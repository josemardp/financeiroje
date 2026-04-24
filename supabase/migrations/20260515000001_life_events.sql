-- Criar tipo para os eventos de vida
CREATE TYPE public.life_event_type AS ENUM (
  'aniversario',
  'vencimento_fixo',
  'vencimento_variavel',
  'data_importante',
  'outro'
);

-- Tabela de eventos de vida (Calendário de vida real)
CREATE TABLE public.life_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope            public.scope_type NOT NULL DEFAULT 'private',
  event_type       public.life_event_type NOT NULL,
  title            text NOT NULL,
  event_date       date NOT NULL,
  recurrence_type  text CHECK (recurrence_type IN ('yearly','monthly','weekly',NULL)),
  reserve_amount   numeric(10,2),
  notes            text,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca de eventos futuros
CREATE INDEX idx_life_events_upcoming ON public.life_events (user_id, event_date) WHERE active = true;

-- RLS
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own life events" ON public.life_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);