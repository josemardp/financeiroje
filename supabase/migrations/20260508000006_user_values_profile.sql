-- supabase/migrations/20260508000006_user_values_profile.sql
CREATE TABLE public.user_values_profile (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value_key       text NOT NULL,
  description     text NOT NULL,
  priority_level  integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_values_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own values" ON public.user_values_profile 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_values_profile_user_id ON public.user_values_profile(user_id);
