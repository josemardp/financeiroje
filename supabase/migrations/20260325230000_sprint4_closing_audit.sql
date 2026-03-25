
-- =====================================================
-- FinanceAI Sprint 4 — Fechamento Mensal + Auditoria Forte
-- =====================================================

-- 1. ADIÇÃO DE COLUNAS DE AUDITORIA EM MONTHLY_CLOSINGS
-- (Já existem: mes, ano, status, fechado_em, fechado_por, pendencias, resumo)
-- Adicionando reaberto_em e reaberto_por para rastreabilidade explícita
ALTER TABLE public.monthly_closings ADD COLUMN IF NOT EXISTS reaberto_em TIMESTAMPTZ;
ALTER TABLE public.monthly_closings ADD COLUMN IF NOT EXISTS reaberto_por UUID REFERENCES auth.users(id);
ALTER TABLE public.monthly_closings ADD COLUMN IF NOT EXISTS reabertura_motivo TEXT;

-- 2. FUNÇÃO PARA VALIDAR SE O PERÍODO ESTÁ FECHADO
-- Esta função será usada por triggers em tabelas críticas (transactions, budgets, goals, etc.)
CREATE OR REPLACE FUNCTION public.check_period_closed()
RETURNS TRIGGER AS $$
DECLARE
  period_status public.closing_status;
  v_date DATE;
  v_user_id UUID;
BEGIN
  -- Identificar a data do registro sendo alterado
  IF TG_TABLE_NAME = 'transactions' THEN
    v_date := COALESCE(NEW.data, OLD.data);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'budgets' THEN
    -- Budgets usam mes/ano, convertemos para o primeiro dia do mês para consulta
    v_date := make_date(COALESCE(NEW.ano, OLD.ano), COALESCE(NEW.mes, OLD.mes), 1);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSE
    RETURN NEW; -- Outras tabelas não bloqueiam por período por enquanto
  END IF;

  -- Verificar status do período na tabela monthly_closings
  SELECT status INTO period_status
  FROM public.monthly_closings
  WHERE user_id = v_user_id
    AND mes = extract(month from v_date)
    AND ano = extract(year from v_date);

  -- Se o período estiver fechado, bloquear a operação (exceto se for o sistema ou se houver bypass)
  IF period_status = 'closed' THEN
    RAISE EXCEPTION 'Operação bloqueada: O período %/% está fechado e não permite alterações.', 
      extract(month from v_date), extract(year from v_date)
      USING ERRCODE = 'P0001'; -- Custom error code for "Period Closed"
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. APLICAR TRIGGERS DE TRAVA NAS TABELAS CRÍTICAS
-- Transactions
DROP TRIGGER IF EXISTS tr_lock_closed_period_transactions ON public.transactions;
CREATE TRIGGER tr_lock_closed_period_transactions
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_period_closed();

-- Budgets
DROP TRIGGER IF EXISTS tr_lock_closed_period_budgets ON public.budgets;
CREATE TRIGGER tr_lock_closed_period_budgets
  BEFORE INSERT OR UPDATE OR DELETE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.check_period_closed();

-- 4. MELHORIA NA AUDITORIA (AUDIT_LOGS)
-- Adicionar coluna para contexto da operação (ex: "Fechamento Mensal", "Reabertura")
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS context TEXT;

-- 5. LOG DE EVENTOS DE FECHAMENTO/REABERTURA
-- Trigger específico para a tabela monthly_closings
CREATE OR REPLACE FUNCTION public.log_closing_event()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status = 'open' OR OLD.status = 'reviewing') AND NEW.status = 'closed' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data, context)
    VALUES (auth.uid(), 'CLOSE_PERIOD', 'monthly_closings', NEW.id, to_jsonb(NEW), 'Fechamento Mensal Realizado');
  ELSIF OLD.status = 'closed' AND NEW.status = 'open' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data, context)
    VALUES (auth.uid(), 'REOPEN_PERIOD', 'monthly_closings', NEW.id, to_jsonb(OLD), to_jsonb(NEW), 'Reabertura de Período Auditada');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_audit_closing_events ON public.monthly_closings;
CREATE TRIGGER tr_audit_closing_events
  AFTER UPDATE ON public.monthly_closings
  FOR EACH ROW EXECUTE FUNCTION public.log_closing_event();

-- 6. VIEW DE QUALIDADE DE DADOS (DATA_QUALITY_CENTER)
-- Centraliza as queries de inconsistência para facilitar o consumo pelo Quality Center
CREATE OR REPLACE VIEW public.view_data_quality_summary AS
SELECT 
  user_id,
  extract(month from data) as mes,
  extract(year from data) as ano,
  count(*) filter (where categoria_id IS NULL) as count_sem_categoria,
  count(*) filter (where data_status = 'suggested') as count_sugeridos,
  count(*) filter (where data_status = 'incomplete') as count_incompletos,
  count(*) filter (where data_status = 'inconsistent') as count_inconsistentes
FROM public.transactions
GROUP BY user_id, mes, ano;

COMMENT ON VIEW public.view_data_quality_summary IS 'Resumo de problemas de qualidade por período para o Quality Center.';
