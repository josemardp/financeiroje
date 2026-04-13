-- Sprint 5 — T5.3: RPC mark_decision_response
-- Atualiza apenas os campos de resposta do usuário em decision_outcomes.
-- Campos protegidos (effectiveness_score, observed_result, recommendation_payload,
-- context_snapshot) não são tocados — atualizados exclusivamente pelo cron de review.

CREATE OR REPLACE FUNCTION public.mark_decision_response(
  p_decision_id uuid,
  p_response    user_response_type,
  p_note        text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE public.decision_outcomes
  SET user_response      = p_response,
      user_response_at   = now(),
      user_response_note = p_note
  WHERE id      = p_decision_id
    AND user_id = auth.uid()
    AND user_response IS NULL;  -- idempotente: ignora se já respondido
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
