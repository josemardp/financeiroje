-- Migration: behavioral_tags
-- Sprint 6 — T6.6: Detecção de padrões comportamentais profundos
-- Baseado em: PLANO_INTELIGENCIA_PESSOAL.md §9.7
-- Ajuste: coluna scope adicionada para isolamento entre escopos (coerência com user_patterns)

CREATE TABLE public.behavioral_tags (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope           scope_type   NOT NULL DEFAULT 'private',
  tag_key         text         NOT NULL,
  intensity       numeric(3,2) NOT NULL CHECK (intensity BETWEEN 0 AND 1),
  confidence      numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence        jsonb        NOT NULL,
  detected_at     timestamptz  NOT NULL DEFAULT now(),
  expires_at      timestamptz  NOT NULL DEFAULT (now() + interval '60 days'),
  UNIQUE (user_id, scope, tag_key)
);

CREATE INDEX idx_behavioral_tags_active
  ON public.behavioral_tags (user_id, scope, intensity DESC, expires_at);

ALTER TABLE public.behavioral_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tags"
  ON public.behavioral_tags FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
