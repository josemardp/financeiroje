# STATUS_EXECUCAO — FinanceiroJe

## Estado atual

**Sprint atual:** Sprint 6 — EM ANDAMENTO  
**Próximo sprint:** Sprint 7 — Gamificação Adaptativa  
**Situação atual:** Sprint 6 em andamento; T6.1 e T6.6 concluídas e validadas no Supabase; próxima tarefa: T6.7 — Edge function `analyze-behavioral-patterns` + cron  
**Última atualização:** 2026-04-14

---

## Progresso por sprint

### Sprint 1 — Compartilhar o que já existe
- [x] T1.1 — Criar `userProfile/snapshot.ts` + `buildArchetype.ts`
- [x] T1.2 — Refatorar `captureContext.ts`
- [x] T1.3 — Atualizar system prompt do `smart-capture-interpret`
- [x] T1.4 — Atualizar chamadas no `SmartCapture.tsx`
- [x] Validação final do Sprint 1 (lint: 0 errors, 69 testes passando)

### Sprint 2 — Materializar padrões aprendidos
- [x] T2.1 — Migrations base (`user_patterns`, `capture_learning_events`, `decay_stale_patterns`)
- [x] T2.2 — Edge function `learn-patterns`
- [x] T2.3 — Trigger síncrono de correção
- [x] T2.4 — Integração em `captureContext.ts`
- [x] T2.5 — Gravação de `capture_learning_events` no Modo Espelho
- [x] T2.6 — Cron diário

### Sprint 3 — Evoluir `ai_coach_memory`
- [x] T3.1 — Migration `ai_coach_memory_v2` (enum + ALTER TABLE + `upsert_coach_memory`)
- [x] T3.2 — Migration `decay_coach_memories` (`decay_stale_coach_memories` + cron)
- [x] T3.3 — Refinar edge function `ai-advisor` (parser INSIGHT_COACH_JSON + curadoria)
- [x] T3.4 — Refinar `systemPrompt.ts` (instrução INSIGHT_COACH_JSON + `buildUncertaintyBlock`)
- [x] T3.5 — Validação final Sprint 3

### Sprint 4 — Loop de feedback explícito
- [x] T4.1 — Migration `user_ai_preferences` (tabela + RLS + trigger)
- [x] T4.2 — Migration `apply_response_feedback` RPC (reforço 👍 / penalidade 👎 + preference via comentário)
- [x] T4.3 — `ai-advisor`: rastrear contexto usado → header `X-Context-Used` + `Access-Control-Expose-Headers`
- [x] T4.4 — `contextCollector.ts`: query + campo `userAiPreferences` na interface `FinancialContext`
- [x] T4.5 — `captureContext.ts`: query + `formatPreferences()` + `prefsBlock` no `contextBlock`
- [x] T4.6 — `ai-advisor`: injetar `preferencias_usuario` no system prompt (formato compacto)
- [x] T4.7 — Tela `/settings/ai-memory` (4 abas: padrões, memória, preferências, histórico)
- [x] T4.8 — Componentes `<ResponseFeedback>` e `<WhyThisAnswerModal>`
- [x] T4.9 — Endpoints LGPD (user-data-export, user-data-purge)

---

## Últimas tarefas concluídas

### 2026-04-10

- T2.6 concluída
- pg_cron habilitado (v1.6.4) — pg_net já estava ativo (v0.20.0)
- Job 1 (jobid=1): `daily-decay-patterns` — `0 4 * * *` — `SELECT decay_stale_patterns()`
- Job 2 (jobid=2): `daily-learn-patterns` — `5 4 * * *` — `net.http_post` → `learn-patterns mode=full`
- Edge function `learn-patterns` deployada manualmente via painel
- Teste pós-deploy: `{"ok":true,"patterns_written":7}`
- Trigger `trg_learn_on_correction` corrigido: `current_setting()` substituído por URL/key hardcoded
  (ALTER DATABASE bloqueado pelo Supabase managed postgres — migration `20260410000001_fix_trigger_hardcoded_url.sql`)
- Sprint 2 finalizado

