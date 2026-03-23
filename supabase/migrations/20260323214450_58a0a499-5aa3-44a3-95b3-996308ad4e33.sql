
-- Fix audit_logs INSERT policy to be more restrictive
-- The SECURITY DEFINER function handles insertion, but we restrict direct user inserts
DROP POLICY "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
