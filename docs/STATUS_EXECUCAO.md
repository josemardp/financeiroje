# STATUS_EXECUCAO — FinanceiroJe

## Transição Fase 1 → Fase 2 (2026-04-19)

**Fase 1 (Sprints 1-7) — ENCERRADA**
- PLANO_INTELIGENCIA_PESSOAL.md v1.3 — Implementação concluída (~92-95%)
- Débitos técnicos aceitos: D3, D5, D7-A, D7-B (documentados)
- Status: Estável em produção. Arquivo movido para `docs/_archive/`

**Fase 2 (Sprints 8-10) — PLANEJADA, NÃO INICIADA**
- Plano complementar elaborado: PLANO_COMPLEMENTAR_INTELIGENCIA.md
- Prompts novos: PROMPTS_POR_SPRINT_COMPLEMENTAR.md
- Backlog estratégico: PLANOS_DE_EVOLUCAO.md (22 planos fora do escopo
  de inteligência, em 7 categorias — plataforma, segurança, qualidade,
  produto, business, família, inteligência deferida)
- Próximo passo: aguardar início do Sprint 8; Sprint de Quitação de Débitos encerrada administrativamente por bloqueios externos

---

## Estado atual

**Sprint atual:** Sprint de Quitação de Débitos — CONCLUÍDA  
**Sprint anterior:** Sprint 7 — CONCLUÍDO (2026-04-19)  
**Situação atual:** Sprint de Quitação de Débitos encerrada administrativamente. Pendências remanescentes dependem de uso orgânico ou modelagem futura. Aguardando início do Sprint 8.  
**Última atualização:** 2026-04-19

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
- [x] T6.2 — Hook `useBehaviorTracking` + `useScreenTracking` + integração nas 8 telas
- [x] T6.3 — Instrumentação do Modo Espelho em `SmartCapture.tsx`
- [x] T6.4 — Migration `pgvector` + coluna `merchant_embedding` em `user_patterns`
- [x] T6.5 — Edge function `learn-patterns`: geração de embeddings
- [x] T6.6 — Migration `behavioral_tags`
- [x] T6.7 — Edge function `analyze-behavioral-patterns` + cron
- [x] T6.8 — `contextCollector.ts` + `systemPrompt.ts`: injeção de `behavioral_tags`
- [x] T6.9 — Validação critérios de aceite Sprint 6

**Nota de escopo:** Gamificação Adaptativa (seção 9.10 do plano) movida para Sprint 7.

### Sprint 7 — Gamificação Adaptativa
- [x] T7.1 — Migration `achievements_catalog` + `user_achievements` + `user_streaks` + seed 7 conquistas
- [x] T7.2 — Edge function `evaluate-achievements` + cron
- [x] T7.3 — Componente `MicroRewardCheckmark.tsx` + integração em `SmartCapture.tsx`
- [x] T7.4 — Componente `AchievementUnlockedToast.tsx` + integração em `Dashboard.tsx`
- [x] T7.5 — Tela `Challenges.tsx` + rota `/challenges`
- [x] T7.6 — Validação critérios de aceite Sprint 7

### Sprint 8 — Memória Conversacional Profunda e Defesa de Prompt

## Sprint 8  T8.1: Embeddings em ai_messages

Status: concluída

### Entregas
- Migration criada: ai_messages_embedding
  - content_embedding vector(384)
  - embedded_at timestamptz
  - embedding_version text
- Índices criados:
  - idx_ai_messages_embedding (ivfflat)
  - idx_ai_messages_pending_embedding
- Edge function criada e deployada:
  - embed-ai-messages
- Cron criado:
  - embed-ai-messages-every-15-min (*/15 * * * *)

### Validação técnica
- Colunas presentes em public.ai_messages
- Índices confirmados
- Function executando sem erro (teste manual OK)
- Cron executando com sucesso (status 200 nas invocations)

### Validação funcional
- embeddings_gravados = 59
- pendencias_restantes = 0
- embedding_version = '1' aplicado corretamente
- embedded_at preenchido

