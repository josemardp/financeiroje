/**
 * FinanceAI — Engine Determinística
 * Ponto de entrada único para todas as funções de cálculo financeiro.
 *
 * Regra central de estados do dado — ver types.ts para documentação completa.
 */
export { calculateMonthlySummary } from "./monthlySummary";
export { calculateBudgetDeviation } from "./budgetDeviation";
export { calculateHealthScore } from "./healthScore";
export { calculateCashflowForecast } from "./cashflowForecast";
export { calculateGoalProgress } from "./goalProgress";
export { calculateLoanIndicators } from "./loanIndicators";
export { filterOfficialTransactions, filterPendingTransactions, OFFICIAL_STATUSES, PENDING_STATUSES, PROJECTION_STATUSES } from "./types";
export type * from "./types";
