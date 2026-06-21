-- Sprint S2.2 — REVOKE EXECUTE nas funções SECURITY DEFINER de system_health_alerts
-- Sem revoke, qualquer role (incl. anon) pode invocar diretamente estas funções,
-- que rodam com privilégios de owner e uma delas faz bypass de RLS.
-- Chamadas legítimas são feitas pelo pg_cron (roda como superuser/postgres).

REVOKE EXECUTE ON FUNCTION public._system_health_primary_user_id()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.emit_system_health_alerts()
  FROM PUBLIC, anon, authenticated;