### Observações
- Correção aplicada no cron (Authorization Bearer)
- Ajuste operacional em .env.local (remoção de BOM)
- [x] T8.2 — `findRelatedConversations()` + integração em `systemPrompt.ts`

## Sprint 8 — T8.2: findRelatedConversations + memória conversacional

Status: concluída

### Entregas
- RPC `find_related_conversations` formalizada no repo (migration 20260501000002)
  - PL/pgSQL com guard `array_length <> 384`
  - JOIN em `ai_conversations` para filtro de scope
  - Duplo filtro `user_id` (c + m)
  - `::vector(384)` explícito em todos os usos
- `embed-ai-messages`: mode="embed" adicionado — embedding único autenticado
- `contextCollector.ts`: `ConversaRelacionada`, `ScopeType`, `findRelatedConversations`, `currentQuestion` em `getFinancialContext`, execução paralela
- `systemPrompt.ts`: bloco `conversasRelacionadasSection` entre `behavioralTagsSection` e `decisionSection`
- `AiAdvisor.tsx`: wiring — `userText` passado como 5º argumento de `getFinancialContext`

### Validação técnica
- tsc --noEmit: 0 erros
- mode="embed" validado: `{ ok: true, embedding: number[384] }`
- batch mode sem regressão
- wiring confirmado em AiAdvisor.tsx
- [x] T8.3 — Migration `ai_self_observations` + parser `META_REFLECTION_JSON`

## Sprint 8 — T8.3: Meta-reflexão da IA (Auto-observações)

Status: concluída e validada

### Entregas
- Migration `20260501000003_ai_self_observations.sql`
  - Enum `self_observation_type` (pattern_stale, context_conflict, calibration_miss, confidence_overreach, other)
  - Tabela `ai_self_observations` com RLS restrito a `SELECT`
- `ai-advisor`: helper `extractMetaReflectionJson` (brace-matching)
- `ai-advisor`: persistência em `ai_self_observations` integrada ao stream

### Validação técnica
- Deploy da Edge Function realizado com sucesso
- Migration aplicada via SQL Editor
- Parser isolado com try/catch silencioso
- Persistência via serviceClient confirmada

- [x] T8.4 — `promptSanitizer.ts` + aplicação em 4 pontos de entrada

## Sprint 8 — T8.4: promptSanitizer + Defesa Adversarial

Status: concluída e validada

### Entregas
- **Serviço Centralizado**: `src/services/aiAdvisor/promptSanitizer.ts`
  - Lista expandida de `KNOWN_JAILBREAK_PATTERNS` (ignore, system:, roleplay, disregard, pretend, override, etc.)
  - Proteção contra quebra de tags (`</user_data>`)
- **Isolamento Semântico**: Tags `<user_data>` injetadas em todos os inputs dinâmicos
- **System Prompt Guardrail**: Instrução rígida de inércia semântica adicionada ao `systemPrompt.ts`
- **Sanitização em Camadas**:
  - **Frontend**: `contextCollector.ts` (pergunta) e `captureContext.ts` (bloco OCR/Descrições)
  - **Backend**: Edge Function `ai-advisor` sanitiza TODO o histórico de mensagens do usuário (`messages.map`)

### Validação técnica
- **Preservação de RAG**: `findRelatedConversations` continua usando `rawQuestion` para manter a qualidade do embedding, enquanto o prompt usa a versão sanitizada.
- **Defesa Profunda**: Backend atua como "porteiro final", garantindo isolamento mesmo se o frontend for ignorado.
- **Inércia**: O modelo é instruído a tratar conteúdo em `<user_data>` estritamente como dado, nunca como instrução.

- [x] T8.5 — Suite adversarial `injection.test.ts` (25 payloads)

## Sprint 8 — T8.5: Suite adversarial injection.test.ts

Status: concluída e validada

### Entregas
- Suite de testes robusta: `src/services/aiAdvisor/__tests__/injection.test.ts`
- 25+ payloads cobrindo 8 categorias:
  - Classic jailbreak, Role override, Tag breakouts, JSON injection, OCR injection, Transaction contamination, Edge cases, Prompt leakage.
