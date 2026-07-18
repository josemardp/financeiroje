# Relatorio de Planejamento — Automacao por Notificacoes Android e Open Finance

Projeto: FinanceiroJe  
Data: 2026-07-04  
Foco: captura automatica de transacoes por notificacoes bancarias/cartoes e integracao oficial via Open Finance

---

## 1. Resumo executivo

Hoje o FinanceiroJe ja possui infraestrutura parcial para origem `sms` em `transactions.source_type`, mas nao existe implementacao real de leitura automatica de SMS ou notificacoes bancarias.

Existem dois caminhos principais para evoluir:

1. **App Android companion com leitura de notificacoes**
   - Captura notificacoes de bancos/cartoes quase em tempo real.
   - Usa `NotificationListenerService` no Android.
   - Funciona apenas no Android.
   - Bom para uso pessoal/familiar.
   - Tem alto cuidado de privacidade e risco maior em publicacao na Play Store.

2. **Open Finance via Pluggy/Belvo**
   - Integra contas e cartoes por API oficial mediante consentimento.
   - Mais robusto, auditavel e multiplataforma.
   - Nao costuma ser tempo real.
   - Pode ter custo/contrato B2B.
   - Exige tratamento formal de LGPD, consentimento e revogacao.

Recomendacao pratica:

1. Comecar por parser de notificacoes coladas manualmente na Captura Inteligente.
2. Depois criar um companion Android interno para leitura de notificacoes.
3. Em paralelo, estudar Pluggy/Belvo para importacao oficial de dados quando custo e contrato fizerem sentido.

---

## 2. Estado atual no FinanceiroJe

### O que ja existe

- Enum `source_type` ja inclui `sms`.
- `transactions` ja possui:
  - `source_type`
  - `confidence`
  - `validation_notes`
  - `data_status`
- A Captura Inteligente ja interpreta:
  - texto livre
  - voz
  - OCR/foto
  - PDF/Word/Excel/HTML extraido como texto
- O pipeline de confirmacao no Modo Espelho ja permite criar transacoes como `confirmed` apos revisao.

### O que nao existe

- Nao existe leitura automatica de SMS.
- Nao existe leitura automatica de notificacoes Android.
- Nao existe app Android nativo/Capacitor.
- Nao existe integracao Open Finance.
- Nao existe deduplicacao especifica entre notificacao, OCR, lancamento manual e importacao bancaria.

---

## 3. Caminho 3 — App Android com leitura de notificacoes

### 3.1 Ideia geral

Criar um app Android, provavelmente via Capacitor, que rode o FinanceiroJe atual dentro de um container nativo e adicione um modulo Android para escutar notificacoes de bancos e cartoes.

O Android oferece `NotificationListenerService`, um servico que recebe eventos quando notificacoes sao publicadas ou removidas. Para funcionar, o usuario precisa conceder manualmente acesso especial a notificacoes nas configuracoes do sistema.

Fluxo:

```text
Banco/cartao envia notificacao
        ↓
Android NotificationListenerService recebe evento
        ↓
Servico filtra apps financeiros conhecidos
        ↓
Parser local extrai valor, direcao, estabelecimento, data/hora
        ↓
App envia transacao sugerida ao Supabase
        ↓
FinanceiroJe exibe pendencia para revisao
        ↓
Usuario confirma/corrige no Modo Espelho
```

### 3.2 Exemplo pratico

Notificacao:

```text
Nubank
Compra aprovada no cartao final 1234: R$ 47,90 em MERCADO X
```

Saida estruturada:

```json
{
  "valor": 47.9,
  "tipo": "expense",
  "descricao": "Compra no Mercado X",
  "data": "2026-07-04",
  "scope": "private",
  "source_type": "sms",
  "data_status": "suggested",
  "confidence": "media"
}
```

Idealmente, no futuro, criar um novo enum:

```sql
ALTER TYPE source_type ADD VALUE 'notification';
```

Enquanto isso, `sms` pode ser usado como origem provisoria para mensagens automatizadas curtas.

### 3.3 Arquitetura sugerida

