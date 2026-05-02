-- ============================================================================
-- Migration: Manual 30 Dias Esdra - Progresso de Checklist
-- Aplicar manualmente no SQL Editor do Supabase Dashboard
-- ============================================================================

-- Tabela principal: registra cada check de cada tarefa
CREATE TABLE IF NOT EXISTS manual_30_dias_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day_num int NOT NULL CHECK (day_num >= 1 AND day_num <= 31),
  operador text NOT NULL CHECK (operador IN ('josemar', 'esdra')),
  nivel text NOT NULL CHECK (nivel IN ('minimo_viavel', 'ideal')),
  task_index int NOT NULL,
  cumprido boolean DEFAULT false,
  cumprido_em timestamptz,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, day_num, operador, nivel, task_index)
);

CREATE INDEX IF NOT EXISTS idx_progresso_user_day
  ON manual_30_dias_progresso(user_id, day_num);

-- Tabela de Decisões Empreendedoras
CREATE TABLE IF NOT EXISTS manual_30_dias_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  semana int NOT NULL CHECK (semana >= 1 AND semana <= 4),
  pergunta text NOT NULL,
  decisao text,
  criterio text,
  data_revisao date,
  resultado text,
  acerto_percebido text CHECK (acerto_percebido IN ('acertou', 'parcial', 'errou', 'nao_avaliado')),
  aprendizado text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, semana)
);

-- RLS
ALTER TABLE manual_30_dias_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_30_dias_decisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own progresso"
  ON manual_30_dias_progresso FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users access own decisoes"
  ON manual_30_dias_decisoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_progresso ON manual_30_dias_progresso;
CREATE TRIGGER set_timestamp_progresso
  BEFORE UPDATE ON manual_30_dias_progresso
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_decisoes ON manual_30_dias_decisoes;
CREATE TRIGGER set_timestamp_decisoes
  BEFORE UPDATE ON manual_30_dias_decisoes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Validação
SELECT 'Migration aplicada com sucesso. Tabelas criadas: manual_30_dias_progresso, manual_30_dias_decisoes' as status;
