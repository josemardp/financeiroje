-- =====================================================
-- FinanceAI Sprint 7 — Assinaturas, Dívidas Premium e Calendário
-- =====================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS frequency public.frequency_type DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS billing_day INTEGER,
  ADD COLUMN IF NOT EXISTS next_charge_date DATE,
  ADD COLUMN IF NOT EXISTS renewal_date DATE,
  ADD COLUMN IF NOT EXISTS annual_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS detection_method TEXT,
  ADD COLUMN IF NOT EXISTS last_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS last_charge_date DATE;

UPDATE public.subscriptions
SET
  frequency = COALESCE(frequency, 'monthly'),
  billing_day = COALESCE(billing_day, data_cobranca),
  annual_amount = COALESCE(annual_amount, valor_mensal * 12),
  origin = COALESCE(origin, 'manual'),
  detection_method = COALESCE(detection_method, 'cadastro_manual')
WHERE true;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_scope_status
  ON public.subscriptions (user_id, scope, status);

CREATE INDEX IF NOT EXISTS idx_loans_user_scope_active
  ON public.loans (user_id, scope, ativo);

CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_scope_active
  ON public.recurring_transactions (user_id, scope, ativa);
