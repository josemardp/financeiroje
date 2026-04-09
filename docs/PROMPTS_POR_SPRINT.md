# 📋 Prompts Padrão para Nova Sessão — Claude Code

> **Como usar:** ao abrir uma sessão nova no Claude Code (aba Code do app Claude),
> anexe o arquivo `PLANO_INTELIGENCIA_PESSOAL.md` arrastando para a conversa,
> depois copie e cole o prompt correspondente ao sprint que você está fazendo.
>
> **Importante:** marque manualmente abaixo de cada prompt em qual tarefa você
> está, para o Claude Code saber onde retomar.

---

## 🟢 PROMPT PADRÃO — SPRINT 1
### (Compartilhar o que já existe — 1-2 dias, sem mudança de schema)

```
Olá. Sou Josemar, Capitão PMESP, dono deste projeto FinanceiroJe.
Comunique-se sempre em português brasileiro, tom direto e executivo,
sem floreio.

CONTEXTO: Estou implementando o plano de evolução da IA Conselheira e
Captura Inteligente. O plano completo está anexado nesta conversa
(PLANO_INTELIGENCIA_PESSOAL.md). Estou no SPRINT 1.

PASSOS OBRIGATÓRIOS ANTES DE QUALQUER CÓDIGO:

1. Leia o plano anexado com atenção, especialmente a SEÇÃO 4 (Sprint 1)
2. Leia também o CLAUDE.md na raiz do projeto (se existir)
3. Explore e leia os arquivos-chave do Sprint 1:
   - src/services/aiAdvisor/contextCollector.ts (852 linhas, leia INTEIRO)
   - src/services/smartCapture/captureContext.ts
   - src/pages/SmartCapture.tsx
   - supabase/functions/smart-capture-interpret/index.ts

4. Depois me responda:
   A) Resumo em 3 linhas do objetivo do Sprint 1
   B) Lista das 4 tarefas (T1.1 a T1.4) com 1 frase cada
   C) Qual tarefa estamos fazendo agora? (me pergunte se não souber)
   D) Plano de implementação dessa tarefa em passos pequenos

TAREFA ATUAL NESTA SESSÃO: _______________
(Preencher: T1.1, T1.2, T1.3, T1.4 ou "validação final")

REGRAS NÃO-NEGOCIÁVEIS DE TODAS AS SESSÕES:
- NÃO execute git push, git commit — eu commito manualmente via github.dev
- NÃO execute supabase db push, supabase functions deploy — eu deployo manual
- NÃO execute npm run build a menos que eu peça
- ANTES de editar arquivo, mostre o plano de mudança e espere validação
- UMA tarefa por sessão — não tente fazer o sprint inteiro
- Quando propuser edição, mostre o DIFF visual antes de aplicar
- Tom direto, sem pedidos de desculpa longos, sem explicações óbvias
- Se algo no plano não estiver claro, PERGUNTE antes de improvisar

PRINCÍPIOS DO PROJETO (não-negociáveis):
1. Zero alucinação financeira — IA nunca inventa números
2. Memória comportamental ≠ fato financeiro
3. Decisão sempre fica com o usuário
4. Sem push notifications de engajamento
5. Escopo isolado (private/family/business não se misturam)

Pode começar pela leitura. Não escreva código ainda.
```

---

## 🟡 PROMPT PADRÃO — SPRINT 2
### (Materializar padrões aprendidos — 4-5 dias, nova tabela + trigger + cron)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Estou implementando o plano de evolução da IA do FinanceiroJe.
O plano está anexado (PLANO_INTELIGENCIA_PESSOAL.md). Estou no SPRINT 2
— o mais pesado dos sprints obrigatórios.

STATUS: Sprint 1 já está concluído e em produção. Agora vou
materializar a camada de padrões aprendidos.

