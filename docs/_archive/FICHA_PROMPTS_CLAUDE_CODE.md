# 📋 Ficha de Prompts — Claude Code para o FinanceiroJe

> Prompts prontos para abrir sessões produtivas no Claude Code em cada
> tarefa do plano. Use copiar/colar e ajuste o necessário.
>
> **Padrão geral:** sempre peça leitura do contexto primeiro, plano de
> implementação em passos pequenos, e validação antes de escrever código.

---

## 🟢 Antes da primeira sessão (preparação)

### Passo 1 — Commitar arquivos de contexto

Antes de abrir o Claude Code pela primeira vez, garanta que estão no repo:

```
financeiroje/
├── CLAUDE.md                                  # contexto persistente do projeto
├── docs/
│   └── PLANO_INTELIGENCIA_PESSOAL.md         # plano estratégico v1.3
└── ... (resto do projeto)
```

### Passo 2 — Inicializar Claude Code

```bash
cd ~/financeiroje
claude
```

Se for a primeira vez no projeto e quiser que ele gere um `CLAUDE.md` base automaticamente, pode rodar `/init` antes — depois você compara com o seu e mescla. Mas o `CLAUDE.md` que te entreguei já está mais completo do que o auto-gerado.

---

## 🟢 SPRINT 1 — Compartilhar o que já existe

> **Ganho rápido, baixo risco, sem mudança de schema.**
> Duração estimada: 1-2 dias. Recomendado começar por aqui.

### Sessão 1.0 — Validação inicial do contexto

```
Olá. Esta é minha primeira sessão de implementação do plano de inteligência
pessoal do FinanceiroJe.

Antes de qualquer coisa, leia os dois arquivos abaixo na ordem:

1. CLAUDE.md (raiz do projeto) — contexto geral
2. docs/PLANO_INTELIGENCIA_PESSOAL.md — plano completo

Depois de ler, me responda 3 coisas:
1. Resuma em 5 linhas o objetivo geral do plano e a estratégia das 3 camadas
2. Liste os 4 sprints obrigatórios e os 2 opcionais com 1 frase cada
3. Confirme que entendeu os princípios não-negociáveis (especialmente
   zero alucinação e separação memória ≠ fato)

Não escreva código ainda. Só leia, sintetize e valide comigo.
```

### Sessão 1.1 — Tarefa T1.1 (criar `userProfile/snapshot.ts` + `buildArchetype.ts`)

```
Vamos começar a implementação do Sprint 1, tarefa T1.1.

Objetivo: criar dois arquivos novos em src/services/userProfile/:
- buildArchetype.ts — função pura que extrai a lógica de arquétipo
  do contextCollector atual (linhas ~712-810)
- snapshot.ts — função getUserBehavioralSnapshot(userId, scope) que
  retorna um snapshot leve para a Captura usar

Antes de escrever qualquer código:
1. Leia src/services/aiAdvisor/contextCollector.ts INTEIRO
2. Leia o trecho do Sprint 1 no plano (seção 4)
3. Me proponha o plano de implementação em passos pequenos
4. Identifique se há risco de quebrar o contextCollector ao extrair
   a lógica de arquétipo
5. Espere minha validação antes de criar qualquer arquivo

Lembre: NÃO duplicar lógica. O contextCollector deve passar a importar
de buildArchetype.ts depois.
```

### Sessão 1.2 — Tarefa T1.2 (refatorar `captureContext.ts`)

```
Sprint 1, tarefa T1.2.

Objetivo: atualizar src/services/smartCapture/captureContext.ts para
incluir o snapshot comportamental que criamos na T1.1.

Antes de escrever:
1. Leia o arquivo atual captureContext.ts (101 linhas) inteiro
2. Leia o snapshot.ts que criamos na T1.1
3. Identifique todos os lugares no projeto que CHAMAM getCaptureContext
   (use grep) — vamos precisar atualizar a assinatura
4. Me proponha o plano antes de codar

Atenção: a função vai precisar receber userId como novo parâmetro.
Confirme comigo se devemos quebrar a assinatura ou tornar opcional.
```

