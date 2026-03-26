/**
 * FinanceAI — Engine Determinística
 * Tipos centralizados para todas as funções puras de cálculo financeiro.
 * Separação clara: raw DB data → calculated outputs.
 *
 * ═══════════════════════════════════════════════════════════════════
 * REGRA CENTRAL DE ESTADOS DO DADO (PRD v3 §5)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  confirmed    → Cálculo OFICIAL. Dado validado pelo usuário.
 *  estimated    → Apenas PROJEÇÃO. Usado em previsões, nunca em KPIs oficiais.
 *  suggested    → PENDENTE de validação. Exibido separadamente na UI.
 *  incomplete   → Dado com campos faltantes. Não entra em cálculos oficiais.
 *  inconsistent → Dado com conflito detectado. Não entra em cálculos oficiais.
 *  missing      → Placeholder de ausência. Nunca entra em cálculos.
 *
 *  REGRA: Funções da engine que calculam valores OFICIAIS (KPIs, score,
 *  orçamento realizado) devem considerar APENAS data_status === "confirmed".
 *  Funções de PROJEÇÃO (forecast) podem incluir "estimated".
 *  "suggested" NUNCA entra em cálculos; é exibido à parte para validação.
 * ═══════════════════════════════════════════════════════════════════
 */

/** Status que contam para cálculos oficiais (KPIs, score, orçamento realizado) */
export const OFFICIAL_STATUSES: ReadonlySet<string> = new Set(["confirmed"]);

/** Status aceitos em projeções (forecast) */
export const PROJECTION_STATUSES: ReadonlySet<string> = new Set(["confirmed", "estimated"]);

/** Status pendentes de validação humana — exibidos à parte, nunca calculados */
export const PENDING_STATUSES: ReadonlySet<string> = new Set(["suggested", "incomplete", "inconsistent", "missing"]);

/** Filtra transações para cálculos oficiais */
export function filterOfficialTransactions(txns: TransactionRaw[]): TransactionRaw[] {
  return txns.filter((t) => OFFICIAL_STATUSES.has(t.data_status || "confirmed"));
}

/** Filtra transações pendentes de validação */
export function filterPendingTransactions(txns: TransactionRaw[]): TransactionRaw[] {
  return txns.filter((t) => t.data_status != null && PENDING_STATUSES.has(t.data_status));
}

// ─── Raw DB Input Types ──────────────────────────────────────────

export interface TransactionRaw {
  id: string;
  valor: number;
  tipo: "income" | "expense";
  data: string;
  descricao: string | null;
  categoria_id: string | null;
  categoria_nome?: string | null;
  categoria_icone?: string | null;
  scope: "private" | "family" | "business" | null;
  data_status: string | null;
  source_type: string | null;
  confidence: string | null;
  e_mei: boolean | null;
  categoria_is_business_cost?: boolean | null;
  papel_negocio?: "receita_operacional" | "custo_direto" | "despesa_operacional" | "tributo" | "retirada" | "investimento" | "financeiro" | null;
  e_dedutivel?: boolean | null;
  categoria_fiscal?: string | null;
  ano_fiscal?: number | null;
}

export interface BudgetRaw {
  id: string;
  categoria_id: string | null;
  categoria_nome?: string | null;
  categoria_icone?: string | null;
  valor_planejado: number;
  mes: number;
  ano: number;
  scope: "private" | "family" | "business" | null;
}

export interface RecurringRaw {
  id: string;
  descricao: string;
  valor: number;
  tipo: "income" | "expense";
  frequencia: string | null;
  dia_mes: number | null;
  ativa: boolean | null;
  categoria_id: string | null;
  scope: "private" | "family" | "business" | null;
}

export interface LoanRaw {
  id: string;
  nome: string;
  valor_original: number;
  saldo_devedor: number | null;
  taxa_juros_mensal: number | null;
  cet_anual: number | null;
  parcelas_total: number | null;
  parcelas_restantes: number | null;
  valor_parcela: number | null;
  metodo_amortizacao: "price" | "sac" | null;
  tipo: string | null;
  credor: string | null;
  data_inicio: string | null;
  scope?: "private" | "family" | "business" | null;
  ativo: boolean | null;
}

export interface InstallmentRaw {
  id: string;
  emprestimo_id: string;
  numero: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string | null;
}

export interface ExtraAmortizationRaw {
  id: string;
  emprestimo_id: string;
  valor: number;
  data: string;
  economia_juros_calculada: number | null;
}

export interface GoalRaw {
  id: string;
  nome: string;
  valor_alvo: number;
  valor_atual: number | null;
  prazo: string | null;
  prioridade: "alta" | "media" | "baixa" | null;
  ativo: boolean | null;
}

