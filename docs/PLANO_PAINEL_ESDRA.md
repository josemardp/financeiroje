# PLANO TÉCNICO — PAINEL EMPREENDEDOR (MÓDULO ESDRA COSMÉTICOS)

**Versão:** 2.0
**Projeto:** FinanceiroJe (extensão modular)
**Stack:** React + TypeScript + Vite + Supabase + Vercel
**Repo:** `josemardp/financeiroje`
**Data início:** Maio 2026
**Padrão:** seguir convenções do `PLANO_INTELIGENCIA_PESSOAL.md` v1.3 e `PLANO_COMPLEMENTAR_INTELIGENCIA.md` v1.0

**Mudança v2.0 (02/05/2026):** expansão de 4 para 6 sprints. Acrescentados Sprint 5 (Personal Intelligence Layer Esdra) e Sprint 6 (AI Conselheiro Esdra Cosméticos). Esses sprints transformam o Painel Empreendedor de "sistema operacional" em "consultor estratégico permanente com memória do negócio", aproveitando massivamente a PIL pessoal (Sprints 8-10 do plano complementar) já em produção.

**Marco anterior à v2.0 (02/05/2026):** Manual 30 Dias HTML criado e deployado em `public/manual/index.html`. Migrations `manual_30_dias_progresso` e `manual_30_dias_decisoes` aplicadas no Supabase. Sistema operacional para Josemar começou. Estes ativos são reaproveitados pelas Sprints 1-6 deste plano.

---

## OBJETIVO

Construir um módulo "Painel Empreendedor" dentro do FinanceiroJe que sirva como interface digital do `MANUAL_30_DIAS_ESDRA.md`. Isto é, migrar gradualmente o trilho operacional em planilha (Google Sheets) para sistema próprio, integrado aos dados financeiros já existentes no FinanceiroJe.

**Princípio diretor:** *toda hora de programação precisa ter vínculo direto com vender mais, vender com mais margem, ou liberar tempo da Esdra. Se a feature não passa nesse teste, ela não entra agora.*

---

## ARQUITETURA GERAL

### Escopo do módulo

```
FinanceiroJe (existente)
├── Pessoal (existente)
├── MEI (existente)
└── Esdra Cosméticos (existente, expandir)
    └── [NOVO] Painel Empreendedor
        ├── Hoje (execução diária)
        ├── Semana (planejamento + retro)
        ├── Métricas (KPIs)
        └── Decisões (registro + revisão)
```

### Princípios de integração

1. **Não duplicar dados.** Faturamento da aba `Métricas` lê do mesmo store financeiro existente. Esdra lança venda uma vez, aparece nos dois módulos.
2. **Persistência via Supabase.** Tabelas novas, RLS configurado, scoped pelo `user_id`.
3. **Migrations manuais via SQL Editor da web.** Nunca CLI. (Conforme padrão consolidado em sessões anteriores.)
4. **Compatibilidade com Personal Intelligence Layer.** Estruturar para que o AI Advisor possa, no futuro, ler o histórico de decisões e dar conselhos contextualizados.

---

## ESQUEMA DE DADOS (Supabase)

### Tabela 1: `esdra_compromissos_diarios`

Representa cada compromisso (tarefa) do dia. Carregada inicialmente via seed do manual de 30 dias.

```sql
CREATE TABLE esdra_compromissos_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  data date NOT NULL,
  operador text NOT NULL CHECK (operador IN ('josemar', 'esdra')),
  bloco text NOT NULL,
  descricao text NOT NULL,
  nivel text NOT NULL CHECK (nivel IN ('minimo_viavel', 'ideal')),
  tempo_estimado_min int,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'cumprido', 'pulado')),
  observacoes text,
  ordem int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_compromissos_data_user ON esdra_compromissos_diarios(user_id, data);
ALTER TABLE esdra_compromissos_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own compromissos"
  ON esdra_compromissos_diarios FOR ALL
  USING (auth.uid() = user_id);
```

### Tabela 2: `esdra_kpis_semanais`

```sql
CREATE TABLE esdra_kpis_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  faturamento_total numeric(10,2),
  numero_pedidos int,
  ticket_medio numeric(10,2) GENERATED ALWAYS AS (
    CASE WHEN numero_pedidos > 0
    THEN faturamento_total / numero_pedidos
    ELSE 0 END
  ) STORED,
  clientes_ativas_mes int,
  clientes_reativadas_mes int,
  capital_liquidado_estoque numeric(10,2),
  visitas_site int,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, semana_inicio)
);

ALTER TABLE esdra_kpis_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own kpis"
  ON esdra_kpis_semanais FOR ALL
  USING (auth.uid() = user_id);
```

