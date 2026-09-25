# PLANO TÉCNICO — CAPTURA AUTOMÁTICA DE TRANSAÇÕES (D.6)

**Versão:** 1.1
**Projeto:** FinanceiroJe (extensão do módulo Captura Inteligente)
**Stack:** React + TypeScript + Vite + Supabase (Deno Edge Functions) + PWA
**Repo:** `josemardp/financeiroje`
**Data:** 04 de Julho de 2026
**Padrão:** seguir as convenções do `CLAUDE.md`

**Origem:** consolidação de três rodadas de análise sobre como reduzir o atrito de captura de
transações bancárias sem violar os princípios de zero-alucinação e "sem push de engajamento" do
projeto — uma proposta interna, um relatório externo recebido pelo usuário, e uma segunda opinião
de um modelo mais capaz que arbitrou entre as duas. Este documento é a síntese final.

---

## OBJETIVO

Reduzir o atrito de registrar transações de cartão/banco sem exigir digitação nem foto, cobrindo
o máximo de valor real com o mínimo de automação frágil de background. Toda decisão aqui segue um
princípio: **nenhuma automação vira dependência permanente sem primeiro provar valor num piloto
com critério de morte objetivo.**

**Princípio diretor:** a base contábil (OFX/CSV, plano D.2 Bloco A) vale mais e custa menos do que
qualquer automação de notificação. A automação de notificação é um complemento de "quase tempo
real", nunca a fonte de verdade.

---

## VEREDITO ARQUITETURAL

Nem "app companion nativo primeiro" nem "só Open Finance" — a combinação vencedora é:

**Fase 0 (colar + PWA Share Target) + Fase 2 (OFX/CSV do D.2, Bloco A)** cobre a maior parte do
valor real com **zero automação frágil de background**. A captura por notificação bancária
(SMS/push) é a peça **menos valiosa e mais frágil** das opções: entra por último, é opcional, e só
passa a existir se ganhar espaço num piloto mensurável. **O companion Android nativo pode nunca
ser construído — isso é um bom desfecho, não uma falha.**

### Duas fontes, dois papéis

- **OFX/CSV (grátis) = base contábil autoritativa.** Histórico, volume de dados para a IA
  aprender, conciliação. Ver `docs/PLANOS_DE_EVOLUCAO.md` — D.2, Bloco A.
- **Notificação = radar de transação pendente.** Bom para "quase tempo real" (autorização de
  cartão), ruim como fonte de verdade — é um rastro operacional frágil do aparelho.

### Por que a API paga do Open Finance fica de fora

A API Open Finance (Pluggy/Belvo) é modelo B2B com custo estimado ~R$2.500/mês **não confirmado**
na tabela vigente do provedor — confirmar antes de qualquer decisão, mas planejar como
deferimento permanente até caber no orçamento pessoal. Isso não afeta o OFX/CSV, que é grátis e
não depende de contrato com o provedor.

---

## ESTADO ATUAL VERIFICADO NO CÓDIGO (04/07/2026)

- `transactions.source_type` já inclui o valor `'sms'` no enum — reservado desde o débito D6
  (Sprint 6, `sourceTrust.ts`), **nunca usado por nenhum código real**.
- `transactions.data_status` já inclui `'suggested'`, `'incomplete'`, `'inconsistent'` — nenhuma
  migration nova necessária para os status usados neste plano.
- `supabase/functions/smart-capture-interpret/index.ts` já aceita `{ text, source_kind, user_name,
  user_context }` no corpo da requisição; `source_kind` (linha 216) é injetado no prompt do LLM
  (linha 253) — **um novo valor como `"bank_notification"` funciona sem alterar a function.**
- Essa function exige JWT de sessão real (`supabase.auth.getUser(token)`) — **não aceita
  autenticação por token estático hoje.** Qualquer ingestão em background (Fase 3+) precisa de uma
  function nova com esquema de auth próprio.
