# PRD + MVP — FinanceiroJe Sync
### Captura automática de lançamentos financeiros a partir de notificações bancárias
### Versão 2.0 — final corrigida e endurecida

---

| Campo | Valor |
|---|---|
| **Produto** | FinanceiroJe Sync (módulo companion do FinanceiroJe) |
| **Documento** | Product Requirements Document (PRD) + Especificação de MVP |
| **Versão** | 2.0 (substitui a v1.0 de 23/06/2026) |
| **Data** | 23 de junho de 2026 |
| **Autor** | Josemar de Paula |
| **Status** | Aprovado para execução após errata técnica |
| **Stack base** | Android (Kotlin + Jetpack Compose) · Supabase (PostgreSQL + Edge Functions) · PWA React/Vite |
| **Documentos-fonte** | `analise_arquitetura_financeiroje.md` · `PRD_MVP_FinanceiroJe_Sync.md` (v1.0) · `relatorio_analise_PRD_FinanceiroJe_Sync.md` |

---

## Changelog v1.0 → v2.0

Esta versão incorpora a errata técnica resultante da análise crítica. As mudanças são cirúrgicas: corrigem design, fecham contradições internas e endurecem compliance, **sem reescrever a tese nem o roadmap**.

| # | Mudança | Origem | Severidade |
|---|---|---|---|
| C01 | **Deduplicação redesenhada em 3 camadas conceituais** (evento / conteúdo em janela curta / semântica como candidato). Elimina o falso positivo da janela de 7 dias por hash de conteúdo. | Relatório 4.1 | P0 |
| C02 | **Identidade de transação passa a ser o EVENTO de notificação, não o conteúdo.** Introduz `event_key` e idempotência de primeira classe. | Calibração própria + 4.1 | P0 |
| C03 | **`transaction_at TIMESTAMPTZ`** adicionado; `transaction_date` vira coluna gerada. Resolve a contradição com a janela de 5 min. | Relatório 4.2 | P0 |
| C04 | **Timestamps separados:** `device_posted_at`, `server_received_at`, `processed_at`. | Relatório 4.2 | P0 |
| C05 | **Campo `status` na transação** (`active`/`pending_review`/`duplicate_candidate`/`rejected`/`archived`). Necessário para o fluxo de revisão do próprio MVP. | Relatório 5.11 (Problema 3) | P0 |
| C06 | **Correção de FK:** `expected_transaction_id` agora referencia `expected_transactions(id)`. | Relatório 5.11 (Problema 2) | P0 (bug) |
| C07 | **Pipeline de parsing reescrito em 7 etapas explícitas** (classificação → extração → normalização → enriquecimento → IA → decisão → dedup). Regra: regex extrai fatos, alias enriquece, IA só preenche lacunas; match determinístico nunca pula o alias. | Relatório 4.4 | P1 |
| C08 | **RLS movido de "recomendado" para Must inegociável**, com policies de referência. | Relatório 4.5 | P0 |
| C09 | **`raw_extras` por allowlist** (minimização), nunca o bundle cru. | Relatório 4.6 | P1 |
| C10 | **IA na nuvem endurecida:** input minimizado, **validação de schema obrigatória** do JSON de retorno, registro de `prompt_version`, provedor declarado como operador. | Relatório 4.7 | P0/P1 |
| C11 | **Exclusão de conta/dados e política de retenção movidas para Must no MVP** (exigência Play + LGPD). | Relatório 4.8 | P0 |
| C12 | **Checklist de publicação Google Play** adicionado ao MVP, incluindo evitar `QUERY_ALL_PACKAGES`. | Relatório 4.9 | P0/P1 |
| C13 | **Métrica "zero perda" redefinida** como "zero perda após captura pelo listener", com denominadores verificáveis. | Relatório 4.3 | P0 |
| C14 | **Sprint -1 (spike técnico de viabilidade Android)** adicionado antes da Sprint 0. | Relatório 4.10 | P1 |
| C15 | **Cronograma recalibrado:** 8 semanas = protótipo auditável; 10–12 semanas = beta externo confiável. | Relatório 4.10 | P1 |
| C16 | **Tela de status do companion movida de Should para Must** (faz parte do contrato de confiança). | Relatório 5.8 | P1 |
| C17 | **`ai_response_cache` versionado** (PK composta com `parser_version`/`prompt_version`/`schema_version`/`model`). | Relatório 5.11 (Problema 5) | P1 |
| C18 | **Tabelas novas:** `consents`, `devices`, `transaction_audit_log`. | Relatório 5.11, 8.4, 8.5 | P0/P2 |
| C19 | **Idempotência de `/ingest` e `process` como requisito explícito.** | Calibração própria | P0 |
| C20 | **Riscos, testes e checklists ampliados** (falso positivo de dedup, revogação de acesso, conteúdo oculto, matriz de OEMs, teste de RLS e de privacidade). | Relatório 5.13, 12, 13 | P1 |

> **Organização do P0 em dois momentos.** Nem todo P0 acontece no mesmo instante. Esta versão distingue **P0-de-design** (precisa estar certo *antes da primeira linha de código*: C01–C07, C19) de **P0-de-compliance** (precisa estar certo *antes do beta com usuários reais*: C08, C11, C12, C13, C18). Os dois são obrigatórios; o que muda é a ordem, e isso evita paralisia de errata.

---

## Sumário

**PARTE I — PRD**
1. Resumo executivo
2. Problema e oportunidade
3. Visão e proposta de valor
4. Objetivos e métricas
5. Personas
6. Princípios de produto (guardrails)
7. Escopo do produto
8. Requisitos funcionais
9. Requisitos não-funcionais
10. Arquitetura de referência
11. Pipeline de parsing (extração vs. enriquecimento)
12. Estratégia de deduplicação e idempotência
13. Modelo de dados
14. Fluxos de usuário
15. Riscos e mitigações
16. Compliance: LGPD e Google Play
17. Roadmap por fases

**PARTE II — MVP**
18. Definição do MVP
19. Escopo do MVP (in/out)
20. Funcionalidades por componente
21. Backlog priorizado (MoSCoW)
22. Critérios de aceitação (DoR / DoD)
23. Métricas de sucesso e gate
24. Cronograma — Sprint -1 a 6
25. Plano de testes
26. Checklist de prontidão para o beta
27. Backlog pós-MVP

**ANEXOS**
- A. Glossário
- B. Schema SQL de referência (corrigido)
- C. Contratos das Edge Functions (idempotentes)
- D. Catálogo de notificações por banco
- E. Matriz de prioridade das correções (P0/P1/P2)

---
---

# PARTE I — PRD

## 1. Resumo executivo

O **FinanceiroJe** é um PWA de finanças pessoais cujo diferencial é eliminar a digitação manual de lançamentos — a causa número um de abandono de apps de finanças pessoais: o usuário começa motivado, falha em registrar por alguns dias, perde a confiança no saldo e desiste.

O **FinanceiroJe Sync** resolve esse atrito. É um aplicativo Android companion de função única: captura as notificações que os bancos já enviam ao aparelho, encaminha o texto bruto ao backend do FinanceiroJe, e um pipeline de parsing (regras determinísticas com IA como fallback) converte essas notificações em lançamentos estruturados — sem que o usuário digite nada.

A premissa de viabilidade é sólida: **notificações bancárias brasileiras são padronizadas por templates**, o que torna o parsing determinístico capaz de cobrir a maior parte dos casos sem custo de IA. O desafio real não é capturar — é **confiabilidade**: não perder, não duplicar (nem por excesso, nem por falso positivo de deduplicação) e não classificar errado. Esses três fracassos destroem a confiança do usuário, e confiança é o único ativo que importa em um app de finanças.

Esta versão 2.0 endurece exatamente esses pontos. O eixo continua sendo um **MVP focado em confiabilidade** — agora com deduplicação que distingue evento de conteúdo, modelo temporal correto, idempotência explícita, RLS e compliance tratados como requisitos de código, e um spike de viabilidade Android antes de comprometer o cronograma.

---

## 2. Problema e oportunidade

### 2.1. A dor

Para manter um controle financeiro fiel, hoje o usuário precisa, após cada transação, lembrar, abrir o app e digitar valor, descrição, categoria e método — 30 a 60 vezes por mês. Na prática isso não acontece, e qualquer lacuna torna o saldo não confiável, o que faz o usuário parar de usar.

### 2.2. O insight

Os bancos **já notificam** cada movimentação:

> "PIX enviado de R$ 58,90 para João Silva"
> "Compra aprovada no cartão final 1234 no valor de R$ 89,90 em Drogasil"
> "PIX recebido de R$ 850,00"

Essas notificações contêm quase tudo que um lançamento precisa. A oportunidade é **interceptar esse fluxo que já existe** e transformá-lo em dado estruturado automaticamente.

### 2.3. A restrição técnica

