-- ai_coach_memory: memória comportamental persistente da IA Coach
-- Armazena observações comportamentais extraídas das conversas ao longo do tempo

CREATE TABLE IF NOT EXISTS ai_coach_memory (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope       text        NOT NULL DEFAULT 'private',
  content     text        NOT NULL,
  relevance   integer     NOT NULL DEFAULT 5 CHECK (relevance BETWEEN 1 AND 10),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_memory_user ON ai_coach_memory (user_id, scope, created_at DESC);

ALTER TABLE ai_coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_memory_own" ON ai_coach_memory
  FOR ALL USING (user_id = auth.uid());
