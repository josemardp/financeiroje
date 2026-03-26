
-- Add missing columns to monthly_closings
ALTER TABLE public.monthly_closings
  ADD COLUMN IF NOT EXISTS reaberto_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reaberto_por uuid,
  ADD COLUMN IF NOT EXISTS reabertura_motivo text;

-- Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'other',
  valor_aquisicao numeric NOT NULL DEFAULT 0,
  valor_atual numeric NOT NULL DEFAULT 0,
  data_aquisicao date,
  detalhes jsonb,
  instituicao text,
  liquidez text,
  vencimento date,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.assets FOR DELETE USING (auth.uid() = user_id);

-- Create asset_valuations table
CREATE TABLE IF NOT EXISTS public.asset_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own valuations" ON public.asset_valuations FOR SELECT
  USING (asset_id IN (SELECT id FROM public.assets WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own valuations" ON public.asset_valuations FOR INSERT
  WITH CHECK (asset_id IN (SELECT id FROM public.assets WHERE user_id = auth.uid()));

-- Create mei_settings table
CREATE TABLE IF NOT EXISTS public.mei_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ano_referencia integer NOT NULL,
  limite_anual numeric NOT NULL DEFAULT 81000,
  alerta_threshold_percent numeric DEFAULT 80,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, ano_referencia)
);

ALTER TABLE public.mei_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mei_settings" ON public.mei_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mei_settings" ON public.mei_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mei_settings" ON public.mei_settings FOR UPDATE USING (auth.uid() = user_id);

-- Add context column to audit_logs if missing
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS context text;

-- Add saldo_atual computed column support for accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS saldo_atual numeric DEFAULT 0;