PASSOS OBRIGATÓRIOS ANTES DE QUALQUER CÓDIGO:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO 5 (Sprint 2) inteira
2. Leia o CLAUDE.md na raiz
3. Explore o estado atual do projeto considerando que Sprint 1 já foi feito:
   - src/services/userProfile/ (deve existir do Sprint 1)
   - src/services/smartCapture/captureContext.ts (já estendido no S1)
   - supabase/migrations/ (liste TODAS as migrations atuais pra confirmar
     que timestamps do Sprint 2 não conflitam)
   - supabase/functions/ai-advisor/index.ts (como referência de padrão)

4. Depois me responda:
   A) Resumo em 3 linhas do objetivo do Sprint 2
   B) Lista das sub-tarefas na ordem que você sugere executar:
      - Migrations base (user_patterns + capture_learning_events + decay)
      - Edge function learn-patterns
      - Trigger síncrono de correção
      - Integração em captureContext
      - Gravação de eventos no Modo Espelho
   C) Qual sub-tarefa estamos fazendo agora?
   D) Plano detalhado dessa sub-tarefa em passos pequenos
   E) Riscos específicos dessa sub-tarefa (especialmente pg_net no trigger)

SUB-TAREFA ATUAL NESTA SESSÃO: _______________
(Preencher: "migrations base", "learn-patterns", "trigger",
"captureContext v2", "modo espelho eventos", "validação final")

ATENÇÃO ESPECIAL SPRINT 2:
- Migrations são APPEND-ONLY — nunca editar migration já aplicada
- Verifique se pg_net está habilitado no Supabase. Se não souber, ME PERGUNTE
  (a alternativa é outbox table — descrita no plano)
- RLS obrigatório em toda tabela nova
- Trigger só dispara em source_type IN ('ocr','voice','document') E
  categoria_id mudou — não pode ser genérico
- Gravação de capture_learning_events é CRÍTICA — é a base de auditoria
  de todo o aprendizado futuro

REGRAS NÃO-NEGOCIÁVEIS:
- NÃO execute git, supabase db push, supabase functions deploy, npm run build
- ANTES de editar, mostre plano + diff + espere validação
- UMA sub-tarefa por sessão
- Tom direto, sem floreio
- Se em dúvida, PERGUNTE

Pode começar pela leitura e exploração. Não escreva código ainda.
```

---

## 🟡 PROMPT PADRÃO — SPRINT 3
### (Evoluir a memória episódica — 2-3 dias, refinamento do ai-advisor)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Sprints 1 e 2 concluídos e em produção. Agora vou refinar
a memória episódica (ai_coach_memory) para virar curadoria viva com
tipos, reforço, decaimento e bloco de incertezas consolidado.

O plano está anexado (PLANO_INTELIGENCIA_PESSOAL.md). Estou no SPRINT 3.

PASSOS OBRIGATÓRIOS:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO 6 (Sprint 3) inteira
2. Leia o CLAUDE.md na raiz
3. Explore arquivos críticos:
   - supabase/migrations/20260404000002_ai_coach_memory.sql (original)
   - supabase/functions/ai-advisor/index.ts (edge function INTEIRA — 436 linhas)
   - src/services/aiAdvisor/systemPrompt.ts (INTEIRO — 352 linhas)
   - src/services/aiAdvisor/contextCollector.ts (para identificar onde
     o bloco de incertezas vai se conectar)

4. ATENÇÃO CRÍTICA — migration de ALTER TABLE:
   - Confirme se há DADOS EM PRODUÇÃO em ai_coach_memory
   - Se sim, garanta que o ALTER TABLE preserva os dados existentes
   - memory_type default 'observation' cobre registros antigos
   - Teste o rollback mentalmente antes de propor o SQL

5. Depois me responda:
   A) Resumo em 3 linhas do objetivo do Sprint 3
   B) Lista das sub-tarefas na ordem:
      - Migrations (ai_coach_memory_v2 + decay_coach_memories)
      - Refinar edge function ai-advisor (parser + persistência + carregamento)
      - Refinar systemPrompt.ts (INSIGHT_COACH_JSON + bloco de incertezas)
      - Validação final
   C) Qual sub-tarefa estamos fazendo agora?
   D) Plano detalhado em passos pequenos
   E) Risco específico: como manter compatibilidade com insights antigos
      durante a transição (30 dias)

SUB-TAREFA ATUAL NESTA SESSÃO: _______________
(Preencher: "migrations", "edge function ai-advisor",
"system prompt", "validação final")

ATENÇÃO ESPECIAL SPRINT 3:
- O parser antigo de INSIGHT_COACH (regex simples) precisa coexistir com
  o novo parser INSIGHT_COACH_JSON por 30 dias (fallback)
- Bloco "⚠️ INCERTEZAS E LIMITES" vai logo após resumo dos dados reais,
  antes das instruções de formato (seção 6.7 do plano)
- Curadoria de memórias: preferences SEMPRE, concerns ativos,
  observations ranqueados por reinforcement_count
- Função upsert_coach_memory() faz o reforço automático

REGRAS NÃO-NEGOCIÁVEIS:
- NÃO execute git, supabase db push, functions deploy, npm run build
- ANTES de editar arquivo grande, LEIA INTEIRO primeiro
- ANTES de edição, mostre diff e espere validação
- UMA sub-tarefa por sessão
- Tom direto

Pode começar pela leitura. Não escreva código ainda.
```

