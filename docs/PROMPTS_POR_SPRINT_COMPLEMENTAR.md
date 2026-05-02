# 📋 Prompts Padrão para Nova Sessão — Plano Complementar (Sprints 8-10)

> **Como usar:** ao abrir uma sessão nova no Claude Code (aba Code do app Claude),
> anexe o arquivo `PLANO_COMPLEMENTAR_INTELIGENCIA.md` arrastando para a conversa,
> depois copie e cole o prompt correspondente ao sprint que você está fazendo.
>
> **Pré-requisito:** Sprints 1-7 do plano original concluídos e estáveis em produção
> (vide `STATUS_EXECUCAO.md`).
>
> **Importante:** marque manualmente abaixo de cada prompt em qual tarefa você
> está, para o Claude Code saber onde retomar.

---

## 🔵 PROMPT PADRÃO — SPRINT 8
### (Memória Conversacional Profunda e Defesa de Prompt — 4-5 dias, novas migrations + pgvector + parser adversarial)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Estou implementando o PLANO COMPLEMENTAR de evolução da IA
do FinanceiroJe. O plano está anexado (PLANO_COMPLEMENTAR_INTELIGENCIA.md).
Estou no SPRINT 8 — primeiro sprint do complemento, focado em memória
conversacional e defesa adversarial.

STATUS: Sprints 1-7 do plano original já estão concluídos e estáveis
em produção. O sistema tem user_patterns, ai_coach_memory_v2,
decision_outcomes, behavioral_tags, user_engagement_events, pgvector
para merchant matching e gamificação adaptativa funcionando.

PASSOS OBRIGATÓRIOS ANTES DE QUALQUER CÓDIGO:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO 5 (Sprint 8) inteira
2. Leia o CLAUDE.md na raiz
3. Leia também docs/STATUS_EXECUCAO.md para entender onde os
   Sprints 1-7 pararam e quais débitos técnicos foram aceitos
4. Explore o estado atual do projeto:
   - src/services/aiAdvisor/contextCollector.ts (já tem 945 linhas —
     vai receber conversasRelacionadas)
   - src/services/aiAdvisor/systemPrompt.ts (já tem 459 linhas —
     vai receber bloco de conversas + diretriz de defesa)
   - supabase/functions/ai-advisor/index.ts (já extrai INSIGHT_COACH_JSON
     e RECOMMENDATION_JSON — vai ganhar META_REFLECTION_JSON)
   - supabase/migrations/ (liste TODAS pra confirmar que timestamps
     20260501xxx não conflitam com nada existente)
   - supabase/migrations/20260408000004_pattern_learning_trigger.sql
     (vai ser alterado pra gravar em outbox em vez de HTTP direto)
   - supabase/migrations/20260410000001_fix_trigger_hardcoded_url.sql
     (tem a URL hardcoded que o trigger atual usa — referência)

5. Depois me responda:
   A) Resumo em 3 linhas do objetivo do Sprint 8
   B) Lista das sub-tarefas na ordem que você sugere executar:
      - T8.1 — Migration ai_messages_embedding + edge function embed-ai-messages
      - T8.2 — findRelatedConversations() no contextCollector + integração no systemPrompt
      - T8.3 — Migration ai_self_observations + parser META_REFLECTION_JSON no ai-advisor
      - T8.4 — promptSanitizer.ts + aplicação nos 4 pontos de entrada + diretriz no system prompt
      - T8.5 — Suite adversarial injection.test.ts (20 payloads)
      - T8.6 — Migration pattern_learning_queue + alteração do trigger + edge function
               process-pattern-learning-queue + modo from_corrections_batch em learn-patterns
      - T8.7 — Validação final Sprint 8 (critérios 5.10 do plano)
   C) Qual sub-tarefa estamos fazendo agora?
   D) Plano detalhado dessa sub-tarefa em passos pequenos
   E) Riscos específicos dessa sub-tarefa (especialmente: pgvector em
      tabela grande de mensagens; parser META_REFLECTION_JSON não quebrar
      o parser existente de INSIGHT_COACH_JSON e RECOMMENDATION_JSON;
      trigger não causar downtime na alteração)

TAREFA ATUAL NESTA SESSÃO: _______________
(Preencher: T8.1, T8.2, T8.3, T8.4, T8.5, T8.6 ou "validação final")

REGRAS NÃO-NEGOCIÁVEIS DE TODAS AS SESSÕES:
- NÃO execute git push, git commit — eu commito manualmente via github.dev
- NÃO execute supabase db push, supabase functions deploy — eu deployo manual
- NÃO execute npm run build a menos que eu peça
- ANTES de editar arquivo, mostre o plano de mudança e espere validação
- UMA tarefa por sessão — não tente fazer o sprint inteiro
- Quando propuser edição, mostre o DIFF visual antes de aplicar
- Tom direto, sem pedidos de desculpa longos, sem explicações óbvias
- Se algo no plano não estiver claro, PERGUNTE antes de improvisar