### Sessão 1.3 — Tarefa T1.3 (atualizar system prompt do `smart-capture-interpret`)

```
Sprint 1, tarefa T1.3.

Objetivo: atualizar o system prompt da edge function
supabase/functions/smart-capture-interpret/index.ts para ensinar o
modelo a usar o novo bloco de perfil_usuario.

Antes:
1. Leia a edge function inteira
2. Leia o trecho exato do plano sobre o que adicionar (seção 4.2 T1.3)
3. Me mostre o trecho atual do system prompt e o trecho proposto novo,
   lado a lado, antes de aplicar str_replace
4. Espere minha validação

Importante: o system prompt já é grande. Verifique se a adição cabe
sem estourar limites de contexto do gpt-4o-mini.
```

### Sessão 1.4 — Tarefa T1.4 (atualizar chamadas no `SmartCapture.tsx`)

```
Sprint 1, tarefa T1.4 (última do Sprint 1).

Objetivo: atualizar src/pages/SmartCapture.tsx para passar userId
nas 3 chamadas a getCaptureContext (linhas ~332, 392, 463).

Antes:
1. Leia SmartCapture.tsx inteiro
2. Confirme que useAuth() já está sendo usado ali
3. Identifique as 3 chamadas exatas
4. Me proponha o diff antes de aplicar

Depois de aplicar:
- Rodar npm run lint para garantir que não quebrou nada
- Me mostrar o resultado
- Não rodar npm run build (demorado)
```

### Sessão 1.5 — Validação final do Sprint 1

```
Sprint 1 — validação final.

Verifique se todos os critérios de aceite do Sprint 1 (seção 4.3 do plano)
estão cumpridos:

1. getUserBehavioralSnapshot existe e retorna o tipo correto
2. captureContext.ts inclui o snapshot no contextBlock
3. System prompt do smart-capture-interpret ensina a usar perfil_usuario
4. SmartCapture.tsx passa userId nas 3 chamadas
5. Nenhuma migration foi criada (não era pra ter)
6. npm run lint passa sem erros
7. Testes (se houver) passam

Me dê um relatório curto. Se algo falhou, sugira correção.
```

---

## 🟡 SPRINT 2 — Materializar padrões aprendidos

> **Coração da inteligência. Mais pesado. 4-5 dias.**
> Tem mudança de schema, edge functions novas, trigger.

### Sessão 2.0 — Plano detalhado do Sprint 2

```
Vamos começar o Sprint 2 do plano. É o mais pesado dos sprints
obrigatórios. Antes de qualquer código:

1. Releia a seção 5 inteira do plano (PLANO_INTELIGENCIA_PESSOAL.md)
2. Identifique todas as tarefas e dependências entre elas
3. Me proponha uma ORDEM de execução das tarefas, justificando
4. Identifique riscos específicos do Sprint 2 (trigger, pg_net, retenção)
5. Me sugira como dividir em sub-sessões pequenas

Não escreva código. Só planeje e valide comigo.
```

### Sessão 2.1 — Migrations base (`user_patterns` + `capture_learning_events`)

```
Sprint 2, primeira sub-tarefa: criar as migrations base.

Crie os 3 arquivos de migration nesta ordem:
1. supabase/migrations/20260408000001_user_patterns.sql
2. supabase/migrations/20260408000002_capture_learning_events.sql
3. supabase/migrations/20260408000003_decay_function.sql

Use exatamente o SQL especificado nas seções 5.2, 5.3 e 5.7 do plano.

Antes de criar:
1. Liste as migrations existentes em supabase/migrations/ para
   confirmar que os timestamps não conflitam
2. Verifique se os types pattern_type, pattern_source e scope_type
   já existem ou precisam ser criados
3. Me mostre o plano de criação

Depois de criar:
- NÃO execute supabase db push — eu aplico no painel
- Me confirme que os arquivos foram criados e o conteúdo está correto
```

