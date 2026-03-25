/**
 * FinanceAI — Schemas de Validação (Zod)
 * Validação centralizada para todos os tipos de dados financeiros.
 * Garante integridade de tipos em tempo de execução.
 */

import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────────────

export const DataStatusEnum = z.enum([
  "confirmed",
  "suggested",
  "incomplete",
  "inconsistent",
  "missing",
  "estimated",
]);

export const ScopeEnum = z.enum(["private", "family", "business"]);

export const TransactionTypeEnum = z.enum(["income", "expense"]);

export const ConfidenceEnum = z.enum(["alta", "media", "baixa"]);

export const SourceTypeEnum = z.enum([
  "manual",
  "voice",
  "photo_ocr",
  "free_text",
  "sms",
  "ai_suggestion",
  "system_generated",
]);

export const AmortizationMethodEnum = z.enum(["price", "sac"]);

export const FrequencyEnum = z.enum([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
]);

export const GoalPriorityEnum = z.enum(["alta", "media", "baixa"]);

// ─── Raw Input Schemas ──────────────────────────────────────────

export const TransactionRawSchema = z.object({
  id: z.string(),
  valor: z.number().finite(),
  tipo: TransactionTypeEnum,
  data: z.string().date(),
  descricao: z.string().nullable(),
  categoria_id: z.string().nullable(),
  categoria_nome: z.string().optional().nullable(),
  categoria_icone: z.string().optional().nullable(),
  scope: ScopeEnum.nullable(),
  data_status: DataStatusEnum.nullable(),
  source_type: SourceTypeEnum.nullable(),
  confidence: ConfidenceEnum.nullable(),
  e_mei: z.boolean().nullable(),
});

export const BudgetRawSchema = z.object({
  id: z.string(),
  categoria_id: z.string().nullable(),
  categoria_nome: z.string().optional().nullable(),
  categoria_icone: z.string().optional().nullable(),
  valor_planejado: z.number().finite().nonnegative(),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2000),
  scope: ScopeEnum.nullable(),
});

export const RecurringRawSchema = z.object({
  id: z.string(),
  descricao: z.string(),
  valor: z.number().finite().positive(),
  tipo: TransactionTypeEnum,
  frequencia: FrequencyEnum.nullable(),
  dia_mes: z.number().int().min(1).max(31).nullable(),
  ativa: z.boolean().nullable(),
  categoria_id: z.string().nullable(),
  scope: ScopeEnum.nullable(),
});

export const LoanRawSchema = z.object({
  id: z.string(),
  nome: z.string(),
  valor_original: z.number().finite().positive(),
  saldo_devedor: z.number().finite().nullable(),
  taxa_juros_mensal: z.number().finite().nullable(),
  cet_anual: z.number().finite().nullable(),
  parcelas_total: z.number().int().nullable(),
  parcelas_restantes: z.number().int().nullable(),
  valor_parcela: z.number().finite().nullable(),
  metodo_amortizacao: AmortizationMethodEnum.nullable(),
  tipo: z.string().nullable(),
  credor: z.string().nullable(),
  data_inicio: z.string().date().nullable(),
  ativo: z.boolean().nullable(),
});

export const InstallmentRawSchema = z.object({
  id: z.string(),
  emprestimo_id: z.string(),
  numero: z.number().int().positive(),
  valor: z.number().finite().positive(),
  data_vencimento: z.string().date(),
  data_pagamento: z.string().date().nullable(),
  status: z.string().nullable(),
});

export const ExtraAmortizationRawSchema = z.object({
  id: z.string(),
  emprestimo_id: z.string(),
  valor: z.number().finite().positive(),
  data: z.string().date(),
  economia_juros_calculada: z.number().finite().nullable(),
});

export const GoalRawSchema = z.object({
  id: z.string(),
  nome: z.string(),
  valor_alvo: z.number().finite().positive(),
  valor_atual: z.number().finite().nullable(),
  prazo: z.string().date().nullable(),
  prioridade: GoalPriorityEnum.nullable(),
  ativo: z.boolean().nullable(),
});

export const GoalContributionRawSchema = z.object({
  id: z.string(),
  goal_id: z.string(),
  valor: z.number().finite().positive(),
  data: z.string().date(),
});

// ─── Output Schemas ─────────────────────────────────────────────

export const MonthlySummarySchema = z.object({
  totalIncome: z.number().finite().nonnegative(),
  totalExpense: z.number().finite().nonnegative(),
  balance: z.number().finite(),
  savingsRate: z.number().finite(),
  expenseByCategory: z.array(
    z.object({
      categoryId: z.string().nullable(),
      categoryName: z.string(),
      categoryIcon: z.string(),
      total: z.number().finite().nonnegative(),
      count: z.number().int().nonnegative(),
      percentage: z.number().finite().nonnegative(),
    })
  ),
  incomeByCategory: z.array(
    z.object({
      categoryId: z.string().nullable(),
      categoryName: z.string(),
      categoryIcon: z.string(),
      total: z.number().finite().nonnegative(),
      count: z.number().int().nonnegative(),
      percentage: z.number().finite().nonnegative(),
    })
  ),
  transactionCount: z.number().int().nonnegative(),
  confirmedCount: z.number().int().nonnegative(),
  suggestedCount: z.number().int().nonnegative(),
});