### Tabela 3: `esdra_decisoes`

```sql
CREATE TABLE esdra_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  data_decisao date NOT NULL,
  semana_referencia int,
  pergunta text NOT NULL,
  decisao text,
  criterio text,
  data_revisao date,
  resultado text,
  acerto_percebido text CHECK (acerto_percebido IN ('acertou', 'parcial', 'errou', 'nao_avaliado')),
  aprendizado text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE esdra_decisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own decisoes"
  ON esdra_decisoes FOR ALL
  USING (auth.uid() = user_id);
```

### Tabela 4: `esdra_clientes` (CRM mínimo)

```sql
CREATE TABLE esdra_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  nome text NOT NULL,
  telefone text,
  cidade text,
  aniversario date,
  ultima_compra date,
  ticket_medio numeric(10,2),
  marca_favorita text,
  categoria text CHECK (categoria IN ('vip', 'ativa', 'inativa', 'nova')),
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_clientes_user_categoria ON esdra_clientes(user_id, categoria);
ALTER TABLE esdra_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own clientes"
  ON esdra_clientes FOR ALL
  USING (auth.uid() = user_id);
```

### Tabela 5: `esdra_estoque` (versão simplificada — não tenta ser ERP)

```sql
CREATE TABLE esdra_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  sku text,
  marca text NOT NULL,
  produto text NOT NULL,
  custo_unitario numeric(10,2),
  preco_venda numeric(10,2),
  quantidade int DEFAULT 0,
  validade date,
  ultima_venda date,
  margem_pct numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN preco_venda > 0
    THEN ((preco_venda - custo_unitario) / preco_venda) * 100
    ELSE 0 END
  ) STORED,
  curva_abc text CHECK (curva_abc IN ('A', 'B', 'C', 'NA')),
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_estoque_user_marca ON esdra_estoque(user_id, marca);
ALTER TABLE esdra_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own estoque"
  ON esdra_estoque FOR ALL
  USING (auth.uid() = user_id);
```

---

## DIVISÃO EM SPRINTS

**Cada sprint = 1 a 3 sessões de Claude Code Desktop.** Padrão de execução: 1 sub-task por sessão, commit ao final, próxima sessão começa quando você estiver pronto.

### Visão geral dos sprints

| Sprint | Foco | Sessões estimadas | Dependência |
|---|---|---|---|
| 1 | Estrutura base + tela "Hoje" | 2–3 | Migrations aplicadas no Supabase |
| 2 | Tela "Métricas" + integração financeira | 2 | Sprint 1 concluído |
| 3 | Tela "Decisões" + tela "Semana" | 2 | Sprint 2 concluído |
| 4 | CRM mínimo + estoque + polish | 2–3 | Sprint 3 concluído |
| 5 | **Personal Intelligence Layer Esdra** | 3–4 | Sprint 4 + 60 dias de dados reais acumulados |
| 6 | **AI Conselheiro Esdra Cosméticos** | 3–4 | Sprint 5 concluído + PIL pessoal Sprints 8-10 estáveis |

**Tempo total estimado:** 14 a 20 sessões. Distribuídas em 4-5 meses = ritmo confortável de 1-2 sessões/semana.

**Sprints 1-4** = sistema operacional. **Sprints 5-6** = sistema consultor estratégico permanente com memória do negócio.

---

## SPRINT 1 — Estrutura Base + Tela "Hoje"

**Objetivo:** ter a tela `/painel-esdra/hoje` exibindo os compromissos do dia atual, lendo do Supabase, com checkbox para marcar cumprido/pulado.

### Pré-requisitos

- [ ] Migrations das 5 tabelas aplicadas no Supabase (web SQL Editor)
- [ ] Seed inicial de compromissos do Manual 30 Dias (script Node.js que insere as ~120 linhas do manual)

### Tarefas

#### T1.1 — Criar migrations (1 sessão)

**Entregáveis:**
- Arquivo `supabase/migrations/20260501_esdra_painel_init.sql` no repo (apenas como referência — **aplicação manual via web**).
- 5 tabelas criadas no Supabase com RLS.
- Conferir no Supabase Dashboard que tabelas existem e RLS está ativo.

**Validação:**
- Executar query simples no SQL Editor: `SELECT * FROM esdra_compromissos_diarios;` retorna 0 rows sem erro.

#### T1.2 — Seed do Manual 30 Dias (1 sessão)

**Entregáveis:**
- Script `scripts/seed-manual-esdra.ts` que parseia o `MANUAL_30_DIAS_ESDRA.md` e insere as linhas em `esdra_compromissos_diarios`.
- Cada compromisso tem: data, operador (josemar/esdra), bloco (vendas/atendimento/marketing/etc), descrição, nível (minimo_viavel/ideal), tempo estimado.
- Script é idempotente (rerun não duplica).

