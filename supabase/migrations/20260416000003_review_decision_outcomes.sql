-- Sprint 5 — T5.4: review_pending_decision_outcomes
-- Cron diário — processa decision_outcomes com resposta registrada e sem review (>30 dias).
-- Preenche observed_result, observed_at, reviewed_after_days e effectiveness_score.
--
-- AVISO DE CALIBRAÇÃO: effectiveness_score serve para calibrar SOMENTE a forma de
-- apresentação de futuros conselhos (tom, timing, granularidade) — nunca o conteúdo
-- factual nem os valores calculados pelo finance-engine.

CREATE OR REPLACE FUNCTION public.review_pending_decision_outcomes() RETURNS void AS $$
DECLARE
  rec                  RECORD;
  snap                 JSONB;
  snap_savings_rate    NUMERIC;
  snap_balance         NUMERIC;
  current_income       NUMERIC;
  current_expense      NUMERIC;
  current_savings_rate NUMERIC;
  delta                NUMERIC;
  base_score           NUMERIC;
  final_score          NUMERIC;
  obs_result           JSONB;
  days_elapsed         INTEGER;
BEGIN
  FOR rec IN
    SELECT *
    FROM public.decision_outcomes
    WHERE user_response IS NOT NULL
      AND observed_at   IS NULL
      AND created_at    < now() - interval '30 days'
  LOOP
    snap := rec.context_snapshot;

    -- Métricas do snapshot (estado no momento da recomendação)
    snap_savings_rate := (snap -> 'resumoConfirmado' ->> 'savingsRate')::NUMERIC;
    snap_balance      := (snap -> 'resumoConfirmado' ->> 'balance')::NUMERIC;

    -- Dados financeiros do mês corrente no escopo da recomendação
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'income'  THEN valor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN tipo = 'expense' THEN valor ELSE 0 END), 0)
    INTO current_income, current_expense
    FROM public.transactions
    WHERE user_id     = rec.user_id
      AND scope       = rec.scope
      AND data_status <> 'suggested'
      AND data >= date_trunc('month', now())
      AND data <  date_trunc('month', now()) + interval '1 month';

    current_savings_rate := CASE
      WHEN current_income > 0
      THEN ROUND(((current_income - current_expense) / current_income) * 100, 2)
      ELSE 0
    END;

    -- Score base: variação da taxa de economia entre snapshot e revisão
    IF snap_savings_rate IS NOT NULL THEN
      delta := current_savings_rate - snap_savings_rate;
      base_score := CASE
        WHEN delta >  5  THEN 0.80
        WHEN delta >  2  THEN 0.65
        WHEN delta > -2  THEN 0.50
        WHEN delta > -5  THEN 0.35
        ELSE                  0.20
      END;
    ELSE
      delta      := NULL;
      base_score := 0.50;  -- sem snapshot suficiente: score neutro
    END IF;

    -- Ajuste por tipo de resposta:
    -- accepted/partial → score positivo indica que seguir o conselho foi benéfico
    -- rejected/ignored → se a situação piorou, o conselho estava certo (inverte contribuição)
    -- postponed        → neutro (não há evidência direcional)
    final_score := CASE
      WHEN rec.user_response IN ('accepted', 'partial') THEN base_score
      WHEN rec.user_response IN ('rejected', 'ignored') THEN GREATEST(0.10, LEAST(1.0, 1.0 - base_score + 0.10))
      ELSE base_score
    END;

    days_elapsed := EXTRACT(DAY FROM now() - rec.created_at)::INTEGER;

    obs_result := jsonb_build_object(
      'snapshot_savings_rate', snap_savings_rate,
      'snapshot_balance',      snap_balance,
      'current_income',        ROUND(current_income,        2),
      'current_expense',       ROUND(current_expense,       2),
      'current_savings_rate',  current_savings_rate,
      'savings_rate_delta',    CASE WHEN delta IS NOT NULL THEN ROUND(delta, 2) ELSE NULL END
    );

    UPDATE public.decision_outcomes
    SET observed_result     = obs_result,
        observed_at         = now(),
        reviewed_after_days = days_elapsed,
        effectiveness_score = ROUND(final_score::NUMERIC, 2)
    WHERE id = rec.id;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron diário às 04:02 (slot distinto do decay às 04:01)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-review-decision-outcomes'
  ) THEN
    PERFORM cron.schedule(
      'daily-review-decision-outcomes',
      '2 4 * * *',
      'SELECT public.review_pending_decision_outcomes()'
    );
  END IF;
END;
$$;
