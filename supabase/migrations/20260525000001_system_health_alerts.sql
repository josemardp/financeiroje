-- Plano A.1 — Alertas por threshold (system_health)
-- Cria função para emitir alerts quando thresholds são violados + agenda cron diário.

CREATE OR REPLACE FUNCTION public._system_health_primary_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
  FROM public.profiles p
  ORDER BY (p.perfil = 'josemar') DESC, p.created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.emit_system_health_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Bypass RLS para inserir em alerts (cron roda sem auth.uid()).
  PERFORM set_config('row_security', 'off', true);

  v_user_id := public._system_health_primary_user_id();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (l.component_name)
      l.component_name,
      l.component_type,
      l.status,
      l.created_at AS last_execution_at,
      l.duration_ms AS last_duration_ms,
      l.message AS last_message
    FROM public.system_health_logs l
    ORDER BY l.component_name, l.created_at DESC
  ),
  err24 AS (
    SELECT
      l.component_name,
      count(*)::int AS error_count_24h
    FROM public.system_health_logs l
    WHERE l.status = 'error'
      AND l.created_at >= now() - interval '24 hours'
    GROUP BY l.component_name
  ),
  breaches AS (
    SELECT
      t.component_name,
      t.component_type,
      latest.last_execution_at,
      latest.last_duration_ms,
      coalesce(err24.error_count_24h, 0) AS error_count_24h,
      t.max_silent_hours,
      t.max_error_count,
      t.max_duration_ms,
      (
        (t.alert_enabled IS TRUE)
        AND (
          (t.max_silent_hours IS NOT NULL AND (latest.last_execution_at IS NULL OR latest.last_execution_at < now() - (t.max_silent_hours || ' hours')::interval))
          OR (t.max_error_count IS NOT NULL AND coalesce(err24.error_count_24h, 0) > t.max_error_count)
          OR (t.max_duration_ms IS NOT NULL AND latest.last_duration_ms IS NOT NULL AND latest.last_duration_ms > t.max_duration_ms)
        )
      ) AS breached
    FROM public.system_health_thresholds t
    LEFT JOIN latest ON latest.component_name = t.component_name
    LEFT JOIN err24  ON err24.component_name  = t.component_name
  )
  INSERT INTO public.alerts (user_id, tipo, nivel, titulo, mensagem, lido, dados, data_expiracao)
  SELECT
    v_user_id,
    'system_health',
    CASE
      WHEN (b.max_silent_hours IS NOT NULL AND (b.last_execution_at IS NULL OR b.last_execution_at < now() - (b.max_silent_hours || ' hours')::interval))
        THEN 'critical'::alert_level
      WHEN (b.max_error_count IS NOT NULL AND b.error_count_24h > b.max_error_count)
        THEN 'warning'::alert_level
      WHEN (b.max_duration_ms IS NOT NULL AND b.last_duration_ms IS NOT NULL AND b.last_duration_ms > b.max_duration_ms)
        THEN 'warning'::alert_level
      ELSE 'info'::alert_level
    END,
    'Alerta de Saúde do Sistema',
    format(
      'Componente "%s" violou thresholds. Última execução: %s. Duração: %s ms. Erros 24h: %s.',
      b.component_name,
      coalesce(to_char(b.last_execution_at, 'YYYY-MM-DD HH24:MI:SS'), '-'),
      coalesce(b.last_duration_ms::text, '-'),
      b.error_count_24h
    ),
    false,
    jsonb_build_object(
      'component_name', b.component_name,
      'component_type', b.component_type,
      'last_execution_at', b.last_execution_at,
      'last_duration_ms', b.last_duration_ms,
      'error_count_24h', b.error_count_24h,
      'max_silent_hours', b.max_silent_hours,
      'max_error_count', b.max_error_count,
      'max_duration_ms', b.max_duration_ms
    ),
    now() + interval '7 days'
  FROM breaches b
  WHERE b.breached IS TRUE
    -- dedupe simples: não recriar se já existe alerta idêntico não-lido nas últimas 24h
    AND NOT EXISTS (
      SELECT 1
      FROM public.alerts a
      WHERE a.user_id = v_user_id
        AND a.tipo = 'system_health'
        AND a.lido IS FALSE
        AND a.created_at >= now() - interval '24 hours'
        AND (a.dados->>'component_name') = b.component_name
    );

END;
$$;

-- Agenda cron diário 07:05 (horário do banco)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-system-health-alerts'
  ) THEN
    PERFORM cron.schedule(
      'daily-system-health-alerts',
      '5 7 * * *',
      'SELECT public.emit_system_health_alerts()'
    );
  END IF;
END;
$$;

