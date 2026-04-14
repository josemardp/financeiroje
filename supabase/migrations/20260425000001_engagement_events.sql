-- Sprint 6 — T6.1: Telemetria de engajamento comportamental
-- Registra eventos de interação do usuário para alimentar analyze-behavioral-patterns

CREATE TABLE public.user_engagement_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  -- 'screen_view', 'screen_exit', 'time_on_page', 'alert_dismissed',
  -- 'insight_liked', 'insight_disliked', 'transaction_reopened',
  -- 'field_hovered', 'mirror_hesitation', 'goal_inspected',
  -- 'loan_inspected', 'recurring_inspected'
  target_id    text,
  context_data jsonb NOT NULL DEFAULT '{}',
  -- ex: { dayOfWeek: 5, hourOfDay: 23, screenName: "Loans", durationMs: 45000 }
  scope        scope_type NOT NULL DEFAULT 'private',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_engagement_user_time
  ON public.user_engagement_events (user_id, event_type, created_at DESC);

CREATE INDEX idx_engagement_recent
  ON public.user_engagement_events (user_id, created_at DESC);

ALTER TABLE public.user_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own events"
  ON public.user_engagement_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own events"
  ON public.user_engagement_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