- `_shared/rateLimiter.ts` (Deno KV) já existe e deve ser reusado por qualquer function nova.
- Sanitização hoje **não é um módulo único compartilhado**: `src/services/aiAdvisor/
  promptSanitizer.ts` é código de frontend; `smart-capture-interpret` e `ai-advisor` implementam
  sanitização inline cada uma à sua moda no lado Deno. Uma nova function de ingestão precisa de um
  **novo util em `_shared/`**, não de "estender" o arquivo do frontend.
- `pattern_learning_queue` (Sprint 8, T8.6) é o precedente de arquitetura Outbox/staging já
  existente no projeto — referência de padrão para a Fase 2 deste plano.
- `public/manifest.webmanifest` existe, `"display": "standalone"`, **sem `share_target`
  configurado ainda**. `public/sw.js` é escrito à mão (não gerado por plugin), hoje só cuida de
  cache de app shell — Share Target de texto via `method: "GET"` **não exige alterar o
  service worker**, só o manifest + uma rota que lê a query string.
- Não existe: leitura automática de SMS/notificação, app nativo/Capacitor, integração Open
  Finance, tabela de deduplicação de capturas externas.

---

## FASES

### Fase 0 — Agora (custo zero)

**Status em 09/07/2026:** implementação concluída localmente e validada com 152 testes Vitest e
`tsc --noEmit`. O frontend foi publicado e o manifest em produção expõe o Share Target. O login
no Supabase foi concluído, mas a publicação da Edge Function `smart-capture-interpret` aguarda o
fim de incidente ativo no painel (`Deploy status unavailable`, 09/07/2026).

**Objetivo:** modo "colar notificação/SMS" na Captura Inteligente + PWA Share Target.

- [x] Novo modo de captura em `SmartCapture.tsx`, reusando o pipeline de texto livre já existente.
- [x] Chamada a `smart-capture-interpret` com `source_kind: "bank_notification"`.
- [x] Resultado usa `source_type: "sms"` (valor já existente no enum) e abre o Modo Espelho;
  nenhuma transação é gravada antes da confirmação explícita do usuário.
- [x] Regra de extração: o valor precisa aparecer **literal** no texto — o LLM não infere número.
  Se houver zero ou mais de um valor candidato, o valor estruturado é removido e exige revisão.
- [x] PWA Share Target: bloco `share_target` em `public/manifest.webmanifest`
  (`method: "GET"`, ação apontando para uma rota tipo `/captura?texto=`), permitindo compartilhar
  o texto de uma notificação/SMS direto de outro app Android para o FinanceiroJe sem copiar/colar
  manualmente. Não exige mudança no `sw.js`.
- [x] Testes de notificações: compra, PIX recebido, crédito em conta, estorno/ambiguidade e ausência
  de valor. O teste Deno da função também foi incluído para a validação de valores literais.

**Objetivo duplo:** alívio de atrito imediato + coleta de amostras reais (Nubank, Itaú, Pix,
estorno, fatura) para calibrar o parser antes de qualquer automação.

**Gate de decisão:** rodar por algumas semanas. Se o atrito já desapareceu na prática, **o plano
pode parar aqui** — isso é um desfecho válido, não incompleto.

### Fase 1 — Base estrutural

**Objetivo:** criar a peça de infraestrutura que vai servir tanto o piloto de notificação (Fase 3)
quanto qualquer importação futura (OFX/CSV do D.2 também pode passar por aqui).

Tabela nova, enxuta, síncrona (sem worker assíncrono):

```sql
CREATE TABLE public.external_capture_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  source_channel text NOT NULL,        -- 'notification' | 'sms' | 'ofx_import' | 'csv_import'
  source_kind text,                    -- ex: 'bank_notification', pacote do app, etc.
  event_hash text NOT NULL,            -- dedup (hash do conteúdo normalizado)
  raw_hash text NOT NULL,              -- hash do texto bruto original (auditoria, não o texto em si)
  redacted_preview text,               -- prévia já redigida de PII, para exibição na fila
  parsed_payload jsonb NOT NULL,       -- saída estruturada do interpretador
  processing_status text NOT NULL DEFAULT 'pending', -- pending | linked | ignored | error
  linked_transaction_id uuid REFERENCES public.transactions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_hash)
);
-- RLS obrigatório (convenção do projeto), TTL do bruto: 30-90 dias via cron de purge
-- (mesmo padrão do `daily-purge-health-logs`, Sprint S3).
```