**Validação:**
- Após seed: `SELECT count(*) FROM esdra_compromissos_diarios;` retorna ~120 linhas.
- `SELECT * WHERE data = '2026-05-01' AND operador = 'josemar';` retorna os 4 compromissos do Dia 1.

#### T1.3 — Componentes React da tela Hoje (1 sessão)

**Entregáveis:**
- Rota `/painel-esdra/hoje` no React Router.
- Componente `<PainelHoje />` com 4 seções:
  1. **Header:** data, dia da semana, frase do dia (rotativa: bíblica + motivação leve).
  2. **Bloco Josemar:** lista de compromissos do dia agrupados por nível (MV em destaque, Ideal abaixo).
  3. **Bloco Esdra:** mesma estrutura (apenas leitura por enquanto — Esdra não usa o sistema diretamente, mas Josemar precisa visualizar para alinhar).
  4. **Footer:** botão "Fechar Dia" que marca todos os pendentes como `pulado` e gera resumo.
- Estado de cada compromisso: checkbox + dropdown (pendente/cumprido/pulado) + textarea opcional de observações.
- Dados persistidos no Supabase via `useMutation` do TanStack Query (já existente no projeto).
- Indicador visual de progresso: barra com % de MV cumprido + % de Ideal cumprido.

**Validação:**
- Marcar 3 compromissos como cumpridos, recarregar página, estado persistido.
- Trocar para o dia seguinte (botão "Próximo dia"), mostra compromissos do dia 2.

### Definition of Done — Sprint 1

- [ ] 5 migrations aplicadas
- [ ] Seed completo do Manual 30 Dias rodado
- [ ] Tela `/painel-esdra/hoje` funcional com persistência
- [ ] 9+ unit tests cobrindo lógica de progresso e marcação
- [ ] Deploy em produção (Vercel) sem erros
- [ ] Smoke test: marcar dia 1 como concluído, verificar persistência

---

## SPRINT 2 — Tela "Métricas" + Integração Financeira

**Objetivo:** tela `/painel-esdra/metricas` mostrando os 7 KPIs semanais, lendo de `esdra_kpis_semanais` E do módulo financeiro existente para auto-popular faturamento.

### Tarefas

#### T2.1 — View ou função SQL para agregar faturamento por semana

**Entregáveis:**
- Função SQL `get_esdra_faturamento_semana(semana_inicio date)` que retorna o total faturado naquela semana, lendo da tabela financeira existente filtrando por escopo "Esdra Cosméticos".
- Função respeitando RLS (security definer com check de auth.uid()).

**Validação:**
- Executar função no SQL Editor com semana de exemplo, retorna número correto.

#### T2.2 — Componente de fechamento semanal

**Entregáveis:**
- Componente `<FechamentoSemanal />` ativado toda sexta (ou manualmente).
- Auto-preenche `faturamento_total` chamando a função SQL.
- Campos manuais para os outros 6 KPIs (Esdra ainda atualiza manualmente número de pedidos, clientes etc.).
- Botão "Salvar fechamento" persiste em `esdra_kpis_semanais`.
- Após salvar, mostra delta vs semana anterior (↑12% ou ↓5%).

**Validação:**
- Preencher KPIs de uma semana fictícia, salvar, verificar persistência.
- Comparar com semana anterior funciona corretamente.

#### T2.3 — Dashboard de métricas

**Entregáveis:**
- Tela com 7 cards (um por KPI), cada um mostrando:
  - Número da semana atual
  - Variação % vs semana anterior
  - Mini gráfico de linha das últimas 4 semanas
- Toggle entre visualização semanal e mensal (agregada).
- Uso da biblioteca de charts já presente no FinanceiroJe (recharts ou similar).

**Validação:**
- Após 2+ fechamentos, dashboard mostra evolução temporal corretamente.

### Definition of Done — Sprint 2

- [ ] Função SQL de agregação financeira funcionando
- [ ] Tela de fechamento semanal operacional
- [ ] Dashboard de 7 KPIs com gráficos
- [ ] Tests cobrindo cálculo de variação e agregação
- [ ] Deploy em produção
- [ ] Smoke test: fechar 2 semanas, verificar comparação correta

---

## SPRINT 3 — Tela "Decisões" + Tela "Semana"

**Objetivo:** sistema completo de Decisões Empreendedoras + visão semanal consolidada.

### Tarefas

#### T3.1 — Tela de Decisões

