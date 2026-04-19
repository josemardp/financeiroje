# 🗺️ Planos de Evolução — FinanceiroJe

> **Objetivo deste documento:** servir como backlog estratégico do projeto além da camada de inteligência pessoal. Lista os 22 planos de evolução identificados em auditoria de Abril/2026, organizados por categoria, com descrição sucinta, prioridade, esforço estimado e pré-requisitos.
>
> **Autor:** sessão Claude com Josemar — Abril/2026
> **Versão:** 1.0
> **Status:** backlog aprovado, aguardando elaboração individual
> **Relação com outros documentos:**
> - Complemento estratégico ao `PLANO_INTELIGENCIA_PESSOAL.md` (v1.3) e `PLANO_COMPLEMENTAR_INTELIGENCIA.md` (v1.0)
> - Ordem de execução sugerida: primeiro completar Sprints 8-10 do plano complementar; depois iniciar os planos prioritários listados aqui.

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
10. [Matriz consolidada de priorização](#10-matriz-consolidada-de-priorização)
11. [Recomendação de sequência](#11-recomendação-de-sequência)
12. [Histórico de versões](#12-histórico-de-versões)

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
│   └── PLANO_COMPLEMENTAR_INTELIGENCIA.md (v1.0)    📋 Sprints 8-10 a implementar
│
└── 🏗️ Eixo Evolução do Projeto (este documento)    📋 22 planos em 7 categorias
    ├── A. Plataforma e operação (4 planos)
    ├── B. Segurança e conformidade (3 planos)
    ├── C. Qualidade de código (4 planos)
    ├── D. Produto e usuário (5 planos)
    ├── E. Uso profissional (3 planos)
    ├── F. Colaboração familiar (3 planos)
    └── G. Inteligência deferida (3 planos — vindos do plano complementar)
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

### E.1 — Integração Esdra Cosméticos ↔ FinanceiroJe 🔴

**Descrição:** O escopo `business` existe mas é subutilizado. Plano para: (1) sincronização de vendas do e-commerce (esdracosmeticos.com.br) com transações — cada pedido vira `income` automático; (2) cálculo de margem por produto (custo - preço - frete - impostos); (3) DRE mensal simplificado para MEI; (4) preparação de documentos para declaração anual MEI/SIMPLES; (5) indicadores-chave do negócio (ticket médio, frequência de compra, produtos campeões).

**Motivação:** Transforma o FinanceiroJe em ferramenta real de gestão para o negócio da Esdra — realiza o propósito colaborativo do projeto.

**Esforço:** Grande (10-14 dias)
**Pré-requisitos:** Acesso técnico ao e-commerce da Esdra (API de pedidos ou export CSV regular)
**Prioridade de execução:** Alta estratégica — é o que diferencia o FinanceiroJe de qualquer app genérico de finanças

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

### F.2 — Educação Financeira para Melinda 🟢

**Descrição:** Módulo futuro — quando Melinda tiver 8-10 anos (aproximadamente 2028-2030). "Mesada inteligente" com cofrinho virtual, metas visuais (brinquedo, passeio, doação para a CCB), lições de alocação (regra 70/20/10 — gastar, poupar, doar), quizzes gamificados sobre conceitos básicos (juros, inflação, reserva). Interface própria com linguagem e visuais adequados à idade.

**Motivação:** Educação financeira desde cedo é uma das maiores heranças que um pai pode deixar. O FinanceiroJe tem infra para isso.

**Esforço:** Médio (7-10 dias quando executado)
**Pré-requisitos:** Melinda em idade apropriada
**Prioridade de execução:** Futuro — 2028/2029

---

### F.3 — Conselheiro Espiritual-Financeiro Familiar 🟢

**Descrição:** Expansão natural do Sprint 10 do plano complementar: a IA Conselheira ganha modo "conselho familiar" onde, com autorização explícita de ambos os cônjuges, analisa finanças do casal à luz de princípios cristãos (mordomia, generosidade, provisão, conforto em crise financeira, prioridades bíblicas). Referências ACF curadas para dilemas típicos (endividamento, tensão conjugal por dinheiro, doação versus poupança, investimento versus ajuda a irmãos em necessidade). Uma espécie de "aconselhamento pastoral financeiro" alinhado com o contexto CCB, respeitando a doutrina e a prática da congregação.

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

## 10. Matriz consolidada de priorização

| # | Plano | Categoria | Prioridade | Esforço | Pré-requisitos |
|---|---|---|---|---|---|
| A.1 | Observabilidade e SRE | Plataforma | 🔴 | Médio | — |
| A.2 | Backup e DR | Plataforma | 🔴 | Médio | Definir storage |
| B.1 | Auditoria LGPD | Segurança | 🔴 | Médio | — |
| B.2 | Hardening de Segurança | Segurança | 🔴 | Médio | — |
| D.1 | Onboarding Estruturado | Produto | 🔴 | Grande | D.2 |
| E.1 | Integração Esdra Cosméticos | Business | 🔴 | Grande | Acesso técnico |
| A.3 | CI/CD e Deploy Seguro | Plataforma | 🟡 | Médio | Staging |
| A.4 | Gestão de Custos | Plataforma | 🟡 | Pequeno | — |
| C.1 | Cobertura de Testes | Qualidade | 🟡 | Grande | — |
| C.2 | Refatoração Arquitetural | Qualidade | 🟡 | Grande | C.1 parcial |
| D.2 | Importação de Dados Externos | Produto | 🟡 | Grande | — |
| D.3 | Mobilidade (PWA) | Produto | 🟡 | Médio | — |
| E.2 | Fluxo de Caixa Business | Business | 🟡 | Médio | E.1 |
| F.1 | Multi-usuário Family | Família | 🟡 | Grande | Validação Esdra |
| B.3 | Pentest Interno | Segurança | 🟢 | Pequeno | B.2 + Sprint 8 |
| C.3 | Eliminação de Débito Silencioso | Qualidade | 🟢 | Contínuo | — |
| C.4 | Documentação Viva | Qualidade | 🟢 | Médio | — |
| D.4 | Acessibilidade WCAG | Produto | 🟢 | Médio | — |
| D.5 | Internacionalização | Produto | 🟢 | Pequeno | — |
| E.3 | Separação Fiscal PF/MEI | Business | 🟢 | Pequeno | E.1 |
| F.2 | Educação Melinda | Família | 🟢 | Médio | Melinda 8+ anos |
| F.3 | Conselheiro Espiritual Família | Família | 🟢 | Médio | Sprint 10 + F.1 |
| G.1 | Causal Tracking | Inteligência deferida | 🟢 | Médio | 90d de dados |
| G.2 | Drift Detection | Inteligência deferida | 🟢 | Médio | A.1 |
| G.3 | Laboratório Experimental | Inteligência deferida | 🟢 | Grande | G.2 |

**Total:** 22 planos principais + 3 deferidos = 25 entradas de backlog.

---

## 11. Recomendação de sequência

### Fase 1 — Fundação operacional (Q2/2026, ~6-8 semanas)

Ordem sugerida após conclusão dos Sprints 8-10 do plano complementar:

1. **A.1 — Observabilidade e SRE** — Fundação para todo o resto. Sem isso, os outros planos voam às cegas.
2. **B.1 — Auditoria LGPD** — Não é opcional. Paralela a A.1.
3. **B.2 — Hardening de Segurança** — Fechar portas abertas antes de crescer.
4. **A.2 — Backup e DR** — Proteção contra perda catastrófica.

### Fase 2 — Destravar valor do negócio (Q2-Q3/2026, ~8-12 semanas)

5. **D.2 — Importação de Dados Externos** — Multiplica o volume de dados para todas as camadas de inteligência.
6. **E.1 — Integração Esdra Cosméticos** — Realiza o propósito familiar/colaborativo do projeto.
7. **D.1 — Onboarding Estruturado** — Destrava adoção pela Esdra e futuros usuários.
8. **A.3 — CI/CD** — Reduz risco de deploys manuais à medida que o projeto cresce em uso.

### Fase 3 — Maturidade técnica (Q3-Q4/2026, ~10-14 semanas)

9. **C.1 — Cobertura de Testes** — Contínuo, iniciado como hábito.
10. **A.4 — Gestão de Custos** — Importante quando o volume de chamadas crescer.
11. **E.2 — Fluxo de Caixa Business** — Aprofundamento do uso profissional.
12. **D.3 — PWA** — Mobilidade para captura via celular.
13. **F.1 — Multi-usuário Family** — Colaboração ativa entre Josemar e Esdra.

### Fase 4 — Polimento e diferenciação (Q4/2026 em diante)

14. **C.2 — Refatoração Arquitetural** — Depois que a cobertura de testes permitir.
15. **F.3 — Conselheiro Espiritual Família** — O diferencial único.
16. **E.3, D.4, C.4, B.3** — Polimento.
17. **G.1, G.2, G.3** — Inteligência deferida conforme dados acumulam.

### Fase 5 — Futuro (2027+)

18. **F.2 — Educação Melinda** — Quando a idade permitir.
19. **D.5 — Internacionalização** — Se surgir necessidade real.

---

## 12. Histórico de versões

### v1.0 — 19 de Abril de 2026

Versão inicial. Baseada em auditoria do `PLANO_INTELIGENCIA_PESSOAL.md` (v1.3), do repositório pós-Sprint 7 e da elaboração do `PLANO_COMPLEMENTAR_INTELIGENCIA.md` (v1.0).

**Conteúdo:**
- 22 planos principais distribuídos em 6 categorias (Plataforma, Segurança, Qualidade, Produto, Business, Família)
- 3 planos deferidos da inteligência (Categoria G)
- Matriz consolidada de priorização
- Recomendação de sequência em 5 fases

**Próxima revisão:** após conclusão do Sprint 10 do plano complementar, quando a primeira fase desta lista começar a ser executada.
