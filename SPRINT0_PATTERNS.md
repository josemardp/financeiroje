# Sprint 0: Padrões e Convenções Implementadas

## 1. Validação com Zod

Todos os tipos de dados financeiros agora possuem schemas Zod correspondentes em `src/services/financeEngine/schemas.ts`.

### Uso em Páginas

**Antes (sem validação):**
```typescript
const rawTxns: TransactionRaw[] = (txRes.data || []).map((t: any) => ({
  id: t.id,
  valor: Number(t.valor),
  // ... mapeamento manual
}));
```

**Depois (com validação):**
```typescript
import { mapTransactions } from "@/services/financeEngine/mappers";

const rawTxns = mapTransactions(txRes.data || []);
// Mapeamento automático + validação integrada
```

## 2. Mapeadores Consolidados

Todos os mapeamentos de dados do Supabase foram consolidados em `src/services/financeEngine/mappers.ts`.

### Funções Disponíveis

- `mapTransaction(row)` → `TransactionRaw`
- `mapTransactions(rows)` → `TransactionRaw[]`
- `mapBudget(row)` → `BudgetRaw`
- `mapBudgets(rows)` → `BudgetRaw[]`
- `mapRecurring(row)` → `RecurringRaw`
- `mapRecurrings(rows)` → `RecurringRaw[]`
- `mapLoan(row)` → `LoanRaw`
- `mapLoans(rows)` → `LoanRaw[]`
- `mapInstallment(row)` → `InstallmentRaw`
- `mapInstallments(rows)` → `InstallmentRaw[]`
- `mapExtraAmortization(row)` → `ExtraAmortizationRaw`
- `mapExtraAmortizations(rows)` → `ExtraAmortizationRaw[]`
- `mapGoal(row)` → `GoalRaw`
- `mapGoals(rows)` → `GoalRaw[]`
- `mapGoalContribution(row)` → `GoalContributionRaw`
- `mapGoalContributions(rows)` → `GoalContributionRaw[]`
- `mapFinancialDataBatch(batch)` → Consolidado

### Exemplo de Uso

```typescript
import {
  mapTransactions,
  mapBudgets,
  mapLoans,
  mapInstallments,
} from "@/services/financeEngine/mappers";

const { data: txRes } = await supabase.from("transactions").select("*");
const { data: budRes } = await supabase.from("budgets").select("*");
const { data: loanRes } = await supabase.from("loans").select("*");
const { data: instRes } = await supabase.from("loan_installments").select("*");

const transactions = mapTransactions(txRes);
const budgets = mapBudgets(budRes);
const loans = mapLoans(loanRes);
const installments = mapInstallments(instRes);
```

## 3. Contratos de Saída Padronizados

Cada domínio financeiro agora possui um contrato de saída bem definido em `src/services/financeEngine/contracts.ts`.

### Contratos Disponíveis

- `MonthlyReport` - Relatório mensal consolidado
- `HealthReport` - Relatório de saúde financeira
- `AlertsReport` - Relatório de alertas
- `AccountsReport` - Relatório de contas
- `BudgetReport` - Relatório de orçamento
- `ForecastReport` - Relatório de previsão de caixa
- `GoalsReport` - Relatório de metas
- `DebtsReport` - Relatório de dívidas
- `MonthlyClosingReport` - Snapshot de fechamento mensal

### Estrutura Comum

Todos os relatórios incluem:
- `period` - Período do relatório (mês/ano)
- `scope` - Escopo (private/family/business/all)
- `metadata` - Metadados de rastreabilidade

### Exemplo de Uso

```typescript
import type { MonthlyReport, HealthReport } from "@/services/financeEngine/contracts";

const monthlyReport: MonthlyReport = {
  period: { month: 3, year: 2026 },
  scope: "private",
  official: summary,
  pending: { count: 2, totalValue: 150, byStatus: { suggested: 2 } },
  dataQuality: { /* ... */ },
  metadata: createMetadata("system_generated", "alta", "confirmed"),
};
```

## 4. Metadados de Rastreabilidade

Todos os dados agora incluem metadados obrigatórios em `src/services/financeEngine/metadata.ts`.