- Correção de vulnerabilidades no `promptSanitizer.ts`:
  - Bloqueio de comandos executáveis: `sudo`, `DROP TABLE`, `rm -rf`, `exec(`.
  - Sanitização de personagens maliciosos conhecidos (`DAN`).
  - Proteção contra quebra de tags de sistema (`<system>`, `<instruction>`).
  - Tratamento correto de inputs vazios.

### Validação técnica
- Vitest: 8 suítes / 8 testes passando (100% coverage de payloads críticos).
- Unicidade das tags `<user_data>` validada por Regex.
- Bloqueio de termos sensíveis confirmado em todas as camadas de sanitização.

- [ ] T8.6 — Migration `pattern_learning_queue` + edge function `process-pattern-learning-queue`
- [ ] T8.7 — Validação critérios de aceite Sprint 8

### Sprint 9 — IA Proativa e Relatório Semanal Interno
- [ ] T9.1 — Migration `weekly_digests` + edge function `generate-weekly-digest`
- [ ] T9.2 — Componente `<WeeklyDigestCard>` no Dashboard
- [ ] T9.3 — Migration `prompt_variants` + A/B testing no `ai-advisor`
- [ ] T9.4 — Hook `useTransactionAnomalyCheck` + modal de anomalias
- [ ] T9.5 — Dashboard `/settings/ai-evolution` (4 gráficos)
- [ ] T9.6 — Dashboard `/settings/ai-experiments` (taxas por variante)
- [ ] T9.7 — Validação critérios de aceite Sprint 9

### Sprint 10 — Alinhamento de Identidade e Valores
- [ ] T10.1 — `activeGoals.ts` + bloco de metas ativas no prompt
- [ ] T10.2 — Migration `life_events` + tela `/settings/life-calendar`
- [ ] T10.3 — Migration `scripture_library` + seed ACF (~40 versículos)
- [ ] T10.4 — `scriptureSelector.ts` + injeção de versículos no `ai-advisor`
- [ ] T10.5 — Correção lacuna silenciosa: consolidar `userAiPreferences` em `systemPrompt.ts`
- [ ] T10.6 — (Condicional) Migration `family_preferences` + `get_effective_ai_prefs()`
- [ ] T10.7 — Validação critérios de aceite Sprint 10

---

**Auditoria de fechamento Sprint 6 — 2026-04-18:**
Sprint 6 oficialmente concluído. Todos os critérios estruturais da seção 9.12 validados.
Critérios de runtime (≥50 eventos/dia, ≥3 tags detectadas) dependem de 30 dias de uso orgânico — infraestrutura deployada e validada.
4 critérios de gamificação (conquistas, streaks, microrrecompensa, /challenges) transferidos para Sprint 7 conforme decisão de escopo.
Próximo: Sprint 7 — Gamificação Adaptativa.

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

### 2026-04-15 (Sprint 6)

- T6.2 concluída
- `src/services/telemetry/useBehaviorTracking.ts` criado
- `EngagementEventType`: `screen_view` | `time_on_page` (demais em T6.3+)
- `persistEvent()` isolada — único ponto de acoplamento com Supabase; guard `import.meta.env.DEV` bloqueia escrita em desenvolvimento
- `useBehaviorTracking()` — `trackEvent` com `useCallback`, enriquecimento automático (`dayOfWeek`, `hourOfDay`), fallback scope `'all'→'private'`
- `useScreenTracking(screenName)` — `screen_view` no mount, `time_on_page` no unmount (guard >2s); `trackRef` evita closure stale
- Integrado nas 8 telas: Dashboard, Loans, Goals, Budget, Transactions, AiAdvisor, SmartCapture, MonthlyClosing
- tsc --noEmit: 0 erros
- commit 9d85a32 realizado, push realizado

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

### 2026-04-17 (Sprint 6)

