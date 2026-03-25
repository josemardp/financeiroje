# Sprint 0: Análise de Dívida Técnica - Lógica Crítica no Frontend

## 1. REGRAS CRÍTICAS ENCONTRADAS NO FRONTEND

### 1.1 Orquestração de Alertas (Alerts.tsx, linhas 76-173)

**Localização:** `src/pages/Alerts.tsx`

**Descrição:** A página realiza orquestração completa de dados financeiros no cliente:
1. Busca transações, budgets, recurrings, loans, installments, amortizations
2. Mapeia manualmente para tipos da engine
3. Filtra transações oficiais
4. Calcula resumo mensal
5. Calcula desvio orçamentário
6. Calcula previsão de caixa
7. Calcula indicadores de dívida
8. Monta contadores de qualidade de dados
9. Gera alertas

**Problema:** Toda essa lógica deveria estar em uma Edge Function ou API backend.

**Impacto:** 
- Duplicação com HealthScore.tsx, Dashboard.tsx, MonthlyClosing.tsx
- Lógica crítica exposta no frontend
- Possibilidade de inconsistência entre páginas

**Complexidade:** Alta (200+ linhas de lógica)

**Prioridade:** 🔴 Crítica

---

### 1.2 Cálculo de Score Financeiro (HealthScore.tsx, linhas 24-88)

**Localização:** `src/pages/HealthScore.tsx`

**Descrição:** A página calcula o score de saúde financeira no cliente:
1. Busca transações, budgets, loans, installments, amortizations
2. Mapeia manualmente para tipos da engine
3. Filtra transações oficiais
4. Calcula totais de receita e despesa
5. Calcula indicadores de dívida
6. Calcula desvio orçamentário
7. Conta parcelas vencidas
8. Chama `calculateHealthScore`

**Problema:** Score é um KPI crítico que deveria ser determinístico no backend.

**Impacto:**
- Possibilidade de inconsistência se o frontend recalcular
- Score pode variar entre páginas
- Difícil de auditar

**Complexidade:** Média (70 linhas de lógica)

**Prioridade:** 🔴 Crítica

---

### 1.3 Cálculo de Saldo de Contas (Accounts.tsx, linhas 56-76)

**Localização:** `src/pages/Accounts.tsx`

**Descrição:** A página calcula saldo de contas no cliente:
1. Busca transações com `account_id`
2. Filtra apenas confirmadas (ou null)
3. Soma manualmente: income - expense por account_id
4. Calcula saldo total: saldo_inicial + movimentações

**Problema:** Saldo é um valor crítico que deveria ser calculado no backend.

**Impacto:**
- Risco de desincronização com dados reais
- Múltiplas páginas fazem o mesmo cálculo (Dashboard, Accounts)
- Difícil manter consistência

**Complexidade:** Baixa (20 linhas de lógica)

**Prioridade:** 🔴 Crítica

---

### 1.4 Agregações no Dashboard (Dashboard.tsx)

**Localização:** `src/pages/Dashboard.tsx`

**Descrição:** O dashboard agrega múltiplos domínios no cliente:
1. Calcula saldo total de contas
2. Identifica metas em risco
3. Calcula cobertura de reserva de emergência
4. Monta lista de transações recentes
5. Agrega alertas

**Problema:** Múltiplas agregações críticas no cliente.

**Impacto:**
- Dificuldade de manutenção
- Inconsistência com outras páginas
- Lógica espalhada

**Complexidade:** Alta (150+ linhas de lógica)

**Prioridade:** 🟠 Alta

---

### 1.5 Snapshots de Fechamento Mensal (MonthlyClosing.tsx, linhas 135-189)

**Localização:** `src/pages/MonthlyClosing.tsx`

**Descrição:** A página monta snapshots críticos de auditoria no cliente:
1. Calcula budget snapshot
2. Calcula score snapshot
3. Monta lista de pendências
4. Calcula qualidade de dados
5. Gera resumo textual

**Problema:** Snapshots críticos de auditoria sendo montados no frontend.

**Impacto:**
- Falta de garantia de integridade dos dados persistidos
- Difícil auditar o que foi calculado
- Possibilidade de inconsistência

**Complexidade:** Média (60 linhas de lógica)

**Prioridade:** 🔴 Crítica

---

### 1.6 Mapeamento de Dados (Múltiplas páginas)

**Localização:** Alerts.tsx, HealthScore.tsx, MonthlyClosing.tsx, Dashboard.tsx, Accounts.tsx

**Descrição:** Cada página mapeia dados do Supabase manualmente:
```typescript
const rawTxns: TransactionRaw[] = (txRes.data || []).map((t: any) => ({
  id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
  categoria_id: t.categoria_id, categoria_nome: t.categories?.nome, categoria_icone: t.categories?.icone,
  scope: t.scope, data_status: t.data_status, source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
}));
```

**Problema:** Mesmo mapeamento repetido 5+ vezes.

**Impacto:**
- Duplicação de código
- Difícil manter consistência
- Risco de inconsistência de tipos

**Complexidade:** Baixa (mas repetida)

**Prioridade:** 🟡 Média

---

## 2. SUGESTÃO OBJETIVA DE MIGRAÇÃO

### Fase 1: Consolidação (Sprint 0) ✅ CONCLUÍDO

- [x] Criar mapeadores consolidados (`mappers.ts`)
- [x] Criar schemas de validação (`schemas.ts`)
- [x] Criar contratos de saída (`contracts.ts`)
- [x] Criar utilitários de metadados (`metadata.ts`)

### Fase 2: Migração de Alertas (Sprint 1) - PRÓXIMO

