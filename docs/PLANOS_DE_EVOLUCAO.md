# 🗺️ Planos de Evolução — FinanceiroJe

> **Objetivo deste documento:** servir como backlog estratégico do projeto além da camada de inteligência pessoal. Lista os 22 planos de evolução identificados em auditoria de Abril/2026 + 4 planos da nova **Categoria H — Esdra Cosméticos como Sistema** adicionada em Maio/2026, organizados por categoria, com descrição sucinta, prioridade, esforço estimado e pré-requisitos.
>
> **Autor:** sessão Claude com Josemar — Abril/2026 (v1.0–1.1); integração do diagnóstico técnico — Junho/2026 (v1.2)
> **Versão:** 1.2
> **Status:** backlog aprovado, aguardando elaboração individual
> **Relação com outros documentos:**
> - Complemento estratégico ao `PLANO_INTELIGENCIA_PESSOAL.md` (v1.3) e `PLANO_COMPLEMENTAR_INTELIGENCIA.md` (v1.0)
> - **Categoria H** referencia o `PLANO_PAINEL_ESDRA.md` (v2.0) para detalhamento técnico
> - **Categoria S e Roteiro de Saneamento** (§9-bis e §10-bis) incorporam o diagnóstico técnico consolidado de Junho/2026 — os relatórios-fonte foram pulverizados neste plano e removidos do repositório.
> - Ordem de execução sugerida: primeiro o **Roteiro de Saneamento (Fase 1.5)**; depois retomar os planos prioritários das categorias A–H.

---

## 📑 Sumário