**Entregáveis:**
- Rota `/painel-esdra/decisoes`.
- Lista de decisões pendentes (sem `decisao` preenchida) em destaque no topo.
- Form para registrar nova decisão: pergunta, decisão, critério, data prevista de revisão (default: +30 dias).
- Card de cada decisão mostrando status: `pendente_decisao`, `aguardando_revisao`, `revisada`.
- Notificação visual quando data de revisão está vencida.

**Validação:**
- Criar decisão da Semana 1, deixar para revisar daqui a 30 dias.
- Avançar tempo (ou data manual), confirmar que aparece como "vencida para revisão".

#### T3.2 — Componente de Revisão de Decisão

**Entregáveis:**
- Modal/tela de revisão com:
  - Recapitulação da decisão e critério originais
  - Campo "resultado" (texto livre)
  - Dropdown "acerto percebido" (acertou/parcial/errou/não avaliado)
  - Campo "aprendizado" (texto livre, principal output)
- Após revisão, decisão fica permanentemente marcada como `revisada`.

**Validação:**
- Revisar 1 decisão, verificar persistência completa.

#### T3.3 — Tela "Semana"

**Entregáveis:**
- Rota `/painel-esdra/semana`.
- Visão de 7 dias da semana atual com:
  - Compromissos do dia (resumo, sem editar — link "Abrir" leva para `/hoje?data=X`)
  - Decisão da semana em destaque
  - KPIs da semana anterior (se já fechada)
- Botão "Iniciar Reset Semanal" (visível só no domingo) que abre wizard de revisão da semana.

**Validação:**
- Navegar entre semanas (anterior/próxima) funciona.
- Reset semanal abre fluxo de retro.

### Definition of Done — Sprint 3

- [ ] Tela de Decisões operacional
- [ ] Sistema de revisão de decisões funcionando
- [ ] Tela Semana com visão consolidada
- [ ] Tests cobrindo lifecycle completo de decisão
- [ ] Deploy em produção
- [ ] Smoke test: criar 4 decisões (semanas 1-4), revisar 1, ver progresso

---

## SPRINT 4 — CRM Mínimo + Estoque + Polish

**Objetivo:** migrar planilha de clientes e estoque para o sistema, finalizar UX.

### Tarefas

#### T4.1 — Importador de CSV (clientes e estoque)

**Entregáveis:**
- Componente de upload de CSV.
- Parser que aceita o formato gerado pelo Google Sheets export.
- Tela de preview antes de importar (mostra primeiras 10 linhas, valida colunas obrigatórias).
- Persistência em `esdra_clientes` e `esdra_estoque`.

**Validação:**
- Importar CSV de 100 clientes, verificar todos persistidos com categoria correta.

#### T4.2 — Tela de Clientes (CRM)

**Entregáveis:**
- Rota `/painel-esdra/clientes`.
- Listagem com filtros (categoria, cidade, marca favorita).
- Cards com: nome, telefone, última compra, ticket médio, observações.
- Botão "WhatsApp" que abre `wa.me/55<telefone>`.
- Detecção automática de "inativa" baseada em `ultima_compra > 90 dias`.
- Lista de aniversariantes da semana em destaque.

**Validação:**
- Filtrar por VIP, listar contatos.
- Detecção de inativas funciona.

#### T4.3 — Tela de Estoque

**Entregáveis:**
- Rota `/painel-esdra/estoque`.
- Listagem com filtros (marca, curva ABC, dias parado).
- Indicador visual de produtos próximos da validade (<60 dias).
- Cálculo automático de "Capital Parado" (sum de custo × qtd dos produtos com >120 dias parado).
- Sugestão automática de candidatos a liquidação.

**Validação:**
- Lista filtrada, capital parado calculado corretamente.

#### T4.4 — Polish geral

**Entregáveis:**
- Navegação entre as 4 telas (Hoje/Semana/Métricas/Decisões/CRM/Estoque) consistente.
- Mobile responsivo (Esdra pode consultar do celular).
- Atalhos de teclado para Josemar (j: hoje, s: semana, m: métricas, d: decisões).
- Tema visual coerente com FinanceiroJe.

**Validação:**
- Testar em iPhone (Esdra) e Desktop (Josemar).
- Atalhos funcionando.

### Definition of Done — Sprint 4

- [ ] Importação de CSV funcional
- [ ] Telas de Clientes e Estoque operacionais
- [ ] Mobile responsivo testado
- [ ] Tests cobrindo importação e filtros
- [ ] Deploy em produção
- [ ] Sistema completo testado end-to-end com dados reais

---

## CONVENÇÕES E PADRÕES

(Manter alinhado com o resto do FinanceiroJe.)