**Débito técnico D3 — aceito, não bloqueador:**
- `captureLearningEvents.ts` — sem testes unitários para `buildDiff()` e `recordCaptureLearningEvent()`
- `captureContext.ts` — sem testes unitários para `formatPatterns()`
- Efeito em caso de regressão: diff gravado vazio ou contexto sem padrões — não derruba o app
- Tratar em sessão isolada antes ou durante o Sprint 4 (UI de controle)

- T2.5 concluída
- `src/services/smartCapture/captureLearningEvents.ts` criado
- `recordCaptureLearningEvent()` — calcula diff e grava `capture_learning_events` antes do insert
- `linkEventToTransaction()` — atualiza `transaction_id` após insert bem-sucedido
- `SmartCapture.tsx` — 3 refs adicionados: `aiSuggestedRef`, `mirrorStartRef`, `ocrRawTextRef`
- `applyParsedResult` — snapshot do formulário AI-suggested + timestamp do Modo Espelho
- `handleSave` — evento gravado antes da transação; transação única linka evento via `.select("id").single()`
- Parcelas: evento gravado sem `transaction_id` (null)
- Falha antes do Modo Espelho: nenhum evento (sem tratamento especial necessário)
- commit 41f2860 realizado

- T2.4 concluída
- `src/services/smartCapture/captureContext.ts` atualizado
- Interface `PatternRow` adicionada
- Função `formatPatterns()` adicionada (3 tipos: `merchant_category`, `category_value_range`, `document_disambiguation`)
- Query paralela em `user_patterns` (confidence ≥ 0.6, top 30) via `Promise.all`
- `currentScope === "all"` pula a query (scope_type não aceita "all")
- `patternBlock` incluído no final do `contextBlock`
- lint: 0 errors, 11 warnings pré-existentes
- commit e5381aa realizado

- T2.3 concluída
- `supabase/migrations/20260408000004_pattern_learning_trigger.sql` criado
- Função `notify_pattern_learning_on_correction()` com `SECURITY DEFINER`
- Trigger `trg_learn_on_correction` — `AFTER UPDATE ON public.transactions`
- Payload: `mode=from_correction`, `user_id`, `transaction_id`, `old_category_id`, `new_category_id`
- commit 12bb48f realizado
- push realizado

---

### 2026-04-09
- T2.1 concluída
- Migrations `20260408000001_user_patterns.sql`, `20260408000002_capture_learning_events.sql` e `20260408000003_decay_function.sql` criadas no repositório
- Migrations aplicadas manualmente no Supabase
- `user_patterns` validada
- `capture_learning_events` validada
- `decay_stale_patterns()` validada
- commit realizado
- push realizado

- T2.2 concluída
- `supabase/functions/learn-patterns/index.ts` criado (3 modos: full, incremental, from_correction)
- `supabase/functions/learn-patterns/__tests__/normalize.test.ts` criado
- `supabase/functions/learn-patterns/__tests__/extractors.test.ts` criado
- 14 testes passando com e sem `--no-check`
- commit 8de145d realizado
- push realizado

## Últimas tarefas concluídas

### 2026-04-10

- T3.1 concluída
- `supabase/migrations/20260410000002_ai_coach_memory_v2.sql` criado e aplicado
- `coach_memory_type` enum criado (5 valores: observation, preference, concern, goal_context, value_alignment)
- `ALTER TABLE ai_coach_memory` — 6 colunas adicionadas: memory_type, pattern_key, reinforcement_count, last_reinforced_at, expires_at, superseded_by
- Índices: `idx_coach_memory_active` (parcial, superseded_by IS NULL) + `idx_coach_memory_pattern_key`
- `upsert_coach_memory()` — deduplicação por pattern_key, reforço semântico, TTL opcional
- Correções aplicadas: `p_scope::text` (cast explícito), `idx_coach_memory_active` sem `now()` no predicado
- Validado: `reinforcement_count = 2` em segunda chamada com mesma key

- T3.2 concluída
- `supabase/migrations/20260410000003_decay_coach_memories.sql` criado e aplicado
- `decay_stale_coach_memories()` — observations decaem após 45 dias, concerns após 30 dias
- Cron `daily-decay-coach-memories` criado — `1 4 * * *`