---

## 🟡 PROMPT PADRÃO — SPRINT 4
### (Loop de feedback explícito — 3 dias, muito componente UI)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Sprints 1, 2 e 3 concluídos e em produção. Agora vou criar
a camada de controle do usuário: tela Settings → Memória da IA com
4 abas, botões de feedback, preferências declarativas, endpoints LGPD.

O plano está anexado (PLANO_INTELIGENCIA_PESSOAL.md). Estou no SPRINT 4.

PASSOS OBRIGATÓRIOS:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO 7 (Sprint 4) inteira
2. Leia o CLAUDE.md na raiz
3. Explore o estado atual:
   - src/pages/ (veja como outras páginas estão estruturadas)
   - src/components/ui/ (confirme quais componentes shadcn já existem:
     Tabs, Dialog, Button, Card, Form, Input, Select, Switch, Textarea)
   - src/App.tsx (para entender sistema de rotas)
   - supabase/migrations/ (verifique timestamps para o Sprint 4)

4. Depois me responda:
   A) Resumo em 3 linhas do objetivo do Sprint 4
   B) Lista das sub-tarefas na ordem sugerida:
      - Migrations (user_ai_preferences + apply_response_feedback RPC)
      - Estrutura da tela AIMemory.tsx (4 abas vazias + rota)
      - Aba 1: Padrões aprendidos
      - Aba 2: Memória do Coach
      - Aba 3: Preferências da IA
      - Aba 4: Histórico de capturas
      - Componente ResponseFeedback.tsx
      - Componente WhyThisAnswerModal.tsx
      - Edge functions user-data-export e user-data-purge
   C) Qual sub-tarefa estamos fazendo agora?
   D) Plano detalhado em passos pequenos
   E) Quais componentes shadcn você vai precisar que talvez não estejam
      instalados?

SUB-TAREFA ATUAL NESTA SESSÃO: _______________
(Preencher com a sub-tarefa específica)

ATENÇÃO ESPECIAL SPRINT 4:
- Este sprint tem MUITO UI — divida bem em sessões separadas
- Cada aba da tela AIMemory é uma sessão separada idealmente
- Componente ResponseFeedback precisa que a edge function ai-advisor
  retorne header X-Context-Used — verifique se isso já existe ou
  se precisa adicionar
- A tela deve funcionar em mobile (PWA) — teste responsividade
  mentalmente
- RLS nas novas tabelas é OBRIGATÓRIO