### Estrutura de pastas
```
src/
├── modules/
│   └── painel-esdra/        # NOVO
│       ├── components/
│       │   ├── PainelHoje.tsx
│       │   ├── PainelSemana.tsx
│       │   ├── PainelMetricas.tsx
│       │   ├── PainelDecisoes.tsx
│       │   ├── PainelClientes.tsx
│       │   ├── PainelEstoque.tsx
│       │   └── EsdraConselheiro.tsx       # 🆕 Sprint 6
│       ├── hooks/
│       │   ├── useCompromissos.ts
│       │   ├── useKPIs.ts
│       │   ├── useDecisoes.ts
│       │   ├── useClientes.ts
│       │   ├── useEstoque.ts
│       │   └── useEsdraConselheiro.ts     # 🆕 Sprint 6
│       ├── lib/
│       │   ├── progressoSemana.ts
│       │   ├── classificacaoABC.ts
│       │   └── importadorCSV.ts
│       └── types.ts
├── services/
│   └── esdraConselheiro/                  # 🆕 Sprint 6
│       ├── systemPrompt.ts
│       ├── contextCollector.ts
│       └── __tests__/
└── ...

supabase/
├── migrations/
│   ├── 20260801000001_extend_ai_messages_for_esdra.sql       # 🆕 Sprint 5
│   └── 20260801000002_esdra_business_observations.sql        # 🆕 Sprint 5
└── functions/
    ├── embed-esdra-decisions/             # 🆕 Sprint 5
    └── esdra-conselheiro/                 # 🆕 Sprint 6
```

### Padrão de commits
```
feat(painel-esdra): adicionar tela Hoje com persistência
test(painel-esdra): cobrir cálculo de progresso semanal
fix(painel-esdra): corrigir off-by-one em data de revisão
```

### Tests
- Mínimo 1 unit test por hook customizado
- Mínimo 1 unit test por função utilitária em `lib/`
- Sem test de componente UI (low ROI para projeto pessoal)

---

## SPRINT 5 — Personal Intelligence Layer Esdra

**Objetivo:** estender a Personal Intelligence Layer pessoal (Sprints 1-7 + 8-10 do plano original) para que ela também aprenda sobre o negócio Esdra Cosméticos, criando memória conversacional, observations específicas e padrões de decisão empreendedora. **Reusa massivamente a infra existente**, não reinventa nada.

**Pré-requisito crítico:** ao iniciar Sprint 5, o sistema operacional (Sprints 1-4) deve ter acumulado **mínimo 60 dias** de uso real. Sem dados, não há o que aprender. Iniciar Sprint 5 antes disso é construir motor sem combustível.

### Princípio diretor

A PIL pessoal já tem: `ai_messages_embeddings` (Sprint 8), `ai_self_observations` (Sprint 8), `decision_outcomes` (Sprint 5 original), `behavioral_tags` (Sprint 6 original), `weekly_digests` (Sprint 9), `prompt_variants` (Sprint 9). **Não vamos criar tabelas paralelas** — vamos adicionar dimensão de escopo (`scope: 'esdra'`) onde fizer sentido, e criar tabelas novas apenas para o que é específico do negócio.

### Tarefas

#### T5.1 — Adaptar `ai_messages_embeddings` para escopo Esdra (1 sessão)

**Entregáveis:**
- Migration `20260801000001_extend_ai_messages_for_esdra.sql` adicionando coluna `business_scope` (text, default 'pessoal', valores: 'pessoal' | 'esdra' | 'family' | 'mei') na tabela `ai_messages` (se ainda não existe).
- Backfill: marcar mensagens existentes como `business_scope = 'pessoal'`.
- Atualizar `find_related_conversations` (RPC já existente) para aceitar parâmetro de filtro de escopo.

**Validação:**
- Inserir mensagem teste com `business_scope = 'esdra'`, busca filtrada retorna apenas Esdra.

#### T5.2 — Tabela de observations específicas Esdra (1 sessão)

**Entregáveis:**
- Migration `20260801000002_esdra_business_observations.sql` criando tabela `esdra_business_observations`:
  - id, user_id
  - observation_type (text): 'pattern_marca', 'pattern_cliente', 'pattern_sazonalidade', 'risk_estoque', 'oportunidade'
  - content (text): texto livre da observação
  - confidence (numeric 0-1)
  - source_data (jsonb): IDs de transações, decisões ou KPIs que originaram a observação
  - reinforcement_count (int default 1)
  - last_reinforced_at (timestamptz)
  - superseded_by (uuid, nullable)
  - created_at, updated_at
- RLS habilitado. Função `upsert_esdra_observation()` similar ao `upsert_coach_memory()`.

**Validação:**
- Inserir 3 observações teste de tipos diferentes, validar que são recuperáveis com filtros.

