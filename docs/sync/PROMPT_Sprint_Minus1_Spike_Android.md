## Contexto (manter adiante — não reabrir decisões)

Você vai construir um **spike técnico descartável** (Sprint -1) do projeto **FinanceiroJe Sync**: um app companion Android que, no futuro, capturará notificações bancárias e as transformará em lançamentos financeiros. ESTE spike NÃO é o produto. O objetivo é UM SÓ: **descobrir, em aparelhos Android reais, se o `NotificationListenerService` (NLS) captura notificações de forma confiável e as persiste localmente sem perder nenhuma** — antes de comprometer 8 semanas de desenvolvimento.

Decisões de arquitetura já travadas (NÃO discutir, NÃO sugerir alternativas):
- Linguagem: **Kotlin**. UI: **Jetpack Compose**. Persistência local: **Room**. (Não usar Flutter, não usar XML views.)
- A captura identifica a fonte SEMPRE por `StatusBarNotification.packageName` do sistema — NUNCA pelo conteúdo do texto.
- Cada notificação capturada é persistida em Room **imediatamente**, antes de qualquer outra coisa.
- Identidade de evento (idempotência): `event_key = SHA-256(device_installation_id | notification_key | post_time)`, onde `notification_key = sbn.key` e `post_time = sbn.postTime`.
- `device_installation_id`: gerar **um UUID aleatório na primeira execução** e persistir em DataStore/SharedPreferences. Reusar sempre o mesmo valor nas execuções seguintes. (Não usar ANDROID_ID neste spike.)

## Papel

Você é um engenheiro Android sênior especializado em serviços de background e no ciclo de vida agressivo do Android (Doze, App Standby, Background Execution Limits, skins de OEM). Você prioriza confiabilidade de captura e clareza de medição acima de qualquer elegância de código.

## Tarefa

Construir um app Android mínimo que faça EXATAMENTE isto, e nada além:

1. **NotificationListenerService** que recebe `onNotificationPosted(sbn)`.
2. **Filtro por lista fechada de pacotes** (apps bancários). Notificação de pacote fora da lista → descartar sem persistir. Lista inicial (deixar como constante editável no código):
   - `com.nu.production` (Nubank)
   - `br.com.intermedium` (Inter)
   - `com.mercadopago.wallet` (Mercado Pago)
   - `com.itau` (Itaú)
   - `com.bradesco` (Bradesco)
   *(Confirme os package names reais dos apps instalados nos aparelhos de teste antes de fixar; se algum diferir, ajuste a constante e avise.)*
3. Para cada notificação aceita: calcular `event_key`, extrair `packageName`, `title` (`extras.getString(EXTRA_TITLE)`), `body` (`extras.getString(EXTRA_TEXT)`), `post_time`, e gravar em Room **imediatamente** com um campo `captured_at` (hora local do dispositivo). Se o mesmo `event_key` já existir, NÃO duplicar (UNIQUE em `event_key`).
4. **Tela única (Compose)** que lista, em ordem decrescente de captura, tudo que foi gravado em Room: app, título, corpo, `post_time`, `captured_at`, `event_key` (abreviado). Atualização reativa (Flow/observeAsState). Incluir no topo um contador total e um indicador "NLS ativo / inativo" (verificar se o componente do listener está habilitado em `Settings.Secure` enabled_notification_listeners).
5. Botão/tela que leva o usuário às **configurações de acesso a notificações** do Android (`ACTION_NOTIFICATION_LISTENER_SETTINGS`).
6. **Toggle de Foreground Service:** implementar a opção de rodar (ou não) um foreground service com notificação `PRIORITY_MIN`/`IMPORTANCE_MIN`, para que o teste compare sobrevivência do NLS **com e sem** foreground service. Deixar isso ligável/desligável para os experimentos.

## Trava de escopo — NÃO FAÇA (crítico)

- **NÃO** criar backend, Supabase, Edge Functions, chamadas de rede, nem enviar nada para lugar nenhum. Tudo é 100% local.
- **NÃO** implementar login/autenticação, IA, parsing de transação, categorização, deduplicação semântica, RLS, nem o PWA.
- **NÃO** adicionar bibliotecas além de: Compose, Room, DataStore/Preferences, e o necessário para coroutines. Pergunte antes de incluir qualquer outra dependência.
- **NÃO** refatorar, generalizar ou "preparar para o futuro". Este código é descartável. Faça apenas o solicitado.