REGRAS ESPECÍFICAS DO SPRINT 8:
- pgvector já está habilitado (Sprint 6). NÃO reexecute CREATE EXTENSION.
- Qualquer trigger novo ou alterado: preferir outbox table a pg_net direto
  (lição aprendida do Sprint 2 — migration 20260410000001_fix_trigger_hardcoded_url)
- Sanitização: SEMPRE que adicionar um novo ponto onde texto do usuário
  entra no prompt, aplique sanitizePromptContext() — nunca improvise
- Embeddings em DEV: guard com import.meta.env.DEV para não gastar API
  (mesmo padrão de useBehaviorTracking.ts no Sprint 6)
- Parser adversarial: adicionar padrão novo sem quebrar os 20 existentes

PRINCÍPIOS DO PROJETO (não-negociáveis):
1. Zero alucinação financeira — IA nunca inventa números
2. Memória comportamental ≠ fato financeiro
3. Decisão sempre fica com o usuário
4. Sem push notifications de engajamento
5. Escopo isolado (private/family/business não se misturam)

PRINCÍPIO ADICIONAL DO COMPLEMENTAR:
6. Conteúdo do usuário é HOSTIL por padrão — tags <user_data>,
   sanitização antes de entrar em prompt, suite adversarial em CI

Pode começar pela leitura. Não escreva código ainda.
```

---

## 🟢 PROMPT PADRÃO — SPRINT 9
### (IA Proativa e Relatório Semanal Interno — 3-4 dias, novas features sem mexer em crítico)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Estou implementando o PLANO COMPLEMENTAR de evolução da IA
do FinanceiroJe. O plano está anexado (PLANO_COMPLEMENTAR_INTELIGENCIA.md).
Estou no SPRINT 9 — IA proativa controlada, A/B testing, anomalias,
dashboards de evolução.

STATUS: Sprint 8 já está concluído e em produção. O sistema tem
memória conversacional via embeddings, defesa contra prompt injection,
meta-reflexão da IA e rate limiting do trigger de correção.

PASSOS OBRIGATÓRIOS ANTES DE QUALQUER CÓDIGO:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO 6 (Sprint 9) inteira
2. Leia o CLAUDE.md na raiz
3. Leia docs/STATUS_EXECUCAO.md para entender Sprint 8 e eventuais
   débitos técnicos aceitos
4. Explore o estado atual do projeto:
   - src/services/aiAdvisor/contextCollector.ts (deve ter
     conversasRelacionadas do Sprint 8)
   - src/services/aiAdvisor/systemPrompt.ts
   - src/pages/Dashboard.tsx (vai receber WeeklyDigestCard)
   - src/pages/Transactions.tsx (vai receber useTransactionAnomalyCheck)
   - src/pages/settings/AIMemory.tsx (referência de estrutura de
     tela de settings — novas telas AIExperiments e AIEvolution
     devem seguir mesmo padrão visual)
   - supabase/functions/ai-advisor/index.ts (vai aceitar variantes
     de prompt)
   - supabase/migrations/ (liste pra confirmar timestamps 20260508xxx
     livres)

5. Depois me responda:
   A) Resumo em 3 linhas do objetivo do Sprint 9
   B) Lista das sub-tarefas na ordem que você sugere executar:
      - T9.1 — Migration weekly_digests + edge function
               generate-weekly-digest + cron segunda 06:00
      - T9.2 — Componente WeeklyDigestCard no Dashboard
      - T9.3 — Migration prompt_variants + coluna prompt_variant_keys
               em ai_messages + assignVariants() no edge function
      - T9.4 — Hook useTransactionAnomalyCheck + AnomalyWarningModal +
               integração em Transactions.tsx
      - T9.5 — Dashboard /settings/ai-evolution (4 gráficos dos 4 scores)
      - T9.6 — Dashboard /settings/ai-experiments (taxas por variante)
      - T9.7 — Validação final Sprint 9 (critérios 6.9 do plano)
   C) Qual sub-tarefa estamos fazendo agora?
   D) Plano detalhado dessa sub-tarefa em passos pequenos
   E) Riscos específicos dessa sub-tarefa (especialmente: digest não
      virar invasão sutil; anomaly check não criar fricção em entrada
      manual rotineira; gráficos de evolução não mostrarem dados
      falsos quando histórico é insuficiente)

TAREFA ATUAL NESTA SESSÃO: _______________
(Preencher: T9.1, T9.2, T9.3, T9.4, T9.5, T9.6 ou "validação final")

REGRAS NÃO-NEGOCIÁVEIS DE TODAS AS SESSÕES:
- NÃO execute git push, git commit — eu commito manualmente via github.dev
- NÃO execute supabase db push, supabase functions deploy — eu deployo manual
- NÃO execute npm run build a menos que eu peça
- ANTES de editar arquivo, mostre o plano de mudança e espere validação
- UMA tarefa por sessão — não tente fazer o sprint inteiro
- Quando propuser edição, mostre o DIFF visual antes de aplicar
- Tom direto, sem pedidos de desculpa longos, sem explicações óbvias
- Se algo no plano não estiver claro, PERGUNTE antes de improvisar

REGRAS ESPECÍFICAS DO SPRINT 9:
- ZERO push notifications do sistema operacional. Nunca. Em nenhuma tela.
- ZERO badge numérica crescente. Nada de "3 insights novos!".
- WeeklyDigestCard: aparece se não visto; some se dismissado. Sem retorno.
- AnomalyWarningModal: bloquear só se for anomalia ALTA (valor > p90 * 3
  E n_amostras >= 5). Anomalia média vira info, não modal.
- Gráficos de evolução: se menos de 4 pontos semanais disponíveis, exibir
  estado vazio com mensagem "Histórico insuficiente — volte em X semanas"
  em vez de gráfico mentiroso
- A/B testing: apenas 1 experimento ativo por vez nos primeiros 90 dias
  (evitar dividir tráfego demais)

PRINCÍPIOS DO PROJETO (não-negociáveis):
1. Zero alucinação financeira — IA nunca inventa números
2. Memória comportamental ≠ fato financeiro
3. Decisão sempre fica com o usuário
4. Sem push notifications de engajamento
5. Escopo isolado (private/family/business não se misturam)

PRINCÍPIOS DO COMPLEMENTAR:
6. Conteúdo do usuário é HOSTIL por padrão (do Sprint 8)
7. Voz proativa controlada — aparece, não interrompe; dismissível sempre

Pode começar pela leitura. Não escreva código ainda.
```

