-- Migration: 20260506000001_link_feedback_to_self_observations.sql
-- Description: Integra o feedback do usuário com a tabela de meta-reflexão (Sprint 8)

CREATE OR REPLACE FUNCTION public.apply_response_feedback(
  p_message_id  uuid,           -- ID da mensagem avaliada
  p_rating      text,           -- 'up' | 'down'
  p_pattern_ids uuid[],         -- IDs de user_patterns usados na resposta
  p_memory_ids  uuid[],         -- IDs de ai_coach_memory usados na resposta
  p_comment     text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- 1. Lógica legada (Sprint 4)
  IF p_rating = 'up' THEN
    -- Reforça padrões comportamentais usados
    UPDATE public.user_patterns
    SET hit_count    = hit_count + 1,
        confidence   = LEAST(1.0, confidence + 0.05),
        last_seen_at = now()
    WHERE id = ANY(p_pattern_ids)
      AND user_id = auth.uid();

    -- Reforça memórias de coach usadas
    UPDATE public.ai_coach_memory
    SET reinforcement_count = reinforcement_count + 1,
        last_reinforced_at  = now()
    WHERE id = ANY(p_memory_ids)
      AND user_id = auth.uid();

  ELSIF p_rating = 'down' THEN
    -- Diminui confiança dos padrões usados (piso: 0.1)
    UPDATE public.user_patterns
    SET confidence = GREATEST(0.1, confidence - 0.10)
    WHERE id = ANY(p_pattern_ids)
      AND user_id = auth.uid();

    -- Se houver comentário substancial, grava como preference na memória do coach
    IF p_comment IS NOT NULL AND length(p_comment) > 5 THEN
      PERFORM public.upsert_coach_memory(
        auth.uid(),
        'private',
        'preference',
        'feedback_' || md5(p_comment),
        p_comment,
        7,
        NULL
      );
    END IF;
  END IF;

  -- 2. T8.7-B: Propaga o feedback para a meta-reflexão (se existir para esta mensagem)
  UPDATE public.ai_self_observations
  SET user_feedback = p_rating,
      user_feedback_at = now()
  WHERE message_id = p_message_id
    AND user_id = auth.uid();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
