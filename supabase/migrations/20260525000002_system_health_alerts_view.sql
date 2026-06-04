-- Plano A.1 - T1.8: view de alertas e thresholds de observabilidade.
-- Complementa 20260525000001_system_health_alerts.sql, que emite alerts via cron.

CREATE OR REPLACE VIEW public.system_health_alerts AS
SELECT
    t.component_name,
    t.component_type,
    o.last_status,
    o.last_execution_at,
    o.last_duration_ms,
    COALESCE(o.error_count_24h, 0) AS error_count_24h,
    t.max_silent_hours,
    t.max_error_count,
    t.max_duration_ms,
    (
        t.max_error_count IS NOT NULL
        AND COALESCE(o.error_count_24h, 0) > t.max_error_count
    ) AS is_recurring_error,
    (
        t.max_duration_ms IS NOT NULL
        AND o.last_duration_ms IS NOT NULL
        AND o.last_duration_ms > t.max_duration_ms
    ) AS is_high_latency,
    (
        t.max_silent_hours IS NOT NULL
        AND (
            o.last_execution_at IS NULL
            OR o.last_execution_at < now() - (t.max_silent_hours * interval '1 hour')
        )
    ) AS is_operational_silence,
    CASE
        WHEN (
            t.max_error_count IS NOT NULL
            AND COALESCE(o.error_count_24h, 0) > t.max_error_count
        ) OR (
            t.max_duration_ms IS NOT NULL
            AND o.last_duration_ms IS NOT NULL
            AND o.last_duration_ms > t.max_duration_ms
        ) OR (
            t.max_silent_hours IS NOT NULL
            AND (
                o.last_execution_at IS NULL
                OR o.last_execution_at < now() - (t.max_silent_hours * interval '1 hour')
            )
        )
        THEN 'alert'
        WHEN o.last_status = 'error' THEN 'warning'
        ELSE 'healthy'
    END AS alert_status
FROM public.system_health_thresholds t
LEFT JOIN public.system_health_overview o ON t.component_name = o.component_name
WHERE t.alert_enabled IS TRUE;

INSERT INTO public.system_health_thresholds
    (component_name, component_type, max_silent_hours, max_error_count, max_duration_ms)
VALUES
    ('ai-advisor:stream-started', 'edge_function', 24, 10, 30000),
    ('evaluate-achievements:batch', 'edge_function', 25, 1, 60000),
    ('learn-patterns:incremental', 'edge_function', 1, 5, 15000),
    ('generate-weekly-digest', 'edge_function', 170, 1, 120000)
ON CONFLICT (component_name) DO UPDATE SET
    component_type = EXCLUDED.component_type,
    max_silent_hours = EXCLUDED.max_silent_hours,
    max_error_count = EXCLUDED.max_error_count,
    max_duration_ms = EXCLUDED.max_duration_ms,
    alert_enabled = true,
    updated_at = now();
