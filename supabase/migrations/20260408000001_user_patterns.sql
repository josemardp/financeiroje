-- user_patterns: regras aprendidas sobre o comportamento do usuário
-- Alimenta a Captura Inteligente com priors específicos por usuário/escopo

CREATE TYPE pattern_type AS ENUM (
  'merchant_category',          -- "POSTO IPIRANGA" → categoria Combustível
  'description_normalization',  -- "MERCPGO LTDA" → "Mercado Pago"
  'counterparty_alias',         -- "ESDRA A. P." e "Esdra Aparecida" → mesmo alias
  'recurring_amount',           -- "Internet Vivo" → R$ 99,90 todo dia 10
  'category_value_range',       -- "Mercado": p10=50, p50=180, p90=450
  'time_pattern',               -- "manhã útil = trabalho/MEI; noite = pessoal"
  'document_disambiguation'     -- "Sicredi: Solicitante = pagador, não usuário"
);

CREATE TYPE pattern_source AS ENUM (
  'observed',   -- extraído passivamente do histórico
  'corrected',  -- usuário corrigiu OCR (sinal forte)
  'declared'    -- usuário declarou explicitamente na UI
);

CREATE TABLE public.user_patterns (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope           scope_type  NOT NULL DEFAULT 'private',
  pattern_type    pattern_type NOT NULL,
  pattern_key     text        NOT NULL,    -- chave normalizada (lowercase, sem acento)
  pattern_value   jsonb       NOT NULL,    -- payload flexível por tipo
  hit_count       integer     NOT NULL DEFAULT 1,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  confidence      numeric(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  source          pattern_source NOT NULL DEFAULT 'observed',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, pattern_type, pattern_key)
);

CREATE INDEX idx_user_patterns_lookup
  ON public.user_patterns (user_id, scope, pattern_type, confidence DESC);

ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own patterns"
  ON public.user_patterns
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_patterns_updated_at
  BEFORE UPDATE ON public.user_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
