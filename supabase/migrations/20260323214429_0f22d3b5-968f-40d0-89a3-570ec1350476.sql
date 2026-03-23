
-- =====================================================
-- FinanceAI v3.0 — Complete Database Schema
-- =====================================================

-- 1. ENUMS
CREATE TYPE public.data_status AS ENUM ('confirmed', 'suggested', 'incomplete', 'inconsistent', 'missing', 'estimated');
CREATE TYPE public.source_type AS ENUM ('manual', 'voice', 'photo_ocr', 'free_text', 'sms', 'ai_suggestion', 'system_generated');
CREATE TYPE public.scope_type AS ENUM ('private', 'family', 'business');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
CREATE TYPE public.frequency_type AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly');
CREATE TYPE public.alert_level AS ENUM ('critical', 'warning', 'info', 'opportunity');
CREATE TYPE public.loan_type AS ENUM ('consignado', 'pessoal', 'cartao', 'financiamento', 'outro');
CREATE TYPE public.amortization_method AS ENUM ('price', 'sac');
CREATE TYPE public.goal_priority AS ENUM ('alta', 'media', 'baixa');
CREATE TYPE public.document_type AS ENUM ('contracheque', 'recibo_medico', 'recibo_educacao', 'informe_rendimentos', 'das_mei', 'nota_fiscal', 'comprovante', 'outro');
CREATE TYPE public.confidence_level AS ENUM ('alta', 'media', 'baixa');
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'paused');
CREATE TYPE public.closing_status AS ENUM ('open', 'reviewing', 'closed');
CREATE TYPE public.ai_message_role AS ENUM ('user', 'assistant', 'system');

-- 2. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. AUDIT LOGS (created first so triggers can reference it)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
CREATE INDEX idx_audit_logs_table ON public.audit_logs (table_name, created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);

-- Audit log function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  perfil TEXT CHECK (perfil IN ('josemar', 'esdra')),
  familia_id UUID DEFAULT gen_random_uuid(),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Family members can view profiles" ON public.profiles FOR SELECT
  USING (familia_id IN (SELECT familia_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('essencial', 'nao-essencial')) DEFAULT 'essencial',
  icone TEXT DEFAULT '📋',
  cor TEXT DEFAULT '#6B7280',
  e_mei BOOLEAN DEFAULT false,
  limite_mensal NUMERIC(12,2),
  scope scope_type DEFAULT 'private',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view system categories" ON public.categories FOR SELECT USING (is_system = true);
CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id AND is_system = false);
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. LOANS
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor_original NUMERIC(12,2) NOT NULL,
  saldo_devedor NUMERIC(12,2),
  taxa_juros_mensal NUMERIC(8,4),
  cet_anual NUMERIC(8,4),
  parcelas_total INTEGER,
  parcelas_restantes INTEGER,
  valor_parcela NUMERIC(12,2),
  tipo loan_type DEFAULT 'pessoal',
  metodo_amortizacao amortization_method DEFAULT 'price',
  devedor TEXT CHECK (devedor IN ('josemar', 'esdra', 'casal')) DEFAULT 'josemar',
  credor TEXT,
  data_inicio DATE,
  scope scope_type DEFAULT 'private',
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family loans" ON public.loans FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (
    SELECT p2.user_id FROM public.profiles p1 JOIN public.profiles p2 ON p1.familia_id = p2.familia_id WHERE p1.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own loans" ON public.loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loans" ON public.loans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loans" ON public.loans FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_loans AFTER INSERT OR UPDATE OR DELETE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 7. TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor NUMERIC(12,2) NOT NULL,
  tipo transaction_type NOT NULL,
  categoria_id UUID REFERENCES public.categories(id),
  descricao TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  competencia DATE,
  scope scope_type DEFAULT 'private',
  e_mei BOOLEAN DEFAULT false,
  comprovante_url TEXT,
  emprestimo_id UUID REFERENCES public.loans(id),
  data_status data_status DEFAULT 'confirmed',
  source_type source_type DEFAULT 'manual',
  confidence confidence_level DEFAULT 'alta',
  validation_notes TEXT,
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family transactions" ON public.transactions FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (
    SELECT p2.user_id FROM public.profiles p1 JOIN public.profiles p2 ON p1.familia_id = p2.familia_id WHERE p1.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_transactions_user_date ON public.transactions (user_id, data DESC);