---

## 🟣 PROMPT PADRÃO — SPRINT 10
### (Alinhamento de Identidade e Valores — 3-4 dias, metas + calendário + versículos ACF + correção arquitetural)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Estou implementando o PLANO COMPLEMENTAR de evolução da IA
do FinanceiroJe. O plano está anexado (PLANO_COMPLEMENTAR_INTELIGENCIA.md).
Estou no SPRINT 10 — último sprint do complementar. Foco: metas ativas,
calendário de vida, biblioteca ACF curada e correção da lacuna silenciosa
do userAiPreferences.

STATUS: Sprints 8-9 já concluídos. O sistema tem memória conversacional,
defesa adversarial, digest semanal inline, A/B testing de prompts,
detecção de anomalias em entrada manual, dashboards de evolução.

PASSOS OBRIGATÓRIOS ANTES DE QUALQUER CÓDIGO:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO 7 (Sprint 10) inteira
   E a SEÇÃO 8 (correção da lacuna silenciosa)
2. Leia o CLAUDE.md na raiz
3. Leia docs/STATUS_EXECUCAO.md
4. Explore o estado atual:
   - src/services/aiAdvisor/contextCollector.ts linhas 140-160
     (interface FinancialContext — observe que userAiPreferences
     JÁ EXISTE no contexto; o problema é que não é lido pelo
     systemPrompt.ts — ver seção 8 do plano)
   - src/services/aiAdvisor/contextCollector.ts linha 290
     (query de user_ai_preferences — referência)
   - src/services/aiAdvisor/contextCollector.ts linhas 900-930
     (onde userAiPreferences é atribuído no retorno)
   - src/services/aiAdvisor/systemPrompt.ts linhas 10-29
     (destructuring atual — NÃO inclui userAiPreferences; é aqui que
     a lacuna silenciosa mora)
   - supabase/functions/ai-advisor/index.ts linhas 569-588
     (montagem manual de userPrefsSection que precisa ser REMOVIDA
     depois que o systemPrompt.ts absorver a responsabilidade)
   - src/pages/Goals.tsx (como referência de como goals são gerenciadas)
   - src/pages/settings/AIMemory.tsx (referência para nova tela
     /settings/life-calendar)
   - supabase/migrations/20260415000001_user_ai_preferences.sql
     (schema atual — vai receber ALTER no Sprint 10)

