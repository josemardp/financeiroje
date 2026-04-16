-- Sprint 6 — T6.4: pgvector + coluna merchant_embedding em user_patterns
-- Habilita busca semântica por similaridade de merchants

-- 1. Habilitar extensão pgvector (idempotente)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Adicionar coluna de embedding (nullable — preenchida incrementalmente pelo learn-patterns)
ALTER TABLE public.user_patterns
  ADD COLUMN merchant_embedding vector(384);

-- 3. Índice vetorial para busca por similaridade cosseno
--    Parcial: só para merchant_category (únicos com embedding relevante)
CREATE INDEX idx_patterns_embedding
  ON public.user_patterns
  USING ivfflat (merchant_embedding vector_cosine_ops)
  WHERE pattern_type = 'merchant_category';