export interface GoalContributionRaw {
  id: string;
  goal_id: string;
  valor: number;
  data: string;
}

// ─── Calculated Output Types ─────────────────────────────────────

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  savingsRate: number;
  expenseByCategory: CategoryAmount[];
  incomeByCategory: CategoryAmount[];
  transactionCount: number;
  confirmedCount: number;
  suggestedCount: number;
}

export interface MeiSummary {
  receitaBruta: number;
  custosOperacionais: number;
  despesasIndiretas: number;
  tributos: number;
  retiradas: number;
  lucroOperacional: number;
  margemLucro: number;
  percentualLimite: number;
  limiteAnual: number;
  valorRestanteLimite: number;
  alertLevel: "info" | "warning" | "critical";
  businessTransactionCount: number;
}

export interface FiscalSummary {
  year: number;
  totalIncome: number;
  totalDeductions: number;
  deductionsByCategory: Record<string, number>;
  standardDiscount: number;
  baseSimplificada: number;
  baseCompleta: number;
  melhorOpcao: "simplificada" | "completa";
  taxableIncomeCount: number;
  deductibleExpenseCount: number;
}

export interface CategoryAmount {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string;
  total: number;
  count: number;
  percentage: number;
}

export type BudgetStatus = "ok" | "warning" | "exceeded";

export interface BudgetDeviationItem {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string;
  planned: number;
  /** Valor realizado OFICIAL (somente confirmed) */
  actual: number;
  /** Valor sugerido pendente de validação (somente suggested/incomplete) */
  suggestedActual: number;
  deviationAbsolute: number;
  deviationPercent: number;
  status: BudgetStatus;
}

export interface BudgetDeviationResult {
  items: BudgetDeviationItem[];
  totalPlanned: number;
  totalActual: number;
  totalDeviationAbsolute: number;
  totalDeviationPercent: number;
  overallStatus: BudgetStatus;
}

export interface HealthScoreInput {
  totalIncome: number;
  totalExpense: number;
  totalDebt: number;
  emergencyReserve: number;
  /** Whether emergency reserve has been configured by the user */
  emergencyReserveConfigured: boolean;
  /** Whether budget exists for this period */
  budgetConfigured: boolean;
  budgetDeviation: number; // 0-100
  overdueInstallments: number;
  totalInstallments: number;
  monthsWithData: number;
  totalMonthsPossible: number;
}

export interface HealthScoreResult {
  /** null if insufficient data to compute */
  scoreGeral: number | null;
  comprometimentoRenda: number | null;
  reservaEmergencia: number | null;
  controleOrcamento: number | null;
  adimplencia: number | null;
  regularidade: number | null;
  recommendations: HealthRecommendation[];
  /** How many components had real data */
  availableComponents: number;
  /** Total components */
  totalComponents: number;
}

export interface HealthRecommendation {
  component: string;
  score: number | null;
  message: string;
  severity: "critical" | "warning" | "info" | "ok";
}

export interface ForecastHorizon {
  days: number;
  label: string;
  projectedBalance: number;
  totalInflows: number;
  totalOutflows: number;
  confidenceLevel: "alta" | "media" | "baixa";
}

export interface CashflowForecastResult {
  /**
   * Saldo líquido do mês (receitas - despesas confirmadas até agora).
   * NÃO é saldo bancário real. É o resultado do mês corrente.
   */
  currentMonthlyBalance: number;
  horizons: ForecastHorizon[];
  assumptions: string[];
  warnings: string[];
}

export interface CashflowForecastInput {
  /** Saldo líquido do mês corrente (receitas - despesas confirmadas) */
  currentBalance: number;
  recurringTransactions: RecurringRaw[];
  recentTransactions: TransactionRaw[];
  upcomingInstallments: InstallmentRaw[];
}

export interface GoalProgressResult {
  goalId: string;
  goalName: string;
  progressPercent: number;
  remainingAmount: number;
  projectedCompletionDate: string | null;
  monthlyContributionNeeded: number | null;
  isOnTrack: boolean;
  totalContributed: number;
}

export interface LoanIndicatorResult {
  loanId: string;
  loanName: string;
  saldoAtual: number;
  parcelasRestantes: number;
  custoEstimadoRestante: number;
  totalJaPago: number;
  totalAPagar: number;
  impactoAmortizacaoExtra: number;
  taxaMensal: number;
  cetAnual: number;
}

export interface LoanSummary {
  loans: LoanIndicatorResult[];
  totalSaldoDevedor: number;
  totalCustoRestante: number;
  totalParcelas: number;
}
