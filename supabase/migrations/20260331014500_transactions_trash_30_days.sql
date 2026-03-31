-- =====================================================
-- FinanceAI — Lixeira de Transações (30 dias)
-- Soft delete no backend + restauração + purge definitivo
-- =====================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at
  ON public.transactions (deleted_at)
  WHERE deleted_at IS NOT NULL;

DROP POLICY IF EXISTS "Users can view family transactions" ON public.transactions;
CREATE POLICY "Users can view family transactions"
  ON public.transactions
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR user_id IN (
        SELECT p2.user_id
        FROM public.profiles p1
        JOIN public.profiles p2 ON p1.familia_id = p2.familia_id
        WHERE p1.user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.transactions_soft_delete_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.transaction_force_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;

  IF OLD.deleted_at IS NULL THEN
    UPDATE public.transactions
       SET deleted_at = now(),
           deleted_by = auth.uid(),
           updated_by = COALESCE(auth.uid(), OLD.updated_by)
     WHERE id = OLD.id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS soft_delete_transactions_before_delete ON public.transactions;
CREATE TRIGGER soft_delete_transactions_before_delete
  BEFORE DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_soft_delete_on_delete();

CREATE OR REPLACE FUNCTION public.restore_transaction(p_transaction_id UUID)
RETURNS public.transactions AS $$
DECLARE
  v_row public.transactions;
BEGIN
  UPDATE public.transactions
     SET deleted_at = NULL,
         deleted_by = NULL,
         updated_by = auth.uid()
   WHERE id = p_transaction_id
     AND user_id = auth.uid()
     AND deleted_at IS NOT NULL
     AND deleted_at > now() - interval '30 days'
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_FOUND_OR_NOT_RESTORABLE';
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.hard_delete_transaction(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  PERFORM set_config('app.transaction_force_delete', 'on', true);

  DELETE FROM public.transactions
   WHERE id = p_transaction_id
     AND user_id = auth.uid()
     AND deleted_at IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.purge_expired_deleted_transactions()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.transaction_force_delete', 'on', true);

  DELETE FROM public.transactions
   WHERE user_id = auth.uid()
     AND deleted_at IS NOT NULL
     AND deleted_at <= now() - interval '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_transaction_trash()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  valor NUMERIC,
  tipo public.transaction_type,
  categoria_id UUID,
  categoria_nome TEXT,
  categoria_icone TEXT,
  descricao TEXT,
  data DATE,
  scope public.scope_type,
  data_status public.data_status,
  source_type public.source_type,
  confidence public.confidence_level,
  deleted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  PERFORM public.purge_expired_deleted_transactions();

  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.valor,
    t.tipo,
    t.categoria_id,
    c.nome AS categoria_nome,
    c.icone AS categoria_icone,
    t.descricao,
    t.data,
    t.scope,
    t.data_status,
    t.source_type,
    t.confidence,
    t.deleted_at,
    t.deleted_at + interval '30 days' AS expires_at,
    t.created_at,
    t.updated_at
  FROM public.transactions t
  LEFT JOIN public.categories c ON c.id = t.categoria_id
  WHERE t.user_id = auth.uid()
    AND t.deleted_at IS NOT NULL
    AND t.deleted_at > now() - interval '30 days'
  ORDER BY t.deleted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.restore_transaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_transaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_deleted_transactions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transaction_trash() TO authenticated;
