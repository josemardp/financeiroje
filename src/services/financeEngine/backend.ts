import { supabase } from "@/integrations/supabase/client";
import type { 
  HealthScoreInput, HealthScoreResult, 
  BudgetRaw, TransactionRaw, BudgetDeviationResult,
  CashflowForecastInput, CashflowForecastResult,
  GoalRaw, GoalContributionRaw, GoalProgressResult,
  LoanRaw, InstallmentRaw, LoanSummary,
  MonthlySummary
} from "./types";

/**
 * Chama a Engine Determinística no Backend (Edge Functions).
 */
async function callEngine<T>(operation: string, data: any): Promise<T> {
  const { data: response, error } = await supabase.functions.invoke("finance-engine", {
    body: { operation, data },
  });

  if (error) {
    console.error(`Erro ao chamar engine (${operation}):`, error);
    throw error;
  }

  return response.result as T;
}

export const backendEngine = {
  calculateHealthScore: (input: HealthScoreInput) => 
    callEngine<HealthScoreResult>("calculate-health-score", input),
  
  calculateBudgetDeviation: (budgets: BudgetRaw[], transactions: TransactionRaw[]) => 
    callEngine<BudgetDeviationResult>("calculate-budget-deviation", { budgets, transactions }),
  
  calculateCashflowForecast: (input: CashflowForecastInput) => 
    callEngine<CashflowForecastResult>("calculate-forecast", input),
  
  calculateGoalProgress: (goals: GoalRaw[], contributions: GoalContributionRaw[]) => 
    callEngine<GoalProgressResult[]>("calculate-goal-progress", { goals, contributions }),
  
  calculateLoanIndicators: (loans: LoanRaw[], installments: InstallmentRaw[]) => 
    callEngine<LoanSummary>("calculate-loan-indicators", { loans, installments }),
  
  calculateMonthlySummary: (transactions: TransactionRaw[]) => 
    callEngine<MonthlySummary>("calculate-monthly-summary", { transactions }),

  calculateMeiSummary: (transactions: TransactionRaw[], annualLimit: number) =>
    callEngine<Record<string, any>>("calculate-mei-summary", { transactions, annualLimit }),
};
