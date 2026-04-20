-- Sprint 8 — T8.2: find_related_conversations
-- ATENÇÃO: RPC já aplicada manualmente no Supabase e validada.
-- CREATE OR REPLACE é idempotente — formaliza no repo sem re-aplicar.

CREATE OR REPLACE FUNCTION public.find_related_conversations(
  p_scope                public.scope_type,
  p_query_embedding      double precision[],
  p_top_k                integer          DEFAULT 3,
  p_similarity_threshold double precision DEFAULT 0.75,
  p_exclude_recent       interval         DEFAULT interval '3 days'
)
RETURNS TABLE (
  message_id      uuid,
  conversation_id uuid,
  role            public.ai_message_role,
  content         text,
  created_at      timestamptz,
  similarity      double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF array_length(p_query_embedding, 1) <> 384 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.role,
    LEFT(m.content, 500),
    m.created_at,
    1 - (m.content_embedding <=> p_query_embedding::vector(384))
  FROM  public.ai_messages m
  JOIN  public.ai_conversations c ON c.id = m.conversation_id
  WHERE c.user_id  = auth.uid()
    AND m.user_id  = auth.uid()
    AND c.scope    = p_scope
    AND m.content_embedding IS NOT NULL
    AND m.created_at < now() - p_exclude_recent
    AND 1 - (m.content_embedding <=> p_query_embedding::vector(384)) >= p_similarity_threshold
  ORDER BY m.content_embedding <=> p_query_embedding::vector(384)
  LIMIT p_top_k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_related_conversations(
  public.scope_type, double precision[], integer, double precision, interval
) TO authenticated;
