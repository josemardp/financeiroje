# CLAUDE.md — Contexto do Projeto FinanceiroJe

## Contexto que afeta o produto

Uso familiar, não SaaS. Três escopos de dados: `private` (Josemar), `family`, `business` (Esdra Cosméticos, MEI da esposa). **Doações recorrentes são lançamentos fixos** — categorização precisa prever isso.

(Perfil pessoal do dono já está no `CLAUDE.md` global — não duplicar aqui.)

---

## O que é o FinanceiroJe

Aplicativo de finanças pessoais PWA para uso familiar e do MEI da esposa.
Escopos: `private` (pessoal), `family` (família), `business` (Esdra Cosméticos MEI).
Não é um produto SaaS — é uso pessoal/familiar. Sem multi-tenant.

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilo | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Edge Functions | Deno (TypeScript) |
| IA Conselheira | OpenRouter (modelos: `anthropic/claude-haiku-4-5`, `openai/gpt-4o-mini`, `google/gemini-3-flash-preview`) |
| Busca web | Tavily Search API (via `ai-advisor`) |
| Captura Inteligente | OpenAI `gpt-4o-mini` (via `smart-capture-interpret`) |
| Package manager | npm (`vercel.json` usa `npm install/build`; lockfile: `package-lock.json`) |
| Build | Vite |
| Testes | Vitest + Playwright |

---

## Deploys ao Supabase — via MCP (preferencial) ou painel web (fallback)

Importante: o Supabase NÃO está conectado ao GitHub via Actions.
Push no repo NÃO aplica migrations nem deploya edge functions automaticamente.

### Edge Functions — usar MCP do Supabase (preferencial)

O usuário tem o MCP do Supabase disponível na sessão do Claude Code.
Para deployar edge functions, usar a ferramenta `mcp__claude_ai_Supabase__deploy_edge_function`.
O arquivo `_shared/rateLimiter.ts` deve ser incluído como dependência relativa
nas funções `ai-advisor`, `smart-capture-interpret` e `smart-capture-voice`.

Após o deploy, confirmar com `mcp__claude_ai_Supabase__list_edge_functions` que o status ficou ACTIVE.

### Migrations — painel web do Supabase (SQL Editor)

O usuário aplica migrations manualmente via SQL Editor.
Sempre que criar uma migration nova, incluir no final da resposta:

1. Abrir https://app.supabase.com → projeto FinanceiroJe → SQL Editor
2. Clicar em + New query
3. Colar o SQL exato (forneça pronto para colar)
4. Clicar em Run
5. Rodar query de validação (forneça SELECT que prova aplicação)
6. Aguardar confirmação do usuário antes de prosseguir

NUNCA sugira `supabase db push`, `supabase functions deploy`,
ou `supabase migration up` — o usuário não tem o CLI Supabase instalado.

NUNCA assuma que uma migration foi aplicada só porque o arquivo
existe no repo. Sempre confirme com o usuário antes de prosseguir
para tarefas que dependem do schema novo.

---

## Arquivos-chave

```
src/services/aiAdvisor/
  contextCollector.ts   — coleta todo o contexto financeiro (1124 linhas)
  systemPrompt.ts       — monta o system prompt do AI Advisor
  responseParser.ts     — parseia a resposta

src/services/smartCapture/
  captureContext.ts     — contexto da Captura (101 linhas — SIMPLES, meta: evoluir)
  adapters/             — OCR, voz, texto, Excel, PDF, Word

supabase/functions/
  ai-advisor/           — edge function do Conselheiro (Anthropic)
  smart-capture-interpret/ — edge function da Captura (OpenAI)
  smart-capture-ocr/    — extração de imagem
  smart-capture-voice/  — transcrição de voz
  finance-engine/       — cálculos financeiros server-side
```

---

## Plano estratégico ativo

Ver: `docs/PLANO_INTELIGENCIA_PESSOAL.md`

Sprints:
- **Sprint 1** (próximo): expor perfil comportamental do Advisor para a Captura. Sem mudança de schema.
- **Sprint 2**: tabela `user_patterns` + `capture_learning_events` + trigger + cron de aprendizado.
- **Sprint 3**: evoluir `ai_coach_memory` com tipos, deduplicação e decaimento.
- **Sprint 4**: UI de controle (`/settings/ai-memory`) + feedback explícito.
- **Sprint 5**: tabela `decision_outcomes` — medir aderência a conselhos (opcional).
- **Sprint 6**: telemetria + `behavioral_tags` + embeddings vetoriais + gamificação adaptativa (opcional).

---

## Princípios não-negociáveis da IA

1. **Zero alucinação**: a IA nunca inventa números. Só usa o que está no contexto.
2. **Memória ≠ fato**: padrões comportamentais são hints, nunca verdades absolutas.
3. **Decisão sempre com o usuário**: IA orienta, nunca decide sozinha.
4. **Sem push de engajamento**: sem notificação push para engajar. Gamificação é prótese cognitiva, não gancho.
5. **Separação de camadas**: fatos reais vs. padrões aprendidos vs. memória episódica — nunca misturar no prompt.
6. **Linguagem reflexiva**: "notei que..." / "costuma..." — nunca "você sempre..." / "você é...".

---

## Regras de colaboração (OBRIGATÓRIAS em toda sessão)

- **NÃO executar `supabase db push` nem `supabase functions deploy` via CLI** — sem CLI instalado. Usar MCP para edge functions, painel web para migrations.
- **NÃO executar `npm run build`** sem pedido explícito — demora muito.
- **ANTES de editar qualquer arquivo**: mostrar o plano/diff e aguardar validação.
- **Uma tarefa por vez** — não fazer tudo em cascata sem aprovação de cada etapa.
- **Quando propor mudança**: mostrar diff visual antes de aplicar.

(Idioma e tom já estão no `CLAUDE.md` global — não repetir aqui.)

---

## Convenções de código

- TypeScript estrito (sem `any` desnecessário).
- Imports com alias `@/` (configurado no tsconfig).
- Componentes React em PascalCase, hooks em camelCase com prefixo `use`.
- Edge Functions Deno: imports de `https://deno.land/std` e `https://esm.sh`.
- `contextCollector` nunca faz cálculos financeiros — importa do `financeEngine`.
- Falhas silenciosas no contexto de captura (retornar `{ contextBlock: "" }` em vez de lançar).
- RLS obrigatório em todas as tabelas novas.
- UNIQUE em `user_patterns` inclui sempre `(user_id, scope, pattern_type, pattern_key)`.

---

## Estado atual

Fonte única: [`docs/STATUS_EXECUCAO.md`](docs/STATUS_EXECUCAO.md) — não duplicar aqui, desatualiza.