### Sessão 2.2 — Edge function `learn-patterns`

```
Sprint 2, próxima tarefa: criar a edge function learn-patterns.

Crie supabase/functions/learn-patterns/index.ts seguindo exatamente
a especificação da seção 5.5 do plano.

A função deve suportar 3 modos:
- "full" (cron diário, varre 90 dias)
- "incremental" (uma transação só)
- "from_correction" (acionada pelo trigger)

Antes:
1. Leia uma edge function existente (supabase/functions/ai-advisor/index.ts)
   para seguir o mesmo padrão de CORS, auth, rate limit
2. Me proponha a estrutura geral antes de codar
3. Identifique se as funções normalizeMerchant, extractMerchantPatterns
   e extractValueRanges devem ser inline ou em arquivo separado

Quando codar, criar testes unitários mínimos para as funções puras
em supabase/functions/learn-patterns/__tests__/.

NÃO deploye. Eu deployo manualmente.
```

### Sessão 2.3 — Trigger síncrono de correção

```
Sprint 2, tarefa: criar o trigger síncrono de correção.

Crie supabase/migrations/20260408000004_pattern_learning_trigger.sql
com o conteúdo da seção 5.6 do plano.

Antes:
1. Confirme se pg_net está habilitado no projeto Supabase
   (se não souber, me pergunte)
2. Se não estiver, sugira a alternativa via outbox table
3. Me mostre o SQL final antes de criar o arquivo

Importante: o trigger só dispara quando source_type IN ('ocr','voice','document')
E categoria_id mudou. Não pode ser genérico demais ou vai poluir.
```

### Sessão 2.4 — Integração na Captura (`captureContext.ts` v2)

```
Sprint 2, tarefa: estender captureContext.ts para incluir os padrões
aprendidos no contextBlock enviado ao LLM.

Seguir a especificação da seção 5.9 do plano.

Antes:
1. Leia o captureContext.ts atual (já modificado no Sprint 1)
2. Me proponha como adicionar a query de patterns sem aumentar latência
3. Considere usar Promise.all para paralelizar com as queries existentes
4. Me mostre o diff antes de aplicar

Depois:
- npm run lint
- Me confirmar tamanho final do contextBlock em chars/tokens estimados
```

### Sessão 2.5 — Gravação de `capture_learning_events` no Modo Espelho

```
Sprint 2, tarefa: instrumentar o Modo Espelho do SmartCapture.tsx para
gravar capture_learning_events em toda confirmação.

Antes:
1. Leia SmartCapture.tsx inteiro de novo (tem mudança recente do Sprint 1)
2. Identifique exatamente o ponto onde o usuário clica em "Confirmar"
3. Me mostre o plano: como calcular o diff entre aiSuggested e userConfirmed
4. Como tratar o caso onde a captura falha antes de chegar ao Modo Espelho

Crie um helper em src/services/smartCapture/captureLearningEvents.ts
para encapsular a gravação. Não polua o SmartCapture.tsx com lógica
de diff inline.
```

### Sessão 2.6 — Validação final do Sprint 2

```
Sprint 2 — validação final.

Verifique critérios de aceite (seção 5.10 do plano):
1. Migrations criadas (3 arquivos)
2. Edge function learn-patterns existe nos 3 modos
3. Trigger criado
4. captureContext inclui patterns
5. SmartCapture grava capture_learning_events
6. Helpers e tipos exportados corretamente
7. npm run lint passa
8. Testes unitários passam

Me dê relatório. Sinalize qualquer débito técnico introduzido.
```

---

## 🟡 SPRINT 3 — Evoluir a memória episódica

### Sessão 3.0 — Plano