5. Depois me responda:
   A) Resumo em 3 linhas do objetivo do Sprint 10
   B) Lista das sub-tarefas na ordem que você sugere executar:
      - T10.1 — src/services/userProfile/activeGoals.ts +
                buildMetasAtivas() + integração em contextCollector +
                metasAtivasSection no systemPrompt
      - T10.2 — Migration life_events + tela /settings/life-calendar
                (LifeEventForm) + eventosProximos30d em contextCollector +
                calendarioSection no systemPrompt
      - T10.3 — Migration scripture_library + seed ACF (~40 versículos)
      - T10.4 — src/services/aiAdvisor/scriptureSelector.ts +
                injeção no ai-advisor com diretriz espiritual
      - T10.5 — Correção da lacuna silenciosa: adicionar
                userAiPreferences ao destructuring e construir
                userPrefsSection DENTRO do systemPrompt.ts;
                REMOVER a montagem duplicada no ai-advisor/index.ts
                (MANTER compatibilidade por 1 semana — não quebrar)
      - T10.6 — (Condicional à Esdra) Migration family_preferences +
                get_effective_ai_prefs()
      - T10.7 — Validação final Sprint 10 (critérios 7.8 do plano) +
                audit manual de fidelidade ACF (10 testes consecutivos)
   C) Qual sub-tarefa estamos fazendo agora?
   D) Plano detalhado dessa sub-tarefa em passos pequenos
   E) Riscos específicos dessa sub-tarefa (especialmente: citação
      bíblica literal não pode ser paráfrase; remoção da montagem
      duplicada não pode quebrar produção; seed ACF precisa revisão
      manual antes de aplicar — tradução errada é pior que ausente)

TAREFA ATUAL NESTA SESSÃO: _______________
(Preencher: T10.1, T10.2, T10.3, T10.4, T10.5, T10.6 ou "validação final")

REGRAS NÃO-NEGOCIÁVEIS DE TODAS AS SESSÕES:
- NÃO execute git push, git commit — eu commito manualmente via github.dev
- NÃO execute supabase db push, supabase functions deploy — eu deployo manual
- NÃO execute npm run build a menos que eu peça
- ANTES de editar arquivo, mostre o plano de mudança e espere validação
- UMA tarefa por sessão — não tente fazer o sprint inteiro
- Quando propuser edição, mostre o DIFF visual antes de aplicar
- Tom direto, sem pedidos de desculpa longos, sem explicações óbvias
- Se algo no plano não estiver claro, PERGUNTE antes de improvisar

REGRAS ESPECÍFICAS DO SPRINT 10:
- Versículos ACF: texto LITERAL da ACF. Se você não tem certeza do
  texto exato, PEÇA pra eu te passar. Citação bíblica errada é
  pior que ausência de versículo.
- Traduções permitidas: APENAS ACF (Almeida Corrigida Fiel).
  Não inserir NVI, ARA, ARC, NTLH ou qualquer outra.
- Tema detection no scriptureSelector: preferir NÃO citar quando
  incerto do tema do que citar versículo deslocado
- Correção da lacuna silenciosa (T10.5): validar em staging antes
  de remover a montagem duplicada no ai-advisor. Manter paralelismo
  por 1 semana — se runtime do systemPrompt incluir userPrefsSection,
  o edge function pode parar de montar. Nunca os dois ao mesmo tempo.
- life_events: CRUD pelo próprio usuário. Não seed automático
  com dados pessoais (aniversários etc. entram manualmente via UI)
- T10.6 é CONDICIONAL: só executar depois de confirmar com a Esdra
  o modelo de preferências por usuário. Se ela não estiver pronta,
  pular T10.6 e fazer validação final só com T10.1-T10.5.

PRINCÍPIOS DO PROJETO (não-negociáveis):
1. Zero alucinação financeira — IA nunca inventa números
2. Memória comportamental ≠ fato financeiro
3. Decisão sempre fica com o usuário
4. Sem push notifications de engajamento
5. Escopo isolado (private/family/business não se misturam)

PRINCÍPIOS DO COMPLEMENTAR:
6. Conteúdo do usuário é HOSTIL por padrão (Sprint 8)
7. Voz proativa controlada (Sprint 9)
8. Fidelidade ACF zero-alucinação — citação literal ou nenhuma
9. Metas declaradas são NORTE de recomendação, não decoração
10. Calendário de vida é contexto operacional, não lembrete cosmético

Pode começar pela leitura. Não escreva código ainda.
```

---

## 🧭 PROMPT PADRÃO — VALIDAÇÃO FINAL DE SPRINT
### (Uso após concluir todas as sub-tarefas de um sprint, antes do commit final)

```
Olá. Sou Josemar. Português brasileiro, tom direto.

CONTEXTO: Acabei de concluir todas as sub-tarefas do SPRINT __
do plano complementar (PLANO_COMPLEMENTAR_INTELIGENCIA.md anexado).
Preciso validar tudo antes de marcar o sprint como concluído.

SPRINT EM VALIDAÇÃO: _______________
(Preencher: 8, 9 ou 10)

PASSOS OBRIGATÓRIOS:

1. Releia a seção do sprint correspondente no plano anexado
2. Leia docs/STATUS_EXECUCAO.md para ver o que foi registrado
3. Abra os critérios de aceite listados no plano:
   - Sprint 8: seção 5.10 (8 critérios)
   - Sprint 9: seção 6.9 (7 critérios)
   - Sprint 10: seção 7.8 (8 critérios)
