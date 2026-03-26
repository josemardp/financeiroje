/**
 * FinanceAI — Engine Determinística
 * Ponto de entrada único para todas as funções de cálculo financeiro.
 *
 * SPRINT 1+: Todas as funções críticas consomem o BACKEND por padrão.
 */

import { backendEngine } from "./backend";

// ─── Cálculos Financeiros (via Backend/Edge Functions) ───────────
export const calculateMonthlySummary = backendEngine.calculateMonthlySummary;
export const calculateBudgetDeviation = backendEngine.calculateBudgetDeviation;
export const calculateHealthScore = backendEngine.calculateHealthScore;
export const calculateCashflowForecast = backendEngine.calculateCashflowForecast;
export const calculateGoalProgress = backendEngine.calculateGoalProgress;
export const calculateLoanIndicators = backendEngine.calculateLoanIndicators;
export const calculateMeiSummary = backendEngine.calculateMeiSummary;
export const calculateFiscalSummary = backendEngine.calculateFiscalSummary;
export const calculateSubscriptionSummary = backendEngine.calculateSubscriptionSummary;
export const calculateDebtStrategies = backendEngine.calculateDebtStrategies;
export const calculateFinancialCalendar = backendEngine.calculateFinancialCalendar;

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

// ─── Schemas de Validação (Zod) ──────────────────────────────────
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

// ─── Mapeadores de Dados ─────────────────────────────────────────
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

// ─── Contratos de Saída Padronizados ─────────────────────────────
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

// ─── Utilitários de Metadados ────────────────────────────────────
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