- T6.7 concluída
- `supabase/functions/analyze-behavioral-patterns/index.ts` criado
- Detectores implementados: `anxiety_debt_focus` e `late_night_spending` (pseudocódigo do plano §9.8)
- Stub: `fim_de_mes_pressionado` — retorna null, implementação futura
- Guard: descarta pares (user_id, scope) com < 50 eventos/30d; filtra eventos com durationMs < 2s
- `fetchActiveUserScopes()` retorna pares (user_id, scope) diretamente — sem etapa separada de descoberta de scopes
- Upsert em `behavioral_tags` ON CONFLICT (user_id, scope, tag_key) — atualiza intensity, confidence, evidence, detected_at, expires_at
- verify_jwt: true (padrão mantido) — cron usa SERVICE_ROLE_KEY no header Authorization
- Cron `daily-analyze-behavioral-patterns` criado — `10 4 * * *`
- Deploy realizado via painel Supabase
- Teste pós-deploy: `{"ok":true,"users_analyzed":0,"tags_written":0}` (esperado — < 50 eventos acumulados)

---

### 2026-04-16 (Sprint 6)

- T6.4 concluída
- `supabase/migrations/20260426000001_pgvector_merchant_embedding.sql` criada e aplicada manualmente no Supabase
- `CREATE EXTENSION IF NOT EXISTS vector` — pgvector habilitado
- `ALTER TABLE public.user_patterns ADD COLUMN merchant_embedding vector(384)` — coluna nullable adicionada
- `CREATE INDEX idx_patterns_embedding` — ivfflat com cosine_ops, parcial para `merchant_category`
- Validado: extensão, coluna e índice confirmados via SQL Editor
- Nenhuma migration existente alterada