**Criar Edge Function:** `supabase/functions/generate-alerts`

```typescript
// supabase/functions/generate-alerts/index.ts
export async function generateAlerts(req: Request) {
  const { userId, month, year, scope } = await req.json();
  
  // Buscar dados
  const transactions = await fetchTransactions(userId, month, year, scope);
  const budgets = await fetchBudgets(userId, month, year, scope);
  // ... resto dos dados
  
  // Mapear
  const txns = mapTransactions(transactions);
  const budgs = mapBudgets(budgets);
  // ... resto do mapeamento
  
  // Calcular
  const official = filterOfficialTransactions(txns);
  const summary = calculateMonthlySummary(official);
  const deviation = calculateBudgetDeviation(budgs, txns, month, year);
  // ... resto dos cálculos
  
  // Gerar alertas
  const alerts = generateAlerts({
    totalIncome: summary.totalIncome,
    // ... resto dos parâmetros
  });
  
  return new Response(JSON.stringify(alerts), { status: 200 });
}
```

**Benefícios:**
- Lógica centralizada
- Reutilizável por múltiplas páginas
- Determinístico
- Auditável

**Impacto em Alerts.tsx:**
```typescript
// Antes: 100+ linhas de orquestração
// Depois:
const { data: alerts } = await supabase.functions.invoke('generate-alerts', {
  body: { userId, month, year, scope }
});
```

---

### Fase 3: Migração de HealthScore (Sprint 1)

**Criar Edge Function:** `supabase/functions/calculate-health-score`

**Benefícios:**
- Score centralizado
- Consistência garantida
- Auditável

---

### Fase 4: Migração de Saldo de Contas (Sprint 1)

**Criar Edge Function:** `supabase/functions/calculate-account-balances`

**Benefícios:**
- Saldo centralizado
- Reutilizável por Dashboard, Accounts, etc
- Consistência garantida

---

### Fase 5: Auditoria Completa (Sprint 2)

**Adicionar metadados em tabelas críticas:**
- `created_by` em transactions, budgets, loans, goals
- `updated_by` em todas as tabelas
- Triggers de auditoria para todas as operações críticas

---

## 3. ORDEM RECOMENDADA DE MIGRAÇÃO

| Prioridade | Módulo | Complexidade | Impacto | Sprint |
|-----------|--------|-------------|--------|--------|
| 🔴 Crítica | Alertas | Alta | Alto | Sprint 1 |
| 🔴 Crítica | HealthScore | Média | Alto | Sprint 1 |
| 🔴 Crítica | Saldo de Contas | Baixa | Médio | Sprint 1 |
| 🔴 Crítica | Snapshots de Fechamento | Média | Alto | Sprint 2 |
| 🟠 Alta | Dashboard | Alta | Médio | Sprint 2 |
| 🟡 Média | Mapeamento de Dados | Baixa | Baixo | Sprint 0 ✅ |

---

## 4. CHECKLIST DE VALIDAÇÃO MANUAL

### Alertas.tsx
- [ ] Verificar se todos os alertas são gerados corretamente
- [ ] Verificar se os contadores de qualidade estão corretos
- [ ] Verificar se as recomendações de ação estão corretas
- [ ] Testar com dados incompletos
- [ ] Testar com dados inconsistentes

### HealthScore.tsx
- [ ] Verificar se o score geral está correto
- [ ] Verificar se os componentes estão corretos
- [ ] Verificar se as recomendações estão corretas
- [ ] Testar com dados insuficientes
- [ ] Testar com dados conflitantes

### Accounts.tsx
- [ ] Verificar se o saldo total está correto
- [ ] Verificar se o saldo por conta está correto
- [ ] Testar com múltiplas contas
- [ ] Testar com contas inativas
- [ ] Testar com transações pendentes

### MonthlyClosing.tsx
- [ ] Verificar se o snapshot de budget está correto
- [ ] Verificar se o snapshot de score está correto
- [ ] Verificar se as pendências estão listadas
- [ ] Verificar se o resumo textual está correto
- [ ] Testar reabertura de mês fechado

### Dashboard.tsx
- [ ] Verificar se o saldo total está correto
- [ ] Verificar se as metas em risco estão corretas
- [ ] Verificar se a reserva de emergência está correta
- [ ] Verificar se os alertas estão corretos
- [ ] Testar com múltiplos escopos

---

## 5. IMPACTO ESTIMADO

| Métrica | Valor |
|---------|-------|
| Linhas de código a migrar | ~500 |
| Páginas afetadas | 5 |
| Edge Functions a criar | 3 |
| Tabelas a modificar | 6 |
| Testes a adicionar | 20+ |
| Tempo estimado (Sprint 1) | 40 horas |
| Tempo estimado (Sprint 2) | 30 horas |
| Tempo estimado (Sprint 3) | 20 horas |

---

## 6. RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|-----------|
| Inconsistência entre frontend e backend | Alta | Alto | Testes automatizados |
| Performance de Edge Functions | Média | Médio | Caching, índices DB |
| Quebra de funcionalidades existentes | Média | Alto | Testes de regressão |
| Dificuldade de rollback | Baixa | Alto | Versionamento de APIs |

---

## 7. MÉTRICAS DE SUCESSO

- [ ] Todas as orquestração de dados movidas para Edge Functions
- [ ] Sem duplicação de mapeamento de dados
- [ ] 100% de cobertura de testes para lógica crítica
- [ ] Tempo de resposta das páginas reduzido em 30%
- [ ] Auditoria completa de todas as operações críticas
- [ ] Documentação atualizada