4. Para cada critério, execute verificação empírica:
   - Migrations aplicadas? → query de tabelas/colunas/índices no Supabase
   - Edge functions deployadas? → tentar chamar
   - Crons ativos? → SELECT * FROM cron.job WHERE jobname = '...'
   - Componentes React funcionam? → verificar importação e render
   - RLS ativa? → relrowsecurity = true
   - Testes passam? → rodar a suite relevante

5. Me entregue um RELATÓRIO DE VALIDAÇÃO neste formato:

   CRITÉRIO 1: <texto do critério>
   STATUS: ✅ / ⚠️ / ❌
   EVIDÊNCIA: <query SQL, output, snippet de código, etc>
   NOTAS: <se ⚠️ ou ❌, o que falta>

   (repetir para cada critério)

   RESUMO: X/Y critérios aprovados.
   DÉBITOS TÉCNICOS IDENTIFICADOS: <lista com código D__-_ se aplicável>
   RECOMENDAÇÃO: ENCERRAR | ENCERRAR COM DÉBITO | NÃO ENCERRAR (o que falta)

6. Se houver débito aceito (dependente de uso orgânico, dados acumulados,
   ou validação externa), me proponha registro em STATUS_EXECUCAO.md
   seguindo o padrão D5, D7-A, D7-B que já existem.

7. Se tudo 100%, me proponha a auditoria de fechamento pra eu colar
   em STATUS_EXECUCAO.md, seguindo o padrão dos sprints anteriores:

   **Auditoria de fechamento Sprint X — YYYY-MM-DD:**
   Sprint X oficialmente concluído. Todos os critérios da seção X.X validados.
   [Observações, débitos orgânicos registrados, etc]
   Próximo: Sprint X+1 — [nome] / ou "a definir".

REGRAS:
- NÃO execute git commit/push, supabase push — eu faço manual
- Se um critério pode ser testado via SQL/query, me entregue a query
  pra eu rodar (eu colo o output aqui)
- Se um critério depende de 30+ dias de uso orgânico, registre como
  débito tipo D5 do Sprint 5 (critério estrutural ok, runtime depende
  de tempo) — não bloqueie o fechamento por isso
- Seja direto sobre o que NÃO está pronto — não mascare

Pode começar pela releitura. Primeiro me mostre o plano de validação
antes de executar as queries.
```

---

## 📘 Observações gerais sobre sessões do plano complementar

### Ordem dos sprints

Os Sprints 8-10 **devem ser executados em ordem**. Razões:

- **Sprint 8 primeiro** — introduz defesa adversarial (pré-requisito de qualquer
  ampliação de superfície do prompt) e infraestrutura de embeddings de mensagens
  que pode ser útil em outros sprints
- **Sprint 9 depende parcialmente do Sprint 8** — se um novo payload adversarial
  entrar via digest ou via campo de anomaly, precisa do sanitizador já em produção
- **Sprint 10 por último** — é o sprint mais "seu" e depende de:
  - Infra dos Sprints 8-9 estável
  - Validação da Esdra para o item de preferências por usuário (T10.6)

### Tempo estimado total

- Sprint 8: 4-5 dias de execução efetiva
- Sprint 9: 3-4 dias
- Sprint 10: 3-4 dias

Total: **10-13 dias** de execução concentrada. Em ritmo real com pausas,
pode levar 3-5 semanas (referência: Sprints 1-7 originais levaram ~15 dias
contínuos).

### Integração com STATUS_EXECUCAO.md

Após cada sub-tarefa concluída, registre em `docs/STATUS_EXECUCAO.md`
no mesmo formato dos sprints 1-7:

```markdown
### 2026-0X-XX (Sprint X)