PWAs não leem notificações de outros apps, não acessam SMS e não usam `NotificationListenerService`. A captura precisa de um app Android nativo dedicado — o companion. O PWA segue como interface de leitura, revisão e gestão; o companion é apenas o "sensor".

### 2.4. Por que agora

Domínio prévio de React/Supabase/Edge Functions/IA (e Jetpack Compose é conceitualmente equivalente ao React, reduzindo a curva para ~2–3 semanas); custo de IA desprezível com cache + regras determinísticas; infraestrutura Supabase já em uso no ecossistema.

---

## 3. Visão e proposta de valor

### 3.1. Visão

> **"O usuário nunca mais digita um lançamento. Ele abre o FinanceiroJe e o dinheiro já está contado — com precisão em que ele confia."**

### 3.2. Proposta de valor

| Para | Que sofre com | O FinanceiroJe Sync | Diferente de |
|---|---|---|---|
| Pessoas que querem controle financeiro real | O atrito de registrar tudo manualmente | Registra automaticamente a partir das notificações que o banco já envia | Apps que exigem digitação manual ou Open Finance com cobertura parcial |

### 3.3. O que torna isto defensável

1. **Confiabilidade projetada desde o design** (idempotência de evento, deduplicação em camadas que não gera falso positivo, auditoria).
2. **Aprendizado por usuário** (merchant aliases personalizados): mais preciso e mais barato com o uso.
3. **Arquitetura preparada para migrar** de notificações → Accessibility → Open Finance sem reescrever o núcleo.

---

## 4. Objetivos e métricas

### 4.1. North Star Metric

> **% de transações do usuário capturadas automaticamente e confirmadas como corretas, sem edição manual.**

Captura simultaneamente cobertura, precisão e valor percebido.

### 4.2. Métricas com denominador verificável (C13)

O "zero perda" foi redefinido porque "notificações emitidas pelo banco" **não são observáveis pelo app**. Existem quatro eventos distintos, e o companion só controla com segurança do evento 3 em diante:

1. Banco emite a notificação.
2. Android posta a notificação.
3. `NotificationListenerService` recebe a notificação.
4. Companion persiste localmente e envia ao backend.

**Definição operacional de zero perda:**

> *100% das notificações recebidas pelo NotificationListenerService e aprovadas pelo filtro local são persistidas em Room antes de qualquer envio.*

| Métrica | Fórmula | Meta MVP | Meta Produção |
|---|---|---|---|
| Taxa de persistência local | itens Room criados / eventos recebidos pelo listener | 100% | 100% |
| Taxa de entrega ao backend | itens `sent` / itens persistidos em Room | ≥ 99% | ≥ 99,9% |
| Taxa de processamento | itens processados / itens recebidos na inbox | 100% | 100% |
| Taxa de parsing correto | transações sem correção / total | > 80% | > 92% |
| Taxa de duplicação real | duplicatas confirmadas / total | < 5% | < 1% |
| **Falso positivo de dedup** | compras legítimas bloqueadas como duplicata / total | **~0%** | **0%** |
| Taxa de revisão | itens editados ou rejeitados / transações automáticas | < 20% | < 8% |
| Custo de IA por usuário/mês | Σ tokens × preço | < R$ 0,10 | < R$ 0,05 |
| Retenção D30 | usuários ativos após 30 dias | 10 betas ativos | curva D30 > 40% |

### 4.3. Anti-metas

Não perseguir: número de bancos suportados, número de features, automação total sem confirmação.

---

## 5. Personas

### 5.1. Primária — "O organizador exausto de planilha"
Já desistiu de planilha/app pela manutenção manual; múltiplos bancos e meios de pagamento; quer ver saldo e categorização sem trabalho diário; tolera revisar ocasionalmente, **não tolera** saldo errado, transação duplicada **nem transação sumida por falso positivo de dedup**; Android como aparelho principal.

### 5.2. Secundária — "O casal que divide finanças"
Dois usuários, contas isoladas no MVP; visão compartilhada é futuro.

### 5.3. Não-persona
Empresas/PJ com conciliação contábil formal; usuários iOS para captura por notificação (inviável na plataforma).

---

## 6. Princípios de produto (guardrails)

Vencem qualquer decisão de feature. Servem para os agentes de código e para o fundador resistirem à complexidade.

1. **Nunca perder um dado.** Toda notificação capturada é persistida localmente antes de qualquer envio.
2. **A inbox é a fonte da verdade bruta.** Transações derivam da inbox; nunca se grava direto na tabela financeira.
3. **Identidade é evento, não conteúdo.** Duas notificações de conteúdo idêntico em dias diferentes são transações legítimas distintas. Só o mesmo *evento* físico é duplicata. *(novo, C02)*
4. **Nunca apagar; sempre marcar.** Duplicatas recebem `duplicate_of` + auditoria. Dedup semântica gera **candidato a revisão**, não descarte automático. *(reforçado, C01)*
5. **IA é fallback, não caminho principal.** Determinístico primeiro; IA só nos casos ambíguos; correção do usuário tem prioridade. Todo retorno de IA é **validado por schema**. *(reforçado, C10)*
6. **Privacidade by design.** Notificações não-financeiras são filtradas e descartadas localmente. `raw_extras` por allowlist. Dado financeiro é dado sensível (LGPD).
7. **Transparência total.** O usuário vê o que foi capturado, como foi interpretado, com que confiança, e pode revisar/rejeitar/pausar.
8. **Confiança > cobertura > features.** Melhor 5 bancos com 95% de precisão do que 15 com 70%.
9. **Idempotência em toda a cadeia.** O mesmo evento nunca vira duas transações, mesmo com reenvio ou reprocessamento. *(novo, C19)*

---

## 7. Escopo do produto

### 7.1. In scope (todas as fases)
Companion Android que captura notificações; fila local resiliente (offline-first); pipeline ingestão → inbox → parsing → transação; parser determinístico + fallback de IA + cache versionado; aprendizado por usuário; deduplicação em camadas + idempotência; autenticação segura compartilhada com o PWA; revisão/edição/auditoria no PWA; consentimento e exclusão de dados; (futuro) conciliação, OFX, CSV, SMS, Open Finance.

### 7.2. Out of scope (produto inteiro)
Intermediação financeira de qualquer tipo; análise de crédito/score; captura por notificação no iOS; compartilhamento multiusuário no MVP. **O produto é estritamente um gestor pessoal de finanças.**

### 7.3. Não-objetivos
Não substituir o app do banco; não garantir 100% de cobertura; não categorizar "perfeitamente" sem o usuário.

---

## 8. Requisitos funcionais

Notação: **"Como [persona], quero [ação], para [valor]"**, com **critérios de aceitação (CA)** verificáveis. Prioridade MoSCoW na Parte II.

### ÉPICO E1 — Captura de notificações (Android Companion)

**E1-US1** — *Conceder acesso a notificações com explicação prévia.* `[M]`
- CA1: Disclosure in-app **antes** de pedir o acesso, com texto específico (ver C12/§16.2).
- CA2: Direciona à tela de acesso a notificações do Android.
- CA3: Detecta estado ativo/inativo e registra em `devices.notification_access_granted`.
- CA4: Se o acesso for revogado, sinaliza e orienta a reativar.

**E1-US2** — *Escolher quais apps bancários monitorar.* `[M]`
- CA1: Lista fechada de apps suportados (Anexo D) com toggle por app. **Não usar `QUERY_ALL_PACKAGES`.**
- CA2: Notificações de apps não selecionados são ignoradas e nunca persistidas.
- CA3: Padrão seguro: nenhum app não-financeiro monitorável.

**E1-US3** — *Capturar e persistir localmente antes de qualquer envio.* `[M]`
- CA1: Notificação de app monitorado é gravada em Room **imediatamente**, com status `pending`.
- CA2: A fonte é identificada por `sbn.packageName` do sistema — **nunca** pelo conteúdo (anti-spoofing).
- CA3: A captura registra a **chave de evento** (`notification_key`, `post_time`, `device_installation_id`) para idempotência.
- CA4: Notificações de apps não monitorados são descartadas sem persistência.
- CA5: A captura sobrevive a reinício do serviço pelo sistema sem perder itens já persistidos.

**E1-US4** — *Enviar ao backend com idempotência e retry resiliente.* `[M]`
- CA1: Envio via WorkManager; item só marcado `sent` após confirmação HTTP.
- CA2: Falha de rede → backoff exponencial; item permanece `pending`.
- CA3: Cache local de `event_key` (24–48h) evita reenvio do mesmo evento.
- CA4: Reenvio do mesmo evento é **idempotente** no servidor (não cria duplicata).
- CA5: Limite de tentativas e estado `failed` visível, sem descarte silencioso.

**E1-US5** — *Ver no companion o que foi capturado e o status.* `[M]` *(promovido de Should, C16)*
- CA1: Lista de capturas recentes com status (`pending`/`sent`/`failed`).
- CA2: Contagem de pendentes visível.
- CA3: Indicador claro de "captura ativa" / "captura pausada".