#### T5.3 — Embeddings das Decisões Empreendedoras (1 sessão)

**Entregáveis:**
- Edge function `embed-esdra-decisions` que pega decisões da `manual_30_dias_decisoes` (e futuramente `esdra_decisoes`) e gera embeddings.
- Cron diário `embed-esdra-decisions-nightly` (`0 5 * * *`) que processa decisões novas.
- RPC `find_related_decisions(user_id, query_embedding, limit)` retornando decisões similares.

**Validação:**
- Após cron rodar com 4+ decisões registradas, query semântica "marcas de baixa margem" retorna decisão da Semana 3 sobre marcas a descontinuar.

#### T5.4 — Análise de outcome de decisões (1 sessão)

**Entregáveis:**
- Cron `review-esdra-decisions` (`0 6 * * 0` — domingo) que:
  - Identifica decisões registradas há 30+ dias sem `acerto_percebido` definido
  - Cria entrada em `decision_outcomes` (tabela existente da PIL pessoal) com escopo Esdra
  - Notifica via `weekly_digests` que há decisões aguardando revisão
- Componente `<EsdraDecisionReview />` que aparece no Painel quando há decisões para revisar, com prompt do contexto original + dados financeiros do período pós-decisão.

**Validação:**
- Decisão registrada em junho aparece para revisão em julho com resumo de dados pós-decisão.

### Definition of Done — Sprint 5

- [ ] Migrations aplicadas
- [ ] Embeddings de decisões funcionando (cron + RPC)
- [ ] `esdra_business_observations` operacional com função upsert
- [ ] `find_related_conversations` filtra por escopo
- [ ] Cron de revisão de decisões funcionando
- [ ] 9+ unit tests cobrindo lógica nova
- [ ] Deploy em produção
- [ ] Smoke test: gerar 1 observation manualmente, recuperar via query

---

## SPRINT 6 — AI Conselheiro Esdra Cosméticos

**Objetivo:** construir interface de chat dedicada dentro do Painel Empreendedor, onde Josemar conversa com um Claude especializado em Esdra Cosméticos. Esse Claude:
- Tem system prompt customizado focado em consultoria estratégica de e-commerce de cosméticos
- Recebe contexto dinâmico via RAG (busca em `esdra_business_observations`, decisões, KPIs, transações)
- Cita números reais com referência à fonte (auditável)
- Recusa responder com base em achismo quando não há dado real

**Pré-requisito crítico:** Sprint 5 concluído. Sem PIL Esdra populada, o Conselheiro não tem o que consultar.

### Princípio não-negociável

**Zero alucinação numérica.** O system prompt instrui o modelo a **sempre** citar a fonte (mês, valor, ID da decisão) quando der número. Se não há dado, responder "não tenho registro disso" em vez de estimar.

### Tarefas

#### T6.1 — Edge function `esdra-conselheiro` (1 sessão)

**Entregáveis:**
- Edge function `supabase/functions/esdra-conselheiro/index.ts`.
- Estrutura espelha `ai-advisor` mas com system prompt e contexto distintos.
- Recebe: `{ message: string, conversation_id: uuid }`.
- Pipeline:
  1. Carrega histórico da conversa (últimas 10 mensagens da `ai_messages` filtrado por `business_scope = 'esdra'`)
  2. Embedding da pergunta
  3. RAG: busca top-5 em `find_related_conversations` (escopo esdra), top-3 em `find_related_decisions`, top-5 em `esdra_business_observations`
  4. Query SQL contextual (KPIs últimos 30 dias, top 3 marcas por margem, decisões pendentes de revisão)
  5. Monta system prompt com `buildEsdraContextBlock()`
  6. Chama Claude API (modelo configurável via env, default `claude-opus-4-7`)
  7. Stream da resposta com SSE
  8. Persiste em `ai_messages` com `business_scope = 'esdra'`
- Suporte a `META_REFLECTION_JSON` (mesma infra do Sprint 8 da PIL pessoal).

**Validação:**
- Pergunta "qual minha pior decisão dos últimos 60 dias?" — resposta cita decisão real com data e ID.
- Pergunta "qual o futuro do Bitcoin?" — resposta declina ("fora de escopo deste consultor").

#### T6.2 — System prompt especializado (1 sessão)

**Entregáveis:**
- Arquivo `src/services/esdraConselheiro/systemPrompt.ts` exportando `buildEsdraSystemPrompt(context)`.
- Identidade: "Você é o Conselheiro Esdra Cosméticos, consultor estratégico sênior de e-commerce de cosméticos de pequeno porte..."
- Princípios não-negociáveis no prompt:
  - Sempre citar fonte ao dar número
  - Recusar achismo
  - Usar ACF apenas quando relevante e citado pelo usuário
  - Tom calibrado para INFJ
  - Foco em decisões com critério escrito