### Interface DataMetadata

```typescript
interface DataMetadata {
  source: "manual" | "voice" | "photo_ocr" | "free_text" | "sms" | "ai_suggestion" | "system_generated" | null;
  confidence: "alta" | "media" | "baixa" | null;
  status: "confirmed" | "suggested" | "incomplete" | "inconsistent" | "missing" | "estimated";
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}
```

### Funções Disponíveis

- `createMetadata(source, confidence, status, createdBy?)` - Cria metadados novos
- `updateMetadata(metadata, updates)` - Atualiza metadados existentes
- `inferDataStatus(data)` - Infere status automaticamente
- `inferConfidenceLevel(data)` - Infere confiança automaticamente
- `validateMetadata(metadata)` - Valida metadados
- `calculateMetadataQuality(metadata)` - Calcula qualidade (0-100)
- `groupByStatus(items)` - Agrupa por status
- `groupBySource(items)` - Agrupa por origem
- `groupByConfidence(items)` - Agrupa por confiança
- `calculateMetadataStats(items)` - Calcula estatísticas
- `generateTraceabilityReport(metadata)` - Gera relatório de rastreabilidade

### Exemplo de Uso

```typescript
import {
  createMetadata,
  inferDataStatus,
  calculateMetadataQuality,
} from "@/services/financeEngine/metadata";

const metadata = createMetadata("manual", "alta", "confirmed", userId);

const quality = calculateMetadataQuality(metadata);
console.log(`Qualidade: ${quality.level} (${quality.score}/100)`);

const status = inferDataStatus({
  hasRequiredFields: true,
  hasConflicts: false,
  isEstimate: false,
  userConfirmed: true,
});
```

## 5. Migração de Páginas Existentes

### Alertas.tsx - Antes vs Depois

**Antes (Linhas 82-130):**
```typescript
const rawTxns: TransactionRaw[] = (financialData.transactions).map((t: any) => ({
  id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
  categoria_id: t.categoria_id, categoria_nome: t.categories?.nome, categoria_icone: t.categories?.icone,
  scope: t.scope, data_status: t.data_status, source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
}));
// ... repetir para budgets, loans, installments
```

**Depois:**
```typescript
import {
  mapTransactions,
  mapBudgets,
  mapLoans,
  mapInstallments,
} from "@/services/financeEngine/mappers";

const rawTxns = mapTransactions(financialData.transactions);
const budgets = mapBudgets(financialData.budgets);
const loans = mapLoans(financialData.loans);
const installments = mapInstallments(financialData.installments);
```

## 6. Checklist de Implementação para Próximas Páginas

Ao refatorar uma página, seguir este checklist:

- [ ] Substituir mapeamentos manuais por funções do `mappers.ts`
- [ ] Adicionar tipos explícitos (não usar `any`)
- [ ] Usar schemas Zod para validação quando necessário
- [ ] Adicionar metadados aos dados críticos
- [ ] Usar contratos de saída padronizados
- [ ] Documentar origem dos dados (source)
- [ ] Adicionar nível de confiança
- [ ] Testar com dados incompletos
- [ ] Testar com dados inconsistentes

## 7. Próximas Sprints

### Sprint 1: Migração de Lógica Crítica

1. **Alertas.tsx** - Migrar orquestração para Edge Function
2. **HealthScore.tsx** - Migrar cálculo para Edge Function
3. **Accounts.tsx** - Migrar cálculo de saldo para Edge Function

### Sprint 2: Auditoria Completa

1. Implementar `created_by`/`updated_by` em todas as tabelas críticas
2. Criar sistema de versioning
3. Implementar dashboard de qualidade de dados

### Sprint 3: Validação em Tempo Real

1. Integrar Zod em todas as operações
2. Criar middleware de validação
3. Implementar testes automáticos

## 8. Referências

- **Schemas:** `src/services/financeEngine/schemas.ts`
- **Mapeadores:** `src/services/financeEngine/mappers.ts`
- **Contratos:** `src/services/financeEngine/contracts.ts`
- **Metadados:** `src/services/financeEngine/metadata.ts`
- **Índice:** `src/services/financeEngine/index.ts`