**E1-US6** — *Pausar/desativar a captura a qualquer momento.* `[M]` *(novo — exigência Play, C12)*
- CA1: Botão de pausa/retomada na interface do companion.
- CA2: Pausar interrompe a captura sem desinstalar nem perder dados já capturados.

### ÉPICO E2 — Ingestão e Inbox

**E2-US1** — *Receber a notificação numa Edge Function idempotente que valida e responde rápido.* `[M]`
- CA1: `POST /ingest` autentica o usuário (token válido) e valida o payload (com tamanho máximo).
- CA2: **Idempotência de evento:** UPSERT por (`user_id`, `event_key`). Evento já ingerido → 200 `already_ingested`, sem criar nada.
- CA3: Evento novo → grava em `notification_inbox`, responde 202.
- CA4: Payload inválido → 422 com erro claro; não cria lixo.

**E2-US2** — *Guardar o dado bruto íntegro, com allowlist de extras.* `[M]`
- CA1: Armazena `raw_title`, `raw_body`, `source_app`, timestamps separados (`device_posted_at`, `server_received_at`).
- CA2: `raw_extras` contém **apenas** campos da allowlist (C09); nunca o bundle cru, ícones, remote inputs ou conteúdo de outras notificações.
- CA3: Campos de processamento (`processed`, `processing_attempts`, `last_error`, `parser_type`, `parser_version`, `ai_*`) permitem rastrear e reprocessar.

### ÉPICO E3 — Parsing (ver pipeline completo no §11)

**E3-US1** — *Classificar se é transação financeira.* `[M]`
- CA1: Etapa de classificação separa transação financeira de não-financeira (saldo/resumo, segurança, promoção).
- CA2: Não-financeira é marcada e **não** gera transação.

**E3-US2** — *Extrair os fatos por regra determinística.* `[M]`
- CA1: Regex cobre PIX enviado/recebido, compra débito/crédito, transferência, boleto, salário (Anexo D).
- CA2: Extrai `type`, `amount`, `merchant`, método bruto e `device_posted_at`; normalização robusta de valor BRL (`R$ 1.234,56`).
- CA3: `parser_type = 'deterministic'`, `parser_version` registrados.

**E3-US3** — *Enriquecer com alias do usuário antes de IA.* `[M]`
- CA1: Match determinístico **não pula** o enriquecimento: o alias define `category`/`payment_method` quando existir (C07).
- CA2: Ordem: **classificação → extração → normalização → enriquecimento (alias) → fallback IA → decisão → dedup**.

**E3-US4** — *Acionar IA só para lacunas/ambiguidade, com validação de schema.* `[M]`
- CA1: Sem resolução determinística/alias → modelo barato com prompt enxuto, **input minimizado** (só `source_app`+`title`+`body`, sem `raw_extras`).
- CA2: Retorno **validado por JSON schema**; retorno inválido → item vai para `pending_review`, nunca cria transação a partir de output não confiável.
- CA3: Se a IA indicar que **não** é transação, nenhuma transação é criada.
- CA4: `parser_type='ai'`, `ai_model`, `ai_prompt_version`, `ai_tokens_used` registrados.

**E3-US5** — *Cachear respostas da IA por padrão normalizado e versionado.* `[S]`
- CA1: Normaliza o texto (placeholders de valor/data/hora/número) e calcula hash.
- CA2: Cache por estrutura, com chave versionada (`parser_version`/`prompt_version`/`schema_version`/`model`) (C17); TTL.

### ÉPICO E4 — Transações e revisão

**E4-US1** — *Criar a transação após o parsing, com rastreabilidade e tempo correto.* `[M]`
- CA1: `transactions` recebe `source='notification'`, `source_notification_id`, `confidence_score`, `parser_version`, **`transaction_at TIMESTAMPTZ`** (C03).
- CA2: Só cria se for transação financeira.
- CA3: Antes de "ativar" no saldo, passa pela deduplicação (§12).

**E4-US2** — *Ver transações com selo "automático", confiança e status.* `[M]`
- CA1: Lista exibe badge "automático" e o `status` (`active`/`pending_review`/`duplicate_candidate`).
- CA2: Baixa confiança e candidatos a duplicata são destacados.
- CA3: É possível abrir a transação e ver a notificação bruta de origem.

**E4-US3** — *Editar a transação e ensinar o sistema.* `[M]`
- CA1: Edita `category`, `description`, `payment_method`, `amount`, `type`, `transaction_at`.
- CA2: Ao editar categoria de um estabelecimento, oferece criar/atualizar o **merchant alias**.
- CA3: A edição é registrada em `transaction_audit_log`; histórico bruto na inbox é preservado.

**E4-US4** — *Resolver candidatos a duplicata.* `[M]` *(promovido — núcleo de confiança)*
- CA1: Itens `duplicate_candidate` aparecem em fila de revisão.
- CA2: Usuário confirma "é duplicata" (transação derivada vira `rejected`, auditoria mantida) ou "não é" (vira `active`).
- CA3: Nada é apagado em nenhum dos caminhos.

### ÉPICO E5 — Aprendizado por usuário

**E5-US1** — *Registrar a correção como alias por usuário.* `[M]`
- CA1: `merchant_aliases` único por (`user_id`, `normalized_merchant_name`).
- CA2: `manually_corrected=true` quando origem é correção; `usage_count` incrementa a cada reuso.
- CA3: Categorias são por usuário.

**E5-US2** — *Aplicar o alias automaticamente nas próximas capturas.* `[M]`
- CA1: Mesmo estabelecimento → usa alias sem IA.
- CA2: Alias do usuário sempre vence a categoria sugerida por IA.

### ÉPICO E6 — Deduplicação e idempotência (ver §12)

**E6-US1** — *Deduplicar sem falso positivo, em camadas, sem apagar.* `[M]`
- CA1: **Camada 0 (idempotência de evento):** mesmo `event_key` nunca é processado duas vezes (companion + ingest).
- CA2: **Camada 1 (conteúdo em janela curtíssima, 1–10 min):** notificações redundantes do mesmo evento real (push + persistente + app do cartão) são agrupadas.
- CA3: **Camada 2 (semântica, candidato):** mesmo valor + descrição similar + janela curta → `duplicate_candidate` para revisão, **nunca** descarte automático (exceto confiança > 0,95 após período de aprendizado).
- CA4: **Compras legítimas recorrentes idênticas em dias diferentes NÃO são bloqueadas** (teste negativo obrigatório, §25).
- CA5: Nada é apagado; `duplicate_of` + `dedup_reason` + auditoria.

### ÉPICO E7 — Autenticação e segurança

**E7-US1** — *Login no companion com a conta do PWA, seguro.* `[M]`
- CA1: Supabase Auth com OAuth 2.0 / PKCE.
- CA2: Refresh tokens no Android Keystore; nenhum token estático no APK.

**E7-US2** — *Recusar payloads não autenticados e limitar abuso.* `[M]`
- CA1: `/ingest` exige token; sem token → 401.
- CA2: Rate limiting mínimo por usuário; payload com tamanho máximo.
- CA3: Fonte avaliada pelo `packageName` do sistema (anti-spoofing).

**E7-US3** — *Proteger dados em trânsito e repouso; isolar por usuário.* `[M]`
- CA1: TLS em todo o tráfego; Keystore no aparelho.
- CA2: **RLS habilitado em todas as tabelas com `user_id` antes de qualquer beta** (C08). Nenhuma tabela financeira acessível por `anon` sem policy restritiva.
- CA3: Logs **sem** conteúdo financeiro bruto.

### ÉPICO E8 — Consentimento, exclusão e auditoria

**E8-US1** — *Consentir de forma explícita e granular (LGPD).* `[M]`
- CA1: Consentimento específico por finalidade (`notification_capture`, `financial_data_processing`, `ai_processing`), registrado em `consents` com `policy_version`.
- CA2: Política de privacidade do companion em **URL pública** (não PDF).

**E8-US2** — *Acessar, corrigir e excluir meus dados.* `[M]` *(promovido de Should, C11)*
- CA1: Exclusão de conta + dados associados, dentro e fora do app.
- CA2: Exportação/acesso aos dados.
- CA3: Retenção limitada do dado bruto (expurgo/anonimização após janela — §16.1).

**E8-US3** — *Painel técnico mínimo de qualidade (para o fundador).* `[C]`
- CA1: Métricas: determinístico vs IA, taxa de correção, duplicação real, falso positivo de dedup, itens não parseados.
- CA2: Lista de notificações não parseadas para melhorar regras.

---

## 9. Requisitos não-funcionais