- Bloco de contexto dinâmico (montado pelo `contextCollector`)
- Diretrizes de defesa contra prompt injection (mesmo padrão do Sprint 8).

**Validação:**
- Snapshot test do prompt com contexto fixo gera output estável.

#### T6.3 — Context collector específico Esdra (1 sessão)

**Entregáveis:**
- `src/services/esdraConselheiro/contextCollector.ts` exportando `collectEsdraContext(userId, query)`.
- Coleta:
  - Posicionamento da marca (constante: curadoria + atendimento consultivo)
  - KPIs últimos 30 dias (de `esdra_kpis_semanais`)
  - Top 5 marcas por margem (de `esdra_estoque`)
  - Decisões registradas (últimas 10, de `esdra_decisoes`)
  - Conversas relacionadas (top 5 via RAG)
  - Observations relevantes (top 5 via RAG)
  - Eventos próximos (Black Friday, Dia das Mães — sazonalidade)
  - Manual 30 Dias progresso (% MV cumprido último mês)
- Retorna objeto estruturado consumido pelo `buildEsdraSystemPrompt`.

**Validação:**
- Unit tests cobrindo casos: contexto vazio, contexto completo, query irrelevante.

#### T6.4 — Interface de chat no Painel Empreendedor (1 sessão)

**Entregáveis:**
- Rota `/painel-esdra/conselheiro`.
- Componente `<EsdraConselheiro />` com:
  - Lista de conversas anteriores (sidebar)
  - Área de chat com streaming
  - Input com botão de envio
  - Botão "Nova conversa"
  - Botão "👍/👎" em cada resposta (alimenta `apply_response_feedback` adaptado para escopo esdra)
  - Modal "Por que essa resposta?" mostrando contexto usado (mesma UX do `WhyThisAnswerModal` do Sprint 4)
- Atalho de teclado `c` abre conselheiro de qualquer tela do Painel.
- Mobile responsivo.

**Validação:**
- Teste end-to-end: nova conversa, pergunta "vale cortar Marca X?", resposta com dado real, feedback 👍, persistência.

### Definition of Done — Sprint 6

- [ ] Edge function `esdra-conselheiro` deployada e estável
- [ ] System prompt especializado com snapshot test
- [ ] Context collector com unit tests
- [ ] Interface `/painel-esdra/conselheiro` operacional
- [ ] Stream funcionando (SSE)
- [ ] Feedback 👍/👎 persistindo
- [ ] Mobile testado
- [ ] Deploy em produção
- [ ] Smoke test: 5 perguntas de naturezas diferentes, todas com resposta apropriada

---

## CONTINUIDADE PÓS-SPRINT 6

Após Sprint 6, o Conselheiro Esdra é sistema permanente em uso. Próximos passos naturais (não são sprints fixos — são evoluções por demanda):

1. **Modo voz** (futuro): integração com Web Speech API para falar com o Conselheiro de viva voz no carro entre quartel e casa.

2. **Conselheiro proativo** (futuro): cron semanal que gera 1 insight não solicitado por semana ("notei que sua margem de Truss caiu 8% no último mês — quer conversar sobre isso?"). Aproveita infra do `weekly_digests`.

3. **Multi-marca/multi-negócio** (longo prazo): se Esdra Cosméticos virar 2+ negócios (e-commerce + atacado, por exemplo), o Conselheiro evolui para suportar sub-escopos.

Estas evoluções vivem no `PLANOS_DE_EVOLUCAO.md` (Categoria H), não neste plano.

---

## RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Sprint 1 trava em migrations | Baixa | Alto | Aplicar migrations 1 a 1, validar antes de seed |
| Seed do manual quebra com mudanças no MD | Média | Médio | Parser tolerante; refazer a cada alteração maior do manual |
| Esdra não usa o sistema | Alta | Baixo | Sistema é primariamente para Josemar; Esdra usa via Josemar |
| Programar virar fuga do operacional | **Alta** | **Alto** | **Limite rígido: 1 sessão Claude Code por semana até Sprint 4** |
| FinanceiroJe ainda em Sprint 1 da PIL | Média | Médio | Construir como módulo independente; integração PIL é Sprint 5+ |
| Sprint 5 iniciado antes de 60d de dados | Alta | Alto | **Bloqueio explícito**: Sprint 5 só inicia após validação manual de volume mínimo de dados acumulados |
| Conselheiro Esdra alucinar números (Sprint 6) | Média | **Crítico** | System prompt rigoroso + zero-hallucination + RAG obrigatório + monitoramento de respostas via `meta_reflection` |
| Custo de API do Conselheiro estourar | Média | Médio | Limite de 50 mensagens/dia inicialmente; cache agressivo de respostas; fallback para modelos mais baratos para perguntas simples |
| Conselheiro virar dependência emocional | Baixa | Alto | UX deliberadamente passiva — Conselheiro responde, não busca atenção; sem notificações; uso opcional |

