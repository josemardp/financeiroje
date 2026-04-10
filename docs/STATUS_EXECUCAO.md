# STATUS_EXECUCAO — FinanceiroJe

## Estado atual

**Sprint atual:** Sprint 2  
**Tarefa atual:** T2.5 — Gravação de `capture_learning_events` no Modo Espelho  
**Situação atual:** T2.4 concluída — aguardando início da T2.5  
**Última atualização:** 2026-04-10

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
- [ ] T2.5 — Gravação de `capture_learning_events` no Modo Espelho
- [ ] T2.6 — Cron diário

---

## Últimas tarefas concluídas

### 2026-04-10

- T2.4 concluída
- `src/services/smartCapture/captureContext.ts` atualizado
- Interface `PatternRow` adicionada
- Função `formatPatterns()` adicionada (3 tipos: `merchant_category`, `category_value_range`, `document_disambiguation`)
- Query paralela em `user_patterns` (confidence ≥ 0.6, top 30) via `Promise.all`
- `currentScope === "all"` pula a query (scope_type não aceita "all")
- `patternBlock` incluído no final do `contextBlock`
- lint: 0 errors, 11 warnings pré-existentes
- commit pendente

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

---

## Próxima tarefa esperada
**T2.5 — Gravação de `capture_learning_events` no Modo Espelho**  
Registrar evento de aprendizado a cada confirmação no Modo Espelho, populando a tabela `capture_learning_events`.