```text
financeiroje/
├── src/                         # React/Vite atual
├── android/                     # gerado pelo Capacitor
├── native/
│   └── NotificationCapture.kt   # plugin/servico Android
├── supabase/
│   └── functions/
│       └── ingest-notification-transaction/
└── public/
```

Componentes:

- **Capacitor Android**
  - Empacota o app web como app Android.
  - Permite ponte entre JavaScript e Kotlin/Java.

- **NotificationListenerService**
  - Servico nativo Android.
  - Recebe notificacoes do sistema apos permissao do usuario.

- **Parser local**
  - Roda no aparelho.
  - Remove notificacoes irrelevantes.
  - Identifica padroes por app/banco.

- **Edge Function de ingestao**
  - Recebe transacoes candidatas.
  - Valida schema.
  - Aplica rate limit.
  - Deduplica.
  - Insere como `data_status = 'suggested'`.

### 3.4 Permissoes e privacidade

Este caminho e sensivel porque o app pode receber notificacoes de outros aplicativos.

Regras recomendadas:

- Pedir permissao somente em tela especifica, nunca no primeiro acesso.
- Explicar claramente o que sera lido.
- Permitir escolher quais apps monitorar.
- Processar localmente sempre que possivel.
- Nao enviar texto bruto completo ao servidor por padrao.
- Salvar apenas:
  - app de origem
  - valor
  - direcao
  - merchant/counterparty
  - data/hora aproximada
  - hash do texto bruto para deduplicacao
- Oferecer botao "Pausar captura".
- Oferecer botao "Apagar dados capturados".

### 3.5 Riscos

| Risco | Impacto | Mitigacao |
|---|---:|---|
| Ler notificacoes sensiveis demais | Alto | Filtro por app + processamento local + consentimento claro |
| Google Play rejeitar ou sinalizar | Alto | Usar distribuicao interna/sideload no inicio |
| Texto das notificacoes variar muito | Medio | Parsers por banco + fallback para IA no Modo Espelho |
| Duplicidade com OCR/manual/Open Finance | Alto | Deduplicacao por valor/data/merchant/origem |
| Banco esconder valor em notificacao | Medio | Criar pendencia parcial, nao transacao confirmada |
| Android mudar restricoes | Medio | Tratar como companion experimental, nao fonte unica |

### 3.6 Deduplicacao minima

Criar uma chave aproximada:

```text
user_id
+ source_app
+ valor arredondado
+ tipo
+ data local
+ merchant normalizado
+ janela de 12 horas
```

Melhor ainda: criar uma tabela auxiliar:

```sql
CREATE TABLE notification_capture_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  source_app text NOT NULL,
  notification_hash text NOT NULL,
  parsed_json jsonb NOT NULL,
  transaction_id uuid REFERENCES transactions(id),
  ignored_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_hash)
);
```

### 3.7 Plano de implementacao

#### Fase 0 — Parser manual no app atual

Antes de Android nativo:

- Adicionar modo "Notificacao/SMS" na Captura Inteligente.
- Usuario cola texto da notificacao.
- Interpretador usa `source_kind = 'bank_notification'`.
- Transacao sai como `source_type = 'sms'` e `data_status = 'suggested'`.

Baixo risco e valida rapidamente os padroes reais de Nubank, Itau, Caixa, C6, PicPay etc.

#### Fase 1 — Companion Android interno

- Adicionar Capacitor ao projeto.
- Gerar app Android.
- Criar servico `NotificationListenerService`.
- Tela de configuracao:
  - status da permissao
  - apps monitorados
  - captura ligada/desligada
- Enviar apenas transacoes candidatas para Supabase.

#### Fase 2 — Ingestao robusta

- Edge Function `ingest-notification-transaction`.
- Tabela `notification_capture_events`.
- Deduplicacao.
- Tela de pendencias "capturadas automaticamente".
- Ajustar score de confianca.

#### Fase 3 — Aprendizado por banco/app

- Criar parsers por origem:
  - Nubank
  - Itau
  - Caixa
  - C6
  - Mercado Pago
  - PicPay
  - Santander
- Registrar correcoes no Modo Espelho.
- Aprender merchant/categoria por usuario.

---

## 4. Caminho 4 — Open Finance via Pluggy/Belvo

### 4.1 Ideia geral