REGRAS NÃO-NEGOCIÁVEIS:
- NÃO execute git, deploys, build
- ANTES de editar, mostre plano + diff + espere validação
- UMA sub-tarefa por sessão
- Tom direto

Pode começar pela leitura. Não escreva código ainda.
```

---

## 🔵 PROMPT PADRÃO — SPRINT 5 (opcional)
### (Aderência aos conselhos — 3-4 dias, ATENÇÃO: risco de virar moralismo)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Sprints 1-4 concluídos. Agora estou no SPRINT 5 (opcional) —
fazer a IA Conselheira aprender com a aderência às suas próprias
recomendações. Este sprint é delicado porque TEM RISCO DE VIRAR
MORALISMO se mal calibrado.

O plano está anexado (PLANO_INTELIGENCIA_PESSOAL.md).

PASSOS OBRIGATÓRIOS:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO 8 (Sprint 5) inteira
2. LEIA COM DESTAQUE a seção 8.2 — "Princípio importante — não pode
   virar moralismo"
3. Leia o CLAUDE.md e o system prompt atual:
   - src/services/aiAdvisor/systemPrompt.ts
   - supabase/functions/ai-advisor/index.ts
4. Identifique no system prompt atual pontos que já poderiam virar
   moralismo se mal calibrados

5. ANTES de qualquer código, me responda:
   A) Com suas palavras: o que este sprint NUNCA pode fazer?
   B) Resumo em 3 linhas do objetivo positivo
   C) Lista das sub-tarefas:
      - Migration decision_outcomes
      - Parser RECOMMENDATION_JSON na edge function ai-advisor
      - Componente DecisionResponseButtons
      - Edge function review-decision-outcomes (cron)
      - Bloco de aderência histórica no system prompt
   D) Qual sub-tarefa agora?
   E) Plano detalhado
   F) Como você vai testar se o sprint não virou moralismo antes
      de considerar pronto?

SUB-TAREFA ATUAL NESTA SESSÃO: _______________

SALVAGUARDA CRÍTICA SPRINT 5:
- A IA NUNCA pode cobrar o usuário por recomendação não seguida
- A IA NUNCA pode dizer "eu já te avisei no mês passado"
- A IA NUNCA pode usar linguagem de culpa ou cobrança
- O bloco de aderência histórica é para CALIBRAÇÃO INTERNA da IA,
  não para exibir ao usuário
- A linguagem sempre devolve agência: "em março você optou por X,
  vamos olhar como está agora" em vez de "você não seguiu"

ANTES DE CADA SUB-TAREFA, VALIDE mentalmente:
- Essa mudança respeita a salvaguarda anti-moralismo?
- Um usuário sensível (INFJ, perfeccionista) se sentiria cobrado?
- Se sim, STOP e me consulte.

REGRAS NÃO-NEGOCIÁVEIS:
- NÃO execute git, deploys, build
- ANTES de editar, mostre plano + diff + espere validação
- UMA sub-tarefa por sessão
- Tom direto

Pode começar pela leitura. Não escreva código ainda.
```

---

## 🔵 PROMPT PADRÃO — SPRINT 6 (opcional, o maior)
### (Coach Comportamental Profundo + Gamificação — 6-8 dias)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Sprints anteriores concluídos. Agora estou no SPRINT 6
(opcional) — o maior e mais transformador do plano. Implementa
telemetria comportamental, detecção de padrões, embeddings vetoriais,
coach comportamental profundo e gamificação adaptativa
pró-neurodivergente.

O plano está anexado (PLANO_INTELIGENCIA_PESSOAL.md).

IMPORTANTE SOBRE ESTE SPRINT:
Eu sou INFJ com alta sensibilidade e padrões de perfeccionismo. A
gamificação deste sprint é desenhada especificamente para esse perfil
— não é gamificação genérica. Leia a seção 9.2 com atenção para
entender a diferença.

PASSOS OBRIGATÓRIOS:

1. Leia o plano anexado, ESPECIALMENTE A SEÇÃO 9 INTEIRA (Sprint 6)
2. Leia também a SEÇÃO 10 (Modelo dos 4 Scores) — é o vocabulário
   conceitual deste sprint
3. Leia o CLAUDE.md
4. Verifique no projeto:
   - Se pgvector já está habilitado (supabase/migrations/ — procure
     CREATE EXTENSION vector)
   - Se existe estrutura de telemetria anterior (src/services/telemetry/)
   - Estado das páginas principais (Dashboard, Loans, Goals)
   - supabase/functions/ai-advisor/index.ts e systemPrompt.ts
     (vão ser estendidos com behavioral_tags)

5. ME PERGUNTE se não souber: pgvector está habilitado? Tenho OpenAI
   API key com acesso a text-embedding-3-small?

6. Depois me responda:
   A) Resumo em 5 linhas do objetivo do Sprint 6
   B) Lista das sub-tarefas na ordem sugerida:
      - Migrations base (engagement_events + behavioral_tags + pgvector
        + achievements_streaks)
      - Hook useBehaviorTracking + instrumentação de páginas
      - Instrumentação do Modo Espelho (time_in_mirror, hypothesis_ranking)
      - Edge function analyze-behavioral-patterns
      - Embeddings vetoriais no learn-patterns
      - Injeção de behavioral_tags no system prompt
      - Componente MicroRewardCheckmark
      - Tela Challenges.tsx
      - Componente AchievementUnlockedToast
      - Função getSourceTrust (4 Scores)
      - Validação final
   C) Qual sub-tarefa agora?
   D) Plano detalhado dessa sub-tarefa
   E) Riscos específicos dessa sub-tarefa

SUB-TAREFA ATUAL NESTA SESSÃO: _______________

SALVAGUARDAS CRÍTICAS SPRINT 6:
Antes de cada sub-tarefa, mentalmente valide:

1. LINGUAGEM REFLEXIVA, NÃO DIAGNÓSTICA
   - IA usa "notei que...", "tende a...", "costuma..."
   - IA NUNCA usa "você sempre...", "você é...", "você tem X"

2. SEM PUSH NOTIFICATIONS DE ENGAJAMENTO
   - Push só para fatos materiais (cobrança, meta atingida)
   - NUNCA push de "volte!", "sua sequência está em risco!"

3. STREAKS SUAVES
   - "12 de 14 dias" (janela móvel), nunca "sequência de 12 dias"
   - Quebrar NÃO zera o contador

4. CONQUISTAS SOBRE PROCESSO, NÃO RESULTADO
   - "Registrou 30 transações" (controlo 100%)
   - NUNCA "Economizou R$500" (depende de fatores externos)

5. MICRORRECOMPENSAS DISCRETAS
   - Animação visual sutil (estilo Things 3, Linear)
   - NUNCA popup "PARABÉNS!", nunca som, nunca modal

6. DESAFIOS SÓ ATIVADOS PELO USUÁRIO
   - IA pode sugerir, mas clique é do usuário
   - NUNCA ativação automática

Se alguma sub-tarefa ameaçar qualquer uma dessas salvaguardas,
PARE e me consulte antes.

ATENÇÃO TÉCNICA ESPECIAL:
- Telemetria: filtrar eventos <2s (evitar ruído de navegação acidental)
- Embeddings: cache de descrições já vistas para não gerar toda vez
- behavioral_tags: expiram em 60 dias, RLS obrigatório
- pgvector: index ivfflat só em merchant_category

REGRAS NÃO-NEGOCIÁVEIS:
- NÃO execute git, deploys, build
- ANTES de editar, mostre plano + diff + espere validação
- UMA sub-tarefa por sessão (ESTE SPRINT É GRANDE, seja rigoroso nisso)
- Tom direto, sem floreio

