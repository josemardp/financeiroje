-- Sprint S3.4 — Retenção de telemetria: purga automática de system_health_logs
-- Implementa o TODO de T1.3 em 20260515000003_system_health_infrastructure.sql:63-64
-- Mantém 30 dias de histórico; cron roda às 04:30 diariamente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-purge-health-logs'
  ) THEN
    PERFORM cron.schedule(
      'daily-purge-health-logs',
      '30 4 * * *',
      'DELETE FROM public.system_health_logs WHERE created_at < now() - interval ''30 days'''
    );
  END IF;
END;
$$;