```
Vamos começar o Sprint 3 do plano.

1. Releia seção 6 inteira de docs/PLANO_INTELIGENCIA_PESSOAL.md
2. Identifique impacto na edge function ai-advisor existente
3. Me proponha ordem de execução das tarefas
4. Identifique risco da migração ALTER TABLE em ai_coach_memory
   (verificar se há dados em produção que precisam ser preservados)

Não codar ainda. Planejar e validar.
```

### Sessão 3.1 — Migrations de evolução

```
Sprint 3, sub-tarefa: criar as migrations de evolução de ai_coach_memory.

Criar 2 arquivos:
1. supabase/migrations/20260410000001_ai_coach_memory_v2.sql
2. supabase/migrations/20260410000002_decay_coach_memories.sql

Conteúdo nas seções 6.2 e 6.3 do plano.

Antes:
1. Verifique a migration original 20260404000002_ai_coach_memory.sql
2. Garanta que o ALTER TABLE não vai quebrar dados existentes
3. Me mostre o SQL antes de criar
```

### Sessão 3.2 — Refinar edge function ai-advisor

```
Sprint 3, sub-tarefa: refinar a edge function ai-advisor.

Mudanças:
1. Trocar parser de INSIGHT_COACH (regex simples) por INSIGHT_COACH_JSON (estruturado)
2. Trocar persistência direta por chamada à RPC upsert_coach_memory
3. Refazer o carregamento de memórias (5 últimas por created_at) para
   curadoria por tipo (preferences sempre, concerns ativos, observations top-rankeados)

Antes:
1. Leia supabase/functions/ai-advisor/index.ts INTEIRO
2. Identifique as 3 zonas a alterar (parser, persistência, carregamento)
3. Me mostre o plano de mudanças antes de aplicar str_replace
4. Mantenha compatibilidade retroativa com insights antigos durante 30 dias
```

### Sessão 3.3 — Refinar systemPrompt.ts

```
Sprint 3, sub-tarefa: refinar src/services/aiAdvisor/systemPrompt.ts.

Mudanças:
1. Atualizar instrução final para emitir INSIGHT_COACH_JSON estruturado
2. Adicionar bloco "⚠️ INCERTEZAS E LIMITES DESTA ANÁLISE" consolidado
   (seção 6.7 do plano)

Antes:
1. Leia systemPrompt.ts inteiro (352 linhas)
2. Identifique onde injetar o novo bloco de incertezas (logo após
   resumo dos dados reais, antes das instruções de formato)
3. Me mostre o diff antes de aplicar
```

### Sessão 3.4 — Validação final Sprint 3

```
Sprint 3 — validação final (seção 6.8 do plano).

Critérios:
1. Migrations aplicadas
2. ai-advisor parseia INSIGHT_COACH_JSON
3. Curadoria de memórias funcionando
4. Bloco de incertezas no system prompt
5. decay_stale_coach_memories no cron
6. Lint passa

Me dê relatório.
```

---

## 🟡 SPRINT 4 — Loop de feedback explícito

### Sessão 4.0 — Plano

```
Vamos começar o Sprint 4 do plano.

1. Releia seção 7 inteira
2. Esse sprint tem MUITO componente UI (4 abas de Settings + ResponseFeedback
   + WhyThisAnswerModal). Sugira como dividir em sub-sessões
3. Identifique dependências de componentes shadcn/ui já instalados
4. Me valide o plano

Não codar.
```

### Sessão 4.1 — Migration `user_ai_preferences` + RPC de feedback

```
Sprint 4, primeiras migrations.

Crie:
1. supabase/migrations/20260415000001_user_ai_preferences.sql
2. supabase/migrations/20260415000002_apply_response_feedback.sql

Conteúdo nas seções 7.2 e 7.4 do plano.
```

### Sessão 4.2 — Tela `Settings → Memória da IA` (estrutura)

