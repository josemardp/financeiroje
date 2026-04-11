# STATUS_EXECUCAO — FinanceiroJe

## Estado atual

**Sprint atual:** Sprint 4  
**Tarefa atual:** T4.6 concluída — próxima: T4.7 (UI `/settings/ai-memory`)  
**Situação atual:** T4.1–T4.6 concluídas; migrations T4.1 e T4.2 aplicadas no Supabase  
**Última atualização:** 2026-04-11

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
- [ ] T4.7 — Tela `/settings/ai-memory` (4 abas: padrões, memória, preferências, histórico)
- [ ] T4.8 — Componentes `<ResponseFeedback>` e `<WhyThisAnswerModal>`
- [ ] T4.9 — Endpoints LGPD (user-data-export, user-data-purge)

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

## Próxima tarefa esperada
**T4.7 — Tela `/settings/ai-memory`**
4 abas: Padrões aprendidos (`user_patterns`), Memória do Coach (`ai_coach_memory`), Preferências da IA (`user_ai_preferences`), Histórico de capturas (`capture_learning_events`). Ver seção 7.3 do plano.
