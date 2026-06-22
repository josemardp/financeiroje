# FinanceiroJe

Aplicativo de finanças pessoais com IA para uso familiar e do MEI da Esdra Cosméticos.
Uso pessoal/familiar — não é um produto SaaS.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilo | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Edge Functions | Deno (TypeScript) |
| IA Conselheira | OpenRouter (modelos: `anthropic/claude-haiku-4-5`, `openai/gpt-4o-mini`, `google/gemini-3-flash-preview`) |
| Busca web | Tavily Search API (`ai-advisor`) |
| Captura Inteligente | OpenAI `gpt-4o-mini` (via `smart-capture-interpret`) |
| Package manager | npm |
| Build | Vite |
| Testes | Vitest (unitários) + Playwright (E2E) |

## Escopos de dados

- `private` — finanças pessoais do Josemar
- `family` — finanças da família
- `business` — Esdra Cosméticos MEI

## Como rodar localmente

```bash
npm install
cp .env.example .env.local   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:5173
```

### Testes

```bash
npm test               # unitários (Vitest)
npm run test:e2e       # smoke E2E (Playwright) — requer browsers instalados
                       # na primeira vez: npx playwright install chromium
```

## Deploys ao Supabase

O Supabase **não** está conectado ao GitHub. Push no repo não aplica migrations nem deploya edge functions.

- **Migrations** — SQL Editor no painel Supabase (instruções detalhadas em `CLAUDE.md`)
- **Edge Functions** — MCP do Supabase (ferramenta `deploy_edge_function`)

## Documentação estratégica

| Documento | Conteúdo |
|-----------|---------|
| `docs/PLANOS_DE_EVOLUCAO.md` | Backlog completo (35 planos A–H + Saneamento S1–S6) |
| `docs/STATUS_EXECUCAO.md` | Histórico de sprints e estado atual |
| `docs/PLANO_PAINEL_ESDRA.md` | Painel Empreendedor Esdra Cosméticos (H.1–H.2) |
| `CLAUDE.md` | Contexto do projeto para agentes de IA |

## Artefatos Esdra Cosméticos / PMESP

Os itens abaixo são artefatos operacionais hospedados junto ao app, mas fora do escopo
da aplicação React principal:

| Caminho | Descrição |
|---------|-----------|
| `public/manual/` | Manual 30 Dias HTML — trilho operacional da Esdra (em produção desde 02/05/2026) |
| `public/checklist-diadasmaes/` | Checklist Dia das Mães — artefato pontual de campanha |
| `Rotina de trabalho/` | Arquivos de gestão da rotina PMESP (não são código da aplicação) |

Rotas configuradas em `vercel.json`: `/manual` e `/checklist-diadasmaes` apontam para seus respectivos `index.html`.
