# 🧠 Plano Técnico — Camada de Inteligência Pessoal do FinanceiroJe

> **Objetivo:** transformar a Captura Inteligente e a IA Conselheira de assistentes genéricos em assistentes que conhecem o usuário, aprendem com ele e melhoram a cada interação — com auditabilidade, governança e aprendizado sobre os próprios conselhos.
>
> **Autor do diagnóstico:** sessão Claude com Josemar — Abril/2026
> **Versão:** 1.3 (com Sprint 6 — Coach Comportamental Profundo e Gamificação Adaptativa)
> **Status:** aprovado para implementação

---

## 📑 Sumário

1. [Diagnóstico do estado atual](#1-diagnóstico-do-estado-atual)
2. [Estratégia central — Três camadas de memória](#2-estratégia-central--três-camadas-de-memória)
3. [Decisões arquiteturais](#3-decisões-arquiteturais)
4. [Sprint 1 — Compartilhar o que já existe](#4-sprint-1--compartilhar-o-que-já-existe)
5. [Sprint 2 — Materializar padrões aprendidos](#5-sprint-2--materializar-padrões-aprendidos)
6. [Sprint 3 — Evoluir a memória episódica](#6-sprint-3--evoluir-a-memória-episódica)
7. [Sprint 4 — Loop de feedback explícito](#7-sprint-4--loop-de-feedback-explícito)
8. [Sprint 5 — Aprender com a aderência aos conselhos](#8-sprint-5--aprender-com-a-aderência-aos-conselhos)
9. [Sprint 6 — Coach Comportamental Profundo e Gamificação Adaptativa](#9-sprint-6--coach-comportamental-profundo-e-gamificação-adaptativa)
10. [Modelo conceitual unificador — Os 4 Scores](#10-modelo-conceitual-unificador--os-4-scores)
11. [Impacto em custo de API](#11-impacto-em-custo-de-api)
12. [Critérios de sucesso](#12-critérios-de-sucesso)
13. [Riscos e mitigações](#13-riscos-e-mitigações)
14. [Apêndice — Mapa de arquivos](#14-apêndice--mapa-dos-arquivos-afetados)
15. [Histórico de versões](#15-histórico-de-versões)

---

## 1. Diagnóstico do estado atual

### 1.1 O que já está bem-feito (não mexer, só aproveitar)

- **`contextCollector.ts` (852 linhas)** já calcula um perfil comportamental sofisticado: arquétipo (`guardiao`/`explorador`/`lutador`/`construtor`), indicador de evitação, indicador de impulsividade, variabilidade de gastos, comprometimento com metas, áreas de atenção, forças, histórico de 24 meses, transações recentes, decisão guiada e progresso comparativo (memória de progresso mês a mês).
- **`ai_coach_memory`** (migration `20260404000002`) já existe e funciona: o system prompt do AI Advisor instrui a IA a emitir uma linha `INSIGHT_COACH:` ao final de cada resposta, que é extraída pela edge function, salva e relida nas próximas conversas.
- **System prompt do Advisor** (`systemPrompt.ts`, 352 linhas) é maduro e tem seções dedicadas a perfil comportamental, decisão guiada, memória de progresso, postura de coach + psicólogo financeiro.
- **Schema de `transactions`** já tem `confidence`, `source_type`, `validation_notes`, `data_status` — toda a infraestrutura para rastrear "veio do OCR" vs "foi corrigido manualmente" está pronta.
- **Pipeline de captura** (`SmartCapture.tsx` → adapters → edge functions → OpenAI) está estável e bem separado em camadas.

### 1.2 Onde está o problema (e por que as respostas são vagas)

| # | Problema | Localização | Severidade |
|---|---|---|---|
| 1 | `captureContext.ts` (101 linhas) é radicalmente mais pobre que `contextCollector.ts` (852 linhas). Só envia categorias + 20 últimas transações cruas. Nenhum perfil comportamental, nenhum mapeamento merchant→categoria, nenhum padrão aprendido. | `src/services/smartCapture/captureContext.ts` | **Alta** |
| 2 | Quando o usuário corrige uma transação que o OCR errou, essa correção morre na própria transação. Não vira regra. Próxima vez que aparecer "POSTO IPIRANGA" o modelo chuta de novo. | Não existe — falta criar | **Alta** |
| 3 | `ai_coach_memory` é primitivo: só `content` (text) + `relevance` (1-10). Não tem `tipo`, não tem `pattern_key` (deduplicação), não tem `expires_at`, não tem reforço. | Migration `20260404000002` | **Média** |
| 4 | Os 5 últimos insights são lidos por `created_at desc` — sem ranking por relevância nem deduplicação. Em 2 semanas a "memória" vira ruído repetido. | `supabase/functions/ai-advisor/index.ts` linhas 359–369 | **Média** |
| 5 | Captura e Advisor não compartilham memória — são silos. O que a IA Conselheira aprende sobre o usuário não chega na Captura, e vice-versa. | Arquitetura geral | **Alta** |
| 6 | Não existe um perfil estável "declarado" do usuário (rotinas, beneficiários frequentes, padrão de fim de mês, datas de pagamento, MEI vs pessoal por horário). Tudo é inferido toda vez. | Não existe — falta criar | **Média** |
| 7 | Nenhum histórico auditável de "o que a IA sugeriu vs. o que o usuário confirmou". Sem isso, não dá para medir evolução nem reprocessar aprendizado quando o algoritmo melhorar. | Não existe — falta criar | **Média** |
| 8 | A IA recomenda mas nunca sabe se a recomendação foi seguida nem se funcionou. Cada resposta é uma ilha. | Não existe — falta criar | **Média** |

---

## 2. Estratégia central — Três camadas de memória

A ideia é parar de pensar em "memória" como uma coisa só. Existem três tipos de conhecimento sobre o usuário, com tempos de vida e usos diferentes:

| Camada | O que é | Como nasce | Onde vive | Quem usa | Estado atual |
|---|---|---|---|---|---|
| **1. Perfil Estável** | Quem o usuário é financeiramente | Calculado a partir do histórico | `contextCollector` em runtime | Advisor + **Captura (novo)** | ✅ Existe — só falta expor para Captura |
| **2. Padrões Aprendidos** | Regras "se X então Y" | Extraídos de transações confirmadas e correções manuais | Nova tabela `user_patterns` + `capture_learning_events` (auditoria) | **Captura (principal)** + Advisor | ❌ Não existe |
| **3. Memória Episódica** | O que a IA observou em conversas + aderência a conselhos | Insight extraído da resposta da IA + outcomes | `ai_coach_memory` evoluída + `decision_outcomes` | **Advisor (principal)** + Captura | ⚠️ Existe primitivo — refinar |

**Insight central:** a Camada 2 é o que está completamente faltando e é o que vai fazer a Captura "acertar" merchants, categorias e valores típicos. A Camada 3 já existe mas precisa amadurecer e ganhar um loop de aprendizado sobre seus próprios conselhos. A Camada 1 já é excelente — só precisa ser exposta para a Captura também.

### 2.1 Princípio de governança (zero-alucinação aplicado à memória)

Memória comportamental **nunca vira fato financeiro**. As três camadas devem permanecer separadas em runtime e no prompt:

- Fatos reais (saldos, transações confirmadas) → bloco `📊 DADOS REAIS`
- Padrões aprendidos → bloco `🧬 PADRÕES APRENDIDOS DESTE USUÁRIO` (com confidence explícita)
- Memórias episódicas → bloco `🧠 PADRÕES OBSERVADOS / ⚠️ PREOCUPAÇÕES ATIVAS`
- Incertezas → bloco `⚠️ INCERTEZAS E LIMITES DESTA ANÁLISE` (consolidado — Sprint 3)

A IA deve usar memória para **calibrar tom e prioridade**, nunca para inventar números. Se usar um padrão comportamental na resposta, deve apresentá-lo como tal: *"Pelo seu histórico, você costuma preferir X"* — nunca *"Você sempre prefere X"*.

---

## 3. Decisões arquiteturais

### 3.1 Onde rodar o aprendizado de padrões — Opção C (híbrida)

- **Trigger síncrono leve** no `UPDATE` de `transactions` apenas quando: `source_type IN ('ocr','voice','document')` E `categoria_id` mudou. Caso crítico, baixo volume, ganho percebido imediato.
- **Cron diário** (Supabase scheduled function) para varredura completa: detecta padrões agregados (medianas, faixas, frequências, aliases) e roda decaimento de padrões antigos.

### 3.2 Escopo de memória — isolado por escopo

Padrões aprendidos em `business` (Esdra Cosméticos) ficam isolados do `private`/`family`. Respeita a separação que o app já tem e evita cross-pollution. A tabela `user_patterns` tem `scope` como chave composta no `UNIQUE`.

### 3.3 Auditabilidade — eventos brutos preservados

Toda confirmação do Modo Espelho gera um registro em `capture_learning_events` (Sprint 2). Esses eventos são **append-only e auditáveis**, e servem como base para:

- **Replay**: rerodar extração de padrões com algoritmo melhorado, sem perda histórica.
- **Métricas reais**: calcular taxa de correção por campo ao longo do tempo (provar evolução).
- **Debug**: quando a IA erra feio, recuperar o `raw_input` original e entender o que aconteceu.

### 3.4 Memória deve decair (não apenas expirar)

Memórias inferidas devem **perder confiança gradualmente** se não forem reforçadas, antes de expirar de vez. Isso evita que padrões antigos dominem o contexto quando o comportamento do usuário mudou. Implementado em `decay_stale_patterns()` (Sprint 2) e equivalente para `ai_coach_memory` (Sprint 3).

### 3.5 Ordem dos sprints

Sprint 1 → 2 → 3 → 4 → 5. O Sprint 1 entrega ganho percebido em 1-2 dias sem mexer em schema. O Sprint 5 (aderência a conselhos) é opcional mas alto valor — pode ser adiado se houver pressão de prazo.

---

## 4. Sprint 1 — Compartilhar o que já existe

**Duração estimada:** 1-2 dias
**Risco:** baixo (sem mudanças de schema)
**Ganho percebido:** alto

### 4.1 Objetivo

A Captura passa a ver o mesmo perfil comportamental que o Advisor já vê.

### 4.2 Tarefas

#### T1.1 — Criar `userProfile/snapshot.ts`

Novo arquivo: `src/services/userProfile/snapshot.ts`

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { ScopeType } from "@/contexts/ScopeContext";

export interface UserBehavioralSnapshot {
  arquetipo: string;            // "guardiao" | "explorador" | "lutador" | "construtor" | "indefinido"
  arquetipoDescricao: string;
  topCategorias: Array<{ nome: string; tipo: "income" | "expense"; usosNoMes: number }>;
  faixasTipicas: {
    despesaMediana: number;
    despesaP10: number;
    despesaP90: number;
    receitaMediana: number;
  };
  beneficiariosFrequentes: Array<{ nome: string; vezes: number; ultimaVez: string }>;
  padraoTemporal: {
    horarioMaisAtivo: "manha" | "tarde" | "noite" | "indefinido";
    diaSemanaMaisAtivo: number | null;
  };
}

/**
 * Retorna um snapshot leve do comportamento do usuário para enriquecer
 * prompts da Captura. Roda em ~1 query graças a agregações no JS.
 *
 * Importante: NÃO recalcula o contextCollector inteiro — é uma versão
 * enxuta otimizada para o caso de uso da Captura.
 */
export async function getUserBehavioralSnapshot(
  userId: string,
  scope: ScopeType
): Promise<UserBehavioralSnapshot> {
  // Implementação:
  // 1. Buscar últimas 90 dias de transações confirmadas no escopo
  // 2. Calcular medianas (P10, P50, P90) por tipo
  // 3. Top 5 categorias mais usadas
  // 4. Top 5 counterparties/descrições mais repetidas
  // 5. Reusar buildArchetype() (extraído do contextCollector)
}
```

**Decisão de implementação:** copiar a lógica de arquétipo do `contextCollector` para uma função pura compartilhada em `userProfile/buildArchetype.ts`, para evitar duplicação. Tanto `contextCollector` quanto `snapshot` passam a importar dela.

#### T1.2 — Refatorar `captureContext.ts`

Adicionar o snapshot ao `contextBlock`:

```typescript
// src/services/smartCapture/captureContext.ts
import { getUserBehavioralSnapshot } from "@/services/userProfile/snapshot";

export async function getCaptureContext(
  currentScope: ScopeType,
  userId: string  // ← novo parâmetro
): Promise<CaptureContextData> {
  try {
    const [catResult, txResult, snapshot] = await Promise.all([
      // ... queries existentes
      getUserBehavioralSnapshot(userId, currentScope),
    ]);

    const blocks: string[] = [];
    blocks.push(formatCategories(categories, currentScope));
    blocks.push(formatRecentTransactions(transactions));
    blocks.push(formatSnapshot(snapshot));  // ← novo

    return { contextBlock: blocks.filter(Boolean).join("\n\n") };
  } catch {
    return { contextBlock: "" };
  }
}

function formatSnapshot(s: UserBehavioralSnapshot): string {
  return `perfil_usuario:
- arquetipo: ${s.arquetipo} (${s.arquetipoDescricao.slice(0, 100)})
- top_categorias: ${s.topCategorias.map(c => `${c.nome}(${c.usosNoMes}x)`).join(", ")}
- faixa_despesa_tipica: R$${s.faixasTipicas.despesaP10}-${s.faixasTipicas.despesaP90} (mediana R$${s.faixasTipicas.despesaMediana})
- beneficiarios_frequentes: ${s.beneficiariosFrequentes.map(b => b.nome).join(", ")}`;
}
```

#### T1.3 — Atualizar system prompt do `smart-capture-interpret`

Adicionar parágrafo no system prompt da edge function:

```
USO DO PERFIL DO USUÁRIO (quando fornecido):
- Use top_categorias como prior: se o estabelecimento ou descrição se parece com categoria que o usuário usa frequentemente, prefira essa categoria.
- Use faixa_despesa_tipica: se o valor extraído está fora do range (>3x mediana ou <0.3x P10), marque confidence='baixa' e adicione "valor_atipico" em evidence.
- Use beneficiarios_frequentes: se counterparty extraído tem fuzzy match com algum nome da lista, normalize para o nome canônico da lista.
- Se arquetipo='lutador', seja extra cauteloso com confidence — usuário em pressão financeira precisa de revisão antes de auto-confirmar.
```

#### T1.4 — Atualizar chamadas no `SmartCapture.tsx`

Passar `userId` para `getCaptureContext` (linhas 332, 392, 463). O `userId` já está disponível via `useAuth()`.

### 4.3 Critérios de aceite Sprint 1

- [ ] Função `getUserBehavioralSnapshot` retorna em <500ms para usuário com 200+ transações.
- [ ] OCR de "POSTO IPIRANGA R$ 150" sugere categoria "Combustível" se essa é a categoria histórica do usuário para postos.
- [ ] OCR de valor 5x acima da mediana da categoria marca `confidence: 'baixa'` automaticamente.
- [ ] Nenhuma mudança de schema no Supabase neste sprint.

---

## 5. Sprint 2 — Materializar padrões aprendidos

**Duração estimada:** 4-5 dias (era 3-4; aumentou pelas adições de auditoria e decaimento)
**Risco:** médio (nova tabela, trigger, cron)
**Ganho percebido:** muito alto (correções deixam de ser desperdício)

### 5.1 Objetivo

Criar a Camada 2 — regras explícitas extraídas do comportamento do usuário, com:
- alimentação por observação passiva (cron) e correção ativa (trigger);
- **auditoria total** dos eventos brutos (`capture_learning_events`);
- **decaimento explícito** de padrões antigos sem reforço.

### 5.2 Migration — `user_patterns`

Arquivo: `supabase/migrations/20260408000001_user_patterns.sql`

```sql
-- user_patterns: regras aprendidas sobre o comportamento do usuário
-- Alimenta a Captura Inteligente com priors específicos por usuário/escopo

CREATE TYPE pattern_type AS ENUM (
  'merchant_category',          -- "POSTO IPIRANGA" → categoria Combustível
  'description_normalization',  -- "MERCPGO LTDA" → "Mercado Pago"
  'counterparty_alias',         -- "ESDRA A. P." e "Esdra Aparecida" → mesmo alias
  'recurring_amount',           -- "Internet Vivo" → R$ 99,90 todo dia 10
  'category_value_range',       -- "Mercado": p10=50, p50=180, p90=450
  'time_pattern',               -- "manhã útil = trabalho/MEI; noite = pessoal"
  'document_disambiguation'     -- "Sicredi: Solicitante = pagador, não usuário"
);

CREATE TYPE pattern_source AS ENUM (
  'observed',   -- extraído passivamente do histórico
  'corrected',  -- usuário corrigiu OCR (sinal forte)
  'declared'    -- usuário declarou explicitamente na UI
);

CREATE TABLE public.user_patterns (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope           scope_type  NOT NULL DEFAULT 'private',
  pattern_type    pattern_type NOT NULL,
  pattern_key     text        NOT NULL,    -- chave normalizada (lowercase, sem acento)
  pattern_value   jsonb       NOT NULL,    -- payload flexível por tipo
  hit_count       integer     NOT NULL DEFAULT 1,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  confidence      numeric(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  source          pattern_source NOT NULL DEFAULT 'observed',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, pattern_type, pattern_key)
);

CREATE INDEX idx_user_patterns_lookup
  ON public.user_patterns (user_id, scope, pattern_type, confidence DESC);

ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own patterns"
  ON public.user_patterns
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_patterns_updated_at
  BEFORE UPDATE ON public.user_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 5.3 Migration — `capture_learning_events` (NOVO — auditoria)

Arquivo: `supabase/migrations/20260408000002_capture_learning_events.sql`

```sql
-- capture_learning_events: registro append-only de tudo que a IA sugeriu
-- vs. tudo que o usuário confirmou na Captura Inteligente.
-- Base auditável para replay de aprendizado, métricas de evolução e debug.

CREATE TABLE public.capture_learning_events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope                scope_type  NOT NULL DEFAULT 'private',
  source_type          text        NOT NULL,  -- 'text','audio','photo','ocr','pdf','word','excel'
  raw_input            text,                  -- input bruto (ou hash, se sensível)
  ocr_text             text,                  -- texto extraído pelo OCR (se aplicável)
  ai_suggested_json    jsonb       NOT NULL,  -- o que a IA sugeriu (snapshot completo)
  hypothesis_ranking   jsonb,                 -- top 3 hipóteses alternativas com probabilidades
                                              -- ex: [{"category_id":"abc","prob":0.82},{"category_id":"def","prob":0.13}]
  user_confirmed_json  jsonb       NOT NULL,  -- o que o usuário confirmou após Modo Espelho
  field_diff_json      jsonb       NOT NULL,  -- {campo: {before, after}} dos campos alterados
  accepted_fields      text[]      NOT NULL DEFAULT '{}',  -- campos que ficaram iguais
  corrected_fields     text[]      NOT NULL DEFAULT '{}',  -- campos que foram alterados
  confidence_before    numeric(3,2),
  time_in_mirror_ms    integer,               -- quanto tempo o usuário ficou no Modo Espelho antes de confirmar
  transaction_id       uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_capture_events_user_time
  ON public.capture_learning_events (user_id, created_at DESC);

CREATE INDEX idx_capture_events_corrections
  ON public.capture_learning_events (user_id, source_type)
  WHERE array_length(corrected_fields, 1) > 0;

ALTER TABLE public.capture_learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own capture events"
  ON public.capture_learning_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own capture events"
  ON public.capture_learning_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Apenas o sistema (service_role) pode deletar (retenção 180 dias via cron)
CREATE POLICY "Users cannot delete own capture events"
  ON public.capture_learning_events
  FOR DELETE USING (false);
```

**Onde popular:** no `SmartCapture.tsx`, ao final do fluxo do Modo Espelho (quando o usuário clica em "Confirmar" após ajustar), antes de criar a transação. Calcular o diff entre `aiSuggested` e `userConfirmed`, gravar o evento, e só depois inserir a transação.

### 5.4 Schema de `pattern_value` por tipo

```typescript
// src/services/userProfile/patternTypes.ts

export type PatternValue =
  | { type: "merchant_category"; merchant_normalized: string;
      category_id: string; category_name: string; sample_descriptions: string[] }
  | { type: "description_normalization"; raw: string; normalized: string }
  | { type: "counterparty_alias"; canonical_name: string; aliases: string[] }
  | { type: "recurring_amount"; descricao: string; valor_tipico: number;
      tolerancia_percent: number; dia_mes_tipico: number | null }
  | { type: "category_value_range"; category_id: string; category_name: string;
      p10: number; p50: number; p90: number; n_amostras: number }
  | { type: "time_pattern"; periodo: "manha" | "tarde" | "noite";
      categoria_dominante: string; scope_dominante: string }
  | { type: "document_disambiguation"; issuer_keyword: string;
      rule: string; field_affected: string };
```

### 5.5 Edge Function — `learn-patterns`

Arquivo: `supabase/functions/learn-patterns/index.ts`

Responsabilidades:

1. **Modo `full`** (chamado por cron diário): varre últimos 90 dias de transações confirmadas do usuário e recalcula todos os padrões. Também roda `decay_stale_patterns()`.
2. **Modo `incremental`** (chamado por trigger ou após `complete_transaction`): processa só uma transação específica.
3. **Modo `from_correction`** (chamado quando usuário corrige OCR): grava `merchant_category` com `source='corrected'` e `confidence=0.95`. **Também consulta `capture_learning_events` para detectar padrões repetidos de correção** (ex: usuário corrigiu o mesmo campo do mesmo emissor 3+ vezes → cria `document_disambiguation`).

**Algoritmos principais:**

```typescript
// merchant_category: extrair "essência" da descrição
function normalizeMerchant(desc: string): string {
  return desc
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // remove acentos
    .replace(/\b(ltda|me|eireli|s\/?a|epp)\b/g, "")    // remove sufixos jurídicos
    .replace(/\d+/g, "")                                // remove números
    .replace(/[^\w\s]/g, " ")                           // remove pontuação
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)                                        // pega primeiros 3 tokens
    .join(" ");
}

// Agrupa transações por merchant_normalized e calcula categoria dominante
function extractMerchantPatterns(txs: Transaction[]): MerchantPattern[] {
  const buckets = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (!tx.descricao) continue;
    const key = normalizeMerchant(tx.descricao);
    if (key.length < 3) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(tx);
  }

  const patterns: MerchantPattern[] = [];
  for (const [key, txs] of buckets) {
    if (txs.length < 2) continue;  // precisa de pelo menos 2 ocorrências

    // Categoria dominante
    const catCounts = new Map<string, number>();
    for (const tx of txs) {
      if (tx.categoria_id) {
        catCounts.set(tx.categoria_id, (catCounts.get(tx.categoria_id) ?? 0) + 1);
      }
    }
    const sorted = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) continue;
    const [topCatId, topCount] = sorted[0];
    const dominance = topCount / txs.length;
    if (dominance < 0.6) continue;  // categoria dominante precisa cobrir >60%

    patterns.push({
      pattern_key: key,
      category_id: topCatId,
      hit_count: topCount,
      confidence: Math.min(0.95, 0.5 + dominance * 0.5),
    });
  }
  return patterns;
}

// category_value_range: percentis por categoria
function extractValueRanges(txs: Transaction[]): ValueRangePattern[] {
  const buckets = new Map<string, number[]>();
  for (const tx of txs) {
    if (!tx.categoria_id) continue;
    if (!buckets.has(tx.categoria_id)) buckets.set(tx.categoria_id, []);
    buckets.get(tx.categoria_id)!.push(Number(tx.valor));
  }

  const patterns: ValueRangePattern[] = [];
  for (const [catId, values] of buckets) {
    if (values.length < 5) continue;
    values.sort((a, b) => a - b);
    patterns.push({
      pattern_key: catId,
      category_id: catId,
      p10: values[Math.floor(values.length * 0.1)],
      p50: values[Math.floor(values.length * 0.5)],
      p90: values[Math.floor(values.length * 0.9)],
      n_amostras: values.length,
      confidence: Math.min(0.9, 0.5 + Math.log10(values.length) * 0.1),
    });
  }
  return patterns;
}

// document_disambiguation: detectar correções repetidas no mesmo tipo de doc
async function extractDocumentRules(userId: string): Promise<DocRulePattern[]> {
  // Lê capture_learning_events dos últimos 60 dias
  // Agrupa por (source_type='ocr', detecção de issuer_keyword no ocr_text)
  // Se mesmo campo é corrigido 3+ vezes para o mesmo emissor, cria regra
  // Ex: 3x corrigiu transaction_type de 'expense' para 'income' em comprovantes Sicredi
  //     → "Sicredi: quando há 'Solicitante' e 'Destinatário', usuário tende a ser destinatário"
}
```

### 5.6 Trigger síncrono para correções de OCR

```sql
-- Trigger: quando usuário corrige categoria de uma transação que veio do OCR
-- dispara aprendizado imediato via edge function

CREATE OR REPLACE FUNCTION public.notify_pattern_learning_on_correction()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.source_type IN ('ocr', 'voice', 'document'))
     AND (OLD.categoria_id IS DISTINCT FROM NEW.categoria_id)
     AND (NEW.categoria_id IS NOT NULL) THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/learn-patterns',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'mode', 'from_correction',
        'transaction_id', NEW.id,
        'user_id', NEW.user_id,
        'old_category_id', OLD.categoria_id,
        'new_category_id', NEW.categoria_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_learn_on_correction
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pattern_learning_on_correction();
```

> **Nota:** se `pg_net` não estiver habilitado no Supabase, alternativa é usar uma `outbox table` que o cron lê a cada minuto.

### 5.7 Decaimento explícito de padrões antigos (NOVO)

Arquivo: `supabase/migrations/20260408000003_decay_function.sql`

```sql
-- Função executada pelo cron diário antes da varredura completa
CREATE OR REPLACE FUNCTION public.decay_stale_patterns() RETURNS void AS $$
BEGIN
  -- Padrões observados sem reforço há >30 dias perdem 0.05 de confidence
  UPDATE public.user_patterns
  SET confidence = GREATEST(0.1, confidence - 0.05),
      updated_at = now()
  WHERE source = 'observed'
    AND last_seen_at < now() - interval '30 days'
    AND confidence > 0.1;

  -- Padrões com confidence muito baixa e sem uso há 90d são apagados
  -- (apenas observed; corrected e declared nunca são apagados automaticamente)
  DELETE FROM public.user_patterns
  WHERE source = 'observed'
    AND confidence < 0.2
    AND last_seen_at < now() - interval '90 days';

  -- Retenção de capture_learning_events: 180 dias
  DELETE FROM public.capture_learning_events
  WHERE created_at < now() - interval '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

O cron diário chama `decay_stale_patterns()` antes de chamar `learn-patterns mode=full` para cada usuário ativo.

### 5.8 Cron diário

Configurar Supabase scheduled function (`pg_cron`) ou usar Vercel Cron Jobs apontando para a edge function:

```
0 4 * * * → SELECT decay_stale_patterns(); depois POST /functions/v1/learn-patterns { "mode": "full" }
```

### 5.9 Integração na Captura

Atualizar `getCaptureContext` para incluir top 30 padrões com `confidence > 0.6`:

```typescript
const { data: patterns } = await supabase
  .from("user_patterns")
  .select("pattern_type, pattern_key, pattern_value, confidence")
  .eq("user_id", userId)
  .eq("scope", currentScope)
  .gte("confidence", 0.6)
  .order("confidence", { ascending: false })
  .order("hit_count", { ascending: false })
  .limit(30);
```

E formatar como bloco compacto no `contextBlock`:

```
padroes_aprendidos:
- POSTO IPIRANGA → Combustível (95%, 12 ocorrências)
- MERCADO PAGO → cobrança recebida (87%, 8 ocorrências)
- counterparty "ESDRA APARECIDA" = alias da esposa (declarado)
- categoria Mercado: faixa típica R$50-450, mediana R$180
- categoria Combustível: faixa típica R$80-200, mediana R$120
- regra Sicredi: quando há "Solicitante" e "Destinatário", usuário tende a ser o destinatário (income)
```

### 5.10 Critérios de aceite Sprint 2

- [ ] Migrations aplicadas sem erros, RLS funcionando.
- [ ] Cron diário roda `decay_stale_patterns()` + `learn-patterns full` e popula `user_patterns`.
- [ ] Trigger de correção dispara em <500ms após UPDATE.
- [ ] OCR seguinte de "POSTO IPIRANGA" depois de uma correção manual sugere a categoria correta com confidence='alta'.
- [ ] Tabela `user_patterns` não passa de ~500 linhas para usuário com 1000+ transações (deduplicação efetiva).
- [ ] **`capture_learning_events` é populado em todo confirm do Modo Espelho.**
- [ ] **Padrão `observed` que não é reforçado por 30 dias começa a perder confidence visível em query de auditoria.**

---

## 6. Sprint 3 — Evoluir a memória episódica

**Duração estimada:** 2-3 dias
**Risco:** baixo (refinamento de estrutura existente)
**Ganho percebido:** alto (IA Conselheira para de soar genérica)

### 6.1 Objetivo

A Camada 3 (`ai_coach_memory`) deixa de ser uma lista crua e vira uma curadoria viva, com tipos, deduplicação semântica, reforço, expiração diferenciada e **decaimento gradual antes da expiração**.

Adicionalmente: introduzir o bloco consolidado **`⚠️ INCERTEZAS E LIMITES DESTA ANÁLISE`** no system prompt para que o LLM calibre melhor a confiança das afirmações.

### 6.2 Migration de evolução

Arquivo: `supabase/migrations/20260410000001_ai_coach_memory_v2.sql`

```sql
CREATE TYPE coach_memory_type AS ENUM (
  'observation',     -- "tende a evitar categorizar lazer"
  'preference',      -- "prefere protocolos curtos e diretos"
  'concern',         -- "reserva abaixo da meta há 3 meses"
  'goal_context',    -- "comprou Macbook em março — lembrar nas próximas decisões de tecnologia"
  'value_alignment'  -- "valoriza generosidade — dízimo CCB recorrente"
);

ALTER TABLE public.ai_coach_memory
  ADD COLUMN memory_type coach_memory_type NOT NULL DEFAULT 'observation',
  ADD COLUMN pattern_key text,
  ADD COLUMN reinforcement_count integer NOT NULL DEFAULT 1,
  ADD COLUMN last_reinforced_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN superseded_by uuid REFERENCES public.ai_coach_memory(id);

CREATE INDEX idx_coach_memory_active
  ON public.ai_coach_memory (user_id, scope, memory_type, last_reinforced_at DESC)
  WHERE superseded_by IS NULL
    AND (expires_at IS NULL OR expires_at > now());

-- Função para upsert com reforço
CREATE OR REPLACE FUNCTION public.upsert_coach_memory(
  p_user_id uuid,
  p_scope text,
  p_memory_type coach_memory_type,
  p_pattern_key text,
  p_content text,
  p_relevance integer,
  p_ttl_days integer DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
  v_existing_id uuid;
BEGIN
  -- Tenta achar memória existente com mesmo pattern_key
  SELECT id INTO v_existing_id
  FROM public.ai_coach_memory
  WHERE user_id = p_user_id
    AND scope = p_scope
    AND memory_type = p_memory_type
    AND pattern_key = p_pattern_key
    AND superseded_by IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.ai_coach_memory
    SET reinforcement_count = reinforcement_count + 1,
        last_reinforced_at = now(),
        relevance = GREATEST(relevance, p_relevance),
        content = p_content
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  ELSE
    INSERT INTO public.ai_coach_memory
      (user_id, scope, memory_type, pattern_key, content, relevance, expires_at)
    VALUES
      (p_user_id, p_scope, p_memory_type, p_pattern_key, p_content, p_relevance,
       CASE WHEN p_ttl_days IS NOT NULL THEN now() + (p_ttl_days || ' days')::interval ELSE NULL END)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6.3 Decaimento de memórias antes da expiração (NOVO)

Mesma lógica do Sprint 2, aplicada a `ai_coach_memory`:

```sql
CREATE OR REPLACE FUNCTION public.decay_stale_coach_memories() RETURNS void AS $$
BEGIN
  -- Observations sem reforço há >45 dias perdem relevância gradualmente
  UPDATE public.ai_coach_memory
  SET relevance = GREATEST(1, relevance - 1)
  WHERE memory_type = 'observation'
    AND last_reinforced_at < now() - interval '45 days'
    AND relevance > 1
    AND superseded_by IS NULL;

  -- Concerns que não foram reforçados há >30 dias começam a decair também
  UPDATE public.ai_coach_memory
  SET relevance = GREATEST(1, relevance - 1)
  WHERE memory_type = 'concern'
    AND last_reinforced_at < now() - interval '30 days'
    AND relevance > 1
    AND superseded_by IS NULL;

  -- Preferences e value_alignment NUNCA decaem (são identidade do usuário)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Adicionado ao cron diário junto com `decay_stale_patterns()`.

### 6.4 Refinar o protocolo `INSIGHT_COACH`

Atualizar a instrução final em `systemPrompt.ts`:

```
INSTRUÇÃO FINAL OBRIGATÓRIA — MEMÓRIA COMPORTAMENTAL:
Ao terminar cada resposta, adicione UMA linha JSON no formato exato (sem markdown, sem prefixo de lista):

INSIGHT_COACH_JSON: {"type":"<tipo>","key":"<chave_curta>","content":"<observação>","relevance":<1-10>}

Tipos válidos:
- observation: padrão observado neste turno (TTL 60 dias)
- preference: como o usuário gosta de receber feedback (permanente)
- concern: preocupação ativa que deve voltar à tona (TTL 30 dias)
- goal_context: contexto de meta/decisão importante (TTL até meta concluída)
- value_alignment: valor pessoal/identidade que orienta decisões (permanente)

A "key" deve ser curta, snake_case, semântica — para deduplicação. Exemplos:
- "avoidance_lazer", "prefere_diretividade", "reserva_baixa_persistente",
- "objetivo_macbook_2026", "generosidade_dizimo_ccb"

Se este insight reforça algo já dito antes, use a MESMA key — o sistema vai
incrementar o contador de reforço automaticamente.
```

### 6.5 Refinar parser na edge function

Substituir o regex atual em `supabase/functions/ai-advisor/index.ts` (linha 221):

```typescript
let coachInsight: { type: string; key: string; content: string; relevance: number } | null = null;
const insightMatch = accumulated.match(/\nINSIGHT_COACH_JSON:\s*(\{.+?\})(?:\n|$)/);
if (insightMatch) {
  try {
    const parsed = JSON.parse(insightMatch[1]);
    if (parsed.type && parsed.key && parsed.content) {
      coachInsight = {
        type: parsed.type,
        key: parsed.key.slice(0, 80),
        content: parsed.content.slice(0, 300),
        relevance: Math.max(1, Math.min(10, parsed.relevance ?? 5)),
      };
    }
  } catch {}
  textToCache = accumulated.replace(/\nINSIGHT_COACH_JSON:.*?(?:\n|$)/, "").trim();
}

if (coachInsight) {
  const ttlMap: Record<string, number | null> = {
    observation: 60,
    concern: 30,
    preference: null,
    goal_context: 180,
    value_alignment: null,
  };
  const ttl = ttlMap[coachInsight.type] ?? 60;

  await supabase.rpc("upsert_coach_memory", {
    p_user_id: userId,
    p_scope: scope,
    p_memory_type: coachInsight.type,
    p_pattern_key: coachInsight.key,
    p_content: coachInsight.content,
    p_relevance: coachInsight.relevance,
    p_ttl_days: ttl,
  });
}
```

### 6.6 Refinar o carregamento de memórias

Substituir o bloco que lê 5 últimas memórias por uma curadoria:

```typescript
// Curadoria: preferences sempre, concerns ativos, observations top-rankeados
const { data: preferences } = await supabase.from("ai_coach_memory")
  .select("content, memory_type, pattern_key")
  .eq("user_id", userId).eq("scope", scope)
  .eq("memory_type", "preference").is("superseded_by", null)
  .order("relevance", { ascending: false }).limit(3);

const { data: concerns } = await supabase.from("ai_coach_memory")
  .select("content, memory_type, pattern_key")
  .eq("user_id", userId).eq("scope", scope)
  .eq("memory_type", "concern").is("superseded_by", null)
  .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
  .order("reinforcement_count", { ascending: false }).limit(3);

const { data: observations } = await supabase.from("ai_coach_memory")
  .select("content, memory_type, pattern_key, reinforcement_count, relevance")
  .eq("user_id", userId).eq("scope", scope)
  .eq("memory_type", "observation").is("superseded_by", null)
  .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
  .order("reinforcement_count", { ascending: false }).limit(4);

const { data: values } = await supabase.from("ai_coach_memory")
  .select("content, memory_type")
  .eq("user_id", userId).eq("scope", scope)
  .eq("memory_type", "value_alignment").is("superseded_by", null).limit(3);

const coachMemoriesSection = [
  preferences?.length ? `\n💎 PREFERÊNCIAS DO USUÁRIO:\n${preferences.map(p => `- ${p.content}`).join("\n")}` : "",
  values?.length ? `\n🌟 VALORES E IDENTIDADE:\n${values.map(v => `- ${v.content}`).join("\n")}` : "",
  concerns?.length ? `\n⚠️ PREOCUPAÇÕES ATIVAS:\n${concerns.map(c => `- ${c.content}`).join("\n")}` : "",
  observations?.length ? `\n🧠 PADRÕES OBSERVADOS:\n${observations.map(o => `- ${o.content} (visto ${o.reinforcement_count}x)`).join("\n")}` : "",
].filter(Boolean).join("\n");
```

### 6.7 Bloco "⚠️ Incertezas e Limites" consolidado (NOVO)

Adicionar ao `systemPrompt.ts` uma seção dedicada que consolida todas as fontes de incerteza, em vez de espalhá-las pelo prompt:

```typescript
function buildUncertaintyBlock(context: FinancialContext): string {
  const limits: string[] = [];

  // Pendências
  if (context.pendencias.count > 0) {
    limits.push(`${context.pendencias.count} transações pendentes (${context.pendencias.tipos.suggested} sugeridas, ${context.pendencias.tipos.incomplete} incompletas) — não fazem parte do saldo confirmado`);
  }

  // Qualidade de dados
  if (context.qualidadeDados.impactoNaPrecisao !== 'baixo') {
    limits.push(`Qualidade de dados: ${context.qualidadeDados.impactoNaPrecisao.toUpperCase()} — análises de tendência podem ser imprecisas`);
  }

  // Histórico curto
  if (context.historicoMensal.length < 3) {
    limits.push(`Apenas ${context.historicoMensal.length} mês(es) de histórico — comparações sazonais não confiáveis`);
  }

  // Memória de progresso limitada
  if (context.progressoMemoria.limitations.length > 0) {
    limits.push(...context.progressoMemoria.limitations);
  }

  // Reserva sem configuração
  if (!context.reservaEmergencia) {
    limits.push("Reserva de emergência não configurada — não é possível avaliar cobertura");
  }

  // Perfil comportamental insuficiente
  if (context.perfilComportamental.consistenciaRegistro === 'baixa') {
    limits.push("Histórico de registro inconsistente — perfil comportamental tem confiança baixa");
  }

  if (limits.length === 0) {
    return `\n⚠️ INCERTEZAS E LIMITES DESTA ANÁLISE:\n- Nenhuma limitação relevante identificada. Os dados disponíveis sustentam análise confiável.\n`;
  }

  return `\n⚠️ INCERTEZAS E LIMITES DESTA ANÁLISE:
Use esta lista para calibrar a confiança das suas afirmações. Não esconda essas limitações; reconheça-as quando relevante.
${limits.map(l => `- ${l}`).join("\n")}
`;
}
```

E injetar esse bloco no `buildSystemPrompt`, **logo após o resumo dos dados reais e antes das instruções de formato**.

### 6.8 Critérios de aceite Sprint 3

- [ ] Migration aplicada, função `upsert_coach_memory` testada.
- [ ] IA emite `INSIGHT_COACH_JSON` em formato válido em pelo menos 90% das respostas.
- [ ] Insight repetido com mesma `key` incrementa `reinforcement_count` em vez de criar duplicata.
- [ ] Após 5 conversas, a IA Conselheira referencia espontaneamente algo dito em conversas anteriores.
- [ ] Memórias do tipo `observation` antigas (>60 dias) deixam de aparecer no contexto.
- [ ] **`decay_stale_coach_memories()` roda no cron diário e diminui relevance de observations >45d.**
- [ ] **Bloco `⚠️ INCERTEZAS E LIMITES` aparece em toda resposta com pelo menos 1 item listado quando há pendências.**

---

## 7. Sprint 4 — Loop de feedback explícito

**Duração estimada:** 3 dias (era 2; aumentou pela tabela de preferências e feedback widget)
**Risco:** baixo (UI puro + endpoints CRUD)
**Ganho percebido:** alto (sensação de controle e transparência)

### 7.1 Objetivo

Dar ao usuário controle sobre o que a IA "sabe" sobre ele, e permitir feedback ativo sobre cada resposta. Transparência cria confiança.

### 7.2 Tabela `user_ai_preferences` (NOVO — separada de memórias)

Arquivo: `supabase/migrations/20260415000001_user_ai_preferences.sql`

```sql
-- Preferências declarativas do usuário sobre como a IA deve se comportar.
-- Diferente de ai_coach_memory: aqui são CONFIGURAÇÕES, não observações inferidas.

CREATE TABLE public.user_ai_preferences (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tom e estilo
  tom_voz              text NOT NULL DEFAULT 'coach'
                       CHECK (tom_voz IN ('direto','empatico','analitico','coach')),
  nivel_detalhamento   text NOT NULL DEFAULT 'medio'
                       CHECK (nivel_detalhamento IN ('executivo','medio','profundo')),
  frequencia_alertas   text NOT NULL DEFAULT 'normal'
                       CHECK (frequencia_alertas IN ('minima','normal','intensa')),

  -- Identidade declarada (vai para o contexto de TODA chamada de IA)
  contexto_identidade  text,  -- ex: "Cap PMESP, casado com Esdra, filha Melinda, CCB"
  valores_pessoais     text[],
  compromissos_fixos   jsonb, -- ex: [{"descricao":"Dízimo CCB","dia":5,"valor":300}]

  -- Preferências religiosas/culturais
  usar_versiculos_acf  boolean NOT NULL DEFAULT false,
  contexto_religioso   text,

  -- Preferências de aconselhamento
  prioridade_default   text CHECK (prioridade_default IN ('seguranca','crescimento','equilibrio')) DEFAULT 'equilibrio',
  tratar_parcelamentos text CHECK (tratar_parcelamentos IN ('mes_atual','competencia','perguntar')) DEFAULT 'perguntar',

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.user_ai_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_ai_preferences_updated_at
  BEFORE UPDATE ON public.user_ai_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

Essas preferências são lidas tanto pelo `contextCollector` quanto pelo `captureContext` e injetadas no system prompt em formato compacto.

### 7.3 Tela `Settings → Memória da IA`

Nova rota: `/settings/ai-memory`. **Quatro abas** (era 3; adicionada a aba de histórico de capturas):

#### Aba 1 — Padrões aprendidos (`user_patterns`)

- Lista todos os padrões agrupados por tipo
- Cada item mostra: chave, valor, confidence, hit_count, source, last_seen_at
- Ações por item:
  - **Aprovar** → `confidence = 1.0`, `source = 'declared'`
  - **Recusar** → DELETE
  - **Editar valor** → permite ajustar `pattern_value`

#### Aba 2 — Memória do Coach (`ai_coach_memory`)

- Lista agrupada por `memory_type`
- Mostra `content`, `reinforcement_count`, `relevance`, `last_reinforced_at`
- Ações por item:
  - **"Não me representa"** → marca `superseded_by = self`
  - **"Importante — sempre lembrar"** → muda `memory_type` para `preference` e remove `expires_at`
  - **Editar conteúdo** → atualiza `content`

#### Aba 3 — Preferências da IA (`user_ai_preferences`)

- Form estruturado com selects, sliders e checkboxes para todos os campos da tabela
- Campos texto livre para `contexto_identidade`, `valores_pessoais` e `contexto_religioso`
- Editor JSON-like para `compromissos_fixos`
- Salvar reflete imediatamente nas próximas chamadas de IA

#### Aba 4 — Histórico de capturas (`capture_learning_events`) (NOVO)

- Lista os últimos 50 eventos de captura, mais recentes primeiro
- Mostra: data, source_type, raw_input (truncado), resumo do diff (campos corrigidos)
- Ações:
  - **Reabrir e corrigir** → leva o evento de volta para o Modo Espelho com os valores originais para ajuste
  - **Reportar erro do OCR** → marca o evento como "amostra de falha conhecida" para análise

Essa aba resolve o caso "a IA errou e eu não tive tempo de corrigir na hora — quero voltar nele depois".

### 7.4 Componente `<ResponseFeedback>` (NOVO)

Componente React que aparece abaixo de cada resposta da IA Conselheira:

```tsx
// src/components/shared/ResponseFeedback.tsx
interface Props {
  messageId: string;
  contextUsedIds: { patterns: string[]; memories: string[] };
}

export function ResponseFeedback({ messageId, contextUsedIds }: Props) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  async function handleRating(value: 'up' | 'down') {
    setRating(value);
    if (value === 'down') setShowComment(true);

    await supabase.rpc('apply_response_feedback', {
      p_message_id: messageId,
      p_rating: value,
      p_pattern_ids: contextUsedIds.patterns,
      p_memory_ids: contextUsedIds.memories,
    });
  }

  // Renderiza 👍 / 👎 + textarea opcional
}
```

E o RPC correspondente:

```sql
CREATE OR REPLACE FUNCTION public.apply_response_feedback(
  p_message_id uuid,
  p_rating text,         -- 'up' | 'down'
  p_pattern_ids uuid[],
  p_memory_ids uuid[],
  p_comment text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF p_rating = 'up' THEN
    -- Reforça padrões usados
    UPDATE public.user_patterns
    SET hit_count = hit_count + 1,
        confidence = LEAST(1.0, confidence + 0.05),
        last_seen_at = now()
    WHERE id = ANY(p_pattern_ids) AND user_id = auth.uid();

    -- Reforça memórias usadas
    UPDATE public.ai_coach_memory
    SET reinforcement_count = reinforcement_count + 1,
        last_reinforced_at = now()
    WHERE id = ANY(p_memory_ids) AND user_id = auth.uid();

  ELSIF p_rating = 'down' THEN
    -- Diminui confiança dos padrões usados
    UPDATE public.user_patterns
    SET confidence = GREATEST(0.1, confidence - 0.10)
    WHERE id = ANY(p_pattern_ids) AND user_id = auth.uid();

    -- Se houver comentário, vira preference
    IF p_comment IS NOT NULL AND length(p_comment) > 5 THEN
      PERFORM public.upsert_coach_memory(
        auth.uid(), 'private', 'preference',
        'feedback_' || md5(p_comment),
        p_comment, 7, NULL
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 7.5 Botão "Por que você sugeriu isso?"

Em qualquer resposta da IA Conselheira, um ícone discreto (ℹ️) que abre modal mostrando:

- Quais memórias (`ai_coach_memory`) foram injetadas
- Quais padrões (`user_patterns`) influenciaram (se for resposta da Captura)
- Qual snapshot comportamental foi usado
- Qual `userIntentHint` foi detectado

Implementação: a edge function passa a retornar, junto da resposta, um header `X-Context-Used` com IDs das memórias e padrões usados. O front-end armazena por mensagem e usa tanto no modal quanto no `<ResponseFeedback>`.

### 7.6 Endpoints LGPD

```typescript
// supabase/functions/user-data-export/index.ts
// Retorna JSON com: profile, patterns, coach_memory, capture_events, preferences, decisions

// supabase/functions/user-data-purge/index.ts
// Recebe { scope?: string, types?: string[] } e apaga seletivamente
```

### 7.7 Critérios de aceite Sprint 4

- [ ] Tela `/settings/ai-memory` funciona nas 4 abas com CRUD completo.
- [ ] "Aprovar" um padrão faz com que a Captura nunca mais erre aquele caso.
- [ ] "Não me representa" remove a memória do contexto da próxima conversa.
- [ ] Modal "Por que" exibe pelo menos 1 memória/padrão real usado naquela resposta.
- [ ] **Botão 👍 reforça os padrões usados; 👎 diminui a confidence.**
- [ ] **Comentário em 👎 vira `preference` na `ai_coach_memory`.**
- [ ] **Tabela `user_ai_preferences` é lida e injetada no prompt em toda chamada.**
- [ ] **Aba "Histórico de capturas" lista eventos com diff legível.**
- [ ] Export retorna JSON válido com todos os dados pessoais.

---

## 8. Sprint 5 — Aprender com a aderência aos conselhos

**Duração estimada:** 3-4 dias
**Risco:** médio (lógica de outcome detection)
**Ganho percebido:** médio-alto (longo prazo)
**Status:** opcional — pode ser adiado se houver pressão de prazo

### 8.1 Objetivo

A IA Conselheira deixa de aconselhar no escuro. Cada recomendação significativa vira uma **hipótese testável**, com aderência medida e resultado observado depois de N dias. Isso permite descobrir quais tipos de conselho realmente ajudam **este usuário específico**.

### 8.2 Princípio importante — não pode virar moralismo

Esta funcionalidade é **estritamente informativa, nunca acusatória**. A IA não deve cobrar o usuário por não ter seguido um conselho. O `observed_result` serve para a IA aprender a calibrar suas próximas sugestões, não para criar culpa.

Exemplos do que **não fazer**:
- ❌ "Você não seguiu meu conselho de antecipar a parcela. Olha no que deu."
- ❌ "Já te falei mês passado e você ignorou."

Exemplos do que **fazer**:
- ✅ (no contexto interno da IA, não exibido) "Recomendações de antecipação de dívida têm aderência baixa para este usuário — considerar abordar diferentemente."
- ✅ "Em março você optou por proteger caixa em vez de antecipar a dívida — vamos olhar como está o saldo agora antes de revisitar a decisão."

### 8.3 Migration — `decision_outcomes`

Arquivo: `supabase/migrations/20260420000001_decision_outcomes.sql`

```sql
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
  'accepted',    -- usuário marcou "vou seguir"
  'rejected',    -- usuário marcou "não faz sentido"
  'ignored',     -- usuário não interagiu
  'postponed',   -- usuário marcou "depois"
  'partial'      -- usuário seguiu parcialmente
);

CREATE TABLE public.decision_outcomes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope                    scope_type NOT NULL DEFAULT 'private',
  recommendation_type      recommendation_type NOT NULL,
  recommendation_summary   text NOT NULL,         -- frase curta resumindo o conselho
  recommendation_payload   jsonb NOT NULL,        -- detalhes completos (valores, prazos)
  context_snapshot         jsonb NOT NULL,        -- snapshot do FinancialContext na hora
  message_id               uuid,                  -- referência opcional ao turno do chat

  user_response            user_response_type,    -- preenchido quando usuário marca
  user_response_at         timestamptz,
  user_response_note       text,

  observed_result          jsonb,                 -- preenchido pelo cron de review
  observed_at              timestamptz,
  reviewed_after_days      integer,

  effectiveness_score      numeric(3,2),          -- 0-1, calculado no review
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decision_outcomes_pending_review
  ON public.decision_outcomes (user_id, created_at)
  WHERE observed_at IS NULL;

CREATE INDEX idx_decision_outcomes_by_type
  ON public.decision_outcomes (user_id, recommendation_type, effectiveness_score DESC NULLS LAST);

ALTER TABLE public.decision_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own decisions"
  ON public.decision_outcomes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own decision responses"
  ON public.decision_outcomes
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 8.4 Detecção de recomendações no fluxo do Advisor

Ao final do streaming da resposta da IA, **além** de extrair `INSIGHT_COACH_JSON`, extrair também:

```
RECOMMENDATION_JSON: {"type":"antecipar_divida","summary":"Antecipar 2 parcelas do empréstimo Banco do Brasil","payload":{"loan_id":"abc","parcelas":2,"valor_total":1200}}
```

Quando detectado, gravar em `decision_outcomes` com `user_response=NULL` (pendente).

### 8.5 UI de marcação de resposta

Quando uma recomendação é detectada na resposta, exibir abaixo do texto **3 botões pequenos** ao lado do `<ResponseFeedback>`:

- ✅ "Vou seguir"
- ⏸ "Depois"
- ❌ "Não vou seguir"
- (opcional) campo "por quê?" se clicar em ❌

Esses botões disparam um RPC `mark_decision_response(decision_id, response, note)`.

### 8.6 Cron de review

Diário, busca todos os `decision_outcomes` com:
- `user_response IS NOT NULL`
- `observed_at IS NULL`
- `created_at < now() - interval '30 days'`

Para cada um, monta um `observed_result` baseado nos dados financeiros atuais comparados ao snapshot no momento da recomendação. Calcula `effectiveness_score` simples (ex: para `antecipar_divida`, verifica se a dívida diminuiu mais do que o esperado).

### 8.7 Uso no contexto da IA

No `contextCollector`, adicionar uma seção com **estatísticas de aderência por tipo** para o usuário:

```
📊 ADERÊNCIA HISTÓRICA POR TIPO DE RECOMENDAÇÃO:
- antecipar_divida: 1 aceita, 2 adiadas (33% aderência) — usuário tende a postergar
- reforcar_reserva: 4 aceitas, 0 rejeitadas (100% aderência) — alta receptividade
- cortar_recorrente: 0 aceitas, 1 rejeitada — baixa receptividade
```

Esse bloco vai no `systemPrompt.ts` com instrução clara: *"Use isso para calibrar **como** apresentar próximas recomendações deste tipo, nunca para cobrar o usuário do passado."*

### 8.8 Critérios de aceite Sprint 5

- [ ] IA Conselheira passa a emitir `RECOMMENDATION_JSON` quando dá conselho específico.
- [ ] Botões de resposta aparecem abaixo de respostas com recomendação.
- [ ] Cron de review preenche `observed_result` após 30 dias.
- [ ] Bloco de aderência histórica aparece no prompt para usuários com 3+ recomendações.
- [ ] **Em nenhum momento a IA cobra moralmente o usuário por recomendação não seguida** (validado por testes manuais).

---

## 9. Sprint 6 — Coach Comportamental Profundo e Gamificação Adaptativa

**Duração estimada:** 6-8 dias
**Risco:** médio (telemetria nova, embeddings, gamificação requer ajuste fino)
**Ganho percebido:** transformacional (a IA passa a parecer que conhece você de verdade)
**Status:** opcional — implementar depois que Sprints 1-4 estiverem em produção e estáveis

### 9.1 Objetivo

Transformar a IA Conselheira de assistente reativo em **coach comportamental profundo**: alguém que conhece os padrões emocionais, cognitivos e neurocientíficos por trás das suas decisões financeiras, e usa esse conhecimento para iluminar pontos cegos. Adicionalmente, implementar uma camada de **gamificação adaptativa pró-neurodivergente** que reduz fricção de uso e ajuda a vencer procrastinação sem virar dependência.

### 9.2 Princípio de design — gamificação como prótese cognitiva, não como gancho

A literatura de neurociência mostra que cérebros com traços neurodivergentes (TDAH, alta sensibilidade, giftedness, INFJ com perfeccionismo) frequentemente têm dopamina tônica mais baixa, o que torna difícil engajar com tarefas cuja recompensa é distante e abstrata — exatamente o caso de finanças pessoais. Gamificação bem desenhada **não substitui motivação intrínseca**: ela cria a ponte cognitiva para que a motivação intrínseca tenha chance de aparecer no dia a dia.

Para perfis com alta sensibilidade e perfeccionismo, há uma linha fina entre gamificação que ajuda e gamificação que ansia. As 5 regras de design abaixo foram escolhidas especificamente para ficar do lado certo dessa linha:

| Princípio | O que faz | O que evita |
|---|---|---|
| **Streaks suaves** | "12 de 14 dias" — quebrar não zera | Streaks que zeram (gera ansiedade e medo) |
| **Conquista sobre processo, não resultado** | Badge por "registrou 30 transações" | Badge por "economizou R$500" (depende de fatores externos) |
| **Microrrecompensas dentro do app** | Microanimação satisfatória ao confirmar transação | Push notifications de engajamento ("volte!") |
| **Desafios opcionais ativados pelo usuário** | Tela "Desafios disponíveis" — você ativa | IA empurra desafio sem você pedir |
| **Conquistas identitárias possíveis** | "Mordomo Fiel: 3 meses de dízimo em dia" | Badges genéricos tipo "ouro nível 3" |

### 9.3 Telemetria comportamental — `user_engagement_events`

Arquivo: `supabase/migrations/20260425000001_engagement_events.sql`

```sql
CREATE TABLE public.user_engagement_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  -- 'screen_view', 'screen_exit', 'time_on_page', 'alert_dismissed',
  -- 'insight_liked', 'insight_disliked', 'transaction_reopened',
  -- 'field_hovered', 'mirror_hesitation', 'goal_inspected',
  -- 'loan_inspected', 'recurring_inspected'
  target_id    text,                       -- id contextual (alert_id, transaction_id, etc.)
  context_data jsonb NOT NULL DEFAULT '{}',
  -- ex: { dayOfWeek: 5, hourOfDay: 23, screenName: "Loans", durationMs: 45000 }
  scope        scope_type NOT NULL DEFAULT 'private',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_engagement_user_time
  ON public.user_engagement_events (user_id, event_type, created_at DESC);

CREATE INDEX idx_engagement_recent
  ON public.user_engagement_events (user_id, created_at DESC)
  WHERE created_at > now() - interval '90 days';

ALTER TABLE public.user_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own events"
  ON public.user_engagement_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own events"
  ON public.user_engagement_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 9.4 Hook React `useBehaviorTracking`

Arquivo: `src/services/telemetry/useBehaviorTracking.ts`

```typescript
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useScopeContext } from '@/contexts/ScopeContext';

interface TrackEventParams {
  event_type: string;
  target_id?: string;
  context_data?: Record<string, unknown>;
}

export function useBehaviorTracking() {
  const { user } = useAuth();
  const { currentScope } = useScopeContext();

  async function trackEvent({ event_type, target_id, context_data = {} }: TrackEventParams) {
    if (!user) return;
    const now = new Date();
    const enriched = {
      ...context_data,
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
    };
    // Fire-and-forget — não bloqueia UI
    supabase.from('user_engagement_events').insert({
      user_id: user.id,
      event_type,
      target_id,
      context_data: enriched,
      scope: currentScope === 'all' ? 'private' : currentScope,
    }).then(() => {});
  }

  return { trackEvent };
}

/**
 * Hook auxiliar: rastreia entrada e tempo em uma tela.
 * Uso: useScreenTracking('Dashboard')
 */
export function useScreenTracking(screenName: string) {
  const { trackEvent } = useBehaviorTracking();
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    trackEvent({ event_type: 'screen_view', context_data: { screenName } });
    const enter = Date.now();
    return () => {
      const durationMs = Date.now() - enter;
      // Só registra se passou >2s (evita ruído de navegação acidental)
      if (durationMs > 2000) {
        trackEvent({
          event_type: 'time_on_page',
          context_data: { screenName, durationMs },
        });
      }
    };
  }, [screenName]);
}
```

Adicionar `useScreenTracking('Dashboard')` em cada página principal: Dashboard, Loans, Goals, Budget, Transactions, AiAdvisor, SmartCapture, MonthlyClosing.

### 9.5 Sinais implícitos da Captura (instrumentação do Modo Espelho)

No `SmartCapture.tsx`, instrumentar:

```typescript
const mirrorOpenedAt = useRef<number>(0);

// Quando o Modo Espelho abre:
mirrorOpenedAt.current = Date.now();

// Quando usuário foca em um campo (sinal de hesitação):
function handleFieldFocus(field: string) {
  trackEvent({
    event_type: 'field_hovered',
    context_data: { field, since_mirror_opened_ms: Date.now() - mirrorOpenedAt.current },
  });
}

// Quando usuário confirma:
async function handleConfirm() {
  const time_in_mirror_ms = Date.now() - mirrorOpenedAt.current;
  // Grava capture_learning_event com o tempo
  await supabase.from('capture_learning_events').insert({
    // ... outros campos
    time_in_mirror_ms,
  });
}
```

E o evento `transaction_reopened`: quando o usuário abre uma transação confirmada nos próximos 7 dias para editar, é sinal forte de que a captura original ficou imperfeita. Esse evento alimenta a confidence dos padrões aprendidos.

### 9.6 Embeddings vetoriais para merchant matching

**Migration:** habilitar `pgvector` no Supabase e adicionar coluna a `user_patterns`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.user_patterns
  ADD COLUMN merchant_embedding vector(384);

CREATE INDEX idx_patterns_embedding ON public.user_patterns
  USING ivfflat (merchant_embedding vector_cosine_ops)
  WHERE pattern_type = 'merchant_category';
```

**Geração de embeddings** (no `learn-patterns` edge function):

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",  // 384 dimensões, custo $0.02/1M tokens
      input: text,
      dimensions: 384,
    }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}
```

**Uso no `smart-capture-interpret`**: quando o OCR extrai uma descrição nova, gerar embedding na hora e fazer query de similaridade:

```sql
SELECT pattern_value, confidence,
       1 - (merchant_embedding <=> $1::vector) AS similarity
FROM user_patterns
WHERE user_id = $2
  AND scope = $3
  AND pattern_type = 'merchant_category'
  AND merchant_embedding IS NOT NULL
ORDER BY merchant_embedding <=> $1::vector
LIMIT 5;
```

Resultado: "POSTO IPIRANGA BR-153" e "POSTO SHELL VIA NORTE" ficam próximos no espaço vetorial sem precisar de regex frágil. O sistema entende que são o mesmo conceito.

**Custo:** $0.02 por 1M tokens. Para usuário com ~500 padrões e ~50 capturas/mês, o custo mensal de embeddings é insignificante (centavos).

### 9.7 Detecção de padrões comportamentais — `behavioral_tags`

Arquivo: `supabase/migrations/20260425000002_behavioral_tags.sql`

```sql
CREATE TABLE public.behavioral_tags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_key         text NOT NULL,
  -- Exemplos:
  -- 'anxiety_debt_focus' — olha tela de dívidas obsessivamente
  -- 'late_night_spending' — compras frequentes após 22h
  -- 'weekend_impulse' — gastos fora da curva nos fins de semana
  -- 'high_savings_consistency' — economiza consistentemente
  -- 'avoidance_lazer' — evita categorizar despesas de lazer
  -- 'fim_de_mes_pressionado' — saldos críticos sempre nos últimos 5 dias
  -- 'early_morning_planner' — usa o app na manhã planejando o dia
  -- 'reactive_user' — só usa o app após receber alerta crítico
  intensity       numeric(3,2) NOT NULL CHECK (intensity BETWEEN 0 AND 1),
  confidence      numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence        jsonb NOT NULL,  -- dados que sustentam a detecção
  detected_at     timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  UNIQUE (user_id, tag_key)
);

CREATE INDEX idx_behavioral_tags_active
  ON public.behavioral_tags (user_id, intensity DESC)
  WHERE expires_at > now();

ALTER TABLE public.behavioral_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tags"
  ON public.behavioral_tags FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 9.8 Edge Function `analyze-behavioral-patterns`

Roda diariamente como parte do cron junto com `learn-patterns`:

```typescript
// supabase/functions/analyze-behavioral-patterns/index.ts

interface PatternDetector {
  tag_key: string;
  detect: (events: Event[], txs: Transaction[]) => { intensity: number; confidence: number; evidence: object } | null;
}

const detectors: PatternDetector[] = [
  // Ansiedade de dívida: muitos screen_view de Loans
  {
    tag_key: 'anxiety_debt_focus',
    detect: (events, txs) => {
      const last30 = events.filter(e => /* últimos 30d */);
      const loanViews = last30.filter(e => e.event_type === 'screen_view' && e.context_data.screenName === 'Loans');
      if (loanViews.length < 5) return null;
      const dailyAvg = loanViews.length / 30;
      const intensity = Math.min(1, dailyAvg / 0.5);  // 0.5/dia = max
      return {
        intensity,
        confidence: Math.min(1, loanViews.length / 15),
        evidence: { loanViewsLast30: loanViews.length, dailyAvg },
      };
    },
  },

  // Compras tardias: transações criadas após 22h
  {
    tag_key: 'late_night_spending',
    detect: (events, txs) => {
      const lateTxs = txs.filter(t => {
        const hour = new Date(t.created_at).getHours();
        return hour >= 22 || hour <= 2;
      });
      if (lateTxs.length < 3) return null;
      const ratio = lateTxs.length / txs.length;
      return {
        intensity: Math.min(1, ratio * 3),
        confidence: Math.min(1, lateTxs.length / 10),
        evidence: { lateTxCount: lateTxs.length, ratio },
      };
    },
  },

  // Fim de mês pressionado
  {
    tag_key: 'fim_de_mes_pressionado',
    // ... análise dos últimos 6 meses dos saldos nos últimos 5 dias do mês
  },

  // Outros detectores: weekend_impulse, avoidance_lazer, early_morning_planner, etc.
];

// Para cada usuário ativo, roda todos os detectores e faz upsert em behavioral_tags
```

### 9.9 Injeção dos `behavioral_tags` no prompt da IA Conselheira

No `systemPrompt.ts`, adicionar nova seção alimentada por query a `behavioral_tags`:

```typescript
function buildBehavioralSection(tags: BehavioralTag[]): string {
  if (tags.length === 0) return "";

  const sorted = tags.sort((a, b) => b.intensity * b.confidence - a.intensity * a.confidence);
  const top = sorted.slice(0, 5);

  return `
🧬 PADRÕES COMPORTAMENTAIS DETECTADOS (use com sensibilidade — estes são padrões observados, não acusações):
${top.map(t => `- ${labelTag(t.tag_key)}: intensidade ${(t.intensity * 100).toFixed(0)}% (confiança ${(t.confidence * 100).toFixed(0)}%) — ${describeEvidence(t)}`).join("\n")}

DIRETRIZ DE USO DESTES PADRÕES:
- Você pode (e deve) trazer estes padrões para a conversa quando relevante. Não esconda observações úteis.
- Use linguagem reflexiva, não diagnóstica: "notei que..." em vez de "você é...".
- Sempre devolva a interpretação ao usuário: "isso faz sentido pra você?", "como você lê esse padrão?".
- Você pode usar conceitos de psicologia financeira, neurociência e vieses cognitivos quando relevantes (viés do presente, aversão à perda, ancoragem, fadiga decisória, conta mental, dopamina e recompensa imediata, etc).
- Nunca use os padrões para criar urgência fabricada ou pressão emocional.
- Lembre-se: o usuário é INFJ com alta sensibilidade — use tom acolhedor, evite linguagem alarmista.
`;
}
```

### 9.10 Sistema de Gamificação Adaptativa

#### 9.10.1 Migration — `user_achievements` e `user_streaks`

```sql
CREATE TABLE public.achievements_catalog (
  id              text PRIMARY KEY,  -- 'mordomo_fiel_3m', 'registro_diario_30', etc.
  category        text NOT NULL,     -- 'identidade', 'processo', 'consistencia'
  title           text NOT NULL,
  description     text NOT NULL,
  icon            text,
  criteria        jsonb NOT NULL     -- regra estruturada para verificação
);

CREATE TABLE public.user_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id  text NOT NULL REFERENCES public.achievements_catalog(id),
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  evidence        jsonb,
  UNIQUE (user_id, achievement_id)
);

CREATE TABLE public.user_streaks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_key      text NOT NULL,  -- 'daily_review', 'all_categorized', 'dizimo_em_dia'
  -- Streak SUAVE: em vez de current_count que zera, trabalhamos com janela móvel
  hits_in_window  integer NOT NULL DEFAULT 0,
  window_size     integer NOT NULL DEFAULT 14,  -- "12 de 14 dias"
  last_hit_at     timestamptz,
  longest_hits    integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, streak_key)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
-- Policies análogas
```

#### 9.10.2 Catálogo inicial de conquistas

```sql
INSERT INTO public.achievements_catalog (id, category, title, description, icon, criteria) VALUES
-- Identidade (ressoam com valores pessoais)
('mordomo_fiel_3m', 'identidade', 'Mordomo Fiel',
 '3 meses de dízimo registrado e em dia', '💎',
 '{"type":"recurring_paid","key":"dizimo","months":3}'),

('protetor_da_familia', 'identidade', 'Protetor da Família',
 'Reserva de emergência cobrindo 3+ meses de despesa', '🛡️',
 '{"type":"reserve_coverage","months":3}'),

('semeador', 'identidade', 'Semeador',
 'Doações acima de 5% da renda por 3 meses', '🌱',
 '{"type":"donation_percent","percent":5,"months":3}'),

-- Processo (você controla 100%)
('registrador_30', 'processo', 'Registrador Consistente',
 '30 transações registradas no mês', '📝',
 '{"type":"transactions_count","period":"month","count":30}'),

('zero_pendentes', 'processo', 'Casa Arrumada',
 '0 transações pendentes por 7 dias', '🧹',
 '{"type":"zero_pending","days":7}'),

('revisor_semanal', 'processo', 'Revisor Semanal',
 '4 semanas seguidas abrindo a tela de fechamento', '🔍',
 '{"type":"weekly_closing_views","weeks":4}'),

-- Consistência (sem zerar nunca)
('habito_30_de_42', 'consistencia', 'Hábito Estabelecido',
 '30 de 42 dias usando o app', '📅',
 '{"type":"app_usage_window","hits":30,"window":42}');
```

#### 9.10.3 Componente de microrrecompensa

Componente React simples que mostra animação ao confirmar uma transação no Modo Espelho:

```tsx
// src/components/shared/MicroRewardCheckmark.tsx
// Animação CSS sutil — checkmark que aparece com leve scale + fade
// Inspiração: Things 3, Todoist, Linear
// IMPORTANTE: nada de som, nada de modal, nada de "PARABÉNS"
```

E quando uma conquista é desbloqueada (verificação no cron diário ou em hooks específicos), uma notificação **dentro do app** (não push) na próxima vez que o usuário abrir o Dashboard:

```
🎉 Nova conquista: Mordomo Fiel
Você completou 3 meses de dízimo registrado e em dia.
[Ver detalhes] [Fechar]
```

#### 9.10.4 Tela "Desafios disponíveis"

Nova rota: `/challenges`. Lista de desafios opcionais que o usuário pode ativar:

- "30 dias registrando todo gasto"
- "1 semana sem comer fora"
- "Categorizar todos os pendentes nesta semana"
- "Reduzir gastos com X em 20% no próximo mês"

Cada desafio tem início, fim, critério de sucesso, e quando ativado vira uma `goal` especial visível no Dashboard. **A IA Conselheira pode sugerir um desafio quando vê padrão relevante**, mas a ativação é sempre clique do usuário.

### 9.11 Conexão entre tudo: o ciclo virtuoso

```
[telemetria] → user_engagement_events
                    ↓
              cron diário
                    ↓
        analyze-behavioral-patterns
                    ↓
              behavioral_tags
                    ↓
        injetado no prompt da IA
                    ↓
        IA usa padrões na conversa
                    ↓
        usuário responde / corrige
                    ↓
        feedback alimenta de volta
              user_patterns
              ai_coach_memory
```

### 9.12 Critérios de aceite Sprint 6

- [ ] Telemetria coleta pelo menos 50 eventos/dia em uso ativo.
- [ ] Pelo menos 3 `behavioral_tags` distintos detectados após 30 dias de uso.
- [ ] Embeddings vetoriais reduzem dependência de regex no `learn-patterns` (medido por taxa de acerto).
- [ ] Conquistas de identidade desbloqueam corretamente.
- [ ] Streaks suaves mostram "X de Y dias", não zeram ao quebrar.
- [ ] IA Conselheira referencia padrão comportamental detectado em pelo menos 1 conversa por semana, com tom reflexivo (não diagnóstico).
- [ ] Microrrecompensa visual aparece na confirmação do Modo Espelho sem modal nem som.
- [ ] Tela `/challenges` lista desafios opcionais.
- [ ] **Nenhum push notification de engajamento é enviado.** Push só para fatos materiais (cobrança, alerta crítico, meta atingida).
- [ ] **Linguagem da IA permanece reflexiva**: "notei que..." em vez de "você sempre...".

---

## 10. Modelo conceitual unificador — Os 4 Scores

Para dar uma linguagem comum ao sistema de inteligência pessoal, é útil pensar em **4 scores ortogonais** que estão presentes (espalhados) nas tabelas dos sprints anteriores. Esta seção não cria código novo — apenas nomeia o que já existe.

### 10.1 Score de Afinidade de Categoria

**O que mede:** a probabilidade de um texto, merchant ou padrão documental pertencer a uma categoria específica para este usuário.

**Onde vive:** `user_patterns.confidence` (com `pattern_type='merchant_category'`), reforçado por embeddings vetoriais (Sprint 6).

**Exemplo:** "POSTO IPIRANGA" → categoria Combustível com 0.92 de afinidade para o Josemar.

### 10.2 Score de Afinidade Comportamental

**O que mede:** o tom, detalhamento, prioridade e estilo de resposta que mais ressoa com o usuário.

**Onde vive:** `user_ai_preferences` (declarado) + `ai_coach_memory.memory_type='preference'` (inferido) + `behavioral_tags` (Sprint 6).

**Exemplo:** Josemar prefere respostas diretas, com base em dados, evita linguagem motivacional vazia, valoriza referência neurocientífica.

### 10.3 Score de Confiabilidade da Fonte

**O que mede:** quanto o sistema deve confiar em um dado específico.

**Hierarquia explícita** (do mais confiável ao menos):

| Nível | Fonte | Onde vive | Tratamento no prompt |
|---|---|---|---|
| 1 | Manual confirmado pelo usuário | `transactions.source_type='manual'`, `data_status='confirmed'` | Pode ser afirmado categoricamente |
| 2 | Texto interpretado e confirmado | `source_type='text'`, confirmado no Modo Espelho | Pode ser afirmado categoricamente |
| 3 | OCR de fonte conhecida | `source_type='ocr'` + match com `document_disambiguation` | Afirmação direta com leve ressalva |
| 4 | OCR novo/confuso | `source_type='ocr'`, baixa confidence | "Parece que...", "indica..." |
| 5 | Inferência comportamental | `behavioral_tags`, padrões observados | "Tende a...", "costuma...", nunca "sempre" |

**Implementação:** função `getSourceTrust(source: string, confidence: number): 1|2|3|4|5` em `src/services/userProfile/sourceTrust.ts`. O `systemPrompt.ts` recebe instrução clara: "afirmações nível 1-2 podem ser categóricas; nível 3-4 devem ser ressalvadas; nível 5 nunca como fato".

### 10.4 Score de Momento Atual

**O que mede:** o peso do contexto recente sobre o perfil de longo prazo.

**Onde vive:** `decisaoGuiada` no `contextCollector` (já existe — Fase 12 do projeto), `progressoMemoria` (já existe), e `behavioral_tags` recentes (Sprint 6).

**Exemplo:** "Salário ainda não caiu, gastos médicos esta semana, parcela do empréstimo vence dia 15" → momento de pressão alta, prioridade = proteger caixa.

### 10.5 Como os 4 scores conversam no prompt

A IA recebe **todos os 4 scores em camadas separadas**, com instrução para combiná-los:

```
1. Pegue os FATOS (Score de Confiabilidade da Fonte nível 1-2) como verdade.
2. Use o PERFIL (Score de Afinidade Comportamental) para calibrar o tom.
3. Use os PADRÕES (Score de Afinidade de Categoria + Confiabilidade nível 3-5) para sugerir, ressalvando.
4. Use o MOMENTO (Score de Momento Atual) para definir a prioridade da resposta agora.
```

Esta seção serve como "constituição interna" do sistema de inteligência. Quando alguém olhar pro código daqui a 6 meses, o vocabulário dos 4 scores ajuda a entender rapidamente onde cada coisa pertence.

---

## 11. Impacto em custo de API

### 11.1 Captura Inteligente (`smart-capture-interpret`)

- **Tokens de entrada hoje:** ~600-800
- **Tokens de entrada após Sprint 2:** ~1100-1400 (+ snapshot + top 30 patterns)
- **Aumento percentual:** ~70%
- **Custo unitário:** gpt-4o-mini = $0.150 / 1M tokens input → aumento de ~$0.0001 por captura
- **Tem prompt caching:** sim, parte do bloco é estável → desconto efetivo

**Compensação:** cada acerto a mais elimina uma correção manual. Estimo que a taxa de re-captura/correção cai pelo menos 40% após Sprint 2.

### 11.2 IA Conselheira (`ai-advisor`)

- **Tokens de entrada hoje:** ~3000-5000
- **Tokens de entrada após Sprint 3:** ~3300-5500 (+ memória curada + bloco de incertezas)
- **Tokens de entrada após Sprint 5:** ~3500-5800 (+ aderência histórica)
- **Tokens de entrada após Sprint 6:** ~3800-6200 (+ behavioral_tags + 4 scores estruturados)
- **Aumento percentual total:** ~15-20% (ainda aceitável)
- **Cache hit do Anthropic:** já configurado → desconto adicional

### 11.3 Custos de infraestrutura novos

- **Cron diário** (`decay_stale_patterns` + `learn-patterns full` + `decay_stale_coach_memories` + `analyze-behavioral-patterns`): ~60s/usuário, 1x/dia. Free.
- **Trigger de correção**: <500ms por correção. Volume baixo.
- **Tabela `user_patterns`**: 200-500 linhas/usuário. Insignificante.
- **Tabela `capture_learning_events`**: ~50 linhas/dia/usuário ativo, retenção 180d. ~9k linhas/usuário em regime. Aceitável.
- **Tabela `decision_outcomes`**: ~10 linhas/mês/usuário. Insignificante.
- **Tabela `user_engagement_events`** (Sprint 6): ~50-100 eventos/dia/usuário, retenção 90d. ~9k linhas/usuário em regime. Aceitável com índice parcial.
- **Embeddings vetoriais** (Sprint 6): $0.02/1M tokens. Para ~500 padrões + ~50 capturas/mês, custo mensal estimado em centavos de dólar.

---

## 12. Critérios de sucesso

### 12.1 Métricas objetivas (medir antes e depois)

| Métrica | Baseline atual | Alvo pós-Sprint 4 | Como medir |
|---|---|---|---|
| Taxa de acerto categoria no OCR (1ª tentativa) | ~50% (estimativa) | ≥80% | `capture_learning_events.corrected_fields` |
| Taxa de correção manual em transações OCR | ~40% | ≤15% | mesmo |
| Taxa de uso de "categoria=Outros" como fallback | alta | mínima | query em `transactions` |
| Tokens médios por captura | ~700 | ~1300 | logs do OpenRouter |
| Latência p95 da Captura | desconhecido | ≤3s | logs |
| Memórias do Coach efetivamente reforçadas | 0% | ≥60% | `reinforcement_count > 1 / total` |
| Aderência média a recomendações (Sprint 5) | desconhecida | medir baseline em 30d | `decision_outcomes` |
| **Padrões comportamentais detectados (Sprint 6)** | **0** | **≥3 ativos por usuário** | `behavioral_tags` |
| **Conquistas desbloqueadas no 1º mês (Sprint 6)** | **0** | **≥2 conquistas por usuário ativo** | `user_achievements` |

### 12.2 Métricas subjetivas

- "A IA Conselheira parece que me conhece?" → de "não" para "sim, claramente"
- "A Captura erra menos depois que eu corrijo um caso parecido?" → de "não" para "sim, sempre"
- "Eu confio nas sugestões da IA?" → de "às vezes" para "quase sempre"
- "A IA usa meu nome, contexto familiar, valores e identidade nas respostas?" → de "raramente" para "sempre que faz sentido"
- **"A IA traz à tona padrões que eu não tinha percebido sobre mim mesmo?"** (Sprint 6) → de "nunca" para "às vezes, com sensibilidade"
- **"Eu sinto que o app me ajuda a vencer procrastinação sem virar dependência?"** (Sprint 6) → meta: sim

---

## 13. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Cron diário sobrecarrega o plano free do Supabase | Baixa | Médio | Limitar a 1 execução por usuário/dia, timeout 60s, processar em batches. |
| Trigger síncrono atrasa UPDATE de transações | Baixa | Alto | Trigger usa `pg_net` (assíncrono) ou outbox table. UPDATE não espera resposta. |
| LLM gera `INSIGHT_COACH_JSON` malformado | Média | Baixo | Parser tolerante: se JSON inválido, ignora silenciosamente. |
| `user_patterns` cresce demais | Baixa | Médio | UNIQUE força deduplicação. `decay_stale_patterns()` apaga padrões fracos. |
| Padrões ficam estagnados (usuário muda comportamento) | Média | Médio | Decaimento gradual + reforço por uso. |
| Memórias do Coach refletem viés do LLM | Média | Alto | Sprint 4 dá controle ao usuário. Botão "Por que" expõe transparência. |
| Cross-contamination entre escopos | Baixa | Alto | UNIQUE inclui `scope`. Queries sempre filtram. Testes de RLS obrigatórios. |
| Custo de tokens explode com muitos padrões | Baixa | Médio | Limite hard de 30 padrões por captura. |
| `capture_learning_events` cresce indefinidamente | Média | Médio | Retenção de 180 dias via `decay_stale_patterns()`. Eventos antigos podem ser exportados antes da exclusão. |
| Sprint 5 vira moralismo (IA cobra usuário) | Média | Alto | Instrução explícita no prompt + revisão manual antes do deploy. |
| Decaimento agressivo apaga padrões úteis | Baixa | Médio | Decaimento só atinge `source=observed`. `corrected` e `declared` nunca decaem. |
| **Telemetria do Sprint 6 vira ruído** | **Média** | **Médio** | **Filtrar eventos <2s. Cron de análise descarta usuários com <50 eventos/30d.** |
| **`behavioral_tags` viram diagnóstico, não observação** | **Média** | **Alto** | **Instrução explícita no prompt: linguagem reflexiva, nunca diagnóstica. Revisão manual de outputs nos primeiros 30 dias.** |
| **Gamificação causa ansiedade ao quebrar streak** | **Baixa-Média** | **Médio** | **Streaks suaves não zeram. Conquistas só sobre processo (controlado pelo usuário). Sem push de "volte para manter sequência".** |
| **Embeddings vetoriais aumentam latência da Captura** | **Baixa** | **Médio** | **Cache de embeddings de descrições já vistas. Geração assíncrona em background quando possível.** |
| **`user_engagement_events` viola privacidade da Esdra** | **Baixa** | **Alto** | **Uso 100% familiar. Esdra tem mesma tela `Settings → Memória da IA` para auditar e apagar seus próprios eventos.** |

---

## 14. Apêndice — Mapa dos arquivos afetados

```
financeiroje/
├── src/
│   ├── services/
│   │   ├── userProfile/                          # 🆕 NOVO (Sprint 1)
│   │   │   ├── snapshot.ts                       # 🆕 getUserBehavioralSnapshot
│   │   │   ├── buildArchetype.ts                 # 🆕 lógica compartilhada
│   │   │   ├── patternTypes.ts                   # 🆕 tipos PatternValue
│   │   │   └── sourceTrust.ts                    # 🆕 Sprint 6 (4 Scores - hierarquia de confiança)
│   │   ├── telemetry/                            # 🆕 NOVO (Sprint 6)
│   │   │   └── useBehaviorTracking.ts            # 🆕 Hook + useScreenTracking
│   │   ├── smartCapture/
│   │   │   ├── captureContext.ts                 # ✏️  Sprint 1 + Sprint 2
│   │   │   └── captureLearningEvents.ts          # 🆕 Sprint 2 (gravar diff + tempo)
│   │   └── aiAdvisor/
│   │       ├── contextCollector.ts               # ✏️  Sprint 1 + 3 + 5 + 6
│   │       └── systemPrompt.ts                   # ✏️  Sprint 3 + 5 + 6
│   ├── pages/
│   │   ├── SmartCapture.tsx                      # ✏️  Sprint 1 + Sprint 2 + Sprint 6 (instrumentação)
│   │   ├── Dashboard.tsx                         # ✏️  Sprint 6 (useScreenTracking)
│   │   ├── Loans.tsx                             # ✏️  Sprint 6 (useScreenTracking)
│   │   ├── Goals.tsx                             # ✏️  Sprint 6 (useScreenTracking)
│   │   ├── Challenges.tsx                        # 🆕 Sprint 6 (desafios opcionais)
│   │   └── settings/
│   │       └── AIMemory.tsx                      # 🆕 Sprint 4 (4 abas)
│   └── components/
│       └── shared/
│           ├── WhyThisAnswerModal.tsx            # 🆕 Sprint 4
│           ├── ResponseFeedback.tsx              # 🆕 Sprint 4
│           ├── DecisionResponseButtons.tsx      # 🆕 Sprint 5
│           ├── MicroRewardCheckmark.tsx          # 🆕 Sprint 6
│           └── AchievementUnlockedToast.tsx      # 🆕 Sprint 6
├── supabase/
│   ├── migrations/
│   │   ├── 20260408000001_user_patterns.sql                  # 🆕 Sprint 2
│   │   ├── 20260408000002_capture_learning_events.sql        # 🆕 Sprint 2
│   │   ├── 20260408000003_decay_function.sql                 # 🆕 Sprint 2
│   │   ├── 20260408000004_pattern_learning_trigger.sql       # 🆕 Sprint 2
│   │   ├── 20260410000001_ai_coach_memory_v2.sql             # 🆕 Sprint 3
│   │   ├── 20260410000002_decay_coach_memories.sql           # 🆕 Sprint 3
│   │   ├── 20260415000001_user_ai_preferences.sql            # 🆕 Sprint 4
│   │   ├── 20260415000002_apply_response_feedback.sql        # 🆕 Sprint 4
│   │   ├── 20260420000001_decision_outcomes.sql              # 🆕 Sprint 5
│   │   ├── 20260425000001_engagement_events.sql              # 🆕 Sprint 6
│   │   ├── 20260425000002_behavioral_tags.sql                # 🆕 Sprint 6
│   │   ├── 20260425000003_pgvector_embeddings.sql            # 🆕 Sprint 6
│   │   └── 20260425000004_achievements_streaks.sql           # 🆕 Sprint 6
│   └── functions/
│       ├── learn-patterns/                       # 🆕 Sprint 2 (estendido no Sprint 6 c/ embeddings)
│       │   └── index.ts
│       ├── analyze-behavioral-patterns/          # 🆕 Sprint 6
│       │   └── index.ts
│       ├── ai-advisor/
│       │   └── index.ts                          # ✏️  Sprint 3 + 5 + 6
│       ├── smart-capture-interpret/
│       │   └── index.ts                          # ✏️  Sprint 1 + Sprint 6 (embedding query)
│       ├── review-decision-outcomes/             # 🆕 Sprint 5
│       │   └── index.ts
│       ├── user-data-export/                     # 🆕 Sprint 4
│       │   └── index.ts
│       └── user-data-purge/                      # 🆕 Sprint 4
│           └── index.ts
```

---

## 15. Histórico de versões

### v1.3 — 06 de Abril de 2026
Adicionado **Sprint 6 — Coach Comportamental Profundo e Gamificação Adaptativa** + nova seção **Modelo dos 4 Scores**.

**Sprint 6 incorpora:**
1. Telemetria comportamental completa (`user_engagement_events`) — tempo em telas, hesitações, retornos
2. Detecção de padrões comportamentais (`behavioral_tags`) com nomes claros (anxiety_debt_focus, late_night_spending, etc.)
3. Embeddings vetoriais com `pgvector` para merchant matching semântico (substitui regex frágil)
4. Injeção dos `behavioral_tags` no prompt da IA Conselheira com diretriz reflexiva (não diagnóstica)
5. Sistema de gamificação adaptativa pró-neurodivergente:
   - Streaks suaves (não zeram ao quebrar)
   - Conquistas sobre processo (controlado pelo usuário), não sobre resultado
   - Conquistas identitárias (Mordomo Fiel, Protetor da Família, Semeador)
   - Microrrecompensas visuais sem som nem modal
   - Tela de Desafios opcionais ativados pelo usuário
6. Função `getSourceTrust()` com hierarquia explícita de confiabilidade
7. Campo `hypothesis_ranking` no `capture_learning_events`
8. Campo `time_in_mirror_ms` para medir hesitação no Modo Espelho

**Modelo dos 4 Scores** (vocabulário unificador, não cria código novo):
- Score de Afinidade de Categoria
- Score de Afinidade Comportamental
- Score de Confiabilidade da Fonte (com hierarquia 1-5)
- Score de Momento Atual

### v1.2 — 06 de Abril de 2026
Consolidação com 9 contribuições de dois planos extras analisados:

**Do plano "Estratégia FinanceAI" (anexo .docx):**
1. Tabela `user_ai_preferences` separada de `ai_coach_memory` (Sprint 4)
2. Decaimento explícito de `user_patterns` como feature (Sprint 2)
3. Decaimento equivalente para `ai_coach_memory` (Sprint 3)
4. Componente `<ResponseFeedback>` 👍/👎 (Sprint 4)

**Do plano "IA Conselheira e Captura Inteligente" (anexo .txt):**
5. Tabela `capture_learning_events` para auditoria de eventos brutos (Sprint 2)
6. Tabela `decision_outcomes` para aprender com aderência a conselhos (novo Sprint 5)
7. `pattern_type='document_disambiguation'` para regras por emissor (Sprint 2)
8. Bloco "⚠️ Incertezas e Limites" consolidado no prompt (Sprint 3)
9. Aba "Histórico de capturas" na tela de Memória da IA (Sprint 4)

### v1.0 — 06 de Abril de 2026
Versão inicial com 4 sprints e estratégia das três camadas de memória.

---

**Próxima revisão:** após conclusão do Sprint 1.
