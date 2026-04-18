-- Migration: gamification — achievements_catalog, user_achievements, user_streaks
-- Sprint 7 — T7.1: Sistema de Gamificação Adaptativa
-- Baseado em: PLANO_INTELIGENCIA_PESSOAL.md §9.10.1 e §9.10.2
-- Decisões de design:
--   - user_achievements inclui seen_at (controle do toast em T7.4)
--   - achievements_catalog sem RLS (catálogo público de configuração)
--   - window_size configurado por streak_key no cron (T7.2), não nesta migration:
--       'daily_review'    → window_size = 14
--       'all_categorized' → window_size = 14
--       'dizimo_em_dia'   → window_size = 90
--     Os INSERTs iniciais em user_streaks são responsabilidade do edge function
--     evaluate-achievements (T7.2), que usa ON CONFLICT DO NOTHING para idempotência.

-- ─── 1. Catálogo de conquistas (sem RLS — dados públicos de configuração) ──────

CREATE TABLE public.achievements_catalog (
  id          text  PRIMARY KEY,       -- 'mordomo_fiel_3m', 'registrador_30', etc.
  category    text  NOT NULL,          -- 'identidade' | 'processo' | 'consistencia'
  title       text  NOT NULL,
  description text  NOT NULL,
  icon        text,                    -- emoji opcional
  criteria    jsonb NOT NULL           -- regra estruturada para o cron evaluate-achievements
);

-- ─── 2. Conquistas desbloqueadas por usuário ─────────────────────────────────

CREATE TABLE public.user_achievements (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text        NOT NULL REFERENCES public.achievements_catalog(id),
  unlocked_at    timestamptz NOT NULL DEFAULT now(),
  seen_at        timestamptz,          -- NULL = toast ainda não exibido (T7.4)
  evidence       jsonb,                -- snapshot dos dados que provaram o critério
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_recent
  ON public.user_achievements (user_id, unlocked_at DESC);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own achievements"
  ON public.user_achievements FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 3. Streaks suaves (janela móvel — não zeram ao quebrar) ─────────────────

CREATE TABLE public.user_streaks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_key     text        NOT NULL, -- 'daily_review' | 'all_categorized' | 'dizimo_em_dia'
  hits_in_window integer     NOT NULL DEFAULT 0,  -- hits dentro da janela atual
  window_size    integer     NOT NULL DEFAULT 14, -- tamanho da janela em dias (ver comentário de cabeçalho)
  last_hit_at    timestamptz,                     -- último hit registrado pelo cron
  longest_hits   integer     NOT NULL DEFAULT 0,  -- recorde histórico (nunca decrementado)
  UNIQUE (user_id, streak_key)
);

CREATE INDEX idx_user_streaks_user
  ON public.user_streaks (user_id);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own streaks"
  ON public.user_streaks FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 4. Catálogo inicial — 7 conquistas (§9.10.2 do plano) ──────────────────

INSERT INTO public.achievements_catalog (id, category, title, description, icon, criteria) VALUES

-- Identidade: ressoam com valores pessoais (CCB, família, proteção)
('mordomo_fiel_3m',    'identidade', 'Mordomo Fiel',
 '3 meses de dízimo registrado e em dia', '💎',
 '{"type":"recurring_paid","key":"dizimo","months":3}'),

('protetor_da_familia', 'identidade', 'Protetor da Família',
 'Reserva de emergência cobrindo 3+ meses de despesa', '🛡️',
 '{"type":"reserve_coverage","months":3}'),

('semeador',           'identidade', 'Semeador',
 'Doações acima de 5% da renda por 3 meses', '🌱',
 '{"type":"donation_percent","percent":5,"months":3}'),

-- Processo: 100% controladas pelo usuário
('registrador_30',     'processo',   'Registrador Consistente',
 '30 transações registradas no mês', '📝',
 '{"type":"transactions_count","period":"month","count":30}'),

('zero_pendentes',     'processo',   'Casa Arrumada',
 '0 transações pendentes por 7 dias', '🧹',
 '{"type":"zero_pending","days":7}'),

('revisor_semanal',    'processo',   'Revisor Semanal',
 '4 semanas seguidas abrindo a tela de fechamento', '🔍',
 '{"type":"weekly_closing_views","weeks":4}'),

-- Consistência: janela móvel, não zera nunca
('habito_30_de_42',   'consistencia', 'Hábito Estabelecido',
 '30 de 42 dias usando o app', '📅',
 '{"type":"app_usage_window","hits":30,"window":42}');
