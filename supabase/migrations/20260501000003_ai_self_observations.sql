-- Migration: 20260501000003_ai_self_observations.sql
-- Description: AI Meta-reflection and self-observation storage

CREATE TYPE public.self_observation_type AS ENUM (
  'pattern_stale',
  'context_conflict',
  'calibration_miss',
  'confidence_overreach',
  'other'
);

CREATE TABLE public.ai_self_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  observation_type public.self_observation_type NOT NULL,
  observation TEXT NOT NULL,
  message_id UUID, -- Referência opcional à mensagem que disparou a reflexão
  related_pattern_id UUID REFERENCES public.user_patterns(id) ON DELETE SET NULL,
  related_memory_id UUID REFERENCES public.ai_coach_memory(id) ON DELETE SET NULL,
  user_feedback TEXT CHECK (user_feedback IN ('up', 'down', null)),
  user_feedback_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast retrieval of recent observations per user
CREATE INDEX idx_self_observations_recent ON public.ai_self_observations (user_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_self_observations ENABLE ROW LEVEL SECURITY;

-- Apenas SELECT permitido para o usuário (Insert via Service Role no Edge Function)
CREATE POLICY "Users can view their own self-observations"
  ON public.ai_self_observations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.ai_self_observations IS 'Armazena meta-reflexões da IA sobre seu próprio raciocínio e interações.';
