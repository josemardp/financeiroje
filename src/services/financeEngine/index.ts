/**
 * FinanceAI — Engine Determinística
 * Ponto de entrada único para todas as funções de cálculo financeiro.
 *
 * Regra central de estados do dado — ver types.ts para documentação completa.
 */

// ─── Cálculos Financeiros ────────────────────────────────────────
export { calculateMonthlySummary } from "./monthlySummary";
export { calculateBudgetDeviation } from "./budgetDeviation";
export { calculateHealthScore } from "./healthScore";
export { calculateCashflowForecast } from "./cashflowForecast";
export { calculateGoalProgress } from "./goalProgress";
export { calculateLoanIndicators } from "./loanIndicators";

// ─── Filtros de Status ───────────────────────────────────────────
export {
  filterOfficialTransactions,
  filterPendingTransactions,
  OFFICIAL_STATUSES,
  PENDING_STATUSES,
  PROJECTION_STATUSES,
} from "./types";

// ─── Tipos Base ──────────────────────────────────────────────────
export type * from "./types";

// ─── Schemas de Validação (Zod) ─────────────────────────────────
export {
  DataStatusEnum,
  ScopeEnum,
  TransactionTypeEnum,
  ConfidenceEnum,
  SourceTypeEnum,
  AmortizationMethodEnum,
  FrequencyEnum,
  GoalPriorityEnum,
  TransactionRawSchema,
  BudgetRawSchema,
  RecurringRawSchema,
  LoanRawSchema,
  InstallmentRawSchema,
  ExtraAmortizationRawSchema,
  GoalRawSchema,
  GoalContributionRawSchema,
  MonthlySummarySchema,
  BudgetStatusSchema,
  BudgetDeviationItemSchema,
  BudgetDeviationResultSchema,
  HealthScoreResultSchema,
  ForecastHorizonSchema,
  CashflowForecastResultSchema,
  GoalProgressResultSchema,
  LoanIndicatorResultSchema,
  LoanSummarySchema,
} from "./schemas";

// ─── Mapeadores de Dados ────────────────────────────────────────
export {
  mapTransaction,
  mapTransactions,
  mapBudget,
  mapBudgets,
  mapRecurring,
  mapRecurrings,
  mapLoan,
  mapLoans,
  mapInstallment,
  mapInstallments,
  mapExtraAmortization,
  mapExtraAmortizations,
  mapGoal,
  mapGoals,
  mapGoalContribution,
  mapGoalContributions,
  mapFinancialDataBatch,
} from "./mappers";

// ─── Contratos de Saída Padronizados ────────────────────────────
export type {
  DataMetadata,
  MonthlyReport,
  HealthReport,
  AlertsReport,
  AccountsReport,
  BudgetReport,
  ForecastReport,
  GoalsReport,
  DebtsReport,
  MonthlyClosingReport,
} from "./contracts";

// ─── Utilitários de Metadados ───────────────────────────────────
export {
  createMetadata,
  updateMetadata,
  inferDataStatus,
  inferConfidenceLevel,
  validateMetadata,
  calculateMetadataQuality,
  groupByStatus,
  groupBySource,
  groupByConfidence,
  calculateMetadataStats,
  generateTraceabilityReport,
} from "./metadata";
