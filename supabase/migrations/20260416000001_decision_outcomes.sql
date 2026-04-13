-- Sprint 5 — T5.1: decision_outcomes
-- Registra recomendações significativas da IA como hipóteses testáveis.
-- Após 30 dias, o cron de review calcula effectiveness_score com base em dados reais.
--
-- AVISO DE CALIBRAÇÃO: effectiveness_score e aderência histórica calibram SOMENTE
-- a forma de apresentação de futuros conselhos (tom, timing, granularidade) —
-- NUNCA o conteúdo factual nem os valores calculados pelo finance-engine.
--
-- POLÍTICA DE ESCRITA:
-- INSERT: feito exclusivamente pela edge function ai-advisor (service role).
-- UPDATE de user_response/user_response_note: via RPC mark_decision_response (T5.3).
-- Campos effectiveness_score, observed_result, recommendation_payload, context_snapshot
-- NÃO são atualizáveis pelo client — apenas pelo cron de review (service role).

-- ENUMs
CREATE TYPE recommendation_type AS ENUM (
  'antecipar_divida',
  'reforcar_reserva',
  'cortar_recorrente',
  'priorizar_meta',
  'adiar_compra',
  'redistribuir_orcamento',
  'revisar_categoria',
  'outro'
);

CREATE TYPE user_response_type AS ENUM (
  'accepted',   -- usuário marcou "vou seguir"
  'rejected',   -- usuário marcou "não faz sentido"
  'ignored',    -- usuário não interagiu
  'postponed',  -- usuário marcou "depois"
  'partial'     -- usuário seguiu parcialmente
);

-- Tabela principal
CREATE TABLE public.decision_outcomes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope                    scope_type NOT NULL DEFAULT 'private',
  recommendation_type      recommendation_type NOT NULL,
  recommendation_summary   text NOT NULL,   -- frase curta resumindo o conselho
  recommendation_payload   jsonb NOT NULL,  -- detalhes completos (valores, prazos)
  context_snapshot         jsonb NOT NULL,  -- snapshot do FinancialContext na hora
  -- message_id é NULLABLE por design (seção 8.3 do plano: "referência opcional ao turno do chat")
  -- Recomendações geradas fora do contexto de um turno rastreável não devem ser descartadas.
  message_id               uuid,

  user_response            user_response_type,  -- preenchido via RPC mark_decision_response (T5.3)
  user_response_at         timestamptz,
  user_response_note       text,

  observed_result          jsonb,           -- preenchido pelo cron de review (service role)
  observed_at              timestamptz,
  reviewed_after_days      integer,

  effectiveness_score      numeric(3,2),    -- 0-1, calculado pelo cron de review (service role)
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Índice para o cron de review: outcomes pendentes de observação
CREATE INDEX idx_decision_outcomes_pending_review
  ON public.decision_outcomes (user_id, created_at)
  WHERE observed_at IS NULL;

-- Índice para o bloco de aderência histórica por tipo
CREATE INDEX idx_decision_outcomes_by_type
  ON public.decision_outcomes (user_id, recommendation_type, effectiveness_score DESC NULLS LAST);

-- RLS
ALTER TABLE public.decision_outcomes ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário vê apenas seus próprios registros
CREATE POLICY "Users see own decisions"
  ON public.decision_outcomes
  FOR SELECT USING (auth.uid() = user_id);

-- Sem policy de INSERT nem UPDATE no client.
-- INSERT: edge function ai-advisor usa service role (bypassa RLS).
-- UPDATE de user_response: via RPC SECURITY DEFINER mark_decision_response (criado em T5.3).
-- UPDATE de campos de review: cron de review usa service role.
