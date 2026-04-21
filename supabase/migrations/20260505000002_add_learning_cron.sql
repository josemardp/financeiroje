-- Script para criar o cron job
SELECT cron.schedule(
  'process-pattern-learning-queue-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hhedxktueawursnzqixg.functions.supabase.co/v1/process-pattern-learning-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  )
  $$
);
