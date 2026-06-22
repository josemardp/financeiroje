-- Sprint H.1 — Painel Empreendedor Esdra Cosméticos
-- Cria as 5 tabelas base com RLS e índices.

-- Função shared de updated_at (idempotente)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────
-- 1. esdra_compromissos_diarios
-- ─────────────────────────────────────────────
CREATE TABLE esdra_compromissos_diarios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) NOT NULL,
  data                date NOT NULL,
  operador            text NOT NULL CHECK (operador IN ('josemar', 'esdra')),
  bloco               text NOT NULL,
  descricao           text NOT NULL,
  nivel               text NOT NULL CHECK (nivel IN ('minimo_viavel', 'ideal')),
  tempo_estimado_min  int,
  status              text DEFAULT 'pendente' CHECK (status IN ('pendente', 'cumprido', 'pulado')),
  observacoes         text,
  ordem               int DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_compromissos_data_user ON esdra_compromissos_diarios(user_id, data);

ALTER TABLE esdra_compromissos_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own compromissos"
  ON esdra_compromissos_diarios FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_compromissos_updated_at
  BEFORE UPDATE ON esdra_compromissos_diarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 2. esdra_kpis_semanais
-- ─────────────────────────────────────────────
CREATE TABLE esdra_kpis_semanais (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid REFERENCES auth.users(id) NOT NULL,
  semana_inicio             date NOT NULL,
  semana_fim                date NOT NULL,
  faturamento_total         numeric(10,2),
  numero_pedidos            int,
  ticket_medio              numeric(10,2) GENERATED ALWAYS AS (
    CASE WHEN numero_pedidos > 0
      THEN faturamento_total / numero_pedidos
      ELSE 0
    END
  ) STORED,
  clientes_ativas_mes       int,
  clientes_reativadas_mes   int,
  capital_liquidado_estoque numeric(10,2),
  visitas_site              int,
  observacoes               text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  UNIQUE(user_id, semana_inicio)
);

ALTER TABLE esdra_kpis_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own kpis"
  ON esdra_kpis_semanais FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_kpis_updated_at
  BEFORE UPDATE ON esdra_kpis_semanais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 3. esdra_decisoes
-- ─────────────────────────────────────────────
CREATE TABLE esdra_decisoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) NOT NULL,
  data_decisao        date NOT NULL,
  semana_referencia   int,
  pergunta            text NOT NULL,
  decisao             text,
  criterio            text,
  data_revisao        date,
  resultado           text,
  acerto_percebido    text CHECK (acerto_percebido IN ('acertou', 'parcial', 'errou', 'nao_avaliado')),
  aprendizado         text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE esdra_decisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own decisoes"
  ON esdra_decisoes FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_decisoes_updated_at
  BEFORE UPDATE ON esdra_decisoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 4. esdra_clientes
-- ─────────────────────────────────────────────
CREATE TABLE esdra_clientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) NOT NULL,
  nome            text NOT NULL,
  telefone        text,
  cidade          text,
  aniversario     date,
  ultima_compra   date,
  ticket_medio    numeric(10,2),
  marca_favorita  text,
  categoria       text CHECK (categoria IN ('vip', 'ativa', 'inativa', 'nova')),
  observacoes     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_clientes_user_categoria ON esdra_clientes(user_id, categoria);

ALTER TABLE esdra_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own clientes"
  ON esdra_clientes FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON esdra_clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 5. esdra_estoque
-- ─────────────────────────────────────────────
CREATE TABLE esdra_estoque (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) NOT NULL,
  sku             text,
  marca           text NOT NULL,
  produto         text NOT NULL,
  custo_unitario  numeric(10,2),
  preco_venda     numeric(10,2),
  quantidade      int DEFAULT 0,
  validade        date,
  ultima_venda    date,
  margem_pct      numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN preco_venda > 0
      THEN ((preco_venda - custo_unitario) / preco_venda) * 100
      ELSE 0
    END
  ) STORED,
  curva_abc       text CHECK (curva_abc IN ('A', 'B', 'C', 'NA')),
  observacoes     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_estoque_user_marca ON esdra_estoque(user_id, marca);

ALTER TABLE esdra_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own estoque"
  ON esdra_estoque FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_estoque_updated_at
  BEFORE UPDATE ON esdra_estoque
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
