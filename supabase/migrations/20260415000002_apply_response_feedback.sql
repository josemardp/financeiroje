-- Sprint 4 — T4.2: RPC apply_response_feedback
-- Recebe avaliação do usuário sobre uma resposta da IA Conselheira e:
--   👍 up   → reforça user_patterns e ai_coach_memory usados naquela resposta
--   👎 down → diminui confidence dos padrões; comentário (se > 5 chars) vira preference

CREATE OR REPLACE FUNCTION public.apply_response_feedback(
  p_message_id  uuid,           -- ID da mensagem avaliada (correlação futura)
  p_rating      text,           -- 'up' | 'down'
  p_pattern_ids uuid[],         -- IDs de user_patterns usados na resposta
  p_memory_ids  uuid[],         -- IDs de ai_coach_memory usados na resposta
  p_comment     text DEFAULT NULL
) RETURNS void AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
