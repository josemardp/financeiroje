-- 1. Criação da tabela com restrições de integridade temporal
CREATE TABLE public.weekly_digests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope        scope_type NOT NULL DEFAULT 'private',
  week_start   date NOT NULL,
  week_end     date NOT NULL,
  content      jsonb NOT NULL,
  seen_at      timestamptz,
  dismissed_at timestamptz,
  dismiss_reason text CHECK (dismiss_reason IN ('this_week')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  
  -- Integridade: week_start deve ser uma segunda-feira (ISO 8601: 1=Segunda, 7=Domingo)
  CONSTRAINT check_week_start_is_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  
  -- Integridade: o período deve cobrir exatamente 7 dias (Segunda a Domingo)
  CONSTRAINT check_week_period_range CHECK (week_end = week_start + 6),

  -- Unicidade: um digest por usuário/escopo por semana
  UNIQUE (user_id, scope, week_start)
);

-- 2. Índices para performance (Dashboard e Histórico)
CREATE INDEX idx_digest_pending
  ON public.weekly_digests (user_id, week_start DESC)
  WHERE seen_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX idx_digest_history
  ON public.weekly_digests (user_id, created_at DESC);

-- 3. Segurança (RLS Granular)
ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

-- O usuário só lê seus próprios dados
CREATE POLICY "Users can select own digests"
  ON public.weekly_digests 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- O usuário só atualiza seus próprios registros (status de leitura/dismiss)
CREATE POLICY "Users can update own digests"
  ON public.weekly_digests 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Comentários para documentação
COMMENT ON COLUMN public.weekly_digests.week_start IS 'Data da segunda-feira de início do período analisado.';
COMMENT ON COLUMN public.weekly_digests.week_end IS 'Data do domingo de encerramento do período analisado.';
