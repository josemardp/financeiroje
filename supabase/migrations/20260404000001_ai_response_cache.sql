-- ai_response_cache: cache de respostas da IA Conselheira
-- Evita chamadas redundantes ao provider quando query + contexto financeiro são idênticos

CREATE TABLE IF NOT EXISTS ai_response_cache (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key      text        UNIQUE NOT NULL,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response_text  text        NOT NULL,
  model_used     text        NOT NULL,
  intent         text,
  hit_count      integer     NOT NULL DEFAULT 0,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índice para lookup rápido por cache_key não expirado
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_response_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_response_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_user ON ai_response_cache (user_id, expires_at);

-- RLS: cada usuário acessa apenas o próprio cache
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cache_select_own" ON ai_response_cache
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cache_insert_own" ON ai_response_cache
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cache_update_own" ON ai_response_cache
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "cache_delete_own" ON ai_response_cache
  FOR DELETE USING (user_id = auth.uid());