Integrar o FinanceiroJe com um agregador Open Finance. O usuario autoriza o compartilhamento de dados bancarios e o FinanceiroJe sincroniza contas, saldos, cartoes e transacoes.

Fluxo:

```text
Usuario clica "Conectar banco"
        ↓
FinanceiroJe cria link/sessao no provedor
        ↓
Usuario autoriza no fluxo do provedor
        ↓
Provedor retorna item/link/conexao
        ↓
FinanceiroJe salva conexao
        ↓
Cron ou webhook sincroniza transacoes
        ↓
Transacoes entram como sugeridas/importadas
        ↓
Usuario revisa/categoriza
```

### 4.2 Arquitetura sugerida

```text
React
  ↓
Edge Function create-open-finance-connection
  ↓
Pluggy/Belvo
  ↓
Webhook ou cron sync-open-finance-transactions
  ↓
Supabase
  ├── open_finance_connections
  ├── open_finance_accounts
  ├── open_finance_transaction_map
  └── transactions
```

### 4.3 Tabelas sugeridas

```sql
CREATE TABLE open_finance_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  provider text NOT NULL CHECK (provider IN ('pluggy', 'belvo')),
  provider_item_id text NOT NULL,
  institution_name text,
  status text NOT NULL,
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider, provider_item_id)
);

CREATE TABLE open_finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  connection_id uuid NOT NULL REFERENCES open_finance_connections(id),
  provider_account_id text NOT NULL,
  name text,
  type text,
  currency text,
  balance numeric(14,2),
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, connection_id, provider_account_id)
);

CREATE TABLE open_finance_transaction_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  provider text NOT NULL CHECK (provider IN ('pluggy', 'belvo')),
  provider_transaction_id text NOT NULL,
  transaction_id uuid REFERENCES transactions(id),
  raw_hash text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider, provider_transaction_id)
);
```

Tambem seria desejavel adicionar:

```sql
ALTER TYPE source_type ADD VALUE 'open_finance';
```

### 4.4 Sincronizacao

Existem dois modelos:

#### Cron

Um cron roda algumas vezes por dia:

```text
sync-open-finance-transactions
→ lista conexoes ativas
→ busca transacoes novas desde last_synced_at
→ deduplica
→ insere/atualiza transactions
```

#### Webhook

O provedor chama o FinanceiroJe quando houver atualizacao:

```text
Pluggy/Belvo webhook
→ Edge Function recebe evento
→ valida assinatura
→ agenda sincronizacao da conexao
```

Mesmo com webhook, manter cron de reconciliacao diario e recomendavel.

### 4.5 Status das transacoes importadas

Nao recomendo inserir tudo como confirmado imediatamente no inicio.

Regra inicial:

```text
Open Finance importado
→ data_status = suggested
→ source_type = open_finance
→ confidence = alta
```

Depois de validar por algumas semanas:

```text
Transacoes com campos completos + sem conflito + instituicao confiavel
→ podem entrar como confirmed automaticamente
```

Mas despesas ambigueas, transferencias e pagamentos de cartao devem continuar pedindo revisao.

### 4.6 Beneficios

- Historico bancario real.
- Menos digitacao manual.
- Melhor base para IA Conselheira.
- Melhor calculo de saldo e fluxo de caixa.
- Importacao retroativa.
- Funciona sem depender do celular Android.

### 4.7 Riscos

| Risco | Impacto | Mitigacao |
|---|---:|---|
| Custo B2B alto | Alto | Prototipar antes, avaliar plano minimo |
| Sincronizacao nao ser tempo real | Medio | Usar notificacoes Android como complemento |
| Descricoes ruins do banco | Medio | Categorizar via user_patterns + Modo Espelho |
| Consentimento expirar | Medio | Tela de conexoes com status e renovacao |
| Duplicidade com manual/OCR/notificacao | Alto | Tabela de mapa + deduplicacao aproximada |
| LGPD | Alto | Consentimento, revogacao, exportacao e purge |

### 4.8 Plano de implementacao

#### Fase 0 — Descoberta

- Verificar custo real Pluggy/Belvo.
- Verificar bancos prioritarios:
  - Nubank
  - Itau
  - Caixa
  - C6
  - Inter
  - Santander
  - Mercado Pago/PicPay, se suportados
