# DECISOES_TECNICAS — FinanceiroJe

---

### 2026-04-08 — T1.2 concluída com quebra de assinatura

**Decisão:**  
getCaptureContext agora recebe userId

**Motivo:**  
permitir integração do snapshot comportamental

**Impacto:**  
todas as chamadas foram atualizadas no SmartCapture

---

### 2026-04-08 — Snapshot integrado no contextBlock

**Decisão:**  
adicionar perfil_usuario ao contexto enviado ao LLM

**Motivo:**  
melhorar assertividade da captura

**Impacto:**  
LLM passa a considerar comportamento do usuário

---

### 2026-04-08 — T1.4 absorvida dentro da T1.2

**Decisão:**  
atualizar chamadas junto com refatoração

**Motivo:**  
dependência direta da mudança de assinatura

**Impacto:**  
T1.4 já executada na prática