CREATE INDEX idx_transactions_categoria ON public.transactions (categoria_id);
CREATE INDEX idx_transactions_scope ON public.transactions (scope);
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 8. RECURRING TRANSACTIONS
CREATE TABLE public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  tipo transaction_type NOT NULL,
  categoria_id UUID REFERENCES public.categories(id),
  frequencia frequency_type DEFAULT 'monthly',
  dia_mes INTEGER CHECK (dia_mes BETWEEN 1 AND 31),
  scope scope_type DEFAULT 'private',
  responsavel TEXT CHECK (responsavel IN ('user', 'partner', 'family', 'mei')) DEFAULT 'user',
  e_mei BOOLEAN DEFAULT false,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family recurring" ON public.recurring_transactions FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (
    SELECT p2.user_id FROM public.profiles p1 JOIN public.profiles p2 ON p1.familia_id = p2.familia_id WHERE p1.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own recurring" ON public.recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring" ON public.recurring_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring" ON public.recurring_transactions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_recurring_updated_at BEFORE UPDATE ON public.recurring_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. BUDGETS
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categories(id),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  valor_planejado NUMERIC(12,2) NOT NULL DEFAULT 0,
  scope scope_type DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, categoria_id, mes, ano)
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. LOAN INSTALLMENTS
CREATE TABLE public.loan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprestimo_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  data_vencimento DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  status TEXT CHECK (status IN ('pendente', 'pago', 'atrasado')) DEFAULT 'pendente',
  data_pagamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own installments" ON public.loan_installments FOR SELECT
  USING (emprestimo_id IN (SELECT id FROM public.loans WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own installments" ON public.loan_installments FOR INSERT
  WITH CHECK (emprestimo_id IN (SELECT id FROM public.loans WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own installments" ON public.loan_installments FOR UPDATE
  USING (emprestimo_id IN (SELECT id FROM public.loans WHERE user_id = auth.uid()));

-- 11. EXTRA AMORTIZATIONS
CREATE TABLE public.extra_amortizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprestimo_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor NUMERIC(12,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  economia_juros_calculada NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.extra_amortizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own amortizations" ON public.extra_amortizations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own amortizations" ON public.extra_amortizations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 12. GOALS
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor_alvo NUMERIC(12,2) NOT NULL,
  valor_atual NUMERIC(12,2) DEFAULT 0,
  prazo DATE,
  prioridade goal_priority DEFAULT 'media',
  para_quem TEXT,
  scope scope_type DEFAULT 'family',
  foto_url TEXT,
  notas TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family goals" ON public.goals FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (
    SELECT p2.user_id FROM public.profiles p1 JOIN public.profiles p2 ON p1.familia_id = p2.familia_id WHERE p1.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_goals AFTER INSERT OR UPDATE OR DELETE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 13. GOAL CONTRIBUTIONS
CREATE TABLE public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor NUMERIC(12,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contributions" ON public.goal_contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contributions" ON public.goal_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 14. SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_servico TEXT NOT NULL,
  valor_mensal NUMERIC(12,2) NOT NULL,
  data_cobranca INTEGER CHECK (data_cobranca BETWEEN 1 AND 31),
  status subscription_status DEFAULT 'active',
  categoria_id UUID REFERENCES public.categories(id),
  scope scope_type DEFAULT 'private',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family subscriptions" ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (
    SELECT p2.user_id FROM public.profiles p1 JOIN public.profiles p2 ON p1.familia_id = p2.familia_id WHERE p1.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. FAMILY VALUES
CREATE TABLE public.family_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categories(id),
  importancia INTEGER DEFAULT 5 CHECK (importancia BETWEEN 1 AND 10),
  scope scope_type DEFAULT 'family',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family values" ON public.family_values FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (
    SELECT p2.user_id FROM public.profiles p1 JOIN public.profiles p2 ON p1.familia_id = p2.familia_id WHERE p1.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own family values" ON public.family_values FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own family values" ON public.family_values FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own family values" ON public.family_values FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_family_values_updated_at BEFORE UPDATE ON public.family_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. DOCUMENTS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  document_type document_type DEFAULT 'outro',
  category TEXT,
  holder TEXT,
  competencia DATE,
  ano_fiscal INTEGER,
  scope scope_type DEFAULT 'private',
  retention_policy TEXT DEFAULT '5_anos_rf',
  linked_entity_type TEXT,
  linked_entity_id UUID,
  dados_extraidos JSONB,
  status_processamento TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 17. HEALTH SCORES
CREATE TABLE public.health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  score_geral NUMERIC(5,2),
  comprometimento_renda NUMERIC(5,2),
  reserva_emergencia NUMERIC(5,2),
  controle_orcamento NUMERIC(5,2),
  adimplencia NUMERIC(5,2),
  regularidade NUMERIC(5,2),
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes, ano)
);
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scores" ON public.health_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scores" ON public.health_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scores" ON public.health_scores FOR UPDATE USING (auth.uid() = user_id);

-- 18. AI CONVERSATIONS
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT,
  contexto TEXT,
  scope scope_type DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON public.ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.ai_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 19. AI MESSAGES
CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role ai_message_role NOT NULL,
  content TEXT NOT NULL,
  contexto_enviado JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.ai_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.ai_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 20. ALERTS
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nivel alert_level DEFAULT 'info',
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lido BOOLEAN DEFAULT false,
  dados JSONB,
  data_expiracao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_alerts_user_unread ON public.alerts (user_id, lido) WHERE lido = false;

-- 21. MONTHLY CLOSINGS
CREATE TABLE public.monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  status closing_status DEFAULT 'open',
  total_receitas NUMERIC(12,2) DEFAULT 0,
  total_despesas NUMERIC(12,2) DEFAULT 0,
  saldo NUMERIC(12,2) DEFAULT 0,
  pendencias JSONB DEFAULT '[]',
  resumo TEXT,
  fechado_em TIMESTAMPTZ,
  fechado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes, ano)
);
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own closings" ON public.monthly_closings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own closings" ON public.monthly_closings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own closings" ON public.monthly_closings FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_monthly_closings_updated_at BEFORE UPDATE ON public.monthly_closings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 22. ONBOARDING PROGRESS
CREATE TABLE public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  step_perfil BOOLEAN DEFAULT false,
  step_renda BOOLEAN DEFAULT false,
  step_despesas BOOLEAN DEFAULT false,
  step_dividas BOOLEAN DEFAULT false,
  step_metas BOOLEAN DEFAULT false,
  step_assinaturas BOOLEAN DEFAULT false,
  step_valores BOOLEAN DEFAULT false,
  step_preferencias_ia BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own onboarding" ON public.onboarding_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own onboarding" ON public.onboarding_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own onboarding" ON public.onboarding_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_onboarding_updated_at BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 23. SEED SYSTEM CATEGORIES
INSERT INTO public.categories (nome, tipo, icone, cor, e_mei, is_system) VALUES
  ('Alimentação', 'essencial', '🍽️', '#EF4444', false, true),
  ('Transporte', 'essencial', '🚗', '#F97316', false, true),
  ('Saúde', 'essencial', '🏥', '#10B981', false, true),
  ('Educação', 'essencial', '📚', '#3B82F6', false, true),
  ('Moradia', 'essencial', '🏠', '#8B5CF6', false, true),
  ('Vestuário', 'nao-essencial', '👔', '#EC4899', false, true),
  ('Lazer', 'nao-essencial', '🎮', '#F59E0B', false, true),
  ('Serviços Financeiros', 'essencial', '🏦', '#6366F1', false, true),
  ('Parcelas', 'essencial', '💳', '#14B8A6', false, true),
  ('Previdência', 'essencial', '🛡️', '#0EA5E9', false, true),
  ('Esdra Cosméticos (MEI)', 'essencial', '💄', '#D946EF', true, true),
  ('Outros', 'nao-essencial', '📋', '#6B7280', false, true),
  ('Salário', 'essencial', '💰', '#22C55E', false, true),
  ('Renda MEI', 'essencial', '💼', '#A855F7', true, true);

-- 24. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
CREATE POLICY "Users can view own docs storage" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own docs storage" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own docs storage" ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