- TX.Y concluída
- <arquivo_principal> criado/atualizado
- <detalhes técnicos relevantes>
- <comandos executados / migrations aplicadas>
- Validação: <evidência>
- Débito técnico (se houver): D__-_ — <descrição>
```

### Quando parar um sprint no meio

É aceitável (e às vezes recomendável) parar um sprint no meio se:

- Surgir um débito técnico dos Sprints 1-7 que precise ser quitado primeiro
- Uma integração externa (Esdra, bloqueio do Supabase, limite de API) travar
- O contexto humano (PMESP, família, CCB) exigir pausa mais longa

Nesses casos, registrar em STATUS_EXECUCAO.md o ponto de pausa com o padrão:

```markdown
**Sprint X — PAUSADO em TX.Y**
Motivo: <razão>
Retomada prevista: <quando>
Estado das tarefas: <lista>
```

### Princípios adicionais do complementar (resumo consolidado)

Além dos 5 princípios originais, o complementar introduz 5 adicionais:

6. **Conteúdo do usuário é HOSTIL por padrão** — Sprint 8
7. **Voz proativa controlada** — aparece, não interrompe; dismissível sempre — Sprint 9
8. **Fidelidade ACF zero-alucinação** — citação literal ou nenhuma — Sprint 10
9. **Metas declaradas são NORTE de recomendação**, não decoração — Sprint 10
10. **Calendário de vida é contexto operacional**, não lembrete cosmético — Sprint 10

---

## 🟢 PROMPTS PARA SPRINTS DO PAINEL EMPREENDEDOR (Esdra Cosméticos)

> **Quando usar:** após conclusão dos Sprints 8-10 da PIL pessoal e após mínimo 30 dias de uso real do Manual 30 Dias HTML (`public/manual/index.html`). Estes prompts são para os 6 sprints do `PLANO_PAINEL_ESDRA.md` v2.0.
>
> **Pré-requisito comum:** anexar `PLANO_PAINEL_ESDRA.md` na conversa antes de colar o prompt.

---

### 🟢 PROMPT — SPRINT 1 (Painel Empreendedor: Estrutura Base + tela "Hoje")

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Estou iniciando o PAINEL EMPREENDEDOR do FinanceiroJe — extensão modular
voltada para gestão da Esdra Cosméticos (e-commerce de cosméticos da minha
esposa). O plano técnico está anexado (PLANO_PAINEL_ESDRA.md v2.0).
Estou no SPRINT 1 — primeiro sprint do plano, focado em estrutura base e
tela "Hoje" com checklist diário.

STATUS:
- Sprints 1-7 do plano original e Sprints 8-10 do plano complementar
  da PIL pessoal estão concluídos e estáveis em produção.
- Manual 30 Dias HTML está em produção em public/manual/index.html
  desde 02/05/2026 e tem sido usado diariamente.
- Migrations manual_30_dias_progresso e manual_30_dias_decisoes estão
  aplicadas no Supabase de produção.

PASSOS OBRIGATÓRIOS ANTES DE QUALQUER CÓDIGO:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO "SPRINT 1" inteira
2. Leia o CLAUDE.md na raiz
3. Leia docs/STATUS_EXECUCAO.md para entender estado atual
4. Explore:
   - public/manual/index.html (HTML atual em produção — fonte de
     inspiração visual para o módulo definitivo)
   - src/services/aiAdvisor/ (padrões de organização de módulos)
   - supabase/migrations/ (liste todas — identifique timestamps usados)
   - Confirme as 5 tabelas esdra_* especificadas no plano não existem ainda
5. Depois me responda:
   A) Resumo em 3 linhas do objetivo do Sprint 1
   B) Lista das sub-tarefas na ordem que você sugere executar:
      - T1.1 — Criar migrations das 5 tabelas esdra_*
      - T1.2 — Seed do Manual 30 Dias (script TypeScript)
      - T1.3 — Componentes React da tela /painel-esdra/hoje
   C) Riscos antecipados específicos deste Sprint
   D) Onde você sugere começar (sub-tarefa atual)

REGRAS:
- Não rode nada, não crie nada, não altere nada antes da minha aprovação
- Quando aprovar, faça uma sub-tarefa de cada vez
- Migrations aplicadas MANUALMENTE via Supabase SQL Editor (NÃO use CLI)
- Após cada sub-tarefa: pause, mostre o que fez, peça validação
- Se encontrar algo divergente do plano (timestamp conflitante, schema
  inesperado), pause e me consulte — não improvise

TAREFA ATUAL NESTA SESSÃO: ___ (preencho ao iniciar)
```

---

### 🟢 PROMPT — SPRINT 2 (Painel Empreendedor: tela "Métricas" + integração financeira)

```
Olá. Sou Josemar. Português brasileiro, tom direto.

CONTEXTO: Estou no SPRINT 2 do Painel Empreendedor (Esdra Cosméticos).
Plano anexado: PLANO_PAINEL_ESDRA.md v2.0.

STATUS: Sprint 1 do Painel concluído (estrutura base + tela /hoje
funcionando com persistência). Tabelas esdra_* todas criadas no
Supabase. Manual 30 Dias HTML continua em uso paralelo.

PASSOS OBRIGATÓRIOS:

1. Leia PLANO_PAINEL_ESDRA.md SEÇÃO SPRINT 2 inteira
2. Leia STATUS_EXECUCAO.md para confirmar Sprint 1 concluído
3. Explore:
   - src/modules/painel-esdra/ (Sprint 1 está aqui)
   - Tabelas no Supabase: confirme esdra_kpis_semanais existe
   - Módulo financeiro do FinanceiroJe (transações filtradas por escopo)
4. Me responda:
   A) Como você planeja construir a função SQL get_esdra_faturamento_semana?
   B) Qual lib de chart vamos usar (recharts já presente?)
   C) Estratégia de fechamento semanal (manual ou semi-automático?)

Sub-tarefas:
- T2.1 — Função SQL de agregação de faturamento por semana
- T2.2 — Componente FechamentoSemanal
- T2.3 — Dashboard de 7 KPIs com gráficos

REGRAS PADRÃO: aprovação prévia, 1 sub-tarefa por vez, migrations manuais.

TAREFA ATUAL NESTA SESSÃO: ___
```

