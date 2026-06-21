-- Sprint S2.4 — Reabilitar RLS em challenges_catalog
-- Padrão idêntico ao achievements_catalog (20260508000003):
-- leitura apenas para authenticated; escrita só via service_role (bypass RLS).

ALTER TABLE public.challenges_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read challenges catalog" ON public.challenges_catalog;
CREATE POLICY "Authenticated can read challenges catalog"
  ON public.challenges_catalog
  FOR SELECT
  TO authenticated
  USING (true);