- Parse **síncrono** na edge function — sem fila assíncrona (`pattern_learning_queue` é overkill
  aqui; a carga esperada é baixa).
- **Sem** fingerprint semântico de dedup ainda — só se justifica quando duas fontes (ex:
  notificação + OFX) coexistirem de fato e precisarem se reconciliar.

### Fase 2 — OFX/CSV (grátis, prioridade real mais alta que a automação de notificação)

Corresponde ao **Bloco A de D.2** (`docs/PLANOS_DE_EVOLUCAO.md`) — importação na mesma tabela de
staging da Fase 1, dedup, revisão em lote, conciliação com transações existentes. É a fase que
mais move o ponteiro de valor entregue por esforço, e é onde a tabela genérica da Fase 1 se paga.

**Gate de decisão:** com Fase 0 + Fase 2 no ar, reavaliar se ainda faz sentido perseguir
automação de notificação (Fase 3). Se não, encerrar o trilho de notificação aqui — sem culpa.

### Fase 3 — Piloto de automação de notificação (só se ainda fizer sentido)

- MacroDroid (recomendado sobre Tasker — ver seção "Decisões" abaixo) → HTTP POST → edge function
  nova de ingestão → `external_capture_events`.
- **Android-only. Sem SMS** — só notificação de app bancário, com whitelist local por pacote.
- Filtro/regex **no dispositivo**, antes de qualquer envio à rede — nunca mandar stream bruto de
  notificações do aparelho.
- Autenticação: **token por dispositivo, hasheado** (`token_hash` no banco; no máximo um pepper
  global no Supabase Vault para HMAC). Escopo restrito ao endpoint de ingestão, revogável a
  qualquer momento sem afetar a sessão principal do usuário.
- Falha silenciosa (nunca derruba nada); dedup no backend via `event_hash`.

**Critério de morte (30-60 dias) — encerra sem dó se qualquer um destes ocorrer:**
- Captura menos de X transações úteis/semana (definir X na hora de rodar o piloto).
- Taxa de falso positivo alta.
- Na prática, as sugestões não são revisadas.
- Quebra recorrente por otimização de bateria do Android.
- Dá mais manutenção do que simplesmente digitar manualmente.

**Se capturar bem mas quem falha é o MacroDroid/Tasker** → considerar Fase 4.
**Se o OFX/CSV (Fase 2) já resolve ~80% do problema** → Fase 4 vira baixa prioridade indefinida.

### Fase 4 — Companion nativo (só se o piloto vencer por falha da ferramenta, não por falta de valor)

- Capacitor + módulo Kotlin com `NotificationListenerService`, distribuído por **sideload**
  (nunca publicado na Play Store — uso pessoal/familiar, elimina o risco de revisão de política
  para apps que leem notificação/SMS).
- Escopo deliberadamente mínimo: coletor burro — escuta notificação, filtra localmente, redige
  PII, hasheia, faz POST. **Sem IA embarcada, sem banco local, sem tela financeira.** Tela própria
  só de status + botão pausar/revogar.
- **Nota importante:** isso *não* adianta o plano D.3 (Mobilidade) de verdade — é a parte mais
  frágil e menos reaproveitável de um app nativo (um serviço de escuta de notificação não vira
  base para telas financeiras completas). Não tratar como sinergia com D.3.

---

## REGRAS INEGOCIÁVEIS (valem em todas as fases)

1. **Nada vira `confirmed` sem ação humana.** Zero promoção automática, mesmo com "confiança
   alta". Em qualquer notificação de confirmação futura, os botões são "Revisar"/"Descartar" —
   nunca "Confirmar" direto na notificação.
2. **O LLM não extrai número que não esteja literal no texto.** Regex encontra o valor; se houver
   ambiguidade, marca `data_status = 'inconsistent'`. Data ausente vem de `posted_at`/timestamp do
   evento e fica marcada como inferida, nunca como certeza.