---

### 🟢 PROMPT — SPRINT 3 (Painel Empreendedor: tela "Decisões" + tela "Semana")

```
Olá. Sou Josemar. SPRINT 3 do Painel Empreendedor.
Plano: PLANO_PAINEL_ESDRA.md v2.0 (seção SPRINT 3).

STATUS: Sprints 1 e 2 do Painel concluídos. KPIs sendo registrados.

PASSOS:
1. Leia SEÇÃO SPRINT 3 do plano
2. STATUS_EXECUCAO.md
3. Explore esdra_decisoes (tabela existente, populada com seed do manual)

Sub-tarefas:
- T3.1 — Tela /painel-esdra/decisoes (lista + form de registro)
- T3.2 — Modal/tela de revisão de decisão (acerto_percebido + aprendizado)
- T3.3 — Tela /painel-esdra/semana (visão consolidada + reset semanal)

REGRAS PADRÃO. Atenção especial: lifecycle completo das decisões
(criação → revisão em 30d → registro de aprendizado).

TAREFA ATUAL: ___
```

---

### 🟢 PROMPT — SPRINT 4 (Painel Empreendedor: CRM + Estoque + Polish)

```
Olá. SPRINT 4 do Painel Empreendedor — fechamento do bloco operacional.
Plano: PLANO_PAINEL_ESDRA.md v2.0 (seção SPRINT 4).

STATUS: Sprints 1-3 do Painel concluídos.

PASSOS:
1. SEÇÃO SPRINT 4 do plano
2. STATUS_EXECUCAO.md
3. Explore esdra_clientes e esdra_estoque (criadas em Sprint 1, vazias)

Sub-tarefas:
- T4.1 — Importador de CSV (clientes + estoque) com preview
- T4.2 — Tela /painel-esdra/clientes (CRM com filtros)
- T4.3 — Tela /painel-esdra/estoque (com curva ABC e capital parado)
- T4.4 — Polish: navegação, mobile, atalhos teclado, tema

REGRAS PADRÃO. Sprint 4 fecha o bloco operacional. Após este sprint,
ESPERAR mínimo 60 dias antes de iniciar Sprint 5 (PIL Esdra).

TAREFA ATUAL: ___
```

---

### 🔵 PROMPT — SPRINT 5 (Painel Empreendedor: Personal Intelligence Layer Esdra)

```
Olá. Sou Josemar. SPRINT 5 do Painel Empreendedor — primeiro sprint
de inteligência para o negócio Esdra Cosméticos.

ATENÇÃO CRÍTICA: este sprint só pode iniciar se:
- Sprints 1-4 do Painel estão concluídos e estáveis
- Painel Empreendedor está em uso real há ≥60 dias
- Mínimo 8 decisões empreendedoras registradas
- Mínimo 8 fechamentos semanais de KPIs
- PIL pessoal (Sprints 8-10) estável há ≥30 dias

CONFIRME COMIGO TODOS OS PRÉ-REQUISITOS ANTES DE QUALQUER CÓDIGO.
Se algum não está atendido, PARE e me oriente a aguardar.

CONTEXTO: Plano anexado (PLANO_PAINEL_ESDRA.md v2.0). Estou no
SPRINT 5, focado em criar memória conversacional E observations
específicas do negócio Esdra. Reuso massivo da infra da PIL pessoal —
NÃO recriamos tabelas paralelas.

PASSOS OBRIGATÓRIOS:

1. Leia PLANO_PAINEL_ESDRA.md SEÇÃO SPRINT 5 inteira
2. Leia PLANO_COMPLEMENTAR_INTELIGENCIA.md SEÇÃO 5 (Sprint 8) — entenda
   como ai_messages_embeddings funciona hoje
3. STATUS_EXECUCAO.md
4. Explore:
   - ai_messages, ai_messages_embeddings, ai_self_observations,
     decision_outcomes, behavioral_tags
   - Edge function embed-ai-messages
   - find_related_conversations RPC

5. Me responda:
   A) Estratégia para adicionar business_scope sem quebrar PIL pessoal
   B) Como evitar mistura de embeddings entre escopos no RAG
   C) Plano de teste do cron embed-esdra-decisions

Sub-tarefas:
- T5.1 — Adaptar ai_messages para escopo Esdra (migration + RPC update)
- T5.2 — Tabela esdra_business_observations + função upsert
- T5.3 — Edge function embed-esdra-decisions + cron
- T5.4 — Cron review-esdra-decisions + componente <EsdraDecisionReview/>

REGRAS PADRÃO + cuidado redobrado com NÃO QUEBRAR a PIL pessoal.
Cada migration tem que ter ROLLBACK comentado no script.

TAREFA ATUAL: ___
```