export const BudgetStatusSchema = z.enum(["ok", "warning", "exceeded"]);

export const BudgetDeviationItemSchema = z.object({
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  planned: z.number().finite().nonnegative(),
  actual: z.number().finite().nonnegative(),
  suggestedActual: z.number().finite().nonnegative(),
  deviationAbsolute: z.number().finite(),
  deviationPercent: z.number().finite(),
  status: BudgetStatusSchema,
});

export const BudgetDeviationResultSchema = z.object({
  items: z.array(BudgetDeviationItemSchema),
  totalPlanned: z.number().finite().nonnegative(),
  totalActual: z.number().finite().nonnegative(),
  totalDeviationAbsolute: z.number().finite(),
  totalDeviationPercent: z.number().finite(),
  overallStatus: BudgetStatusSchema,
});

export const HealthScoreResultSchema = z.object({
  scoreGeral: z.number().finite().nullable(),
  comprometimentoRenda: z.number().finite().nullable(),
  reservaEmergencia: z.number().finite().nullable(),
  controleOrcamento: z.number().finite().nullable(),
  adimplencia: z.number().finite().nullable(),
  regularidade: z.number().finite().nullable(),
  recommendations: z.array(
    z.object({
      component: z.string(),
      score: z.number().finite().nullable(),
      message: z.string(),
      severity: z.enum(["critical", "warning", "info", "ok"]),
    })
  ),
  availableComponents: z.number().int().nonnegative(),
  totalComponents: z.number().int().nonnegative(),
});

export const ForecastHorizonSchema = z.object({
  days: z.number().int().positive(),
  label: z.string(),
  projectedBalance: z.number().finite(),
  totalInflows: z.number().finite().nonnegative(),
  totalOutflows: z.number().finite().nonnegative(),
  confidenceLevel: ConfidenceEnum,
});

export const CashflowForecastResultSchema = z.object({
  currentMonthlyBalance: z.number().finite(),
  horizons: z.array(ForecastHorizonSchema),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const GoalProgressResultSchema = z.object({
  goalId: z.string(),
  goalName: z.string(),
  progressPercent: z.number().finite().min(0).max(100),
  remainingAmount: z.number().finite(),
  projectedCompletionDate: z.string().date().nullable(),
  monthlyContributionNeeded: z.number().finite().nullable(),
  isOnTrack: z.boolean(),
  totalContributed: z.number().finite().nonnegative(),
});

export const LoanIndicatorResultSchema = z.object({
  loanId: z.string(),
  loanName: z.string(),
  saldoAtual: z.number().finite().nonnegative(),
  parcelasRestantes: z.number().int().nonnegative(),
  custoEstimadoRestante: z.number().finite().nonnegative(),
  totalJaPago: z.number().finite().nonnegative(),
  totalAPagar: z.number().finite().nonnegative(),
  impactoAmortizacaoExtra: z.number().finite().nonnegative(),
  taxaMensal: z.number().finite(),
  cetAnual: z.number().finite(),
});

export const LoanSummarySchema = z.object({
  loans: z.array(LoanIndicatorResultSchema),
  totalSaldoDevedor: z.number().finite().nonnegative(),
  totalCustoRestante: z.number().finite().nonnegative(),
  totalParcelas: z.number().int().nonnegative(),
});

// ─── Type Exports ───────────────────────────────────────────────

export type TransactionRaw = z.infer<typeof TransactionRawSchema>;
export type BudgetRaw = z.infer<typeof BudgetRawSchema>;
export type RecurringRaw = z.infer<typeof RecurringRawSchema>;
export type LoanRaw = z.infer<typeof LoanRawSchema>;
export type InstallmentRaw = z.infer<typeof InstallmentRawSchema>;
export type ExtraAmortizationRaw = z.infer<typeof ExtraAmortizationRawSchema>;
export type GoalRaw = z.infer<typeof GoalRawSchema>;
export type GoalContributionRaw = z.infer<typeof GoalContributionRawSchema>;
export type MonthlySummary = z.infer<typeof MonthlySummarySchema>;
export type BudgetDeviationResult = z.infer<typeof BudgetDeviationResultSchema>;
export type HealthScoreResult = z.infer<typeof HealthScoreResultSchema>;
export type CashflowForecastResult = z.infer<typeof CashflowForecastResultSchema>;
export type GoalProgressResult = z.infer<typeof GoalProgressResultSchema>;
export type LoanIndicatorResult = z.infer<typeof LoanIndicatorResultSchema>;
export type LoanSummary = z.infer<typeof LoanSummarySchema>;