| Categoria | Requisito |
|---|---|
| **Confiabilidade** | Zero perda após captura pelo listener; persistência local antes do envio; idempotência de evento; inbox auditável. |
| **Latência** | `/ingest` < 1s P95. Parsing pode ser assíncrono em produção. |
| **Precisão** | > 80% no MVP, com **falso positivo de dedup ~0%**; sobe com aliases e cache. |
| **Segurança** | TLS; Keystore; OAuth/PKCE; anti-spoofing; **RLS Must**; rate limit; payload máximo; sem credenciais no APK; logs sem raw financeiro. |
| **Privacidade / LGPD** | Consentimento granular registrado; finalidade específica; `raw_extras` por allowlist; retenção mínima; direitos do titular (acesso/correção/**exclusão Must**); filtragem local de não-financeiras; IA com input minimizado e provedor declarado. |
| **Escalabilidade** | Desacoplar ingestão de processamento (`pgmq`/`pg_cron`) a partir do volume; cache de IA versionado. Viável a 10k+ usuários. |
| **Custo** | IA como fallback + cache mantém custo irrelevante. |
| **Observabilidade** | Logs de processamento, tentativas, erros por notificação; em produção, monitoramento de erros e de qualidade. |
| **Compatibilidade Android** | Suportar Background Execution Limits, Doze, App Standby; recuperar-se de reinícios; lidar com variação de OEM. |
| **Compliance de loja** | Checklist Play (§16.2) tratado como parte do MVP. |

---

## 10. Arquitetura de referência

### 10.1. Diagrama de componentes

```
┌──────────────────────────────────────────────────────────────┐
│  APARELHO ANDROID                                            │
│  [Apps bancários] ──notificações──▶ NotificationListener     │
│                                          │                   │
│                                   Filtro (apps monitorados)  │
│                                          │                   │
│                                   Room DB (fila local)       │
│                                   + event_key (idempotência) │
│                                   status: pending/sent/failed│
│                                          │                   │
│                                   WorkManager (retry/backoff)│
└──────────────────────────────────────────┼──────────────────┘
                                            │ HTTPS + token (PKCE)
                                            ▼
┌──────────────────────────────────────────────────────────────┐
│  SUPABASE                                                    │
│  Edge Function: INGEST (idempotente)                        │
│    valida → UPSERT por (user_id, event_key) → inbox         │
│    202 (novo) | 200 already_ingested (repetido)            │
│                         │ (produção: enfileira em pgmq)      │
│                         ▼                                    │
│  Worker / Edge Function: PROCESS                            │
│    classificação → extração → normalização →                │
│    enriquecimento (alias) → IA (validada) → decisão → dedup │
│    cria transactions (transaction_at, status, confidence)  │
│                         │                                    │
│  PostgreSQL (RLS em tudo): notification_inbox · transactions│
│    · merchant_aliases · ai_response_cache · consents ·      │
│    devices · transaction_audit_log · (expected_transactions)│
│                         │                                    │
│  Edge Function: API (leitura) ◀──── PWA React/Vite          │
└──────────────────────────────────────────────────────────────┘
                                            ▲
                                  [PWA FinanceiroJe no navegador]
                                  revisão · edição · auditoria · exclusão
```

### 10.2. Stack tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Companion | **Kotlin + Jetpack Compose** | Acesso nativo a NLS, Keystore, WorkManager; Compose ≈ React. **Não usar Flutter.** |
| Persistência local | **Room + WorkManager** | Fila offline-first com retry; `event_key` local. |
| Backend | **Supabase Edge Functions** | Ingestão idempotente e processamento serverless. |
| Banco | **PostgreSQL (Supabase) com RLS** | Inbox, transações, aliases, cache, consentimento, dispositivos. Escala: `pgmq` + `pg_cron`. |
| IA | **Modelo barato (GPT-4o-mini / Gemini Flash)** | Fallback; saída só-JSON validada por schema. |
| Frontend | **React + Vite (PWA existente)** | Revisão/gestão. |
| Auth | **Supabase Auth (OAuth/PKCE)** | Sessão compartilhada companion ↔ PWA. |

---

## 11. Pipeline de parsing (extração vs. enriquecimento) — C07

A v1.0 era ambígua: em um ponto dizia "determinístico → cria transação", em outro "determinístico → alias → cache → IA". A v2.0 define etapas explícitas. **Regra-mãe: a regra determinística extrai fatos; o alias enriquece; a IA só preenche lacunas. Match determinístico nunca pula o alias.**

```
notificação bruta (da inbox)
   │
   ├─ 1. CLASSIFICAÇÃO ........ é transação financeira? (senão → marca não-financeira, fim)
   │
   ├─ 2. EXTRAÇÃO FACTUAL ..... regex extrai: type, amount, merchant, método bruto, device_posted_at
   │
   ├─ 3. NORMALIZAÇÃO ......... merchant normalizado, valor decimal BRL, type padronizado
   │
   ├─ 4. ENRIQUECIMENTO ....... alias do usuário define category + payment_method (custo R$ 0)
   │
   ├─ 5. FALLBACK DE IA ....... só campos não resolvidos / texto ambíguo
   │        input minimizado · retorno VALIDADO por schema · senão → pending_review
   │
   ├─ 6. DECISÃO .............. cria transação | envia para revisão | marca não-financeira
   │
   └─ 7. DEDUPLICAÇÃO ......... antes de ativar saldo (§12): event → conteúdo curto → semântico
```

**Exemplo:**
```
Regex extrai:   expense, R$ 89,90, merchant=Drogasil
Normaliza:      merchant="drogasil"
Alias aplica:   category=Saúde, payment_method=credit_card
IA:             não é chamada
Dedup:          sem evento/conteúdo/semântico igual → cria transação (status=active)
```

Cobertura-alvo por camada (referência): determinístico ~70%, alias ~10%, cache de IA ~15% (hit), IA na nuvem ~5%.

---

## 12. Estratégia de deduplicação e idempotência — C01, C02, C19

Este é o ponto mais sensível do produto. **Falso positivo de deduplicação é tão destrutivo quanto a duplicação.** O erro da v1.0 era usar hash de conteúdo com janela de 7 dias: "café R$ 5,00 todo dia na mesma padaria" gera `title`+`body` idênticos e o segundo seria descartado — sumindo com o saldo do usuário.

A v2.0 separa **identidade de evento** de **semelhança de conteúdo**, em três camadas:

### Camada 0 — Idempotência de evento (companion + `/ingest`)
- **Chave:** `event_key = SHA-256(device_installation_id | notification_key | post_time_epoch)`.
- **Garante:** o mesmo evento físico nunca vira duas transações, mesmo com reenvio do WorkManager ou reprocessamento da inbox.
- **Janela:** permanente (é a identidade do evento, não uma heurística temporal).
- **Companion:** cache local de `event_key` (24–48h) evita reenvio.
- **Servidor:** `/ingest` faz UPSERT por (`user_id`, `event_key`); repetido → 200 `already_ingested`.

### Camada 1 — Conteúdo idêntico em janela curtíssima (1–10 min)
- **Alvo:** a "tempestade" de notificações do **mesmo** evento real (push + notificação persistente de resumo + app do cartão virtual).
- **Regra:** hash de conteúdo **só** vale dentro de 1–10 minutos. Fora dessa janela, conteúdo igual é transação legítima.
- **Resultado:** marca a redundante como `duplicate_of` com `dedup_reason='content_short_window'`.

### Camada 2 — Semântica de transação (candidato, não descarte)
- **Regra:** mesmo `user_id` + mesmo `amount` + descrição similar (fuzzy) + janela curta (ex.: 10–15 min) → cria/transição para `status='duplicate_candidate'`.
- **Resultado:** vai para a **fila de revisão** do usuário. Só vira descarte automático com `confidence > 0,95` **e** após 30 dias de aprendizado.

### Regra de ouro
> **Nunca apagar. Marcar `duplicate_of` + `dedup_reason` + auditoria.** O critério de identidade é o **evento**; conteúdo idêntico em momentos distintos é transação real.

### Teste negativo obrigatório
Compras legítimas recorrentes idênticas (mesmo valor, mesmo estabelecimento, dias diferentes) **devem** gerar transações distintas. Coberto na suíte (§25).

---

## 13. Modelo de dados

Visão de alto nível. DDL completo e corrigido no **Anexo B** (com RLS).

| Tabela | Papel | Mudanças v2.0 |
|---|---|---|
| `notification_inbox` | Verdade bruta | `event_key` (idempotência), `device_posted_at`/`server_received_at`/`processed_at`, `raw_extras` por allowlist, `dedup_reason`, `parser_version`, `ai_prompt_version`, `UNIQUE(user_id,event_key)` |
| `transactions` | Lançamentos derivados | **`transaction_at TIMESTAMPTZ`** + `transaction_date` gerada; **`status`**; FK `expected_transaction_id` corrigida |
| `merchant_aliases` | Aprendizado por usuário | inalterada (único por usuário) |
| `ai_response_cache` | Custo/latência | **versionado** (PK composta) |
| `consents` | Consentimento granular | **nova** |
| `devices` | Dispositivos/instalações | **nova** (suporta `event_key`) |
| `transaction_audit_log` | Auditoria de edição | **nova** |
| `expected_transactions` | Conciliação (pós-MVP) | inalterada |

Relacionamentos essenciais: `transactions.source_notification_id → notification_inbox.id`; `notification_inbox.duplicate_of → notification_inbox.id`; tudo isolado por `user_id` com **RLS**.

---

## 14. Fluxos de usuário

### 14.1. Onboarding (companion)
Instala → tela de finalidade + **consentimento granular** (registrado em `consents`) → login PKCE → solicita acesso a notificações (com disclosure prévio) → seleciona apps bancários (lista fechada) → estado "ativo".

### 14.2. Captura → transação (caminho feliz)
Banco notifica → companion filtra, grava em Room (`pending`) com `event_key` → WorkManager envia ao `/ingest` (idempotente) → inbox → `process` roda o pipeline de 7 etapas → dedup → cria `transaction` (`source=notification`, `transaction_at`, `status=active`, `confidence`) → PWA mostra com badge "automático".

### 14.3. Correção e aprendizado
Usuário muda "Drogasil → Saúde" → sistema oferece criar/atualizar alias → registra em `transaction_audit_log` → próximas compras já vêm "Saúde", sem IA.

### 14.4. Revisão de duplicata
Banco + sistema notificam a mesma compra → Camada 1/2 marca a redundante → item aparece como `duplicate_candidate` → usuário confirma → derivada vira `rejected`, auditoria mantida.

### 14.5. Exclusão de dados (novo)
Usuário pede exclusão (no app ou fora) → conta + dados associados removidos; raw já expurgado conforme retenção.

---

## 15. Riscos e mitigações

| # | Risco | Categoria | Prob. | Impacto | Mitigação |
|---|---|---|---|---|---|
| R1 | Duplicação de transações | Produto/UX | Alta | Crítico | Dedup em camadas; nunca apagar; revisão |
| R2 | **Falso positivo de dedup** (compra recorrente bloqueada) | Produto/UX | Média | **Crítico** | Identidade por evento, não conteúdo; janela curta para conteúdo; teste negativo *(novo, C01)* |
| R3 | Perda de notificações (offline, app morto) | Técnico | Alta | Crítico | Persistência local imediata; WorkManager; inbox auditável |
| R4 | Android mata o serviço (Doze/OEM) | Técnico | Alta | Alto | Recuperação após reinício; orientação de bateria; **spike Sprint -1** |
| R5 | **Revogação silenciosa do acesso a notificações** | Técnico/UX | Média | Alto | Detectar e sinalizar estado; registrar em `devices` *(novo)* |
| R6 | **Conteúdo de notificação ocultado pelo Android** (lockscreen sensível) | Técnico | Média | Médio | Documentar limitação; orientar configuração; fallback futuro (SMS) *(novo)* |
| R7 | Rejeição na Play Store (NLS) | Negócio | Média | Alto | Checklist §16.2; disclosure; sem `QUERY_ALL_PACKAGES`; Data Safety |
| R8 | Classificação errada | Produto | Média | Médio | Correção com aprendizado; confiança exibida; revisão |
| R9 | Notificações falsas/spoofing | Segurança | Baixa | Alto | `packageName` do sistema; auth obrigatória |
| R10 | Vazamento de dado sensível | Segurança/Legal | Baixa | Crítico | TLS, Keystore, **RLS**, retenção mínima, allowlist, logs sem raw |
| R11 | **Provedor de IA como operador de dados** | Legal | Média | Médio | Input minimizado; provedor declarado; política de retenção do provedor *(novo, C10)* |
| R12 | **Output de IA não confiável / prompt injection** | Técnico/Segurança | Baixa | Médio | **Validação por schema**; texto da notificação tratado como não confiável *(novo, C10)* |
| R13 | Custo de IA fora de controle | Negócio | Baixa | Médio | Determinístico + cache + alias |
| R14 | Variação de templates entre bancos/versões | Técnico | Média | Médio | Golden files; fallback IA; melhoria contínua |
| R15 | Virar "intermediário" (regulatório) | Legal | Baixa | Crítico | Estritamente gestor pessoal |

---

## 16. Compliance: LGPD e Google Play

### 16.1. LGPD (Lei 13.709/2018)
- **Base legal:** consentimento explícito (registrado em `consents`).
- **Finalidade específica:** exclusivamente gestão financeira pessoal.
- **Minimização:** `raw_extras` por allowlist; IA com input minimizado.
- **Retenção:**

| Dado | Retenção |
|---|---|
| Transação estruturada | enquanto a conta existir |
| Notificação bruta (`raw_*`) | janela limitada (90–180 dias), depois expurgo/anonimização |
| Logs técnicos | curto prazo, sem conteúdo financeiro bruto |
| Cache de IA | TTL, sem identificação direta |
| Dados de conta excluída | exclusão, salvo retenção justificada e informada |

- **Direitos do titular:** acesso, correção e **exclusão (Must)**.
- **Operadores:** provedor de IA declarado como operador/suboperador.
- **DPO:** avaliar conforme volume de titulares.

### 16.2. Checklist de publicação Google Play (parte do MVP) — C12
- [ ] Disclosure in-app **antes** de pedir acesso a notificações.
- [ ] Texto específico: *"o app coleta notificações dos apps bancários selecionados para gerar lançamentos financeiros automáticos"*.
- [ ] Consentimento afirmativo e **permissão revogável** (pausa/desativação — E1-US6).
- [ ] Tela de apps monitorados (lista fechada).
- [ ] Política de privacidade em **URL pública** (não PDF).
- [ ] Seção **Data Safety** preenchida coerentemente.
- [ ] **Exclusão de conta** dentro e fora do app.
- [ ] **Evitar `QUERY_ALL_PACKAGES`**; usar lista fechada de pacotes bancários.
- [ ] Sem SDKs de analytics invasivos.
- [ ] **Logs sem conteúdo financeiro bruto.**

### 16.3. Banco Central / Open Finance (futuro)
Integração exige certificação/participação (ou intermediário). **Manter-se como gestor pessoal**, nunca intermediário, para não cair na regulação de fintechs.

---

## 17. Roadmap por fases

| Fase | Entrega | Observação |
|---|---|---|
| **Fase 1** | Pipeline base: ingestão manual + Edge Function + IA + banco | Prova do parsing |
| **Fase 2 (MVP)** | Companion + ingestão idempotente + parsing híbrido + PWA de revisão + compliance mínimo | **Foco deste documento** |
| **Fase 3** | Leitura de SMS (fallback) | Cobertura adicional |
| **Fase 4** | Importação OFX | Dados oficiais |
| **Fase 5** | Importação CSV | Compatibilidade ampla |
| **Fase 6** | Open Finance | Dados oficiais; maior cobertura |

---
---

# PARTE II — MVP

## 18. Definição do MVP

### 18.1. Objetivo
Validar, com usuários reais, que é possível **capturar transações automaticamente a partir de notificações, com confiabilidade suficiente para o usuário confiar no saldo** — sem perder, sem duplicar, **sem falso positivo de dedup** e sem errar a categoria com frequência.

### 18.2. Hipótese central
> *"Se capturarmos automaticamente as notificações bancárias e as transformarmos em lançamentos com > 80% de precisão, < 5% de duplicação real, ~0% de falso positivo de dedup e zero perda após captura, então usuários reais manterão o uso por 30 dias e confiarão no app como fonte do seu controle financeiro."*

### 18.3. Filosofia
**Confiabilidade, não features.** O MVP abre mão de conciliação, OFX, CSV, SMS e cache avançado para concentrar esforço em: não perder, não duplicar (nos dois sentidos), parsear bem, ser auditável e estar em conformidade mínima.

---

## 19. Escopo do MVP

### 19.1. ✅ Incluído

**Companion Android (Kotlin + Compose):** NLS capturando apps monitorados (lista fechada); login PKCE com tokens no Keystore; fila Room + WorkManager (offline-first, retry, `event_key`); envio idempotente ao `/ingest`; tela de status (Must); pausa/desativação (Must).

**Edge Function `ingest` (idempotente):** auth + validação + tamanho máximo; UPSERT por `event_key`; grava na inbox com `raw_extras` por allowlist.

**Edge Function `process`:** pipeline de 7 etapas (§11); alias antes de IA; IA com input minimizado e **validação de schema**; deduplicação em 3 camadas (§12); cria `transaction` com `transaction_at`, `status`, origem e confiança.

> **Simplificação MVP permitida:** o `process` pode rodar **inline** após o `ingest` (sem `pgmq`), dado o baixo volume do beta — mantendo as duas funções logicamente separadas no código. A fila entra na produção.

**PWA (React/Vite):** lista com badge "automático" + `status`; edição de campos + criação/atualização de alias; visualização da notificação bruta; fila de revisão de baixa confiança e de `duplicate_candidate`; **exclusão de conta/dados** (Must).

**Compliance mínimo:** consentimento granular registrado; política de privacidade em URL pública; `raw_extras` por allowlist; filtragem local de não-financeiras; **RLS em todas as tabelas**; checklist Play (§16.2).

### 19.2. ❌ Excluído do MVP (vai para produção)
Conciliação automática (`expected_transactions`); OFX/CSV; SMS; cache de IA avançado; analytics e painel completo; rate limiting endurecido; ML sofisticado de aliases; multiusuário.

---

## 20. Funcionalidades do MVP por componente

### 20.1. Companion Android
Onboarding + consentimento (E8-US1, E7-US1) · acesso a notificações com disclosure (E1-US1) · seleção de apps lista fechada (E1-US2) · captura + Room + `event_key` (E1-US3) · envio idempotente resiliente (E1-US4, E6-US1 C0) · tela de status (E1-US5) · pausa/desativação (E1-US6).

### 20.2. Edge Function `ingest`
Auth (E7-US2) · validação + tamanho máximo (E2-US1) · idempotência por `event_key` (E2-US1, E6-US1 C0) · inbox com allowlist (E2-US2).

### 20.3. Edge Function `process`
Pipeline de 7 etapas (E3-US1..4) · alias antes de IA (E3-US3) · IA validada por schema (E3-US4) · dedup 3 camadas (E6-US1) · criação com `transaction_at`/`status` (E4-US1).

### 20.4. PWA
Lista com badge + status (E4-US2) · edição + aprendizado (E4-US3, E5-US1) · transparência (E4-US2 CA3) · revisão de duplicatas (E4-US4) · exclusão de dados (E8-US2).

---

## 21. Backlog priorizado do MVP (MoSCoW)

### MUST
- E1-US1..US6 (captura confiável, status, pausa)
- E2-US1, E2-US2 (ingestão idempotente + inbox/allowlist)
- E3-US1..US4 (pipeline + alias + IA validada)
- E4-US1..US4 (transação rastreável + tempo + status + revisão)
- E5-US1, E5-US2 (aprendizado)
- E6-US1 (dedup 3 camadas + idempotência)
- E7-US1..US3 (auth + segurança + **RLS**)
- E8-US1, E8-US2 (consentimento + **exclusão**)

### SHOULD
- E3-US5 (cache de IA versionado)

### COULD
- E8-US3 (painel técnico de qualidade)

### WON'T (fora do MVP)
Conciliação, OFX, CSV, SMS, dedup avançado adaptativo, ML de aliases, multiusuário.

> **Mudanças de prioridade na v2.0:** E1-US5 (status), E4-US4 (revisão de duplicata), E8-US2 (exclusão) e RLS (em E7-US3) subiram para **Must**. Eram Should/recomendado na v1.0.

---

## 22. Critérios de aceitação do MVP

### 22.1. Definition of Ready
CA verificáveis; componente alvo identificado; dependências mapeadas; amostra de notificações reais disponível quando aplicável.

### 22.2. Definition of Done (por história)
Todos os CA atendidos e testados; nenhum dado perdido ou apagado em caminho de erro; segue os 9 princípios (§6); parsing coberto por golden files; **idempotência testada**; **RLS testado**; sem segredos no código; code review feito (Claude/Opus audita, agente executa, sem commit/deploy autônomo).

### 22.3. Definition of Done (MVP)
Companion instalável capturando ao menos os bancos suportados; pipeline ingest→inbox→process→transaction ponta a ponta e **idempotente**; PWA revisa, edita, aprende e **exclui dados**; consentimento + política pública; **RLS em tudo**; checklist Play (§16.2) cumprido; métricas (§23) mensuráveis.

---

## 23. Métricas de sucesso e gate

### 23.1. Critérios de sucesso (beta de 30 dias)

| Métrica | Meta |
|---|---|
| Usuários beta ativos por 30 dias | ≥ 10 |
| Taxa de parsing correto | > 80% |
| Taxa de duplicação real | < 5% |
| **Falso positivo de dedup** | **~0%** |
| Perda após captura pelo listener | 0 (verificável) |
| Custo de IA | Irrelevante |

### 23.2. Gate para produção
Avançar **somente** se: parsing > 80% **e** duplicação real < 5% **e** **falso positivo de dedup ~0%** **e** zero perda verificável **e** ≥ 10 betas ativos a 30 dias. Caso contrário, iterar parser/dedup antes de qualquer feature nova.

---

## 24. Cronograma — Sprint -1 a 6

> Premissa: fundador com agentes de código (Claude Code/Codex) executando sob auditoria, sequência **entender → planejar → confirmar → executar**, sem commit/deploy autônomos. **Calibração honesta (C15):** 8 semanas = protótipo beta auditável; 10–12 semanas = MVP confiável para beta externo mais sério.

### Sprint -1 (2–3 dias) — Spike de viabilidade Android — C14
**Objetivo:** de-riscar o ponto de maior incerteza do projeto inteiro **antes** de comprometer semanas.
- Validar `NotificationListenerService` + captura real + persistência Room em **2 aparelhos Android reais** (idealmente de OEMs diferentes).
- Observar comportamento sob Doze/otimização de bateria e reinício do serviço.
- **Gate:** se a captura não for confiável o suficiente, reavaliar abordagem antes da Sprint 0.

### Sprint 0 (Semana 1) — Fundação do parsing
Coletar ~50 notificações reais próprias (golden files). Parser determinístico + classificação + normalização BRL + **testes negativos de dedup**. **Entregável:** parser cobrindo ~70% das amostras + relatório de lacunas.

### Sprint 1 (Semana 2) — Companion mínimo
Projeto Android; NLS + filtro (lista fechada) + permissão com disclosure; Room (`pending`) + `event_key`; login PKCE + Keystore. **Entregável:** captura local confiável + login.

### Sprint 2 (Semana 3) — Ingestão idempotente + Inbox
`/ingest` idempotente (UPSERT por `event_key`) + inbox (allowlist) + **RLS**; WorkManager com retry; `sent` só após confirmação. **Entregável:** notificação chega íntegra; reenvio não duplica; nada perdido.

### Sprint 3 (Semana 4) — Parsing + IA + Transações
`process` com pipeline de 7 etapas; alias; IA com input minimizado + **validação de schema**; dedup 3 camadas; cria transação com `transaction_at`/`status`. **Entregável:** pipeline ponta a ponta correto + idempotente.

### Sprint 4 (Semana 5) — PWA: revisão e aprendizado
Lista com badge + status; edição + alias; visualização do bruto; fila de `duplicate_candidate`. **Entregável:** corrige categoria e a próxima já vem certa; resolve duplicata.

### Sprint 5 (Semana 6) — Compliance e endurecimento
Consentimento + política pública; **exclusão de conta/dados**; pausa/desativação; retenção/expurgo do raw; logs sem raw; checklist Play; testes de RLS e privacidade. **Entregável:** conformidade mínima + zero perda demonstrável + falso positivo de dedup ~0%.

### Sprint 6 (Semanas 7–8) — Beta fechado e métricas
Distribuir a 5–10 betas; coletar métricas (parsing, duplicação, falso positivo, perda, custo); refinar regex/aliases com itens não parseados; decisão de **gate** (§23.2). **Entregável:** relatório de métricas + go/no-go.

### Resumo visual
```
S-1     S0      S1      S2         S3          S4         S5        S6
Spike   Parser  Compan. Ingest+    Process+    PWA        Compli.   Beta +
Android (50)    Android Inbox+RLS  IA+Dedup    revisão    +endure.  métricas
2-3d    Sem1    Sem2    Sem3       Sem4        Sem5       Sem6      Sem7-8
        └──────────── 8 sem = protótipo · 10-12 sem = beta sério ──────────┘
```

---

## 25. Plano de testes

### 25.1. Parser (golden files)
50 notificações reais anonimizadas (cresce no beta), cada uma com resultado esperado. Bordas: valores com milhar, "saldo/resumo" (não vira transação), textos sem estabelecimento. Critério: determinístico ≥ 70% sozinho; com IA, ≥ 80%. Parser **versionado** (`parser_version`).

### 25.2. Deduplicação e idempotência
- **Idempotência:** reenvio do mesmo `event_key` (WorkManager) → nenhuma duplicata; reprocessar inbox → nenhuma duplicata.
- **Conteúdo janela curta:** banco + sistema na mesma compra → no máximo uma ativa; redundante marcada.
- **Teste negativo (crítico):** compras legítimas idênticas em dias diferentes → transações **distintas**, nunca bloqueadas.

### 25.3. Confiabilidade
Offline (fica `pending`, envia ao reconectar, sem duplicar); app morto/reiniciado (itens persistidos não se perdem); retry (backoff, sem descarte silencioso).

### 25.4. Segurança e privacidade
`/ingest` sem token → 401; spoofing avaliado por `packageName`; **teste de RLS** (cada usuário só acessa o próprio dado; `anon` bloqueado); **teste de privacidade** (logs sem raw; `raw_extras` só allowlist; não-financeiras não trafegam); IA com input minimizado.

### 25.5. Dispositivos
**Matriz mínima de OEMs** (ex.: Samsung, Xiaomi, Motorola) para comportamento de NLS/Doze/bateria.

### 25.6. Aceitação do beta
10 usuários, 30 dias, métricas (§23) dentro das metas.

---

## 26. Checklist de prontidão para o beta

**Produto**
- [ ] Onboarding explica o acesso a notificações
- [ ] Usuário escolhe bancos monitorados (lista fechada)
- [ ] Companion mostra status ativo/inativo e pendentes
- [ ] Usuário pode pausar/desativar a captura
- [ ] PWA mostra transações automáticas
- [ ] Usuário edita, rejeita item errado e resolve duplicata

**Técnico**
- [ ] NLS testado em aparelho real (Sprint -1)
- [ ] Room persiste antes do envio
- [ ] WorkManager reenvia após falha
- [ ] `/ingest` idempotente; `process` não duplica ao reprocessar
- [ ] `transaction_at` e `status` implementados
- [ ] Dedup não bloqueia compras legítimas repetidas
- [ ] Parser com golden files e `parser_version`
- [ ] IA validada por schema; logs sem raw financeiro

**Segurança**
- [ ] **RLS em todas as tabelas por usuário; policies testadas**
- [ ] Tokens no Keystore; sem segredo no APK
- [ ] Rate limit mínimo; payload com tamanho máximo
- [ ] `raw_extras` com allowlist

**LGPD / Play**
- [ ] Consentimento registrado (`consents`)
- [ ] Política de privacidade publicada (URL)
- [ ] **Exclusão de conta/dados implementada**
- [ ] Revogação/pausa implementada
- [ ] Data Safety preenchida; subprocessadores listados; retenção definida; IA declarada

**Métricas**
- [ ] Eventos instrumentados; tabela técnica de beta
- [ ] Correções, duplicatas, falso positivo de dedup, itens não parseados e custo de IA medidos

---

## 27. Backlog pós-MVP (produção, 3–6 meses)

| Item | Descrição |
|---|---|
| Desacoplar ingestão/processamento | `pgmq` + worker; `/ingest` responde 202 e enfileira |
| Cache de IA avançado | Normalização + chave versionada + TTL via `pg_cron` |
| Conciliação previsto×realizado | `expected_transactions` + matching fuzzy (Jaro-Winkler); sugerido, automático só com confiança > 0,95 após 30 dias |
| Dedup semântica adaptativa | Aprender limiares por usuário; promover candidato a automático com segurança |
| Importação OFX e CSV | Fontes estruturadas |
| Leitura de SMS | Fallback para bancos que notificam mal / conteúdo oculto |
| Painel de qualidade completo | Determinístico vs IA, correções, duplicação, falso positivo, não parseadas |
| Feedback "esta transação está errada" | Loop estruturado de melhoria |
| Rate limiting e anti-abuse | Endurecimento |
| Monitoramento | Erros e qualidade (ex.: Sentry/Logflare) |
| Migração de captura | Accessibility Service e Open Finance documentados como caminho |

---
---

# ANEXOS

## Anexo A — Glossário

| Termo | Definição |
|---|---|
| **Companion** | App Android dedicado que captura notificações e as envia ao backend |
| **Inbox** | `notification_inbox`; dado bruto íntegro (fonte da verdade) |
| **event_key** | Hash de identidade do evento (`device_installation_id`+`notification_key`+`post_time`); base da idempotência e da dedup correta |
| **Idempotência** | Propriedade de que o mesmo evento, reenviado ou reprocessado, nunca gera duas transações |
| **Parser determinístico** | Extração por regex/dicionário, sem IA |
| **Enriquecimento** | Aplicar categoria/método a partir do alias do usuário |
| **Merchant alias** | Mapeamento estabelecimento→categoria aprendido por usuário |
| **duplicate_candidate** | Status de transação possivelmente duplicada, aguardando revisão (nunca descarte automático) |
| **Allowlist** | Lista fechada de campos de `raw_extras` permitidos (minimização) |
| **RLS** | Row Level Security; isolamento por `user_id` no PostgreSQL |
| **PKCE** | Fluxo OAuth seguro para apps públicos (sem segredo embarcado) |
| **Golden file** | Notificação real com resultado esperado, base dos testes do parser |
| **pgmq / pg_cron** | Extensões PostgreSQL para fila e agendamento (escala/produção) |

---

## Anexo B — Schema SQL de referência (corrigido, com RLS)

> No MVP, as tabelas centrais são `notification_inbox`, `transactions`, `merchant_aliases`, `consents`, `devices` (e, opcionalmente, `ai_response_cache`, `transaction_audit_log`). `expected_transactions` é pós-MVP.
>
> **Nota sobre referência circular:** `transactions` e `expected_transactions` referenciam-se mutuamente. No MVP, **omita** `expected_transaction_id` e a tabela `expected_transactions`. Ao introduzi-las, crie ambas sem as FKs cruzadas e adicione-as via `ALTER TABLE` ao final.

```sql
-- DEVICES (suporta event_key e estado de acesso)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    device_installation_id VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    os_version VARCHAR(50),
    notification_access_granted BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, device_installation_id)
);

-- CONSENTS (consentimento granular registrado)
CREATE TABLE consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    consent_type VARCHAR(50) NOT NULL,   -- notification_capture | financial_data_processing | ai_processing
    granted BOOLEAN NOT NULL,
    policy_version VARCHAR(20) NOT NULL,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INBOX (verdade bruta + idempotência + timestamps separados + allowlist)
CREATE TABLE notification_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    device_id UUID REFERENCES devices(id),

    -- Fonte
    source_app VARCHAR(100) NOT NULL,
    source_app_display_name VARCHAR(100),

    -- Identidade do EVENTO (idempotência) — C02/C19
    notification_key TEXT,
    device_installation_id VARCHAR(100),
    device_posted_at TIMESTAMPTZ,                 -- post_time do evento no aparelho
    event_key VARCHAR(64) NOT NULL,               -- SHA-256(device_installation_id|notification_key|post_time)

    -- Dados brutos (allowlist) — C09
    raw_title TEXT NOT NULL,
    raw_body TEXT,
    raw_extras JSONB,                             -- SOMENTE campos da allowlist

    -- Timestamps separados — C04
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,

    -- Processamento
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,

    -- Parsing
    parser_type VARCHAR(20),                      -- deterministic | ai | manual
    parser_version VARCHAR(20),
    ai_result JSONB,
    ai_model VARCHAR(50),
    ai_prompt_version VARCHAR(20),
    ai_tokens_used INT,

    -- Deduplicação — C01 (conteúdo só p/ janela curta; identidade = event_key)
    content_hash VARCHAR(64),
    duplicate_of UUID REFERENCES notification_inbox(id),
    dedup_reason VARCHAR(30),                     -- event | content_short_window | semantic

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, event_key)                   -- idempotência de evento
);

CREATE INDEX idx_inbox_user_received ON notification_inbox(user_id, server_received_at);
CREATE INDEX idx_inbox_content_hash  ON notification_inbox(content_hash);
CREATE INDEX idx_inbox_unprocessed   ON notification_inbox(processed, processing_attempts)
                                      WHERE processed = false;

-- TRANSACTIONS (tempo correto + status + FK corrigida)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),

    type VARCHAR(20) NOT NULL CHECK (type IN ('income','expense','transfer')),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    payment_method VARCHAR(30),

    -- Temporal — C03
    transaction_at TIMESTAMPTZ NOT NULL,
    transaction_date DATE GENERATED ALWAYS AS (transaction_at::date) STORED,

    -- Status — C05
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','pending_review','duplicate_candidate','rejected','archived')),

    -- Rastreabilidade
    source VARCHAR(30) NOT NULL DEFAULT 'manual', -- notification | ofx | csv | open_finance
    source_notification_id UUID REFERENCES notification_inbox(id),
    source_reference VARCHAR(255),                -- txid PIX, NSU cartão, etc.

    -- Qualidade
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    parser_version VARCHAR(20),

    -- Conciliação (pós-MVP) — C06 (FK corrigida; ver nota de circularidade)
    reconciled BOOLEAN NOT NULL DEFAULT false,
    -- expected_transaction_id UUID REFERENCES expected_transactions(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tx_user_at     ON transactions(user_id, transaction_at);
CREATE INDEX idx_tx_user_status ON transactions(user_id, status);

-- MERCHANT ALIASES (aprendizado por usuário)
CREATE TABLE merchant_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    merchant_name VARCHAR(255) NOT NULL,
    normalized_merchant_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    payment_method VARCHAR(30),
    usage_count INT NOT NULL DEFAULT 1,
    manually_corrected BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, normalized_merchant_name)
);

-- AI RESPONSE CACHE (versionado) — C17 / Should no MVP
CREATE TABLE ai_response_cache (
    input_hash VARCHAR(64) NOT NULL,
    parser_version VARCHAR(20) NOT NULL,
    prompt_version VARCHAR(20) NOT NULL,
    schema_version VARCHAR(20) NOT NULL,
    model VARCHAR(50) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (input_hash, parser_version, prompt_version, schema_version)
);

-- TRANSACTION AUDIT LOG (auditoria de edição) — P2
CREATE TABLE transaction_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action VARCHAR(30) NOT NULL,                  -- created | edited | rejected | reclassified | duplicate_resolved
    before JSONB,
    after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EXPECTED TRANSACTIONS (conciliação) — pós-MVP
CREATE TABLE expected_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    description VARCHAR(255) NOT NULL,
    expected_amount DECIMAL(12,2),
    amount_tolerance DECIMAL(5,2) DEFAULT 0.10,
    expected_date DATE,
    date_tolerance_days INT DEFAULT 3,
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',          -- pending | matched | expired
    matched_transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Ao habilitar conciliação, descomentar a coluna em transactions e:
-- ALTER TABLE transactions
--   ADD CONSTRAINT fk_tx_expected
--   FOREIGN KEY (expected_transaction_id) REFERENCES expected_transactions(id);

-- ============ RLS (Must — C08) ============
ALTER TABLE devices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_inbox    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_aliases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE expected_transactions ENABLE ROW LEVEL SECURITY;
-- ai_response_cache: habilitar RLS se contiver padrão sensível por usuário.

-- Padrão de policy por tabela (exemplo em transactions; replicar nas demais):
CREATE POLICY "select own" ON transactions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "insert own" ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own" ON transactions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own" ON transactions FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Anexo C — Contratos das Edge Functions (idempotentes)

### C.1. `POST /ingest`

**Headers**
```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

**Request body** (`user_id` derivado do token — nunca do corpo)
```json
{
  "source_app": "com.nu.production",
  "source_app_display_name": "Nubank",
  "notification_key": "0|com.nu.production|123|tag|0",
  "device_installation_id": "a1b2c3d4",
  "device_posted_at": "2026-06-23T14:33:00-03:00",
  "raw_title": "Compra aprovada",
  "raw_body": "R$ 89,90 no estabelecimento DROGASIL",
  "raw_extras": { "channel_id": "transactions", "template": "purchase" }
}
```

**Comportamento:** valida (com tamanho máximo) → calcula `event_key` → UPSERT por (`user_id`, `event_key`).

**Respostas**
```json
// 202 Accepted — evento novo
{ "status": "accepted", "inbox_id": "uuid" }

// 200 OK — idempotência: evento já ingerido (reenvio/reprocesso)
{ "status": "already_ingested", "inbox_id": "uuid" }

// 401 — sem token válido
{ "error": "unauthorized" }

// 422 — payload inválido ou grande demais
{ "error": "invalid_payload", "details": "raw_title is required" }
```

### C.2. `process` (worker; no MVP pode ser chamado inline pelo `ingest`)

**Entrada lógica:** `inbox_id` (ou item enfileirado). **Idempotente:** reprocessar a mesma `inbox_id` não cria transação adicional.

**Comportamento (pipeline §11):**
1. Carrega a entrada da inbox.
2. Classificação → Extração → Normalização → Enriquecimento (alias) → IA (se necessário, **validada por schema**) → Decisão.
3. Deduplicação (§12): evento → conteúdo curto → semântico (candidato).
4. Cria `transaction` (`transaction_at`, `status`, `source`, `confidence_score`, `parser_version`) ou marca `pending_review`/não-financeira.
5. Atualiza `processed`, `processed_at`, `parser_*`, `ai_*` na inbox.

**Contrato só-JSON da IA (validado por schema):**
```json
{
  "is_financial_transaction": true,
  "transaction_type": "expense",
  "amount": 89.90,
  "merchant": "Drogasil",
  "category": "Farmácia",
  "payment_method": "credit_card",
  "confidence": 0.98
}
```
Retorno que não passar na validação → item para `pending_review`, **sem** criar transação.

### C.3. Prompt de IA (referência, enxuto, input minimizado)
```
SYSTEM:
Você é um parser de notificações bancárias brasileiras.
Extraia: tipo (income/expense/transfer), valor, estabelecimento,
categoria e método de pagamento. Responda APENAS em JSON válido, sem markdown.

USER:
source_app=<source_app>
title=<raw_title>
body=<raw_body>
```
> Não enviar `raw_extras` à IA, salvo necessidade real. Registrar `ai_prompt_version`.

---

## Anexo D — Catálogo de notificações por banco

### D.1. Apps-alvo (MVP define o subconjunto inicial — lista fechada)
Nubank (`com.nu.production`), Inter, Itaú, Bradesco, Santander, Mercado Pago, PicPay, Sicoob, Sicredi.

> **Recomendação MVP:** começar pelos bancos do próprio fundador/beta (provável Nubank + Inter) e atingir > 90% de precisão neles antes de ampliar. **Sem `QUERY_ALL_PACKAGES`** — usar lista fechada de pacotes.

### D.2. Padrões determinísticos (base inicial de regex)

| Tipo | Exemplo | Padrão (referência) |
|---|---|---|
| PIX enviado | "PIX enviado de R$ 58,90 para João Silva" | `/PIX enviado.*?R\$ ?([\d.,]+).*?para (.+)/i` |
| PIX recebido | "PIX recebido de R$ 850,00" | `/PIX recebido.*?R\$ ?([\d.,]+)/i` |
| Compra débito | "Compra no débito de R$ 32,00 em Padaria X" | `/(?:débito|debito).*?R\$ ?([\d.,]+).*?(?:em|no|na) (.+)/i` |
| Compra crédito | "Compra aprovada no valor de R$ 89,90 em Drogasil" | `/(?:compra aprovada|cartão).*?R\$ ?([\d.,]+).*?(?:em|no|na) (.+)/i` |
| Transferência recebida | "Transferência recebida de R$ 2.500,00" | (análogo) |
| Pagamento de boleto | "Pagamento de boleto R$ 147,33 para ENEL" | (análogo) |
| Salário | "Crédito de salário de R$ 4.000,00" | (análogo) |

### D.3. Casos que **não** devem virar transação (testes negativos)
Notificações de saldo/resumo; avisos de segurança/login; promoções e mensagens do app. Alimentam os testes negativos da suíte (§25.1).

---

## Anexo E — Matriz de prioridade das correções

| Prioridade | Correção | Por quê | Momento |
|---|---|---|---|
| **P0-design** | Dedup por evento, não conteúdo (C01/C02) | Evita falso positivo que apaga saldo | Antes de codar |
| **P0-design** | `transaction_at` (C03) + timestamps separados (C04) | Janela de min exige hora | Antes de codar |
| **P0-design** | `status` na transação (C05) | Fluxo de revisão do MVP | Antes de codar |
| **P0-design** | FK `expected_transaction_id` (C06) | Bug objetivo | Antes de codar |
| **P0-design** | Idempotência `/ingest` e `process` (C19) | WorkManager reenvia | Antes de codar |
| **P1** | Pipeline extração→enriquecimento (C07) | Evita pular alias / IA desnecessária | Antes de codar |
| **P0-compliance** | RLS Must (C08) | Dados financeiros sensíveis | Antes do beta |
| **P0-compliance** | Exclusão de dados Must (C11) | LGPD + Play | Antes do beta |
| **P0-compliance** | Checklist Play (C12) | Evita bloqueio de distribuição | Antes do beta |
| **P0-compliance** | Métrica de perda com denominador (C13) | Evita métrica impossível | Antes do beta |
| **P1** | `raw_extras` allowlist (C09) | Minimização | Durante MVP |
| **P0/P1** | IA: input mínimo + validação schema (C10) | Privacidade + previsibilidade | Durante MVP |
| **P1** | Sprint -1 spike Android (C14) | De-risca o projeto | Antes da Sprint 0 |
| **P1** | Status do companion Must (C16) | Confiança do usuário | Durante MVP |
| **P1/P2** | Cache de IA versionado (C17) | Evita contaminação | Quando houver cache |
| **P0/P2** | Tabelas `consents`/`devices`/`audit_log` (C18) | Consentimento, idempotência, auditoria | `consents`/`devices` antes do beta; `audit_log` P2 |

---

## Fechamento

A tese e a arquitetura da v1.0 estavam corretas na direção. A v2.0 as torna executáveis por agentes de código sem sair do trilho, fechando os três pontos que decidem o sucesso de um app de finanças: **não perder, não duplicar (nem por excesso, nem por falso positivo) e classificar bem** — com identidade por evento, tempo correto, idempotência, RLS, compliance tratado como código e um spike que de-risca o ponto mais incerto antes de comprometer o cronograma. O gate (§23.2) continua protegendo o produto contra adicionar features antes de a confiabilidade estar comprovada.

*Versão 2.0 — final corrigida. Gerada em 23 de junho de 2026.*