1. [Como usar este documento](#1-como-usar-este-documento)
2. [Mapa do ecossistema de planos](#2-mapa-do-ecossistema-de-planos)
3. [Categoria A — Plataforma e operação](#3-categoria-a--plataforma-e-operação)
4. [Categoria B — Segurança e conformidade](#4-categoria-b--segurança-e-conformidade)
5. [Categoria C — Qualidade de código](#5-categoria-c--qualidade-de-código)
6. [Categoria D — Produto e usuário](#6-categoria-d--produto-e-usuário)
7. [Categoria E — Uso profissional (Esdra Cosméticos e PMESP)](#7-categoria-e--uso-profissional-esdra-cosméticos-e-pmesp)
8. [Categoria F — Colaboração familiar](#8-categoria-f--colaboração-familiar)
9. [Categoria G — Inteligência deferida](#9-categoria-g--inteligência-deferida)
10. [Categoria H — Esdra Cosméticos como Sistema](#10-categoria-h--esdra-cosméticos-como-sistema)
- [Diagnóstico técnico — Junho/2026 (snapshot)](#diagnóstico-técnico--junho2026-snapshot)
- [Categoria S — Saneamento Técnico (Diagnóstico Jun/2026)](#categoria-s--saneamento-técnico-diagnóstico-jun2026)
- [Roteiro de Saneamento — sprint a sprint (S1→S6)](#roteiro-de-saneamento--sprint-a-sprint-s1s6)
11. [Matriz consolidada de priorização](#11-matriz-consolidada-de-priorização)
12. [Recomendação de sequência](#12-recomendação-de-sequência)
- [Apêndice — Backlog especulativo (Diagnóstico Jun/2026)](#apêndice--backlog-especulativo-diagnóstico-jun2026)
13. [Histórico de versões](#13-histórico-de-versões)

---

## 1. Como usar este documento

Cada plano está descrito aqui com apenas **nome + descrição sucinta + metadados** (prioridade, esforço, pré-requisitos). A elaboração técnica completa de cada plano (migrations, código, critérios de aceite, etc.) é feita sob demanda — como foi com o plano complementar da inteligência.

**Convenções de prioridade:**
- 🔴 **Alta** — endereça risco imediato (segurança, legal, operacional) ou destrava valor estratégico do projeto
- 🟡 **Média** — melhora significativa mas sem urgência imediata
- 🟢 **Baixa** — polimento, futuro, ou depende de validação externa

**Convenções de esforço:**
- **Pequeno** — 1-3 dias
- **Médio** — 4-10 dias
- **Grande** — 10+ dias

**Quando elaborar um plano individual:**
1. Escolher o plano do backlog
2. Solicitar elaboração detalhada em sessão dedicada
3. Validar o documento gerado
4. Executar em sprint próprio, registrando progresso em `STATUS_EXECUCAO.md`
5. Marcar o plano como ✅ neste documento quando concluído

---

## 2. Mapa do ecossistema de planos

```
FinanceiroJe — Ecossistema de Planos
│
├── 🧠 Eixo Inteligência Pessoal
│   ├── PLANO_INTELIGENCIA_PESSOAL.md (v1.3)         ✅ Sprints 1-7 concluídos
│   └── PLANO_COMPLEMENTAR_INTELIGENCIA.md (v1.0)    ✅ Sprints 8-10 concluídos (Abr/2026)
│
├── 🛍️ Eixo Esdra Cosméticos como Sistema
│   ├── public/manual/index.html                      ✅ Em produção (02/Mai/2026)
│   ├── manual_30_dias_progresso (tabela)             ✅ Migration aplicada
│   ├── manual_30_dias_decisoes (tabela)              ✅ Migration aplicada
│   └── PLANO_PAINEL_ESDRA.md (v2.0)                  📋 6 sprints aguardando execução
│       ├── Sprints 1-4: sistema operacional
│       └── Sprints 5-6: PIL Esdra + AI Conselheiro
│
└── 🏗️ Eixo Evolução do Projeto (este documento)    📋 22 + 4 planos em 8 categorias
    ├── A. Plataforma e operação (4 planos)
    ├── B. Segurança e conformidade (3 planos)
    ├── C. Qualidade de código (4 planos)
    ├── D. Produto e usuário (5 planos)
    ├── E. Uso profissional (3 planos)
    ├── F. Colaboração familiar (3 planos)
    ├── G. Inteligência deferida (3 planos — vindos do plano complementar)
    └── H. Esdra Cosméticos como Sistema (4 planos — adicionada Mai/2026)
```

---

## 3. Categoria A — Plataforma e operação

### A.1 — Observabilidade e SRE 🔴

**Descrição:** Dashboards consolidados (Grafana ou Supabase Studio) para monitorar saúde do sistema em produção: taxa de sucesso e latência de crons, edge functions (latência p50/p95/p99, taxa de erro, distribuição de tokens), saúde do pgvector (tamanho do índice, qualidade das buscas), uso de recursos do Supabase. Alertas automáticos via Telegram ou e-mail quando algo falha por 2+ dias seguidos ou ultrapassa thresholds configurados.

**Motivação:** Hoje o projeto tem 13+ migrations, 10+ edge functions e 7+ crons rodando. Sem observabilidade, uma falha silenciosa (ex: cron de embeddings parado) só é descoberta quando o usuário percebe que a IA está respondendo mal.

**Esforço:** Médio (5-7 dias)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** 1ª entre todos os planos deste documento

---

### A.2 — Backup e Disaster Recovery 🔴

**Descrição:** Backup automatizado diário de dados críticos (`transactions`, `ai_coach_memory`, `user_patterns`, `decision_outcomes`, `capture_learning_events`, `ai_messages`) para storage externo ao Supabase (Cloudflare R2, Google Drive via MCP, ou Backblaze B2). Procedimento documentado de restore. Teste semestral de restore em ambiente de staging. Retenção escalonada: diário 30 dias, semanal 12 semanas, mensal 12 meses.

**Motivação:** Perda de dados financeiros históricos e memória de IA seria catastrófica — representa anos de insights e padrões aprendidos. Depender apenas do backup do Supabase não é suficiente.

**Esforço:** Médio (3-4 dias)
**Pré-requisitos:** Definir provedor de storage externo
**Prioridade de execução:** 2ª

---

### A.3 — CI/CD e Deploy Seguro 🟡

**Descrição:** Pipeline automatizado (GitHub Actions) que: roda `supabase db diff` para detectar migrations pendentes, aplica em ambiente de staging, executa suite completa de testes, exige aprovação manual, aplica em produção. Bloqueia merge em `main` se testes falharem. Integração com Vercel Preview Deploys para PRs.

**Motivação:** Hoje migrations são aplicadas manualmente no painel Supabase — risco real de divergência entre repositório e produção (já aconteceu no histórico do projeto). CI/CD formal elimina essa classe de bug.

**Esforço:** Médio (4-5 dias)
**Pré-requisitos:** Ambiente de staging do Supabase criado
**Prioridade de execução:** 3ª

---

### A.4 — Gestão de Custos 🟡

**Descrição:** Dashboard consolidado de custos mensais de todos os provedores (OpenAI, OpenRouter, Supabase, Vercel, Google Cloud, Tavily, storage externo). Cálculo de custo por usuário ativo e por funcionalidade (captura, advisor, digest semanal). Alerta quando gasto projetado exceder 120% da média dos últimos 3 meses. Relatório mensal em PDF.

**Motivação:** Quando Esdra + familiares + possível expansão começarem a usar o sistema, saber exatamente quanto cada feature custa é essencial para priorização e para decidir modelos de LLM usados.

**Esforço:** Pequeno (3-4 dias)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** Paralela a A.1

---

## 4. Categoria B — Segurança e conformidade

### B.1 — Auditoria LGPD Completa 🔴

**Descrição:** Conjunto completo de requisitos LGPD: Registro de Atividades de Processamento de Dados Pessoais (RAPDP), política de privacidade pública no site, termo de consentimento explícito exibido na primeira interação do usuário, auditoria periódica de campos que armazenam dados sensíveis (CPF, RG, endereço, transações financeiras), procedimento formal de resposta a requisições de titular (art. 18 da LGPD). Sprint 4 já entregou `user-data-export` e `user-data-purge` — este plano completa o círculo legal.

**Motivação:** O FinanceiroJe trata dados pessoais sensíveis (dados financeiros + identificadores pessoais). Sem auditoria LGPD, há exposição legal real — especialmente se o sistema for aberto além da família.

**Esforço:** Médio (4-5 dias)
**Pré-requisitos:** Nenhum (porém pode precisar consultar advogado para revisão do RAPDP e termo)
**Prioridade de execução:** Paralela a A.1

---

### B.2 — Hardening de Segurança 🔴

**Descrição:** Auditoria completa de: (1) RLS — teste sistemático de cross-tenant isolation em todas as tabelas; (2) `SECURITY DEFINER` functions — revisão de privilégios mínimos; (3) rotação de chaves — `service_role_key`, API keys OpenAI/OpenRouter/Tavily; (4) remoção de segredos commitados (reforço do débito antigo `.env`); (5) 2FA obrigatório em Supabase, GitHub e Vercel; (6) monitoramento via `pg_stat_statements` para queries anômalas; (7) headers de segurança (CSP, HSTS, X-Frame-Options) no Vercel.

**Motivação:** Base de segurança do app. Cada item é uma porta que precisa estar fechada.

**Esforço:** Médio (5-7 dias)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** 4ª

---

### B.3 — Penetration Testing Interno 🟢

**Descrição:** Sessão trimestral onde o próprio Josemar tenta invadir o sistema: SQL injection em campos livres (descrição de transação, nome de beneficiário, notas), XSS em conteúdo renderizado, CSRF em endpoints sensíveis, upload de arquivos maliciosos no OCR (payloads em PDF, EXE disfarçado de imagem), bypass de RLS via manipulação de JWT, teste com credenciais vazadas. Checklist OWASP Top 10 adaptado.

**Motivação:** Após Sprint 8 (defesa contra prompt injection) e plano B.2 (hardening), validar empiricamente se as defesas funcionam. Atividade educativa também — fortalece conhecimento de segurança.

**Esforço:** Pequeno (1 dia por sessão trimestral)
**Pré-requisitos:** B.2 concluído; Sprint 8 do plano complementar concluído
**Prioridade de execução:** A partir de Q3/2026

---

## 5. Categoria C — Qualidade de código

### C.1 — Cobertura de Testes 🟡

**Descrição:** Plano formal para aumentar cobertura de testes automatizados. Metas concretas: ≥ 70% no `financeEngine` (cálculos financeiros — zero tolerância a bug), ≥ 60% no `contextCollector` e `systemPrompt` (coração da IA), ≥ 50% nos edge functions críticos. Testes E2E com Playwright para os 5 fluxos principais: login, adicionar transação, Modo Espelho (captura + confirmação), conversa com Advisor, fechamento mensal. Integração de coverage badge no README.

**Motivação:** Hoje a cobertura é pontual (só nas áreas onde foi explicitamente implementada — `learn-patterns`, `captureLearningEvents`, `captureContext`). Refatorações futuras ficam arriscadas sem suite robusta.

**Esforço:** Grande (contínuo — 15+ dias distribuídos ao longo de meses)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** Contínua, iniciar em Q2/2026

---

### C.2 — Refatoração Arquitetural 🟡

**Descrição:** `contextCollector.ts` tem 945 linhas e `systemPrompt.ts` tem 459 — ambos estão no limite do manejável por um humano. Plano para: (1) quebrar em módulos menores por responsabilidade (carregamento, análise comportamental, geração de contexto, formatação); (2) extrair hooks compartilhados (`useAuth`, `useScope`, `useSupabaseQuery`); (3) padronizar error handling com padrão `Result<T, E>`; (4) consolidar tipos duplicados entre frontend e edge functions; (5) eliminar casts `as any` e `as unknown`.

**Motivação:** Débito técnico arquitetural cresce silenciosamente. A cada nova feature, fica mais custoso mexer nesses arquivos.

**Esforço:** Grande (10-15 dias)
**Pré-requisitos:** C.1 com cobertura mínima de 50% nos arquivos a refatorar (senão o risco de regressão é muito alto)
**Prioridade de execução:** Após C.1 atingir baseline

---

### C.3 — Eliminação de Débito Técnico Silencioso 🟢

**Descrição:** Inventário completo e iterativo de marcadores de débito no codebase: `any`, `as any`, `// eslint-disable`, `@ts-ignore`, `TODO`, `FIXME`, `HACK`. Cada ocorrência vira uma issue priorizada. Meta: reduzir contagem total em 80% em 90 dias. Regra obrigatória a partir da criação do plano: novo código não pode adicionar `any` ou `@ts-ignore` sem issue justificativa linkada.

**Motivação:** O projeto tem 3+ anos de evolução acumulada. Débitos técnicos silenciosos se tornam invisíveis — este plano dá visibilidade.

**Esforço:** Contínuo (15-30 min/semana)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** Iniciar imediatamente como hábito contínuo

---

### C.4 — Documentação Técnica Viva 🟢

**Descrição:** Hoje a documentação vive em múltiplos arquivos `docs/` (CONTEXTO_MESTRE, DECISOES_TECNICAS, PLANOS, STATUS_EXECUCAO). Plano para consolidar e modernizar: (1) ADRs (Architecture Decision Records) datadas e numeradas para cada decisão arquitetural relevante; (2) diagrama de arquitetura gerado automaticamente (Mermaid ou C4 com Structurizr) a partir da análise do código; (3) Storybook interno para componentes React; (4) geração automática de docs de APIs das edge functions a partir de JSDoc.

**Motivação:** Documentação que não é viva fica desatualizada rápido. Automação reduz esse problema.

**Esforço:** Médio (3-5 dias iniciais + manutenção contínua)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** Paralela a outras frentes

---

## 6. Categoria D — Produto e usuário

### D.1 — Onboarding Estruturado 🔴

**Descrição:** Fluxo guiado para novo usuário (Esdra, familiar, ou usuário futuro), em 4 etapas: (1) perguntas de perfil que populam `user_ai_preferences` (tom, detalhamento, contexto religioso, etc.); (2) importação assistida de extratos bancários (CSV ou OFX do banco principal do usuário); (3) categorização em lote com sugestões da IA baseadas no extrato importado; (4) primeira conversa guiada com o Advisor, já com contexto populado. Métrica de ativação: % de usuários que completam os 4 passos na primeira semana.

**Motivação:** Hoje o sistema é maduro mas hostil ao novato — entra, vê tela vazia, não sabe por onde começar. Sem onboarding, a Esdra ou qualquer novo usuário vai abandonar antes do sistema se tornar útil para ela.

**Esforço:** Grande (7-10 dias)
**Pré-requisitos:** D.2 (importação de dados) como dependência parcial
**Prioridade de execução:** Após D.2

---

### D.2 — Importação de Dados Externos 🟡

**Descrição:** Suporte nativo a: (1) importação de extrato OFX (formato padrão dos bancos brasileiros); (2) importação de CSV estruturado dos principais bancos (Nubank, Itaú, Caixa, C6, Inter, PagSeguro, PicPay); (3) integração com Pluggy ou Belvo para Open Finance — sincronização automática de contas via API oficial do Banco Central. Categorização automática via `user_patterns` já existentes (Sprint 2 do plano original).

**Motivação:** Hoje o sistema vive de digitação manual + OCR. Isso limita adoção massiva e limita também o volume de dados para inteligência pessoal aprender. Open Finance via Pluggy transformaria o FinanceiroJe em ferramenta séria.

**Esforço:** Grande (8-12 dias)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** Alta estratégica — destrava D.1 e aumenta volume de dados para todos os outros recursos

---

### D.3 — Mobilidade (PWA ou App Nativo) 🟡

**Descrição:** Hoje o FinanceiroJe é web desktop-first. A Captura Inteligente pede foto → smartphone é o ambiente natural. Plano em 2 fases: (1) PWA com `display: standalone`, ícone instalável na home screen, captura direta da câmera do celular, funcionamento offline básico (cache de últimas 50 transações); (2) se validado com uso real, evoluir para Capacitor (mantém codebase React) ou React Native.

**Motivação:** Captura de comprovantes via celular é 10x mais natural que via desktop. Maior volume de capturas = mais dados para a inteligência pessoal.

**Esforço:** Médio (5-8 dias para PWA); Grande (15+ dias para nativo)
**Pré-requisitos:** Nenhum para PWA
**Prioridade de execução:** PWA pode ser feito em paralelo a outras frentes

---

### D.4 — Acessibilidade (WCAG AA) 🟢

**Descrição:** Auditoria com `axe-core`, navegação completa por teclado em todas as telas, `aria-label` em todos os ícones interativos, contraste mínimo 4.5:1 em textos, labels semânticas em formulários, suporte testado a screen reader (NVDA no Windows, VoiceOver no Mac). Conformidade WCAG 2.1 nível AA.

**Motivação:** Acessibilidade é boa prática fundamental. Alguém da família pode desenvolver necessidade visual no futuro (idade). Melhor construir pronto do que retrofitar.

**Esforço:** Médio (4-6 dias)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** Q4/2026 ou quando surgir necessidade

---

### D.5 — Internacionalização 🟢

**Descrição:** Hoje o app é pt-BR hardcoded. Preparação de infra com `react-intl` ou `i18next`, extração de strings para arquivos de tradução, formatação de data/moeda consciente de locale.

**Motivação:** Baixa prioridade imediata (nenhum usuário não-brasileiro planejado). Porém, se feito cedo, evita dívida técnica enorme depois.

**Esforço:** Pequeno-Médio (3-4 dias)
**Pré-requisitos:** Nenhum
**Prioridade de execução:** Baixa — implementar só se necessidade real surgir

---

## 7. Categoria E — Uso profissional (Esdra Cosméticos e PMESP)

### E.1 — Integração Esdra Cosméticos ↔ FinanceiroJe (financeiro) 🔴

**Descrição:** Especificamente sobre a **camada financeira** da integração — diferente dos planos da Categoria H que cobrem o sistema de gestão completo. Plano para: (1) sincronização de vendas do e-commerce (esdracosmeticos.com.br) com transações — cada pedido vira `income` automático no escopo `business`; (2) cálculo de margem por produto via cruzamento com `esdra_estoque` (criada em Sprint 4 do `PLANO_PAINEL_ESDRA.md`); (3) DRE mensal simplificado para MEI; (4) preparação de documentos para declaração anual MEI/SIMPLES; (5) indicadores-chave do negócio (ticket médio, frequência de compra, produtos campeões).

**Motivação:** Realiza a integração financeira-fiscal do sistema Esdra Cosméticos. Os aspectos operacionais (compromissos, decisões, KPIs, CRM, conselheiro IA) ficam na Categoria H.

**Esforço:** Médio (6-8 dias) — reduzido em relação à v1.0 porque agora há infra preparada na Categoria H
**Pré-requisitos:** **H.1 (Painel Empreendedor) Sprint 4 concluído** (ou seja, tabelas `esdra_estoque` existindo); acesso técnico ao e-commerce da Esdra (API de pedidos ou export CSV regular)
**Prioridade de execução:** Após Categoria H — Sprint 4

---

### E.2 — Fluxo de Caixa Profissional (Business) 🟡

**Descrição:** Previsão de caixa específica para negócio da Esdra, considerando: (1) sazonalidade (Black Friday, Dia das Mães, Natal — alto impacto em cosméticos); (2) ponto de equilíbrio (qual faturamento mínimo mensal cobre custos fixos); (3) análise ABC de produtos (quais produtos geram 80% do lucro); (4) alerta de ruptura de estoque cruzando histórico de vendas com estoque atual.

**Motivação:** Diferente da lógica familiar — negócio precisa de outra inteligência. A IA Conselheira pode ter "modo business" com diretrizes distintas.

**Esforço:** Médio (7-10 dias)
**Pré-requisitos:** E.1
**Prioridade de execução:** Após E.1

---

### E.3 — Separação Fiscal Pessoa Física × MEI 🟢

**Descrição:** Ferramenta que avalia periodicamente se as transações do escopo `business` estão contabilmente bem separadas da PF (regra do art. 1.187 do Código Civil — obrigação de separação patrimonial). Alerta quando há mistura (gasto pessoal registrado no escopo business, ou vice-versa). Relatório mensal de compliance de separação.

**Motivação:** Útil em eventual fiscalização da Receita Federal. Reduz risco de desconsideração da personalidade jurídica.

**Esforço:** Pequeno (3-4 dias)
**Pré-requisitos:** E.1
**Prioridade de execução:** Após E.1 e E.2

---

## 8. Categoria F — Colaboração familiar

### F.1 — Multi-usuário Real no Escopo Family 🟡

**Descrição:** Hoje o schema tem `familia_id` mas a experiência multi-usuário é rudimentar. Plano para: (1) convite por e-mail com aceite; (2) papéis (admin familiar / membro / leitor); (3) atribuição de transação ao membro que registrou (`transactions.created_by`); (4) histórico de alterações (audit log — quem mudou o quê, quando); (5) comentários em transações ("Esdra, pode me explicar este gasto?"); (6) metas compartilhadas com progresso por membro e por família.

**Motivação:** Transforma o FinanceiroJe em ferramenta colaborativa real entre Josemar e Esdra. Hoje é mais "eu uso, ela vê" — faltam as camadas de colaboração ativa.

**Esforço:** Grande (8-12 dias)
**Pré-requisitos:** Validação com Esdra sobre o modelo de papéis e fluxo de convite
**Prioridade de execução:** Após E.1 — faz mais sentido quando a Esdra já tem a parte business dela

---

### F.2 — Educação Financeira para filha 🟢

**Descrição:** Módulo futuro — quando a idade permitir. "Mesada inteligente" com cofrinho virtual, metas visuais (brinquedo, passeio, doação para a comunidade), lições de alocação (regra 70/20/10 — gastar, poupar, doar), quizzes gamificados sobre conceitos básicos (juros, inflação, reserva). Interface própria com linguagem e visuais adequados à idade.

**Motivação:** Educação financeira desde cedo é uma das maiores heranças que um pai pode deixar. O FinanceiroJe tem infra para isso.

**Esforço:** Médio (7-10 dias quando executado)
**Pré-requisitos:** filha em idade apropriada
**Prioridade de execução:** Futuro — 2028/2029

---

### F.3 — Conselheiro Espiritual-Financeiro Familiar 🟢

**Descrição:** Expansão natural do Sprint 10 do plano complementar: a IA Conselheira ganha modo "conselho familiar" onde, com autorização explícita de ambos os cônjuges, analisa finanças do casal à luz de princípios cristãos (mordomia, generosidade, provisão, conforto em crise financeira, prioridades bíblicas). Referências ACF curadas para dilemas típicos (endividamento, tensão conjugal por dinheiro, doação versus poupança, investimento versus ajuda a irmãos em necessidade). Uma espécie de "aconselhamento pastoral financeiro" alinhado com o contexto de valores, respeitando a doutrina e a prática da congregação.

**Motivação:** Realiza o potencial máximo do alinhamento espiritual do projeto. Diferencia radicalmente de qualquer app de finanças no mercado.

**Esforço:** Médio (5-7 dias)
**Pré-requisitos:** Sprint 10 do plano complementar concluído; F.1 (multi-usuário) ativo para Esdra participar
**Prioridade de execução:** Após Sprint 10 + F.1

---

## 9. Categoria G — Inteligência deferida

*Planos que surgiram da auditoria da inteligência pessoal mas foram deferidos para este documento por serem pesquisa/observabilidade fina, não produto direto.*

### G.1 — Causal Tracking de Comportamento 🟢

**Descrição:** Detector de sequências temporais causais entre eventos do usuário. Exemplo de padrão a detectar: "quando Josemar abriu a tela de Dívidas após receber alerta crítico → 68% das vezes ele categorizou uma pendência nos próximos 2 dias". Nova tabela `behavior_chains` com `trigger_event → consequent_event → probability → confidence`. Alimenta a IA Conselheira com entendimento causal, não apenas correlacional.

**Motivação:** Evolução natural do Sprint 6 (behavioral_tags são correlacionais). Causal tracking abre porta para intervenções mais precisas.

**Esforço:** Médio (6-8 dias)
**Pré-requisitos:** Pelo menos 90 dias de dados em `user_engagement_events` e `behavioral_tags`
**Prioridade de execução:** Q3/2026 ou depois

---

### G.2 — Detecção de Drift do Modelo de Inteligência 🟢

**Descrição:** Cron que monitora métricas de qualidade do sistema de inteligência ao longo do tempo e emite alerta quando detecta regressão. Exemplos: taxa de acerto do OCR por tipo de documento, precisão de `user_patterns` medida por correções subsequentes, taxa de 👎 por variante de prompt, tempo médio de hesitação no Modo Espelho. Dashboard com evolução de cada métrica, alerta quando valor recente desvia > 2σ da média histórica.

**Motivação:** Sistemas de ML/IA silenciosamente degradam quando dados mudam ou bugs são introduzidos. Sem drift detection, a degradação só é percebida quando é dramática.

**Esforço:** Médio (5-7 dias)
**Pré-requisitos:** A.1 (observabilidade básica) concluído
**Prioridade de execução:** Após A.1

---

### G.3 — Laboratório Comportamental Experimental 🟢

**Descrição:** Ambiente de experimentação controlada para testar hipóteses comportamentais sobre o próprio usuário. Exemplos: "Se eu trocar a cor do alerta de vermelho para âmbar, o Josemar reage mais rápido?" ou "Se eu agrupar transações por dia ao invés de cronologicamente, a taxa de categorização aumenta?". Infra leve com `experiment_key`, `variant`, `metric`, análise automática de significância estatística. Diferente de A/B test de prompt (Sprint 9) — este é sobre UX e fluxos.

**Motivação:** Permite tomar decisões de produto baseadas em evidência ao invés de intuição, mesmo em uso mono-usuário (o Josemar é seu próprio n=1 ao longo do tempo).

**Esforço:** Grande (8-10 dias)
**Pré-requisitos:** G.2 (drift detection — compartilha infra de análise estatística)
**Prioridade de execução:** Futuro — 2027

---

## 10. Categoria H — Esdra Cosméticos como Sistema

*Adicionada em Maio/2026 após elaboração do `PLANO_PAINEL_ESDRA.md` v2.0. Esta categoria consolida o eixo "Esdra Cosméticos como Sistema" — diferente da Categoria E (que trata de aspectos financeiros-fiscais), aqui estão os planos operacionais, de inteligência específica do negócio e evoluções do consultor IA.*

*Os planos H.1 e H.2 estão totalmente detalhados no documento `PLANO_PAINEL_ESDRA.md` (v2.0). Esta seção apenas referencia. Os planos H.3 e H.4 são evoluções pós-Sprint 6 que ainda não têm documento dedicado — quando forem priorizados, ganham elaboração própria.*

### H.1 — Painel Empreendedor Operacional (Sprints 1-4) 🔴

**Descrição:** Sistema operacional completo dentro do FinanceiroJe para a gestão diária da Esdra Cosméticos. Inclui: tela "Hoje" (compromissos do dia com checkbox), tela "Semana" (visão consolidada), tela "Métricas" (7 KPIs com gráficos), tela "Decisões" (registro e revisão de decisões empreendedoras), CRM mínimo (clientes), módulo de estoque (curva ABC, capital parado). Persiste no Supabase, integrado ao módulo financeiro existente.

**Motivação:** Migrar o trilho operacional da fase HTML standalone (`public/manual/index.html`) para sistema definitivo dentro do FinanceiroJe, com integração nativa aos dados financeiros e preparação para os planos H.2-H.4.

**Esforço:** Grande (8-11 sessões de Claude Code Desktop ao longo de ~2 meses)
**Pré-requisitos:** Mínimo 30 dias de uso do Manual 30 Dias HTML antes de iniciar
**Prioridade de execução:** Alta — primeira frente da Categoria H, base para tudo o que vem depois
**Documentação completa:** `PLANO_PAINEL_ESDRA.md` (v2.0) — Sprints 1-4

---

### H.2 — Personal Intelligence Layer Esdra + AI Conselheiro (Sprints 5-6) 🔴

**Descrição:** Extensão da PIL pessoal (já em produção) para que o sistema também aprenda e raciocine sobre o negócio Esdra Cosméticos. Sprint 5 cria infra: embeddings de decisões, observations específicas do negócio, reuso de `ai_messages_embeddings` com escopo. Sprint 6 cria o **AI Conselheiro Esdra Cosméticos** — interface de chat dedicada onde o LLM tem system prompt especializado, RAG sobre dados reais, citação obrigatória de fonte, zero alucinação numérica.

**Motivação:** Transforma o Painel Empreendedor de "sistema operacional" em "consultor estratégico permanente" com memória do negócio. É a realização do desejo de "ter um consultor de IA permanente que conhece minha história, não inventa, e acompanha a evolução do negócio".

**Esforço:** Grande (6-8 sessões de Claude Code ao longo de ~1.5 meses)
**Pré-requisitos:** H.1 completo + mínimo 60 dias de dados reais no Painel + PIL pessoal Sprints 8-10 estáveis há ≥30 dias
**Prioridade de execução:** Alta estratégica — segundo bloco da Categoria H, a partir de agosto/2026
**Documentação completa:** `PLANO_PAINEL_ESDRA.md` (v2.0) — Sprints 5-6

---

### H.3 — Conselheiro Proativo + Modo Voz 🟡

**Descrição:** Evolução do AI Conselheiro Esdra (H.2 / Sprint 6) com 2 capacidades adicionais: (1) **Conselheiro Proativo** — cron semanal que gera 1 insight não solicitado por semana, aproveitando infra do `weekly_digests` da PIL pessoal (ex: "notei que sua margem de Truss caiu 8% no último mês — quer conversar sobre isso?"). UX deliberadamente passiva — aparece como card opcional, sem notificação push. (2) **Modo Voz** — integração com Web Speech API (Web Speech Recognition + SpeechSynthesis) para conversar com o Conselheiro de viva voz no carro entre quartel e casa. PWA com permissão de microfone.

**Motivação:** Conselheiro reativo é útil, mas Conselheiro proativo gera insights que o usuário não saberia perguntar. Modo voz aproveita o tempo de deslocamento de Josemar (PMESP em Guararapes) que hoje é improdutivo.

**Esforço:** Médio (5-7 dias)
**Pré-requisitos:** H.2 (Sprint 6) concluído e Conselheiro em uso real há ≥60 dias
**Prioridade de execução:** Q4/2026 ou Q1/2027 — depende de validação real de H.2

---

### H.4 — Multi-marca / Multi-negócio 🟢

**Descrição:** Se Esdra Cosméticos evoluir para 2+ negócios paralelos (ex: e-commerce + atacado, ou Esdra Cosméticos + outra linha), o sistema precisa suportar sub-escopos dentro do escopo "esdra". Plano para: (1) campo `business_unit` em todas as tabelas `esdra_*`; (2) seletor de unidade no Painel; (3) Conselheiro IA capaz de comparar unidades ("qual unidade tem melhor margem?"); (4) consolidação financeira opcional ou separada; (5) métricas por unidade + agregadas.

**Motivação:** Antecipa cenário de crescimento real (não hipotético) em que o negócio se diversifica. Construir antes da necessidade gera dívida; depois da necessidade gera caos. Manter como plano dormente, ativar se cenário materializar.

**Esforço:** Grande (10-12 dias)
**Pré-requisitos:** H.2 estável + sinal real de diversificação do negócio (não construir especulativamente)
**Prioridade de execução:** Sob demanda — só executar se Esdra abrir segunda unidade de negócio

---

## Diagnóstico técnico — Junho/2026 (snapshot)

> Esta seção e as duas seguintes (Categoria S + Roteiro de Saneamento) incorporam
> o **diagnóstico técnico consolidado de 20/06/2026** (branch `main`, commit
> `6dc482f`). Os 6 relatórios-fonte foram dissolvidos aqui e removidos do repo.
> Toda afirmação abaixo foi verificada no código.

**Estado verificado:**
- App **roda**: `vite` sobe, tela pública redireciona a `/auth` sem erro.
- **97/97 testes Vitest** passando; **ESLint** 0 erros / 14 avisos; **`tsc --noEmit` 0 erros** sob a config do projeto.
- 24 rotas, 47 migrations, ~30 tabelas, 13 Edge Functions + `_shared`.
- Sprints 1–10 (inteligência) concluídos e com código correspondente.

**Correção de engano de diagnóstico:** uma análise-fonte relatou "75 erros de
TypeScript". **Não se reproduz** — sob `tsconfig.app.json` (`strict: false`,
`noImplicitAny: false`, linhas 25 e 16) o `tsc --noEmit` retorna **0 erros**. O
achado real é que o **modo estrito está desligado** (item S.4), não que há 75 erros.

**Diagnóstico em uma frase:** *produto funcional e bem planejado, com fundação de
qualidade defasada e alguns números financeiros incorretos.* O que ficou para trás
não é capacidade de execução — é base operacional (backup, onboarding, segurança) e
correção de bugs que ferem o princípio de zero-alucinação.

**Gap central:** o planejamento (29 entradas A–H) é muito mais ambicioso que a
cadência recente (3 commits em Junho). A fundação 🔴 (A.2, B.1, B.2, D.1) ficou
atrás enquanto a frente de IA já estava rica. O Go/No-Go do Painel Esdra (H.1),
agendado para fim de Maio/2026, está **vencido e não registrado** no Git.

---

## Categoria S — Saneamento Técnico (Diagnóstico Jun/2026)

> Categoria nova, **prioritária e bloqueante**, derivada do diagnóstico. Catalogada
> na matriz (§11) e detalhada sprint-a-sprint no Roteiro de Saneamento (§10-bis).
> O detalhamento técnico de cada bug (arquivo:linha) está no roteiro.

### S.1 — Correção dos números financeiros 🔴

**Descrição:** corrigir bugs confirmados que produzem número errado ou quebra de
runtime: saldo do Dashboard que ignora transações (`Dashboard.tsx:168` usa
`saldo_actual`, grafia inexistente; schema é `saldo_atual`); Edge Function
`finance-engine` que omite `recommendations` exigido pela UI (`HealthScore.tsx:145`);
detecção de anomalia "média" sem amostra mínima; datas em UTC tratadas como horário
de São Paulo; parcelamento que joga a competência no mês corrente e perde resíduo de
centavos. **Sem mudança de schema.** Viola diretamente o princípio "zero alucinação".

### S.2 — Segurança e segredos 🔴

**Descrição:** `.env` versionado fora do `.gitignore`; funções `SECURITY DEFINER` de
`system_health_alerts` sem `REVOKE EXECUTE`; XSS self-stored no Manual standalone
(`innerHTML` com dados persistidos); RLS desabilitado em `challenges_catalog`;
auditoria fechada de RLS por tabela. Materializa parte de **B.1** e **B.2**.

### S.3 — Backup/DR + auditoria de produção 🔴

**Descrição:** criar a primeira rotina de backup (`pg_dump`/export agendado para
storage externo) + runbook de restauração; auditar (somente leitura) o que está de
fato aplicado no Supabase (migrations, versões de functions, crons, secrets, RLS);
implementar a retenção de telemetria que hoje é um TODO. Materializa **A.2** e parte
de **A.1**.

### S.4 — Qualidade de código e tipagem 🟡

**Descrição:** remover os ~50 `as any` dos caminhos de escrita financeira; ligar
`strict`/`noImplicitAny` gradualmente; corrigir warnings de hooks (`exhaustive-deps`);
tornar o rate-limit persistente (hoje só em memória); criar contrato/teste de paridade
entre os **dois motores financeiros** (frontend puro × Edge Function). Materializa
parte de **C.1/C.2/C.3**.

### S.5 — Testes e ferramentas 🟡

**Descrição:** consertar o Playwright (config importa pacote ausente) + smoke E2E de
login/rotas; tornar o `scripts/integration-test.ts` real (hoje afirma "OK" sem
verificar) ou renomeá-lo; aliviar o `contextCollector` (baixa 24 meses brutos) com
RPC/view agregada. Materializa parte de **C.1**.

### S.6 — Documentação e higiene de repositório 🟢

**Descrição:** README real (hoje stub Lovable); unificar `AGENTS.md`≡`CLAUDE.md`
(fonte + stub); corrigir a doc que diz "Anthropic Claude direto" quando o código usa
**OpenRouter**; escolher um único gerenciador de pacotes (4 lockfiles hoje);
documentar a fronteira de escopo (artefatos Esdra/PMESP no repo). Materializa **C.4**.

---

## Roteiro de Saneamento — sprint a sprint (S1→S6)

> Passo a passo executável até concluir **todas** as correções e melhorias do
> diagnóstico. Ordem por risco. Cada tarefa cita evidência (arquivo:linha).
> Marcar `[x]` ao concluir e registrar em `STATUS_EXECUCAO.md`. Respeitar as regras
> de deploy manual do `CLAUDE.md` (migrations/functions via painel).

### Sprint S1 — Correção dos números (P0, sem schema)

> **Por que primeiro:** número financeiro errado fere o princípio de zero-alucinação
> antes mesmo de envolver IA. Nenhum pré-requisito. Esforço: Pequeno/Médio.

- [x] **S1.1** — ✅ Corrigido o saldo do Dashboard (20/06/2026): removido o campo
  inexistente `saldo_actual`; adicionada query `dashboard-account-balances` que aplica
  a regra oficial `saldo_inicial + transações confirmadas` (income − expense), idêntica
  a `src/pages/Accounts.tsx:56-96` (fonte única). Contas já filtradas por `ativa`.
  `tsc --noEmit` 0 erros; 97/97 testes verdes. *Pendente:* teste dedicado Dashboard ×
  Contas (a adicionar em S5).
- [x] **S1.2** — ✅ (20/06/2026) `finance-engine` passa a retornar `recommendations`:
  portado `buildHealthRecommendations` em `supabase/functions/finance-engine/index.ts`
  (paridade com `healthScore.ts`). Frontend blindado em `backend.ts` (`recommendations
  ?? []`). ✅ **Redeploy concluído (v5, 20/06/2026)** — recomendações reais vêm do servidor.
- [x] **S1.3** — ✅ Anomalia exige amostra mínima E p90>0 nos dois níveis
  (`src/hooks/useTransactionAnomalyCheck.ts`): `hasEnoughData = n>=5 && p90>0`. Resolve
  o falso-positivo com histórico vazio. *Teste dedicado de 0/1/4 amostras → S5.*
- [x] **S1.4** — ✅ Datas em `America/Sao_Paulo` via `Intl.DateTimeFormat("en-CA")`:
  corrigido `src/services/smartCapture/textParser.ts` (`today` + branch "ontem") e
  `supabase/functions/smart-capture-interpret/index.ts:233`. Teste `detects yesterday
  date` realinhado ao fuso de SP. ✅ **Redeploy concluído (v15, 20/06/2026)**.
- [x] **S1.5** — ✅ Parcelamento: competência derivada de `form.data` (ano/mês/dia) e
  última parcela absorve o resíduo de centavos. Corrigido em
  `src/pages/Transactions.tsx` **e** `src/pages/SmartCapture.tsx`.
- [x] **S1.6** — ✅ Validação: `tsc --noEmit` 0 erros; **97/97 testes** verdes; sem
  novos erros de lint. Fechamento de S1 registrado neste roteiro e no `STATUS_EXECUCAO.md`.

> **✅ Deploys do S1 concluídos (20/06/2026)** via MCP Supabase, conta autorizada:
> `finance-engine` v4→**v5** (recomendações reais no servidor) e
> `smart-capture-interpret` v14→**v15** (data no fuso de SP). Ambas `ACTIVE`,
> `verify_jwt: false` preservado. **Sprint S1 100% concluído.**

### Sprint S2 — Segurança e segredos 🔴 (B.1/B.2)

> **Pré-requisito:** nenhum (pode ir em paralelo a S1). Esforço: Médio.

- [x] **S2.1** — ✅ (21/06/2026) `.env` removido do git (`git rm --cached`); `.gitignore`
  atualizado com `.env`, `.env.local`, `.env.*.local`; `.env.example` atualizado.
  Histórico auditado — apenas anon keys; sem service_role ou API keys de terceiros.
- [x] **S2.2** — ✅ (21/06/2026) `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` nas
  funções `_system_health_primary_user_id` e `emit_system_health_alerts`.
  Migration `20260621000001_security_revoke_definer_functions.sql` aplicada e validada.
- [x] **S2.3** — ✅ (21/06/2026) XSS self-stored corrigido em `public/manual/index.html`:
  campos `saved.decisao/criterio/aprendizado` saíram do `innerHTML` e passaram para
  `.value` nos textareas após montagem do DOM.
- [x] **S2.4** — ✅ (21/06/2026) RLS reabilitado em `challenges_catalog` com policy
  `SELECT TO authenticated USING (true)`. Padrão idêntico ao `achievements_catalog`.
  Migration `20260621000002_security_rls_challenges_catalog.sql` aplicada e validada.
- [x] **S2.5** — ✅ (21/06/2026) Auditoria de RLS concluída: **43/43 tabelas com RLS ativo**.
  Zero tabelas com `rls_ativo = false`. Duas tabelas com 0 policies (`prompt_variants`
  e `system_health_logs`) são infra de acesso exclusivo por `service_role` — intencional
  e documentado. Nenhuma ação adicional necessária.

### Sprint S3 — Backup/DR + auditoria de produção 🔴 (A.2)

> **Pré-requisito:** definir storage externo de backup. Esforço: Médio.

- [x] **S3.1** — ✅ (21/06/2026) Script `scripts/backup-supabase.ps1`: exporta 26 tabelas
  via Supabase REST API (service_role) e salva JSON timestampado em
  `G:\Meu Drive\Arquivos Josemar\projetos nao vercionados\financeiroje` (Google Drive
  Desktop sincroniza automaticamente). Retenção 30 dias. Testado: 26/26 tabelas, 1.94 MB.
  Agendar via Windows Task Scheduler (comando no histórico da sessão).
- [x] **S3.2** — ✅ (21/06/2026) Runbook em `docs/RUNBOOK_RESTORE.md`: localizar backup,
  inspecionar JSON, restaurar via merge seguro (ON CONFLICT DO NOTHING) ou TRUNCATE+INSERT,
  ordem de dependências entre tabelas, teste semestral (próximo: Dez/2026).
- [x] **S3.3** — ✅ (21/06/2026) Auditoria de produção concluída via MCP Supabase:
  36 migrations rastreadas (restante aplicado via SQL Editor — divergência esperada);
  13/13 Edge Functions ACTIVE, versões corretas; 11 crons ativos.
  **Achados corrigidos:** jobid 5 e 6 tinham URL/token com angle brackets literais
  (falhando silenciosamente) — recriados com comandos corretos (novos jobid 13 e 14).
- [x] **S3.4** — ✅ (21/06/2026) Retenção de 30 dias implementada via `cron.schedule`
  (`daily-purge-health-logs`, `30 4 * * *`). Migration
  `20260621000003_system_health_logs_retention.sql` aplicada (jobid 12).

### Sprint S4 — Qualidade de código e tipagem ✅ CONCLUÍDO 2026-06-21

> **Pré-requisito:** S1 concluído (evita misturar correção e refator). Esforço: Médio.

- [x] **S4.1** — 48 → 0 `as any` fora de testes: enums via `Enums<"*">`, `UserPreferences`
  interface, `Json` para JSONB, `"tabela" as never` para tabelas fora dos tipos gerados.
  Commits: `9ccf441`
- [x] **S4.2** — `noImplicitAny: false` → `true`, `strict: false` → `true` no `tsconfig.app.json`.
  Zero erros de compilação. Commit: `86f83bd`
- [x] **S4.3** — 5 warnings `exhaustive-deps` eliminados: `eslint-disable-next-line` em 2 casos
  intencionais (rastreio por ID), ref para `lastFetchedCategory` em `useTransactionAnomalyCheck`,
  pattern de refs estáveis em SmartCapture (voz/OCR). Commit: `ce96ac3`
- [x] **S4.4** — Rate-limit persistente via Deno KV (`_shared/rateLimiter.ts`): operação
  atômica com retry, TTL automático, chaves prefixadas por função. Commit: `bc80aa7`
- [x] **S4.5** — Contrato/teste de paridade entre os dois motores financeiros
  (`src/services/financeEngine/` puro × `supabase/functions/finance-engine/`).
  30 testes de paridade (`parity.test.ts`) cobrem os 6 contratos núméricos.
  4 bugs corrigidos no backend: `overallStatus` threshold (`>5→>10`),
  `deviationPercent` quando `planned=0`, `confidenceLevel` forecast (30d/90d),
  `Math.max` vs soma em `calculateGoalProgress` (bug crítico de dupla contagem),
  `progressPercent` cap 100%, filtro `ativo` em `calculateLoanIndicators`,
  suporte a `extraAmortizations` e preferência por `saldo_devedor` quando preenchido.
  Commit: (pendente)

### Sprint S5 — Testes e ferramentas 🟡 (C.1)

> **Pré-requisito:** nenhum. Esforço: Médio.

- [ ] **S5.1** — Consertar Playwright: substituir o import de
  `lovable-agent-playwright-config` (`playwright.config.ts:1`, pacote ausente) por
  config própria de `@playwright/test`; adicionar smoke E2E de login + rotas
  principais; script `test:e2e` no `package.json`.
- [ ] **S5.2** — Tornar `scripts/integration-test.ts` real (assertions de verdade) ou
  renomear como demonstração estática (hoje `:22-26`,`:62-69` afirmam "OK" sem checar).
- [ ] **S5.3** — Aliviar `contextCollector` (`:375-385` baixa 24 meses brutos;
  `:842-852` agrega no cliente): mover agregação para RPC/view mensal.

### Sprint S6 — Documentação e higiene de repositório 🟢 (C.4)

> **Pré-requisito:** nenhum. Esforço: Pequeno/Médio.

- [ ] **S6.1** — README real apontando para `docs/` + passo a passo de execução.
- [ ] **S6.2** — Unificar `AGENTS.md`≡`CLAUDE.md` (uma fonte + um stub que referencia).
- [ ] **S6.3** — Corrigir doc do provedor de IA: registrar **OpenRouter** (modelos
  `openai/gpt-4o-mini`, `anthropic/claude-haiku-4-5`) + Tavily (`ai-advisor/index.ts:621,796`),
  e atualizar a métrica obsoleta ("contextCollector 852 linhas" → ~1141).
- [ ] **S6.4** — Escolher um gerenciador (Vercel usa npm) e remover lockfiles extras
  (`pnpm-lock.yaml`/`bun.lock`/`bun.lockb`/`deno.lock` conforme decisão).
- [ ] **S6.5** — Documentar no README a fronteira de escopo dos artefatos
  Esdra/PMESP (`public/manual`, `public/checklist-diadasmaes`, `Rotina de trabalho/`).

### Critério de conclusão do Saneamento

Saneamento concluído quando S1–S6 estiverem `[x]`, com: bugs financeiros corrigidos e
testados; `.env` fora do git e segredos auditados; backup operacional + runbook;
produção auditada; `strict` ligado; Playwright funcional com smoke E2E; doc alinhada
ao código. Só então retomar com folga as Fases 2+ (Painel Esdra etc.).

---

## 11. Matriz consolidada de priorização

| # | Plano | Categoria | Prioridade | Esforço | Pré-requisitos |
|---|---|---|---|---|---|
| **S.1** | **Correção dos números financeiros** | **Saneamento** | 🔴 | **Pequeno/Médio** | **— (bloqueante)** |
| **S.2** | **Segurança e segredos** | **Saneamento** | 🔴 | **Médio** | **—** |
| **S.3** | **Backup/DR + auditoria de produção** | **Saneamento** | 🔴 | **Médio** | **Definir storage** |
| **S.4** | **Qualidade de código e tipagem** | **Saneamento** | 🟡 | **Médio** | **S.1** |
| **S.5** | **Testes e ferramentas** | **Saneamento** | 🟡 | **Médio** | **—** |
| **S.6** | **Documentação e higiene de repo** | **Saneamento** | 🟢 | **Pequeno/Médio** | **—** |
| A.1 | Observabilidade e SRE | Plataforma | 🔴 | Médio | — |
| A.2 | Backup e DR | Plataforma | 🔴 | Médio | Definir storage |
| B.1 | Auditoria LGPD | Segurança | 🔴 | Médio | — |
| B.2 | Hardening de Segurança | Segurança | 🔴 | Médio | — |
| D.1 | Onboarding Estruturado | Produto | 🔴 | Grande | D.2 |
| **H.1** | **Painel Empreendedor (Sprints 1-4)** | **Esdra Sistema** | 🔴 | **Grande** | **30d uso Manual** |
| **H.2** | **PIL Esdra + AI Conselheiro (Sprints 5-6)** | **Esdra Sistema** | 🔴 | **Grande** | **H.1 + 60d dados** |
| E.1 | Integração Esdra Cosméticos (financeiro) | Business | 🔴 | Médio | H.1 Sprint 4 |
| A.3 | CI/CD e Deploy Seguro | Plataforma | 🟡 | Médio | Staging |
| A.4 | Gestão de Custos | Plataforma | 🟡 | Pequeno | — |
| C.1 | Cobertura de Testes | Qualidade | 🟡 | Grande | — |
| C.2 | Refatoração Arquitetural | Qualidade | 🟡 | Grande | C.1 parcial |
| D.2 | Importação de Dados Externos | Produto | 🟡 | Grande | — |
| D.3 | Mobilidade (PWA) | Produto | 🟡 | Médio | — |
| E.2 | Fluxo de Caixa Business | Business | 🟡 | Médio | E.1 |
| F.1 | Multi-usuário Family | Família | 🟡 | Grande | Validação Esdra |
| **H.3** | **Conselheiro Proativo + Voz** | **Esdra Sistema** | 🟡 | Médio | H.2 + 60d uso |
| B.3 | Pentest Interno | Segurança | 🟢 | Pequeno | B.2 + Sprint 8 |
| C.3 | Eliminação de Débito Silencioso | Qualidade | 🟢 | Contínuo | — |
| C.4 | Documentação Viva | Qualidade | 🟢 | Médio | — |
| D.4 | Acessibilidade WCAG | Produto | 🟢 | Médio | — |
| D.5 | Internacionalização | Produto | 🟢 | Pequeno | — |
| E.3 | Separação Fiscal PF/MEI | Business | 🟢 | Pequeno | E.1 |
| F.2 | Educação filha | Família | 🟢 | Médio | idade apropriada |
| F.3 | Conselheiro Espiritual Família | Família | 🟢 | Médio | Sprint 10 + F.1 |
| **H.4** | **Multi-marca / Multi-negócio** | **Esdra Sistema** | 🟢 | Grande | Sinal real |
| G.1 | Causal Tracking | Inteligência deferida | 🟢 | Médio | 90d de dados |
| G.2 | Drift Detection | Inteligência deferida | 🟢 | Médio | A.1 |
| G.3 | Laboratório Experimental | Inteligência deferida | 🟢 | Grande | G.2 |

**Total:** 22 planos originais + 4 da Categoria H + 3 deferidos + **6 de Saneamento (Categoria S)** = **35 entradas de backlog**.

---

## 12. Recomendação de sequência

### Fase 0 — Validação operacional Esdra (Maio/2026, 30 dias) ✅ Em curso

Antes mesmo de iniciar Sprint 1 do Painel Empreendedor:

1. **Manual 30 Dias HTML** — em produção em `public/manual/index.html` desde 02/05/2026
2. **Acumular dados reais** — Josemar usa diariamente; Esdra executa em paralelo
3. **Decisão Go/No-Go ao final dos 30 dias** — vale prosseguir para Painel? Ajustar abordagem? Pivotar?

### Fase 1 — Fundação operacional FinanceiroJe (Q2/2026, ~6-8 semanas)

Após Sprints 8-10 do plano complementar (já concluídos em Abril/2026):

1. **A.1 — Observabilidade e SRE** — Em execução. Fundação para todo o resto.
2. **B.1 — Auditoria LGPD** — Não é opcional. Paralela a A.1.
3. **B.2 — Hardening de Segurança** — Fechar portas abertas antes de crescer.
4. **A.2 — Backup e DR** — Proteção contra perda catastrófica.

### Fase 1.5 — Saneamento técnico (bloqueante, Junho/2026) 🆕

> Inserida pela integração do diagnóstico (v1.2). **Precede a Fase 2.** Os bugs de
> número (S.1) ferem o princípio de zero-alucinação e o Go/No-Go do Painel Esdra
> depende de uma base sã. Detalhe em "Roteiro de Saneamento — S1→S6".

- **S.1 — Correção dos números** 🔴 (bloqueante; sem schema)
- **S.2 — Segurança e segredos** 🔴 (paralela a S.1; absorve B.1/B.2 imediatos)
- **S.3 — Backup/DR + auditoria de produção** 🔴 (absorve A.2)
- **S.4 — Qualidade e tipagem** 🟡 · **S.5 — Testes/ferramentas** 🟡 · **S.6 — Doc/higiene** 🟢

Concluído o Saneamento (S1–S6 `[x]`), retomar a Fase 2.

### Fase 2 — Esdra Cosméticos Operacional (Junho-Julho/2026, ~6-8 semanas)

5. **H.1 — Painel Empreendedor (Sprints 1-4)** — Sistema operacional completo. Inicia após mínimo 30 dias de uso do Manual HTML **e após o Saneamento (Fase 1.5)**.
6. **D.2 — Importação de Dados Externos** — Multiplica o volume de dados para todas as camadas de inteligência (paralelo a H.1 se houver banda).

### Fase 3 — Inteligência Esdra + Crescimento (Agosto-Setembro/2026, ~8 semanas)

7. **H.2 — PIL Esdra + AI Conselheiro (Sprints 5-6)** — Realiza o desejo de "consultor permanente do negócio". Inicia após 60 dias de dados no Painel.
8. **E.1 — Integração Esdra Cosméticos (financeiro)** — Aproveita infra do H.1 Sprint 4. DRE, margem, fiscal.
9. **D.1 — Onboarding Estruturado** — Destrava adoção pela Esdra e futuros usuários.
10. **A.3 — CI/CD** — Reduz risco de deploys manuais à medida que o projeto cresce em uso.

### Fase 4 — Maturidade técnica (Q4/2026, ~10-14 semanas)

11. **C.1 — Cobertura de Testes** — Contínuo, iniciado como hábito.
12. **A.4 — Gestão de Custos** — Importante quando o volume de chamadas crescer.
13. **E.2 — Fluxo de Caixa Business** — Aprofundamento do uso profissional.
14. **D.3 — PWA** — Mobilidade para captura via celular.
15. **F.1 — Multi-usuário Family** — Colaboração ativa entre Josemar e Esdra.
16. **H.3 — Conselheiro Proativo + Voz** — Evolução natural do AI Conselheiro depois de 60 dias de uso real.

### Fase 5 — Polimento e diferenciação (Q1-Q2/2027)

17. **C.2 — Refatoração Arquitetural** — Depois que a cobertura de testes permitir.
18. **F.3 — Conselheiro Espiritual Família** — O diferencial único.
19. **E.3, D.4, C.4, B.3** — Polimento.
20. **G.1, G.2, G.3** — Inteligência deferida conforme dados acumulam.

### Fase 6 — Futuro (2027+)

21. **F.2 — Educação filha** — Quando a idade permitir.
22. **D.5 — Internacionalização** — Se surgir necessidade real.
23. **H.4 — Multi-marca / Multi-negócio** — Apenas se sinal real de diversificação aparecer.

---

## Apêndice — Backlog especulativo (Diagnóstico Jun/2026)

> ⚠️ **Especulativo.** Ideias do diagnóstico que **não** estavam no roadmap, mas são
> coerentes com o domínio (finanças família + MEI Esdra + contexto de valores). Avaliar
> **após** o Saneamento. Esforço relativo. Não confundir com backlog aprovado (A–H).

**Eixo Integridade de dados:**
- **I.1 — Ritual de reconciliação de 5 min** (baixo/médio): usuário informa saldo
  observado por conta; app explica a diferença e cria ajuste só após confirmação.
- **I.2 — Detector de contagem dupla entre escopos** (médio): pareia transferências
  pessoal↔família↔negócio para não inflar indicadores.
- **I.3 — Explicação causal de mudanças (diff determinístico)** (médio): "o que mudou
  no score/saldo desde ontem" — transações, reclassificações, impacto numérico.
- **I.4 — Previsão em faixas (mín/provável/máx)** (médio): usa `data_status`/`confidence`
  — aplica zero-alucinação também à apresentação visual.

**Eixo MEI Esdra:**
- **I.5 — Monitor de teto fiscal MEI + simulação de desenquadramento** (baixo/médio):
  faturamento móvel 12m vs. R$ 81.000, alerta em 80/95%, simula migração a Simples.
- **I.6 — Guardrail de retirada (pró-labore) do MEI** (médio): faixa segura de retirada
  por caixa mínimo + obrigações + volatilidade.
- **I.7 — CRM geográfico + roteirizador de entregas** (médio/alto): geocodifica clientes
  e sugere rota semanal otimizada.

**Eixo Valores e perfil:**
- **I.8 — Caixa de Mordomia (dízimo/ofertas first-class)** (médio): deduz percentual da
  receita, protege a parcela, destrava conquistas `semeador`/`mordomo_fiel_3m` (D7-A).
- **I.9 — Orçamento por energia executiva + briefing falado** (baixo/médio): modos
  mínimo/normal/completo, sem push; digest semanal em TTS reusando peças existentes.

**Eixo Resiliência/decisão:**
- **I.10 — Modo de estresse familiar** (médio): simula 30/60/90 dias sem renda, vendas −40%.
- **I.11 — Simulador de quitação de dívidas (avalanche × bola de neve)** (baixo/médio):
  engine calcula, IA explica; card "comprar minha liberdade".
- **I.12 — Diário de decisões financeiras** (baixo): hipótese, alternativas, revisão
  sem julgamento; acopla à telemetria `mirror_hesitation`.
- **I.13 — Plano offline de emergência (exportável/impresso)** (médio): contas
  essenciais, vencimentos, reserva e sequência de ações pré-aprovada.

**Entrada recomendada (pós-saneamento):** I.8 (Mordomia) e I.5 (teto MEI) — esforço
contido, destravam itens já catalogados (D7-A; Esdra) e atendem valor exclusivo do
usuário. I.1 e I.3 são as mais alinhadas ao princípio de integridade de dados.

---

## 13. Histórico de versões

### v1.2 — 20 de Junho de 2026

**Adições (integração do diagnóstico técnico consolidado):**
- Nova seção **Diagnóstico técnico — Junho/2026 (snapshot)** com o estado verificado do repo e a correção do engano "75 erros TS → 0 erros".
- Nova **Categoria S — Saneamento Técnico** (S.1–S.6) na matriz (§11) — total de backlog sobe de 29 para **35 entradas**.
- Novo **Roteiro de Saneamento — sprint a sprint (S1→S6)** com checklists de tarefas (arquivo:linha) até concluir todas as correções/melhorias.
- Nova **Fase 1.5 — Saneamento técnico (bloqueante)** na sequência (§12), antes da Fase 2.
- Novo **Apêndice — Backlog especulativo** com 13 ideias (I.1–I.13) do diagnóstico.

**Origem:** os 6 relatórios do diagnóstico consolidado (resumo executivo, estrutura,
planejamento, próximos passos, correções, ideias) foram **pulverizados** neste plano e
**removidos do repositório** — este documento passa a ser a fonte única.

### v1.1 — 02 de Maio de 2026

**Adições:**
- Nova **Categoria H — Esdra Cosméticos como Sistema** (4 planos: H.1, H.2, H.3, H.4)
- Marco registrado: Manual 30 Dias HTML em produção (`public/manual/index.html`); migrations `manual_30_dias_progresso` e `manual_30_dias_decisoes` aplicadas no Supabase em 02/05/2026
- Referência ao novo documento `PLANO_PAINEL_ESDRA.md` (v2.0) com elaboração técnica completa de H.1 e H.2 (6 sprints)
- Fase 0 (Validação operacional Esdra — 30 dias) adicionada à recomendação de sequência
- Fase 2 expandida para incluir H.1 (Painel Empreendedor)
- Fase 3 expandida para incluir H.2 (PIL Esdra + AI Conselheiro)
- Fase 4 inclui H.3 (Conselheiro Proativo + Voz)
- Fase 6 inclui H.4 (Multi-marca, sob demanda)

**Modificações:**
- E.1 (Integração Esdra Cosméticos) reescopado para "camada financeira-fiscal" apenas, com pré-requisito alterado para "H.1 Sprint 4 concluído"
- Esforço de E.1 reduzido de Grande (10-14d) para Médio (6-8d) — aproveita infra de H.1
- Marca de "Sprints 8-10 concluídos" no mapa do ecossistema (validado em 26/04/2026)

**Total de planos:** subiu de 25 (22 + 3 deferidos) para **29 (22 + 4 H + 3 deferidos)**.

### v1.0 — 19 de Abril de 2026

Versão inicial. Baseada em auditoria do `PLANO_INTELIGENCIA_PESSOAL.md` (v1.3), do repositório pós-Sprint 7 e da elaboração do `PLANO_COMPLEMENTAR_INTELIGENCIA.md` (v1.0).

**Conteúdo:**
- 22 planos principais distribuídos em 6 categorias (Plataforma, Segurança, Qualidade, Produto, Business, Família)
- 3 planos deferidos da inteligência (Categoria G)
- Matriz consolidada de priorização
- Recomendação de sequência em 5 fases

**Próxima revisão:** após conclusão de H.1 Sprint 1 (~junho/2026), ou após primeiro Go/No-Go da Fase 0.