- T6.5 concluída — validada em produção
- `supabase/functions/learn-patterns/index.ts` atualizado — 161 inserções, 0 remoções de lógica existente
- Constantes exportadas: `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `EMBEDDING_VERSION`, `SIMILARITY_THRESHOLD`
- Interface `EmbeddingMetadata` com campos `embedding_source_text`, `embedding_model`, `embedding_version`, `embedded_at`
- `buildEmbeddingSourceText()` — monta texto para embedar (`pattern_key | sample_descriptions`)
- `generateEmbeddingsBatch()` — chamada à API OpenAI com fallback silencioso em todos os erros
- `backfillEmbeddingsForScope()` — modo `full`: detecta padrões sem embedding ou com versão desatualizada, gera em batch, atualiza DB
- `generateAndSaveSingleEmbedding()` — modos `incremental` e `from_correction`: gera e salva embedding para um único padrão
- Lógica determinística existente intacta — embeddings são complemento, não substituição
- tsc --noEmit: 0 erros
- Deploy realizado via painel Supabase
- Validado em produção: mode=full → ok: true, patterns_written=9
- merchant_embedding confirmado, embedding_metadata confirmado, vector_dims=384

- T6.3 concluída
- `src/pages/SmartCapture.tsx` instrumentado — nenhum outro arquivo alterado
- Constante `MIRROR_HESITATION_THRESHOLD_MS = 20_000` adicionada fora do componente
- `useBehaviorTracking()` instanciado no componente (já existia o hook; T6.2 criou)
- 2 novos refs: `hesitationFiredRef` (deduplicação por sessão) + `mirrorHesitationTimerRef` (timer setTimeout)
- `applyParsedResult`: reset de ambos os refs + agendamento de `mirror_hesitation` via `setTimeout`
- `handleFieldFocus`: disparo de `mirror_hesitation` se threshold ultrapassado no foco (proteção híbrida) + `field_hovered` em todos os focos
- `handleSave` + `handleDiscard`: `clearTimeout` antes de qualquer lógica
- `onFocus` adicionado nos 5 campos editáveis: `valor` (Input), `tipo` (SelectTrigger), `descricao` (Input), `data` (Input), `categoria` (SelectTrigger)
- Escopo não instrumentado (campo desabilitado quando `currentScope !== "all"`)
- `as EngagementEventType` usado como cast localizado — `useBehaviorTracking.ts` não alterado (extensão do tipo postergada para tarefa de tipagem dedicada)
- Fire-and-forget em todos os `trackEvent` (`void` sem `await`)
- Backend já suportava `field_hovered` e `mirror_hesitation` (`event_type text NOT NULL` na migration T6.1)

### 2026-04-18 (Sprint 6)

- T6.8 concluída
- `contextCollector.ts`: interface `BehavioralTag` exportada; campo `behavioralTags: BehavioralTag[] | null` em `FinancialContext`
- Query em `behavioral_tags` incluída no `Promise.all` — filtros: `user_id`, `expires_at > now()`, scope condicional, `limit(8)`
- Pós-processamento: map → filter (`intensity * confidence > 0.09`) → sort por score composto → slice(5)
- `systemPrompt.ts`: `behavioralTagsSection` construída condicionalmente; injetada entre `perfilSection` e `decisionSection`
- Nenhuma migration nova — tabela já existia (T6.6)

---

### 2026-04-18 (Sprint 6 — encerramento)

- T6.9 concluída — Sprint 6 encerrado
- Checklist de validação executado: behavioral_tags, contextCollector, systemPrompt, performance
- Todos os critérios estruturais aprovados
- Risco de TypeScript identificado (cast `supabase as any` em behavioral_tags) — não bloqueia runtime
- Sprint 6 declarado concluído

---

### 2026-04-18 (débito D6)

- Débito D6 quitado: `sourceTrust.ts` criado em `src/services/userProfile/`
- `getSourceTrust(source_type, confidence) → 1|2|3|4|5` — normaliza confidence texto e numérico
- Mapeamento completo do enum real do banco (manual, free_text, voice, photo_ocr, sms, ai_suggestion, system_generated)
- `SOURCE_TRUST_LABELS` exportado para uso futuro
- `systemPrompt.ts`: item 8 adicionado ao PROTOCOLO DE INTEGRIDADE — hierarquia de confiança de fonte
- tsc --noEmit: 0 erros
- commit 4f438be — push realizado

---

### 2026-04-18 (Sprint 7)

- T7.1 concluída
- `supabase/migrations/20260428000001_gamification.sql` criada e aplicada manualmente no Supabase
- Tabelas: `achievements_catalog` (sem RLS), `user_achievements` (RLS + seen_at), `user_streaks` (RLS)
- Índices: `idx_user_achievements_recent` (user_id, unlocked_at DESC), `idx_user_streaks_user` (user_id)
- Seed: 7 conquistas inseridas em `achievements_catalog` (3 identidade, 3 processo, 1 consistência)
- Checklist de validação executado: 3 tabelas, 2 policies, 2 índices, 7 seeds — tudo confirmado
- Correção pós-aplicação: Supabase auto-habilitou RLS em `achievements_catalog` (comportamento do projeto)
  → `ALTER TABLE public.achievements_catalog DISABLE ROW LEVEL SECURITY;` aplicado manualmente e confirmado
- T7.1 administrativamente encerrada

- T7.2 concluída
- `supabase/functions/evaluate-achievements/index.ts` criado
- Edge function deployada manualmente via painel Supabase
- Cron `daily-evaluate-achievements` criado via SQL Editor — `15 4 * * *` — `net.http_post` → `evaluate-achievements`
- Cron validado: `SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'daily-evaluate-achievements'`
- Teste pós-deploy executado via painel: `{"ok":true,"users_evaluated":0,"achievements_unlocked":0}` (esperado — < 10 eventos acumulados)
- Avaliadores ativos (3): `transactions_count`, `weekly_closing_views`, `app_usage_window`
- Avaliadores desativados por ausência de fonte de verdade (4): `recurring_paid`, `donation_percent`, `reserve_coverage`, `zero_pending`
- Streaks não implementados nesta tarefa — sem fonte validada
- Catálogo inválido/ausente: guard `if (!row.criteria || typeof row.criteria.type !== "string") continue` — execução não quebra
- Idempotência: upsert com `ignoreDuplicates: true` em `user_achievements`

---

---

### 2026-04-19 (Sprint 7)

- T7.3 concluída
- `src/components/shared/MicroRewardCheckmark.tsx` criado
- Animação CSS pura (Tailwind): fade-in 16ms → visível 600ms → fade-out 300ms → desmonta
- `fireReward()` em `SmartCapture.tsx`: padrão `false → setTimeout → true` garante múltiplos disparos
- Integrado nos dois caminhos de sucesso do `handleSave` (simples e parcelado)
- `MicroRewardCheckmark` renderizado fora do bloco `{parsed && ...}` — sobrevive ao `setParsed(null)`
- tsc --noEmit: 0 erros
- Sem migration, sem edge function, sem alteração de schema

### 2026-04-19 (Sprint 7 — continuação)

- T7.4 concluída
- `src/components/shared/AchievementUnlockedToast.tsx` criado
- Query `user_achievements` JOIN `achievements_catalog!inner` WHERE `seen_at IS NULL`
- `seen_at` marcado com `await` + try/catch antes da animação iniciar
- Fila via `toastIdx` — múltiplas conquistas exibidas sequencialmente
- Componente `pointer-events-none`, auto-dismiss ~2,8s, fora de qualquer bloco condicional
- tsc --noEmit: 0 erros
- Sem migration, sem edge function

### 2026-04-19 (Sprint 7 — continuação)

- T7.5 concluída
- `supabase/migrations/20260428000002_challenges_catalog.sql` criada e aplicada manualmente no Supabase
- Tabela `challenges_catalog` validada — 4 linhas (sem_saida_7, categorizar_semana, registrar_30, reduzir_despesas)
- `ALTER TABLE DISABLE ROW LEVEL SECURITY` incluído na migration — evita regressão conhecida do projeto
- `src/pages/Challenges.tsx` criado — lê catálogo do banco, detecta ativos via `goals WHERE notas ILIKE 'challenge:%'`
- Ativação cria goal com `notas = 'challenge:<id>'`; encerramento seta `ativo = false`
- Rota `/challenges` adicionada em `App.tsx` (lazy)
- tsc --noEmit: 0 erros

### 2026-04-19 (Sprint 7 — encerramento)

- T7.6 concluída — Sprint 7 oficialmente encerrado
- Critérios atendidos: microrrecompensa ✅, /challenges ✅, sem push ✅, linguagem reflexiva ✅
- Critérios de runtime (conquistas de identidade, streaks) dependem de uso orgânico — infraestrutura deployada e validada
- cron `daily-evaluate-achievements` ativo (`15 4 * * *`)
- `seen_at` funcional: marcado com await antes da animação, query filtra IS NULL
- tsc --noEmit: 0 erros em todos os arquivos do Sprint 7

**Débito técnico D7-A — aceito, não bloqueador:**
- Conquistas de identidade (`mordomo_fiel_3m`, `protetor_da_familia`, `semeador`) sem avaliador ativo
- Motivo: ausência de fonte de verdade validada para dízimo/doações/reserva no schema atual
- Efeito: essas 3 conquistas jamais desbloqueam automaticamente — não derruba o app
- Tratar quando modelagem de recorrências/dízimo for formalizada

**Débito técnico D7-B — aceito, não bloqueador:**
- Tabela `user_streaks` existe mas sem UI ("X de Y dias")
- Motivo: sem dados populados — exibir zeros não agrega valor real
- Efeito: streaks invisíveis para o usuário — não derruba o app
- Tratar quando `user_streaks` tiver dados orgânicos após 30+ dias de uso

**Auditoria de fechamento Sprint 7 — 2026-04-19:**
Sprint 7 oficialmente concluído. Critérios estruturais validados.
Critérios de runtime dependem de uso orgânico (analogia: D5 Sprint 5, critérios Sprint 6).
Próximo sprint a definir.

---

## Cronograma de Quitação de Débitos

### Sessão 1 — Limpeza de tipagem (rápida, hoje)
> Pré-requisito: nenhum. Estimativa: 30 min.

- [x] **DI-1** — Corrigir cast `supabase as any` em `contextCollector.ts` — tipo explícito `DecisionRow`, cast `as unknown as { data: DecisionRow[] | null }`
- [x] **DI-2** — Estender `EngagementEventType` em `useBehaviorTracking.ts` para incluir `field_hovered` e `mirror_hesitation` — 3 casts localizados removidos de `SmartCapture.tsx`

### Sessão 2 — Testes unitários (D3)
> Pré-requisito: nenhum. Estimativa: 1–2h.

- [x] **D3-a** — Testes para `buildDiff()` em `captureLearningEvents.ts` (5 casos)
- [x] **D3-b** — Testes para `recordCaptureLearningEvent()` em `captureLearningEvents.ts` (3 casos: sucesso, erro supabase, exceção)
- [x] **D3-c** — Testes para `formatPatterns()` em `captureContext.ts` (8 casos)
- Funções exportadas: `buildDiff`, `confidenceToNumeric` (captureLearningEvents.ts), `formatPatterns` (captureContext.ts)
- 20/20 testes passando — `src/services/smartCapture/__tests__/`

### Sessão 3 — Detector comportamental (stub)
> Pré-requisito: alinhamento sobre critério de "fim de mês pressionado". Estimativa: 1h.

- [x] **DI-3** — Implementar `fim_de_mes_pressionado` em `analyze-behavioral-patterns`
  - Critério: gasto diário médio nos últimos 5 dias do mês > resto do mês em ≥ 2 meses completos
  - Interface `Transaction` ampliada: campos `tipo` e `data` adicionados
  - `fetchTransactions` select atualizado: `tipo, data` incluídos
  - Guard: mínimo 10 despesas confirmadas; exclui mês atual (incompleto)
  - intensity = pressuredMonths / monthsWithData; confidence = monthsWithData / 3
  - **Requer redeploy manual da edge function `analyze-behavioral-patterns`**

### Sessão 4 — UI de streaks (D7-B)
> Pré-requisito: ≥ 30 dias de uso orgânico (dados reais em `user_streaks`). Previsão: maio/2026.

- [ ] **D7-B** — Componente de streak suave ("X de Y dias") visível no Dashboard ou `/challenges`

### Sessão 5 — Confirmação cron aderência (D5)
> Pré-requisito: orgânico — cron `review-decision-outcomes` rodando desde 2026-04-14. Previsão: maio/2026.

- [ ] **D5** — Confirmar via SQL que `decision_outcomes` tem registros com `reviewed_at` preenchido pelo cron

### Sessão 6 — Avaliadores de identidade (D7-A)
> Pré-requisito: modelagem de recorrências/dízimo no schema. Sem data — depende de Sprint futuro.

- [ ] **D7-A-1** — Avaliador `recurring_paid` (dízimo) — requer `recurring_transactions` ou campo equivalente
- [ ] **D7-A-2** — Avaliador `reserve_coverage` (reserva) — requer cálculo via saldo de contas + meta de reserva
- [ ] **D7-A-3** — Avaliador `donation_percent` (doações) — requer categorização de doações + renda confirmada
- [ ] **D7-A-4** — Avaliador `zero_pending` — requer query de `transactions WHERE data_status = 'pending'` por N dias

---

### Resumo do cronograma

| Sessão | Débitos | Quando | Bloqueio |
|---|---|---|---|
| 1 | DI-1, DI-2 | Hoje | Nenhum |
| 2 | D3-a, D3-b, D3-c | Hoje | Nenhum |
| 3 | DI-3 | Próxima sessão | Alinhamento de critério |
| 4 | D7-B | Maio/2026 | Dados orgânicos |
| 5 | D5 | Maio/2026 | Orgânico |
| 6 | D7-A | Sprint futuro | Modelagem de schema |

## Próxima tarefa esperada
**Sessão 4 — D7-B: UI de streaks (aguarda dados orgânicos em maio/2026)**
