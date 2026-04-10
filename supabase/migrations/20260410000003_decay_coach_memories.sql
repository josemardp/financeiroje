-- Sprint 3 — T3.2: Decaimento gradual de ai_coach_memory
-- observations sem reforço >45 dias e concerns >30 dias perdem 1 ponto/ciclo
-- preferences e value_alignment NUNCA decaem (são identidade do usuário)

CREATE OR REPLACE FUNCTION public.decay_stale_coach_memories() RETURNS void AS $$
BEGIN
  -- Observations sem reforço há >45 dias: -1 relevância por ciclo diário, mínimo 1
  UPDATE public.ai_coach_memory
  SET relevance = LEAST(10, GREATEST(1, relevance - 1))
  WHERE memory_type        = 'observation'
    AND last_reinforced_at < now() - interval '45 days'
    AND relevance          > 1
    AND superseded_by      IS NULL;

  -- Concerns não reforçados há >30 dias: mesmo mecanismo
  UPDATE public.ai_coach_memory
  SET relevance = LEAST(10, GREATEST(1, relevance - 1))
  WHERE memory_type        = 'concern'
    AND last_reinforced_at < now() - interval '30 days'
    AND relevance          > 1
    AND superseded_by      IS NULL;

  -- preferences e value_alignment NUNCA decaem (identidade do usuário)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron diário às 04:01 — idempotente (não cria se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-decay-coach-memories'
  ) THEN
    PERFORM cron.schedule(
      'daily-decay-coach-memories',
      '1 4 * * *',
      'SELECT public.decay_stale_coach_memories()'
    );
  END IF;
END;
$$;