## Protocolo de teste (você entrega o app + este roteiro de experimentos para eu rodar nos aparelhos)

Gere, junto do código, um arquivo `ROTEIRO_SPIKE.md` com os passos para eu executar manualmente em cada aparelho real:

1. **Captura básica:** instalar, conceder acesso a notificações, gerar 10 notificações de teste dos apps da lista (PIX de R$ 0,01 entre contas próprias, ou notificações reais) → verificar que 10/10 aparecem na lista.
2. **Tela apagada / Doze:** deixar o aparelho parado com tela apagada por ≥ 2h, gerar notificações no período → verificar quantas foram capturadas. Repetir **com** e **sem** foreground service.
3. **Morte de processo:** remover o app das recentes (swipe), gerar notificação → verificar se o NLS é reiniciado pelo sistema e captura.
4. **Reinício do aparelho:** reiniciar o celular SEM reabrir o app, gerar notificação → verificar se captura.
5. **Morte silenciosa (24–48h):** uso normal por 1–2 dias → verificar se `onNotificationPosted` continua sendo chamado (a lista continua crescendo).

Aparelhos-alvo (rodar em pelo menos 2, priorizando skins agressivas):
| OEM | Skin | Prioridade |
|---|---|---|
| Samsung | One UI | P0 (maior base no BR) |
| Xiaomi | HyperOS/MIUI | P0 (mais agressivo com bateria) |
| Motorola / Google Pixel | Próximo do AOSP | P1 (baseline) |

## Critérios de sucesso do spike (binários — este é o gate)

- [ ] Captura ≥ 95% das notificações de teste em condições normais (cenário 1).
- [ ] Sobrevive a ≥ 2h de tela apagada/Doze capturando notificações (cenário 2) — registrando se precisou de foreground service para isso.
- [ ] Recupera captura após reinício do aparelho (cenário 4).
- [ ] Mede e documenta a diferença de confiabilidade **com vs. sem** foreground service.

**Se os critérios NÃO forem atingidos em nenhuma configuração:** PARE. Não prossiga para o MVP. Reporte os números e recomende reavaliar a abordagem (ex.: AccessibilityService ou outra estratégia) antes de comprometer as 8 semanas.

## Entregável de medição

Ao final, preencher no `ROTEIRO_SPIKE.md` uma tabela por aparelho: `modelo × skin/Android × cenário (1–5) × resultado (capturou X/Y) × foreground service (sim/não)`. Essa tabela é o que decide o go/no-go do projeto.

## Regras de trabalho (obrigatórias)

1. Siga a sequência **entender → planejar → confirmar → executar**. Antes de escrever código, apresente um plano curto de arquivos/passos e **aguarde minha confirmação**.
2. **NÃO** faça `git commit` nem `git push` em nenhuma hipótese sem eu autorizar explicitamente.
3. Após cada etapa concluída, emita: ✅ [o que foi feito].
4. **Pare e pergunte antes de:** instalar qualquer dependência nova, deletar/sobrescrever arquivos, ou qualquer ação destrutiva.
5. Se algo no ambiente real divergir destas instruções (ex.: package name diferente), **sinalize e pergunte** em vez de adivinhar.

---

🎯 **Ferramenta:** Claude Code · 💡 Otimizado para Claude Opus 4.x em tarefa agêntica: trava de escopo forte (impede o modelo de construir backend/IA/PWA por conta própria), decisões de arquitetura e `device_installation_id` fixados no topo (sobrevivem ao decaimento de atenção), critérios de sucesso binários e checkpoint humano antes de executar e antes de qualquer commit.

> **Nota de configuração:** antes de colar, abra o Claude Code na pasta vazia onde o spike vai morar (ele é descartável e separado do repositório do MVP). Confirme que você tem pelo menos 2 aparelhos Android físicos para os testes — emulador não serve para validar Doze/OEM.
