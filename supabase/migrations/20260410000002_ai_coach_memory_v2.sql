-- Sprint 3 — T3.1: Evolução de ai_coach_memory
-- Adiciona tipos semânticos, deduplicação por pattern_key, reforço e expiração diferenciada
-- Registros existentes: memory_type='observation', reinforcement_count=1, last_reinforced_at=now()
-- pattern_key NULL em registros antigos — não participam de deduplicação (IS NOT DISTINCT FROM)

-- 1. Enum de tipos de memória
CREATE TYPE public.coach_memory_type AS ENUM (
  'observation',      -- padrão observado em conversa (TTL 60 dias)
  'preference',       -- como o usuário gosta de receber feedback (permanente)
  'concern',          -- preocupação ativa que deve voltar à tona (TTL 30 dias)
  'goal_context',     -- contexto de meta/decisão importante (TTL 180 dias)
  'value_alignment'   -- valor pessoal/identidade que orienta decisões (permanente)
);

-- 2. Novos campos — todos com DEFAULT seguro para registros existentes
ALTER TABLE public.ai_coach_memory
  ADD COLUMN memory_type        public.coach_memory_type NOT NULL DEFAULT 'observation',
  ADD COLUMN pattern_key        text,
  ADD COLUMN reinforcement_count integer NOT NULL DEFAULT 1,
  ADD COLUMN last_reinforced_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN expires_at         timestamptz,
  ADD COLUMN superseded_by      uuid REFERENCES public.ai_coach_memory(id);

-- 3. Índice parcial para leituras de memórias ativas (filtra expiradas e superseded)
CREATE INDEX idx_coach_memory_active
  ON public.ai_coach_memory (user_id, scope, memory_type, last_reinforced_at DESC)
  WHERE superseded_by IS NULL;

-- 4. Índice em pattern_key para lookups de deduplicação
CREATE INDEX idx_coach_memory_pattern_key
  ON public.ai_coach_memory (user_id, scope, memory_type, pattern_key)
  WHERE superseded_by IS NULL;

-- 5. Função upsert com reforço semântico
--    Se pattern_key já existe (IS NOT DISTINCT FROM — trata NULL corretamente):
--      incrementa reinforcement_count, atualiza content e relevance (capped em 10)
--    Se não existe: insere novo registro com TTL opcional
CREATE OR REPLACE FUNCTION public.upsert_coach_memory(
  p_user_id     uuid,
  p_scope       public.scope_type,
  p_memory_type public.coach_memory_type,
  p_pattern_key text,
  p_content     text,
  p_relevance   integer,
  p_ttl_days    integer DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id          uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.ai_coach_memory
  WHERE user_id      = p_user_id
    AND scope         = p_scope::text
    AND memory_type   = p_memory_type
    AND pattern_key   IS NOT DISTINCT FROM p_pattern_key
    AND superseded_by IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.ai_coach_memory
    SET reinforcement_count = reinforcement_count + 1,
        last_reinforced_at  = now(),
        relevance           = LEAST(10, GREATEST(relevance, p_relevance)),
        content             = p_content
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  ELSE
    INSERT INTO public.ai_coach_memory
      (user_id, scope, memory_type, pattern_key, content, relevance, expires_at)
    VALUES
      (p_user_id, p_scope::text, p_memory_type, p_pattern_key, p_content,
       LEAST(10, GREATEST(1, p_relevance)),
       CASE WHEN p_ttl_days IS NOT NULL
            THEN now() + (p_ttl_days || ' days')::interval
            ELSE NULL
       END)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