```
Sprint 4, tarefa: criar a estrutura da tela /settings/ai-memory.

Crie src/pages/settings/AIMemory.tsx com 4 abas usando shadcn Tabs:
- Aba 1: Padrões aprendidos
- Aba 2: Memória do Coach
- Aba 3: Preferências da IA
- Aba 4: Histórico de capturas

Antes:
1. Verifique como outras páginas em src/pages/ estão estruturadas
2. Verifique se shadcn Tabs já está instalado em src/components/ui/
3. Crie só a estrutura vazia das abas — vamos preencher uma por vez
4. Adicione a rota em src/App.tsx
```

### Sessão 4.3 a 4.6 — Implementar cada aba

```
Sprint 4, implementar Aba [N] de AIMemory.tsx.

[N=1: Padrões aprendidos / N=2: Memória do Coach /
 N=3: Preferências / N=4: Histórico de capturas]

Antes:
1. Leia a especificação exata da aba na seção 7.3 do plano
2. Identifique queries Supabase necessárias
3. Identifique componentes shadcn que vai usar
4. Me proponha o plano antes de codar

Importante: cada aba é independente. Quando terminar uma, fazemos
commit e abrimos sessão nova para a próxima.
```

### Sessão 4.7 — Componentes `<ResponseFeedback>` e `<WhyThisAnswerModal>`

```
Sprint 4, criar componentes de feedback.

Criar:
1. src/components/shared/ResponseFeedback.tsx
2. src/components/shared/WhyThisAnswerModal.tsx

Especificações nas seções 7.4 e 7.5 do plano.

Antes:
1. Identifique onde no projeto as respostas da IA Conselheira são
   renderizadas (provavelmente src/pages/AiAdvisor.tsx)
2. Verifique como o messageId e contextUsedIds vão chegar até ali
3. Pode ser necessário modificar a edge function ai-advisor para
   retornar header X-Context-Used — confirme antes
```

### Sessão 4.8 — Endpoints LGPD

```
Sprint 4, criar endpoints de export e purge LGPD.

Criar:
1. supabase/functions/user-data-export/index.ts
2. supabase/functions/user-data-purge/index.ts

Especificação na seção 7.6 do plano. Padrão segue ai-advisor (CORS, auth).
```

---

## 🔵 SPRINT 5 — Aderência aos conselhos (opcional)

> **Atenção: este sprint tem risco de virar moralismo. Siga rigoroso
> as salvaguardas da seção 8.2.**

### Sessão 5.0 — Plano + reflexão ética

```
Vamos começar o Sprint 5 (opcional). Antes de qualquer código:

1. Releia INTEIRA a seção 8 do plano, especialmente 8.2 (princípio
   importante — não pode virar moralismo)
2. Me confirme com suas próprias palavras o que esse sprint NUNCA
   pode fazer
3. Identifique no system prompt atual da IA pontos que poderiam
   acidentalmente virar moralismo se mal calibrados
4. Sugira testes manuais para validar antes de deploy

Não codar ainda. Reflexão e plano primeiro.
```

### Sessão 5.1 em diante

```
Sprint 5, sub-tarefa [X].

Seguir especificação da seção 8.[Y] do plano.

Antes de cada sub-tarefa, me confirme que o que está prestes a codar
respeita a salvaguarda anti-moralismo da seção 8.2.
```

---

## 🔵 SPRINT 6 — Coach Comportamental + Gamificação (opcional)

> **Sprint mais transformador. Maior. 6-8 dias.**
> Tem telemetria, embeddings vetoriais, behavioral_tags e gamificação.

### Sessão 6.0 — Plano detalhado

```
Vamos começar o Sprint 6 (opcional). É o maior do plano.

1. Releia a seção 9 INTEIRA
2. Identifique TODAS as sub-tarefas (telemetria, behavioral_tags,
   embeddings, gamificação)
3. Me proponha uma ORDEM de execução em sub-sessões
4. Identifique se pgvector já está habilitado no Supabase
   (se não souber, me pergunte)
5. Identifique riscos específicos: telemetria virando ruído,
   behavioral_tags virando diagnóstico, streaks gerando ansiedade
6. Me valide o plano antes de codar

Não codar. Planejar.
```