3. **Redação de PII antes do LLM.** Remover final de cartão, CPF, agência/conta, telefone antes de
   qualquer chamada ao modelo — o LLM recebe o mínimo necessário (valor + comerciante + data). Isso
   nasce como um **novo util em `supabase/functions/_shared/`** (não uma extensão do
   `promptSanitizer.ts` do frontend, que não é acessível pelo lado Deno).
4. **Filtro no dispositivo, não só no servidor.** Whitelist por pacote de app bancário definida
   localmente. Nunca enviar stream bruto de notificações à rede.
5. **Token por dispositivo, hasheado.** Nunca a `service_role_key` nem credencial de sessão indo
   para o Tasker/MacroDroid/companion — só um token opaco por dispositivo, guardado como hash.
6. **`source_type = 'sms'` não é para notificação push.** Registrar o canal real em
   `external_capture_events.source_channel`/`source_kind` desde já; avaliar adicionar
   `'bank_notification'`, `'external_import'`, `'open_finance'` ao enum `source_type` no médio
   prazo, quando o volume de dados justificar a migration. Usar `'sms'` para tudo é gambiarra
   semântica que este plano evita desde o início.
7. **MEI da Esdra é caso à parte.** Transações do escopo `business` (Pix recebido de clientes,
   dados da MEI) não devem passar pelo mesmo pipeline de LLM sem redação — ou passam já redigidas,
   ou ficam fora da automação de notificação por padrão. Se rodar no celular da Esdra, exige
   consentimento familiar explícito antes de habilitar qualquer captura automática lá.
8. **Sem push de engajamento.** Qualquer notificação gerada pelo próprio FinanceiroJe neste fluxo
   é função (confirmar um dado pendente), nunca gancho de engajamento — princípio já estabelecido
   no `CLAUDE.md` do projeto.

---

## DECISÕES JÁ TOMADAS (não reabrir sem novo motivo)

- **MacroDroid, não Tasker, para o piloto (Fase 3).** Macros visuais são mais fáceis de
  reconstruir depois de meses sem mexer — "esquecer a configuração" é o maior risco realista de
  uso solo de longo prazo. Tasker fica como alternativa só se precisar de controle mais fino.
- **Staging (`external_capture_events`), não escrita direta em `transactions`.** A borda
  MacroDroid → backend é *at-least-once* — idempotência, retenção do bruto e isolamento de falha
  antes de tocar a tabela financeira real são obrigatórios. Mas sem Outbox assíncrono — síncrono
  já basta para o volume esperado.
- **OFX/CSV antes de qualquer automação pesada.** Grátis, robusto, conciliável — entra antes da
  Fase 3 na prática, mesmo que cronologicamente as fases estejam numeradas em série.
- **API Open Finance paga fica fora, ao custo atual.** Ver seção "Por que a API paga fica de fora".

---

## O QUE DESCARTAR (decidido, não reavaliar sem mudança de contexto)

- `READ_SMS`/`RECEIVE_SMS` em app próprio publicado na Play Store.
- Companion nativo antes do piloto (Fase 3) rodar e vencer.
- Parser específico por banco antes de haver amostra real (o modelo de linguagem já generaliza
  formato o suficiente na Fase 0).
- Fingerprint de dedup semântica antes de múltiplas fontes coexistirem de fato.
- API Open Finance paga, enquanto o custo não for confirmado e couber no orçamento.
- Confirmação por push como primeira versão (só depois da fila básica provar valor).
- Qualquer push de engajamento.

---

## RELAÇÃO COM OUTROS DOCUMENTOS

- `docs/PLANOS_DE_EVOLUCAO.md` — entrada **D.6** (Categoria D) referencia este documento para
  elaboração completa. **D.2** foi reescopado em Bloco A (OFX/CSV) e Bloco B (API paga) na mesma
  sessão que originou este plano.
- `CLAUDE.md` — princípios de zero-alucinação, sem push de engajamento, e separação de camadas
  (fatos reais vs. padrões aprendidos) aplicam-se integralmente a este plano.
