-- Security hardening:
-- - fix mutable search_path on client-exposed SECURITY DEFINER RPCs

CREATE OR REPLACE FUNCTION public.apply_response_feedback(
  p_message_id  uuid,
  p_rating      text,
  p_pattern_ids uuid[],
  p_memory_ids  uuid[],
  p_comment     text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Legacy feedback logic
  IF p_rating = 'up' THEN
    UPDATE public.user_patterns
    SET hit_count    = hit_count + 1,
        confidence   = LEAST(1.0, confidence + 0.05),
        last_seen_at = now()
    WHERE id = ANY(p_pattern_ids)
      AND user_id = auth.uid();

    UPDATE public.ai_coach_memory
    SET reinforcement_count = reinforcement_count + 1,
        last_reinforced_at  = now()
    WHERE id = ANY(p_memory_ids)
      AND user_id = auth.uid();

  ELSIF p_rating = 'down' THEN
    UPDATE public.user_patterns
    SET confidence = GREATEST(0.1, confidence - 0.10)
    WHERE id = ANY(p_pattern_ids)
      AND user_id = auth.uid();

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

  -- T8.7-B: propagate feedback to self observations when linked to the message
  UPDATE public.ai_self_observations
  SET user_feedback = p_rating,
      user_feedback_at = now()
  WHERE message_id = p_message_id
    AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_decision_response(
  p_decision_id uuid,
  p_response    user_response_type,
  p_note        text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.decision_outcomes
  SET user_response      = p_response,
      user_response_at   = now(),
      user_response_note = p_note
  WHERE id      = p_decision_id
    AND user_id = auth.uid()
    AND user_response IS NULL;
END;
$$;
