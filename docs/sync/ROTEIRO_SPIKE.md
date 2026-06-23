# ROTEIRO DE TESTE — Sprint -1 Spike Android
## FinanceiroJe Sync · Viabilidade do NotificationListenerService

> Preencher após cada experimento. Esta tabela é o go/no-go do projeto.
> Instruções completas em `PROMPT_Sprint_Minus1_Spike_Android.md`.

---

## Aparelho 1: [modelo | OEM | skin | Android versão]

| Cenário | Descrição resumida | FS? | Resultado | Notas |
|---|---|:---:|---|---|
| 1 — Captura básica | 10 notificações geradas → gravadas em Room | Não | ___/10 | |
| 1 — Captura básica | 10 notificações geradas → gravadas em Room | Sim | ___/10 | |
| 2 — Doze ≥ 2h | Tela apagada ≥ 2h → notificações no período → capturadas | Não | ___/___ | |
| 2 — Doze ≥ 2h | Tela apagada ≥ 2h → notificações no período → capturadas | Sim | ___/___ | |
| 3 — Morte de processo | Swipe no recentes → notificação → NLS reiniciou? capturou? | Não | S / N | |
| 3 — Morte de processo | Swipe no recentes → notificação → NLS reiniciou? capturou? | Sim | S / N | |
| 4 — Reinício | Reiniciar sem abrir o app → notificação → capturou? | Não | S / N | |
| 4 — Reinício | Reiniciar sem abrir o app → notificação → capturou? | Sim | S / N | |
| 5 — 24–48h uso normal | Lista de Room continua crescendo após 1–2 dias? | Não | S / N | |
| 5 — 24–48h uso normal | Lista de Room continua crescendo após 1–2 dias? | Sim | S / N | |

**FS = Foreground Service ativo**

---

## Aparelho 2: [modelo | OEM | skin | Android versão]

| Cenário | Descrição resumida | FS? | Resultado | Notas |
|---|---|:---:|---|---|
| 1 — Captura básica | 10 notificações geradas → gravadas em Room | Não | ___/10 | |
| 1 — Captura básica | 10 notificações geradas → gravadas em Room | Sim | ___/10 | |
| 2 — Doze ≥ 2h | Tela apagada ≥ 2h → notificações no período → capturadas | Não | ___/___ | |
| 2 — Doze ≥ 2h | Tela apagada ≥ 2h → notificações no período → capturadas | Sim | ___/___ | |
| 3 — Morte de processo | Swipe no recentes → notificação → NLS reiniciou? capturou? | Não | S / N | |
| 3 — Morte de processo | Swipe no recentes → notificação → NLS reiniciou? capturou? | Sim | S / N | |
| 4 — Reinício | Reiniciar sem abrir o app → notificação → capturou? | Não | S / N | |
| 4 — Reinício | Reiniciar sem abrir o app → notificação → capturou? | Sim | S / N | |
| 5 — 24–48h uso normal | Lista de Room continua crescendo após 1–2 dias? | Não | S / N | |
| 5 — 24–48h uso normal | Lista de Room continua crescendo após 1–2 dias? | Sim | S / N | |

---

## Critérios de go/no-go (binários — PRD §23.2)

- [ ] Captura ≥ 95% das notificações em condições normais (cenário 1)
- [ ] Sobrevive a ≥ 2h de Doze/tela apagada (cenário 2) — registrar se precisa de Foreground Service
- [ ] Recupera captura após reinício do aparelho sem abrir o app (cenário 4)
- [ ] Diferença com vs. sem Foreground Service documentada e quantificada

### Decisão

- [ ] ✅ **GO** — prosseguir para Sprint 0 (parser determinístico + golden files)
- [ ] ❌ **NO-GO** — parar. Reavaliar abordagem antes de comprometer 8 semanas.
  Candidatos: `AccessibilityService`, leitura de SMS, Open Finance.

> Se NO-GO: registrar os números exatos aqui e não avançar para o MVP.
