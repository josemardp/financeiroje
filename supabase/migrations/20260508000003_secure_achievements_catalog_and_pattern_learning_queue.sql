-- Security hardening:
-- - enable RLS on achievements_catalog and allow read only for authenticated users
-- - enable RLS on pattern_learning_queue and block direct client access
-- - restrict queue RPCs to service_role only

ALTER TABLE public.achievements_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read achievements catalog" ON public.achievements_catalog;
CREATE POLICY "Authenticated can read achievements catalog"
  ON public.achievements_catalog
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.pattern_learning_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No access for clients" ON public.pattern_learning_queue;
CREATE POLICY "No access for clients"
  ON public.pattern_learning_queue
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.pattern_learning_queue FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_pattern_learning_batch(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_queue_attempts(uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pattern_learning_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_queue_attempts(uuid[], text) TO service_role;