---

### 🔵 PROMPT — SPRINT 6 (Painel Empreendedor: AI Conselheiro Esdra Cosméticos)

```
Olá. Sou Josemar. SPRINT 6 do Painel Empreendedor — sprint final.
Construindo o AI Conselheiro permanente do negócio.

ATENÇÃO CRÍTICA:
- Sprint 5 deve estar concluído e estável
- esdra_business_observations populada com mínimo 5 observations
- find_related_conversations filtrado por escopo funcionando
- Cron embed-esdra-decisions rodando há ≥7 dias

REGRA NÃO-NEGOCIÁVEL DESTE SPRINT: ZERO ALUCINAÇÃO NUMÉRICA.
O Conselheiro DEVE citar fonte (mês, valor, ID da decisão) ao dar
qualquer número. Se não há dado real, responde "não tenho registro
disso" em vez de estimar. Isso é critério de aceite no Definition of
Done — sem isso, o sprint não fecha.

CONTEXTO: Plano anexado. SEÇÃO SPRINT 6.

PASSOS OBRIGATÓRIOS:

1. Leia SEÇÃO SPRINT 6 inteira
2. Leia novamente o sistema atual:
   - supabase/functions/ai-advisor/index.ts (referência de estrutura)
   - src/services/aiAdvisor/systemPrompt.ts (padrão a espelhar)
   - src/services/aiAdvisor/contextCollector.ts (mesmo)
3. STATUS_EXECUCAO.md
4. Explore:
   - Modelo de Claude API atual (env CLAUDE_API_KEY?)
   - Padrão de SSE streaming usado pelo ai-advisor

5. Me responda:
   A) Como você implementa "zero alucinação numérica" no system prompt?
   B) Qual o limite de tokens do contexto montado?
   C) Como a UI vai mostrar "fonte" em cada número citado?
   D) Estratégia de teste adversarial (perguntar coisas inventadas pra
      ver se o modelo declina ou aluciena)

Sub-tarefas:
- T6.1 — Edge function esdra-conselheiro
- T6.2 — System prompt especializado com snapshot test
- T6.3 — Context collector específico Esdra
- T6.4 — Interface /painel-esdra/conselheiro com chat + feedback

REGRAS PADRÃO + suite adversarial obrigatória antes de deploy.

TAREFA ATUAL: ___
```

---


## 📋 Checklist rápido antes de abrir cada sessão

Antes de colar qualquer um dos 9 prompts acima no Claude Code, confirme:

**Para Sprints 8-10 (PIL pessoal):**
- [ ] O arquivo `PLANO_COMPLEMENTAR_INTELIGENCIA.md` está anexado na conversa
- [ ] O arquivo `STATUS_EXECUCAO.md` está acessível (no repo, via Claude Code)
- [ ] O sprint anterior está registrado como concluído em `STATUS_EXECUCAO.md`
- [ ] Você preencheu o campo "TAREFA ATUAL NESTA SESSÃO: ___"
- [ ] Git está limpo (sem alterações não commitadas de sessão anterior)
- [ ] Você está com tempo de 1-3 horas para a sessão (sub-tarefa típica)

**Para Sprints 1-6 do Painel Empreendedor:**
- [ ] O arquivo `PLANO_PAINEL_ESDRA.md` está anexado na conversa
- [ ] `STATUS_EXECUCAO.md` está acessível
- [ ] Sprint anterior do Painel está concluído (exceto Sprint 1, claro)
- [ ] **Para Sprint 1 do Painel:** ≥30 dias de uso real do Manual 30 Dias HTML
- [ ] **Para Sprint 5 do Painel:** ≥60 dias de uso do Painel + ≥8 decisões registradas
- [ ] **Para Sprint 6 do Painel:** Sprint 5 estável + observations populadas
- [ ] Git limpo
- [ ] Tempo reservado de 1-3 horas

Se algum item não estiver pronto, resolva primeiro.

---

**Última revisão deste arquivo:** 02 de Maio de 2026 — v1.1, em conjunto com:
- `PLANO_COMPLEMENTAR_INTELIGENCIA.md` v1.0 (Sprints 8-10 — concluídos)
- `PLANO_PAINEL_ESDRA.md` v2.0 (Sprints 1-6 do Painel Empreendedor — aguardando execução)

### Histórico de versões deste arquivo

**v1.1 — 02/05/2026**
- Adicionados 6 prompts para os Sprints 1-6 do Painel Empreendedor (Esdra Cosméticos)
- Checklist expandido para os 9 sprints
- Pré-requisitos específicos por sprint do Painel (especialmente atenção para Sprints 5 e 6)

**v1.0 — Abril/2026**
- Versão inicial com prompts dos Sprints 8, 9 e 10 (PIL pessoal — plano complementar)
