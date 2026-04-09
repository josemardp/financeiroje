-- capture_learning_events: registro append-only de tudo que a IA sugeriu
-- vs. tudo que o usuário confirmou na Captura Inteligente.
-- Base auditável para replay de aprendizado, métricas de evolução e debug.

CREATE TABLE public.capture_learning_events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope                scope_type  NOT NULL DEFAULT 'private',
  source_type          text        NOT NULL,  -- 'text','audio','photo','ocr','pdf','word','excel'
  raw_input            text,                  -- input bruto (ou hash, se sensível)
  ocr_text             text,                  -- texto extraído pelo OCR (se aplicável)
  ai_suggested_json    jsonb       NOT NULL,  -- o que a IA sugeriu (snapshot completo)
  hypothesis_ranking   jsonb,                 -- top 3 hipóteses alternativas com probabilidades
                                              -- ex: [{"category_id":"abc","prob":0.82},{"category_id":"def","prob":0.13}]
  user_confirmed_json  jsonb       NOT NULL,  -- o que o usuário confirmou após Modo Espelho
  field_diff_json      jsonb       NOT NULL,  -- {campo: {before, after}} dos campos alterados
  accepted_fields      text[]      NOT NULL DEFAULT '{}',  -- campos que ficaram iguais
  corrected_fields     text[]      NOT NULL DEFAULT '{}',  -- campos que foram alterados
  confidence_before    numeric(3,2),
  time_in_mirror_ms    integer,               -- quanto tempo o usuário ficou no Modo Espelho antes de confirmar
  transaction_id       uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_capture_events_user_time
  ON public.capture_learning_events (user_id, created_at DESC);

CREATE INDEX idx_capture_events_corrections
  ON public.capture_learning_events (user_id, source_type)
  WHERE array_length(corrected_fields, 1) > 0;

ALTER TABLE public.capture_learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own capture events"
  ON public.capture_learning_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own capture events"
  ON public.capture_learning_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Apenas o sistema (service_role) pode deletar (retenção 180 dias via cron)
CREATE POLICY "Users cannot delete own capture events"
  ON public.capture_learning_events
  FOR DELETE USING (false);