Pode começar pela leitura. Não escreva código ainda.
```

---

## 🔄 PROMPT DE RETOMADA
### (Quando uma sessão ficou longa e você precisa abrir nova no meio de uma tarefa)

```
Olá. Sou Josemar, Capitão PMESP, dono do FinanceiroJe. Português
brasileiro, tom direto.

CONTEXTO: Estou retomando uma tarefa que começou em outra sessão
que ficou longa demais. O plano está anexado
(PLANO_INTELIGENCIA_PESSOAL.md).

ESTADO DA RETOMADA:
- Sprint: _______ (ex: Sprint 2)
- Sub-tarefa: _______ (ex: edge function learn-patterns)
- Onde paramos: _______ (ex: "estava escrevendo a função
  extractMerchantPatterns, faltava a parte de confidence scoring")
- Arquivos já modificados nesta tarefa: _______
  (ex: "supabase/functions/learn-patterns/index.ts parcialmente criado")

PASSOS OBRIGATÓRIOS:

1. Leia o plano anexado, seção correspondente ao Sprint ______
2. Leia o CLAUDE.md
3. Verifique o estado atual dos arquivos que mencionei acima
4. Me responda:
   A) Confirme que entendeu onde paramos
   B) Verifique o que já foi feito nesse arquivo
   C) Proponha como retomar do ponto exato
   D) Plano dos passos restantes para concluir essa sub-tarefa

REGRAS NÃO-NEGOCIÁVEIS:
- NÃO execute git, deploys, build
- NÃO recomece do zero — continue do ponto onde paramos
- ANTES de editar, mostre plano + diff + espere validação
- Tom direto

Pode começar pela verificação do estado atual. Não escreva código ainda.
```

---

## 📝 Dicas de uso dos prompts

### Como preencher a "SUB-TAREFA ATUAL"

Antes de colar o prompt, edite a linha `SUB-TAREFA ATUAL NESTA SESSÃO: _______________`
com o nome da sub-tarefa. Exemplo:

```
SUB-TAREFA ATUAL NESTA SESSÃO: T1.2 — refatorar captureContext.ts
```

Isso faz o Claude Code saber exatamente onde começar, sem perder tempo
explorando o que não importa para aquela sessão.

### Quando abrir sessão nova vs. continuar a mesma

**Abra sessão nova quando:**
- Conversa passou de 30-40 mensagens
- Você completou uma tarefa inteira (ex: T1.1 pronta e commitada)
- Mudou de sub-tarefa dentro do mesmo sprint
- Mudou de sprint
- Claude Code começou a esquecer detalhes do início da conversa
- Você vai pausar por mais de 1 dia

**Continue a mesma sessão quando:**
- Está no meio de uma sub-tarefa e só precisa de ajustes
- Está debugando algo específico que acabou de aparecer
- Passou menos de 20 mensagens

### Template mental para qualquer prompt novo

Todo prompt segue a mesma estrutura. Se precisar criar um do zero:

1. **Quem sou eu** (Josemar, PMESP, português direto)
2. **Contexto** (que sprint, o que já foi feito)
3. **Anexar o plano** (arrastar para a conversa)
4. **Passos obrigatórios** (ler plano → ler código → responder perguntas)
5. **Sub-tarefa específica** (qual, exatamente)
6. **Salvaguardas específicas do sprint** (se houver)
7. **Regras não-negociáveis** (sem deploys, sem build, uma tarefa por vez)
8. **"Pode começar pela leitura. Não escreva código ainda."**

Esse último comando é importantíssimo — previne que o Claude Code
saia codando antes de se situar.

### Quando o Claude Code ignorar alguma instrução

Redirecione curto e firme:

```
Espera. Você ignorou a regra de [regra X]. Volta e siga o padrão
que combinei: primeiro plano, depois validação, depois código.
```

Não precisa ser longo. Ele entende.

---

**Bom trabalho, Cap. Com esses 6 prompts + o de retomada, você tem
tudo que precisa para trabalhar de forma organizada e segura. 🎯**