- T3.3 concluída
- `supabase/functions/ai-advisor/index.ts` atualizado (3 zonas)
- Carregamento: 4 queries em `Promise.all` curadas por tipo com `nowIso` único, filtros `superseded_by`/`expires_at`, rank por `reinforcement_count`
- Parser: `extractInsightJson()` por brace-matching + fallback legado `INSIGHT_COACH:` (compat até 2026-05-10)
- Persistência: `supabase.rpc("upsert_coach_memory")` substituindo `.insert()` direto
- Validado em produção: log `Coach memory upserted: type=concern key=renda_inconsistente_critica`

- T3.4 concluída
- `src/services/aiAdvisor/systemPrompt.ts` atualizado
- Instrução final → `INSIGHT_COACH_JSON` com 5 tipos, `key` semântica e regra de reforço
- `buildUncertaintyBlock()` adicionada e injetada entre dados reais e instruções de formato

- T3.5 concluída — Sprint 3 finalizado
- Todos os critérios da seção 6.8 do plano atendidos
- Deploy validado em produção com teste funcional

---

---

### 2026-04-12

- T4.8 concluída
- `src/components/shared/ResponseFeedback.tsx` — prop `messageId` adicionada; usa ID real na RPC (não mais UUID aleatório)
- `src/components/shared/WhyThisAnswerModal.tsx` — sem alteração estrutural
- `src/pages/AiAdvisor.tsx` — imports dos dois componentes; `contextUsedIds` na interface `Message`; leitura do header `X-Context-Used` com try/catch; campo propagado na criação e no update durante streaming; render abaixo de cada mensagem do assistente (blocos estruturados + Markdown puro)

- T4.9 concluída
- `supabase/functions/user-data-export/index.ts` criado — leitura via anonClient (respeita RLS), export JSON com Content-Disposition para download, charset=utf-8
- `supabase/functions/user-data-purge/index.ts` criado — confirmação obrigatória `{ confirm: true }`, serviceClient para bypass do RLS de DELETE em `capture_learning_events`, retorna contagens por tabela
- Validado: export HTTP 200 conta principal; purge HTTP 400 sem confirm; purge HTTP 200 com confirm conta secundária; export pós-purge zerado; isolamento por user_id confirmado
- **Sprint 4 concluído**

### Sprint 5 — Aprender com a aderência aos conselhos
- [x] T5.1 — Migration `decision_outcomes` + enums (`recommendation_type`, `user_response_type`) + RLS + índices
- [x] T5.2 — Edge function `ai-advisor`: detecção de `RECOMMENDATION_JSON` + persistência em `decision_outcomes`
- [x] T5.3 — Componente `<DecisionResponseButtons>` + RPC `mark_decision_response` + integração em `AiAdvisor.tsx`
- [x] T5.4 — Edge function `review-decision-outcomes` + cron `daily-review-decision-outcomes` (04:02 diário)
- [x] T5.5 — `contextCollector.ts`: `buildAderenciaHistorica()` + `aderenciaHistorica` na interface; `systemPrompt.ts`: bloco aderência + guard-rail anti-moralismo (5 regras)
- [x] T5.6 — Validação critérios de aceite (seção 8.8): todos os 5 critérios aprovados

### Sprint 6 — Telemetria + Coach Comportamental + Embeddings
- [x] T6.1 — Migration `user_engagement_events`
- [ ] T6.2 — Hook `useBehaviorTracking` + `useScreenTracking` + integração nas 8 telas
- [ ] T6.3 — Instrumentação do Modo Espelho em `SmartCapture.tsx`
- [ ] T6.4 — Migration `pgvector` + coluna `merchant_embedding` em `user_patterns`
- [ ] T6.5 — Edge function `learn-patterns`: embeddings + query de similaridade
- [x] T6.6 — Migration `behavioral_tags`
- [ ] T6.7 — Edge function `analyze-behavioral-patterns` + cron
- [ ] T6.8 — `contextCollector.ts` + `systemPrompt.ts`: injeção de `behavioral_tags`
- [ ] T6.9 — Validação critérios de aceite Sprint 6