### Sessões seguintes

```
Sprint 6, sub-tarefa [X]: [nome].

Seguir seção 9.[Y] do plano.

Antes de cada sub-tarefa, validar:
1. Mantém linguagem reflexiva (não diagnóstica)?
2. Não cria push notification de engajamento?
3. Streak é suave (não zera)?
4. Conquista é sobre processo (controlado pelo usuário)?

Se algum desses critérios não for atendido, parar e me perguntar.
```

---

## 🛠 Prompts utilitários (use a qualquer momento)

### Quando o Claude Code propõe algo que parece ir contra o plano

```
Espera. O que você está propondo está alinhado com qual seção do
docs/PLANO_INTELIGENCIA_PESSOAL.md? Cite trecho específico.

Se não estiver no plano, justifique por que essa decisão é melhor
que o que o plano sugere. Não tome decisões fora do plano sem
me consultar.
```

### Quando precisa parar uma sessão pela metade

```
Pausa. Antes de fechar esta sessão, me dê:
1. Resumo do que foi feito até agora
2. Lista de arquivos modificados (com git status equivalente)
3. O que ficou pendente
4. Próximo passo exato para retomar
5. Sugestão de prompt para abrir a próxima sessão de retomada

Não precisa rodar nada. Só relatório.
```

### Quando algo falhou e você não sabe por quê

```
Vamos debugar com calma. Antes de tentar consertar:
1. Mostre exatamente o erro que aconteceu
2. Mostre exatamente o comando ou ação que disparou
3. Me dê 3 hipóteses sobre a causa, ranqueadas por probabilidade
4. Para cada hipótese, sugira como verificar
5. Espere minha decisão sobre qual investigar primeiro

Não tente correção especulativa.
```

### Quando o Claude Code está sendo verboso demais

```
Seja mais conciso. Direto ao ponto. Sem repetir o que eu já sei.
Sem pedidos de desculpa. Sem "deixa eu explicar primeiro".
Próxima resposta máximo 5 linhas a menos que precise código.
```

### Quando você quer revisar antes de aplicar

```
Antes de aplicar essa mudança, me mostre o diff EXATO:
- Arquivo: <path>
- Antes: <trecho atual>
- Depois: <trecho novo>

Espere meu OK explícito antes de chamar str_replace ou create_file.
```

### Para atualizar o status do plano no CLAUDE.md

```
Atualize a seção "Status atual" do CLAUDE.md marcando:
- Sprint [N] como concluído (ou parcial)
- Adicione 1 linha em "Histórico relevante de decisões arquiteturais"
  com data e o que foi decidido nesta sessão de implementação

Mostre o diff antes de aplicar.
```

---

## 📌 Lembretes operacionais finais

1. **Uma tarefa por sessão.** Sessões focadas geram código melhor.

2. **Sempre commitar entre sessões.** Cada tarefa concluída → commit no
   github.dev → nova sessão. Isso evita perda de trabalho e mantém
   histórico limpo.

3. **Não confie cegamente no Claude Code.** Revise os diffs antes de
   commitar. Especialmente em arquivos críticos como `contextCollector.ts`,
   `systemPrompt.ts` e edge functions.

4. **Quando em dúvida, pergunte ao Claude Code para CITAR o trecho do
   plano** que está orientando a decisão. Se ele não consegue citar,
   é sinal de que está improvisando.

5. **Sprint 1 primeiro.** Mesmo que dê vontade de ir para o Sprint 6
   (mais transformador), faça o 1 primeiro. Ele te dá confiança no
   workflow e o ganho percebido aparece em 1-2 dias.

6. **Plano é vivo.** Se durante a implementação você descobrir que algo
   no plano não faz sentido, atualize o plano (ou peça pro Claude Code
   atualizar) antes de divergir do plano. Documento desatualizado é
   pior que não ter documento.

---

**Bom trabalho, Cap. Que essa implementação te traga a clareza
financeira que você está construindo. 🎯**