- Decidir provedor inicial.

#### Fase 1 — Modelo de dados

- Criar tabelas `open_finance_*`.
- Adicionar `source_type = 'open_finance'`.
- Criar tela `/configuracoes/conexoes-bancarias`.

#### Fase 2 — Primeira conexao sandbox

- Criar Edge Function `create-open-finance-connection`.
- Abrir widget/link do provedor no frontend.
- Persistir conexao.

#### Fase 3 — Sincronizacao de transacoes

- Criar Edge Function `sync-open-finance-transactions`.
- Buscar transacoes.
- Mapear para `transactions`.
- Inserir como `suggested`.
- Deduplicar.

#### Fase 4 — Promocao para confirmado

- Definir regras para auto-confirmar.
- Integrar categorias aprendidas.
- Criar tela de revisao em lote.

---

## 5. Comparativo

| Criterio | Android notificacoes | Open Finance |
|---|---|---|
| Tempo real | Quase tempo real | Periodico |
| Confiabilidade | Media | Alta |
| Custo | Baixo para uso pessoal | Pode ser alto |
| Plataforma | Android | Multiplataforma |
| Privacidade | Muito sensivel | Formal via consentimento |
| Risco Play Store | Alto | Menor |
| Historico retroativo | Nao | Sim |
| Melhor uso | Captura imediata | Base financeira oficial |

Conclusao: os caminhos sao complementares, nao concorrentes.

---

## 6. Recomendacao para o FinanceiroJe

### Curto prazo

Criar modo "Notificacao/SMS" na Captura Inteligente.

Motivo:

- Usa a infraestrutura atual.
- Nao exige Android nativo ainda.
- Valida formatos reais de notificacoes.
- Ajuda a treinar parser e deduplicacao.

### Medio prazo

Criar app Android companion.

Motivo:

- Entrega captura quase em tempo real.
- Faz sentido para uso pessoal/familiar.
- Pode ser distribuido fora da Play Store inicialmente.

### Medio/longo prazo

Avaliar Pluggy/Belvo.

Motivo:

- Caminho mais robusto para dados oficiais.
- Melhor base para IA Conselheira e fechamento mensal.
- Importacao retroativa aumenta muito o valor do sistema.

---

## 7. Primeira sprint sugerida

Nome: **D.6 Sprint 1 — Captura por texto de notificacao bancaria**

Objetivo: permitir que o usuario cole uma notificacao/SMS bancario na Captura Inteligente e gere uma transacao sugerida com origem rastreavel.

Entregas:

1. Adicionar modo "Notificacao" na UI da Captura Inteligente.
2. Enviar `source_kind = 'bank_notification'` para `smart-capture-interpret`.
3. Salvar como `source_type = 'sms'`.
4. Ajustar prompt do interpretador com exemplos de notificacoes brasileiras.
5. Criar testes com exemplos de bancos/cartoes.
6. Manter sempre `data_status = 'suggested'` ate confirmacao do usuario.

Definition of Done:

- 10 exemplos reais/sinteticos de notificacoes parseados.
- Valor e tipo corretos em pelo menos 8/10.
- Nenhuma transacao entra como confirmada sem revisao.
- Correcao no Modo Espelho continua gerando evento de aprendizado.

---

## 8. Fontes de referencia

- Android NotificationListenerService: https://developer.android.com/reference/kotlin/android/service/notification/NotificationListenerService
- Capacitor Android: https://capacitorjs.com/docs/android
- Capacitor Plugins: https://capacitorjs.com/docs/plugins
- Pluggy Transactions: https://docs.pluggy.ai/docs/transactions
- Pluggy Open Finance: https://docs.pluggy.ai/docs/open-finance-regulated
- Pluggy rate limits: https://docs.pluggy.ai/docs/rate-limits-of
- Belvo Transactions API: https://developers.belvo.com/apis/belvoopenapispec/transactions/retrievetransactions
- Belvo Open Finance data retrieval limits: https://developers.belvo.com/products/aggregation_brazil/aggregation-brazil-data-retrieval-limits
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play Protect sensitive permissions guidance: https://developers.google.com/android/play-protect/warning-dev-guidance

