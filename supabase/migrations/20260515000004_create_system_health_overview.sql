-- Plano A.1 — T1.6: View consolidada de observabilidade operacional

CREATE OR REPLACE VIEW public.system_health_overview AS
WITH latest_execution AS (
  SELECT DISTINCT ON (component_name)
    component_name,
    status AS last_status,
    created_at AS last_execution_at,
    duration_ms AS last_duration_ms
  FROM public.system_health_logs
  ORDER BY component_name, created_at DESC
),
errors_24h AS (
  SELECT
    component_name,
    count(*)::integer AS error_count_24h
  FROM public.system_health_logs
  WHERE status = 'error'
    AND created_at >= now() - interval '24 hours'
  GROUP BY component_name
)
SELECT
  latest_execution.component_name,
  latest_execution.last_status,
  latest_execution.last_execution_at,
  latest_execution.last_duration_ms,
  COALESCE(errors_24h.error_count_24h, 0) AS error_count_24h
FROM latest_execution
LEFT JOIN errors_24h
  ON errors_24h.component_name = latest_execution.component_name;