**Nota de escopo:** Gamificação Adaptativa (seção 9.10 do plano) movida para Sprint 7.

---

### 2026-04-14

- T5.1 concluída
- Migration `20260420000001_decision_outcomes.sql` aplicada
- Enums `recommendation_type` (8 valores) e `user_response_type` (5 valores) criados
- Tabela `decision_outcomes` com RLS + 2 índices (`pending_review` parcial, `by_type`)
- RPC `mark_decision_response` criada

- T5.2 concluída
- `supabase/functions/ai-advisor/index.ts` (v25): `extractRecommendationJson()` + persistência em `decision_outcomes`
- Validado: registros reais criados automaticamente por interações com o Advisor

- T5.3 concluída
- `src/components/shared/DecisionResponseButtons.tsx` criado
- Botões ✅ "Vou seguir" / ⏸ "Depois" / ❌ "Não vou seguir"
- `AiAdvisor.tsx`: detecção do marcador no stream, strip do texto exibido, fetch do `decisionId` após 1.5s, render condicional dos botões

- T5.4 concluída
- `supabase/functions/review-decision-outcomes/index.ts` criado e deployado
- Cron `daily-review-decision-outcomes` ativo — `2 4 * * *` — `SELECT public.review_pending_decision_outcomes()`

- T5.5 concluída
- `contextCollector.ts`: `buildAderenciaHistorica()` (threshold ≥ 3 registros com resposta, agrupado por tipo)
- `systemPrompt.ts`: bloco `📊 ADERÊNCIA HISTÓRICA` injetado + guard-rail obrigatório de 5 regras anti-moralismo

- T5.6 concluída — Sprint 5 finalizado

**Auditoria de fechamento Sprint 5 — 2026-04-14:**
Sprint 5 oficialmente concluído. Todos os 5 critérios da seção 8.8 validados.
Débito técnico D5 registrado (não bloqueador): ciclo real de 30 dias do cron
review-decision-outcomes será confirmado organicamente em maio/2026.
Próximo: Sprint 6 — avaliar prioridade antes de iniciar.

- Critério 1 (RECOMMENDATION_JSON): ✅ registros reais em `decision_outcomes`
- Critério 2 (botões): ✅ fluxo de código validado
- Critério 3 (cron): ✅ job ativo no pg_cron
- Critério 4 (bloco aderência): ✅ estrutural — ativa com ≥ 3 registros com resposta
- Critério 5 (sem moralismo): ✅ guard-rail de 5 regras em `systemPrompt.ts`

**Nota técnica:** `ai-advisor` v23/v24 deployadas com `verify_jwt: true` (default do MCP) causaram 401.
Corrigido na v25 com `verify_jwt: false` — função valida JWT internamente via `anonClient.auth.getUser()`.

---

### 2026-04-14 (Sprint 6)

- T6.1 concluída
- `supabase/migrations/20260425000001_engagement_events.sql` criada e aplicada manualmente no Supabase
- Tabela `user_engagement_events` validada
- RLS validado (`relrowsecurity = true`)
- Policies validadas: `Users see own events` (SELECT) + `Users insert own events` (INSERT)
- Índices validados: `idx_engagement_user_time` + `idx_engagement_recent`
- Índice parcial com `now()` substituído por índice simples — evita regressão conhecida do projeto

- T6.6 concluída
- `supabase/migrations/20260425000002_behavioral_tags.sql` criada no repositório e aplicada manualmente no Supabase
- Tabela `behavioral_tags` validada — 9 colunas corretas
- UNIQUE (user_id, scope, tag_key) confirmado
- Índice `idx_behavioral_tags_active` criado (user_id, scope, intensity DESC, expires_at)
- RLS habilitado (`relrowsecurity = true`)
- Policy "Users manage own tags" criada (cmd = ALL)
- Índice parcial com `now()` substituído por índice composto — evita regressão conhecida do projeto

---

## Próxima tarefa esperada
**T6.7 — Edge function `analyze-behavioral-patterns` + cron**
