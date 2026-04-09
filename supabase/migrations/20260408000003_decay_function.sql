-- Função executada pelo cron diário antes da varredura completa

CREATE OR REPLACE FUNCTION public.decay_stale_patterns() RETURNS void AS $$
BEGIN
  -- Padrões observados sem reforço há >30 dias perdem 0.05 de confidence
  UPDATE public.user_patterns
  SET confidence = GREATEST(0.1, confidence - 0.05),
      updated_at = now()
  WHERE source = 'observed'
    AND last_seen_at < now() - interval '30 days'
    AND confidence > 0.1;

  -- Padrões com confidence muito baixa e sem uso há 90d são apagados
  -- (apenas observed; corrected e declared nunca são apagados automaticamente)
  DELETE FROM public.user_patterns
  WHERE source = 'observed'
    AND confidence < 0.2
    AND last_seen_at < now() - interval '90 days';

  -- Retenção de capture_learning_events: 180 dias
  DELETE FROM public.capture_learning_events
  WHERE created_at < now() - interval '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
