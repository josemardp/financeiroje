# STATUS_EXECUCAO — FinanceiroJe

## Estado atual

**Sprint atual:** Sprint 2  
**Tarefa atual:** T2.2 — Edge function `learn-patterns`  
**Situação atual:** T2.1 concluída — aguardando início da T2.2  
**Última atualização:** 2026-04-09

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
- [ ] T2.2 — Edge function `learn-patterns`
- [ ] T2.3 — Trigger síncrono de correção
- [ ] T2.4 — Integração em `captureContext.ts`
- [ ] T2.5 — Gravação de `capture_learning_events` no Modo Espelho
- [ ] T2.6 — Cron diário

---

## Últimas tarefas concluídas

### 2026-04-09
- T2.1 concluída
- Migrations `20260408000001_user_patterns.sql`, `20260408000002_capture_learning_events.sql` e `20260408000003_decay_function.sql` criadas no repositório
- Migrations aplicadas manualmente no Supabase
- `user_patterns` validada
- `capture_learning_events` validada
- `decay_stale_patterns()` validada
- commit realizado
- push realizado

---

## Próxima tarefa esperada
**T2.2 — Edge function `learn-patterns`**  
Criar `supabase/functions/learn-patterns/index.ts` seguindo a seção 5.5 do plano.