**Risco mais importante destacado:** o limite de **1 sessão de Claude Code por semana** para o Painel Esdra durante Sprints 1-4. Sua disposição natural é programar mais — mas as primeiras 4 semanas são de **execução comercial**, não técnica. O módulo serve à execução, não substitui ela.

**Para Sprints 5-6:** mesma regra inversa — só comece **depois** de ter dados reais validando que o Painel é útil. Construir consultor IA antes de ter o que ele consultar é overengineering puro.

---

## CRITÉRIOS DE SUCESSO DO PLANO

Em 30 dias (1º a 30 de maio de 2026):
- ✅ Sprints 1 e 2 concluídos (mínimo)
- ✅ Sistema usado diariamente para marcar compromissos
- ✅ 4 KPIs semanais fechados no sistema
- ✅ 4 decisões registradas

Em 60 dias (até 30 de junho de 2026):
- ✅ Sprints 3 e 4 concluídos
- ✅ CRM e estoque migrados da planilha
- ✅ Primeiras 2 decisões revisadas com aprendizado registrado
- ✅ Decisão tomada: prosseguir para Sprint 5 ou consolidar mais 30 dias?

Em 90 dias (até 30 de julho de 2026):
- ✅ **Se decidiu prosseguir:** Sprint 5 iniciado, PIL Esdra em construção
- ✅ **Se decidiu consolidar:** Painel maduro em uso contínuo, dados acumulando
- ✅ Decisão sobre próxima fase do negócio: marketplaces, contratação, tráfego pago — todas já com dado real do sistema

Em 120-150 dias (agosto-setembro 2026):
- ✅ Sprint 5 (PIL Esdra) concluído
- ✅ Sprint 6 (AI Conselheiro Esdra) iniciado ou concluído
- ✅ Conselheiro respondendo perguntas estratégicas com dados reais
- ✅ Mínimo 5 conversas com Conselheiro com feedback registrado

Em 180 dias (até final de outubro 2026):
- ✅ Sistema completo (Sprints 1-6) em produção e maduro
- ✅ Decisões empreendedoras tomadas com apoio do Conselheiro
- ✅ PIL Esdra com observations consolidadas (mínimo 30 observations únicas)
- ✅ Histórico auditável de decisões + outcomes

---

## CHECKLIST PRÉ-SPRINT 1

Antes de abrir o Claude Code Desktop para começar:
- [x] Manual 30 Dias lido e aceito
- [x] HTML do Manual em produção (`public/manual/index.html`)
- [x] Tabelas `manual_30_dias_progresso` e `manual_30_dias_decisoes` criadas no Supabase
- [ ] FinanceiroJe rodando localmente sem erros
- [ ] Branch nova criada: `feat/painel-esdra-sprint-1`
- [ ] Reservar 2h ininterruptas para a primeira sessão (T1.1)
- [ ] Mínimo 30 dias de uso real do Manual antes de abrir Sprint 1 do Painel

## CHECKLIST PRÉ-SPRINT 5 (PIL Esdra)

Antes de iniciar Sprint 5:
- [ ] Sprints 1-4 do Painel concluídos e estáveis em produção
- [ ] Mínimo 60 dias de uso real do Painel
- [ ] Mínimo 8 decisões empreendedoras registradas
- [ ] Mínimo 8 fechamentos semanais de KPIs
- [ ] PIL pessoal (Sprints 8-10 do plano original) estáveis em produção há ≥30 dias

## CHECKLIST PRÉ-SPRINT 6 (AI Conselheiro Esdra)

Antes de iniciar Sprint 6:
- [ ] Sprint 5 concluído com observations populadas
- [ ] Decisão consciente: vale o custo de API mensal do Conselheiro (~R$ 30-80)
- [ ] Critério de sucesso definido: o que torna o Conselheiro útil vs descartar?
- [ ] Comprometimento de uso real (mínimo 1 conversa estratégica/semana após deploy)

---

*Plano técnico versão 2.0 — Construído para Josemar de Paula.*
*v1.0 (30/04/2026): 4 sprints (estrutura → CRM/estoque)*
*v2.0 (02/05/2026): expansão para 6 sprints (acrescentado PIL Esdra + AI Conselheiro Esdra)*
*Próxima revisão: junho de 2026 (após Sprint 1 + 2 concluídas).*
