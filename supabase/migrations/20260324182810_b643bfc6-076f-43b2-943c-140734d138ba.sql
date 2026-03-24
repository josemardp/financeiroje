-- PRIORITY 1: Restrict audit_logs INSERT policy
-- Current: any authenticated user can insert (auth.uid() IS NOT NULL) — too permissive
-- Fix: only allow inserts where user_id matches the authenticated user
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;

CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);