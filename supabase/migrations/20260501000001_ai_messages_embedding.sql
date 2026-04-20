-- Sprint 8 — T8.1: ai_messages_embedding + edge function embed-ai-messages
-- Pré-requisito: pgvector já habilitado no Sprint 6.

ALTER TABLE public.ai_messages
  ADD COLUMN content_embedding vector(384),
  ADD COLUMN embedded_at timestamptz,
  ADD COLUMN embedding_version text;

CREATE INDEX idx_ai_messages_embedding
  ON public.ai_messages
  USING ivfflat (content_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE content_embedding IS NOT NULL;

CREATE INDEX idx_ai_messages_pending_embedding
  ON public.ai_messages (created_at)
  WHERE content_embedding IS NULL AND length(content) > 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'embed-ai-messages-every-15-min'
  ) THEN
    PERFORM cron.schedule(
      'embed-ai-messages-every-15-min',
      '*/15 * * * *',
      $sql$
        SELECT net.http_post(
          url := 'https://hhedxktueawursnzqixg.supabase.co/functions/v1/embed-ai-messages',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
          ),
          body := '{}'::jsonb
        );
      $sql$
    );
  END IF;
END;
$$;
