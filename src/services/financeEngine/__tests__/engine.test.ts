import { describe, it, expect } from "vitest";
import { calculateMonthlySummary } from "../monthlySummary";
import { calculateBudgetDeviation } from "../budgetDeviation";
import { calculateHealthScore } from "../healthScore";
import { calculateCashflowForecast } from "../cashflowForecast";
import { calculateGoalProgress } from "../goalProgress";
import { calculateLoanIndicators } from "../loanIndicators";
import type { TransactionRaw, BudgetRaw, HealthScoreInput, CashflowForecastInput, GoalRaw, GoalContributionRaw, LoanRaw, InstallmentRaw } from "../types";

// ─── Monthly Summary ─────────────────────────────────────────────

describe("calculateMonthlySummary", () => {
  it("returns zeroes for empty array", () => {
    const result = calculateMonthlySummary([]);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.savingsRate).toBe(0);
  });

  it("calculates correctly with mixed transactions", () => {
    const txns: TransactionRaw[] = [
      { id: "1", valor: 5000, tipo: "income", data: "2026-03-01", descricao: "Salário", categoria_id: "c1", categoria_nome: "Salário", categoria_icone: "💰", scope: "private", data_status: "confirmed", source_type: "manual", confidence: "alta", e_mei: false },
      { id: "2", valor: 1200, tipo: "expense", data: "2026-03-05", descricao: "Aluguel", categoria_id: "c2", categoria_nome: "Moradia", categoria_icone: "🏠", scope: "private", data_status: "confirmed", source_type: "manual", confidence: "alta", e_mei: false },
      { id: "3", valor: 800, tipo: "expense", data: "2026-03-10", descricao: "Mercado", categoria_id: "c3", categoria_nome: "Alimentação", categoria_icone: "🛒", scope: "family", data_status: "suggested", source_type: "voice", confidence: "media", e_mei: false },
    ];

    const result = calculateMonthlySummary(txns);
    expect(result.totalIncome).toBe(5000);
    expect(result.totalExpense).toBe(2000);
    expect(result.balance).toBe(3000);
    expect(result.savingsRate).toBe(60);
    expect(result.transactionCount).toBe(3);
    expect(result.confirmedCount).toBe(2);
    expect(result.suggestedCount).toBe(1);
    expect(result.expenseByCategory).toHaveLength(2);
    expect(result.expenseByCategory[0].total).toBe(1200); // sorted desc
  });

  it("handles zero income gracefully", () => {
    const txns: TransactionRaw[] = [
      { id: "1", valor: 500, tipo: "expense", data: "2026-03-01", descricao: "Gasto", categoria_id: null, scope: "private", data_status: "confirmed", source_type: "manual", confidence: "alta", e_mei: false },
    ];
    const result = calculateMonthlySummary(txns);
    expect(result.savingsRate).toBe(0);
    expect(result.balance).toBe(-500);
  });
});

// ─── Budget Deviation ─────────────────────────────────────────────

describe("calculateBudgetDeviation", () => {
  it("returns empty for no budgets", () => {
    const result = calculateBudgetDeviation([], [], 3, 2026);
    expect(result.items).toHaveLength(0);
    expect(result.overallStatus).toBe("ok");
  });

  it("calculates deviation correctly", () => {
    const budgets: BudgetRaw[] = [
      { id: "b1", categoria_id: "c1", categoria_nome: "Alimentação", categoria_icone: "🛒", valor_planejado: 1000, mes: 3, ano: 2026, scope: "private" },
      { id: "b2", categoria_id: "c2", categoria_nome: "Transporte", categoria_icone: "🚗", valor_planejado: 500, mes: 3, ano: 2026, scope: "private" },
    ];
    const txns: TransactionRaw[] = [
      { id: "t1", valor: 1100, tipo: "expense", data: "2026-03-05", descricao: "Mercado", categoria_id: "c1", scope: "private", data_status: "confirmed", source_type: "manual", confidence: "alta", e_mei: false },
      { id: "t2", valor: 400, tipo: "expense", data: "2026-03-10", descricao: "Uber", categoria_id: "c2", scope: "private", data_status: "confirmed", source_type: "manual", confidence: "alta", e_mei: false },
    ];

    const result = calculateBudgetDeviation(budgets, txns, 3, 2026);
    expect(result.items).toHaveLength(2);

    const alimentacao = result.items.find((i) => i.categoryId === "c1")!;
    expect(alimentacao.actual).toBe(1100);
    expect(alimentacao.deviationAbsolute).toBe(100);
    expect(alimentacao.deviationPercent).toBe(10);
    expect(alimentacao.status).toBe("warning");

    const transporte = result.items.find((i) => i.categoryId === "c2")!;
    expect(transporte.actual).toBe(400);
    expect(transporte.deviationAbsolute).toBe(-100);
    expect(transporte.status).toBe("ok");
  });

  it("ignores income transactions", () => {
    const budgets: BudgetRaw[] = [
      { id: "b1", categoria_id: "c1", categoria_nome: "Test", categoria_icone: "📋", valor_planejado: 500, mes: 3, ano: 2026, scope: null },
    ];
    const txns: TransactionRaw[] = [
      { id: "t1", valor: 5000, tipo: "income", data: "2026-03-01", descricao: "Salário", categoria_id: "c1", scope: null, data_status: "confirmed", source_type: "manual", confidence: "alta", e_mei: false },
    ];
    const result = calculateBudgetDeviation(budgets, txns, 3, 2026);
    expect(result.items[0].actual).toBe(0);
  });
});

// ─── Health Score ──────────────────────────────────────────────────

describe("calculateHealthScore", () => {
  it("returns perfect score for ideal financials", () => {
    const input: HealthScoreInput = {
      totalIncome: 10000,
      totalExpense: 4000,
      totalDebt: 0,
      emergencyReserve: 30000,
      budgetDeviation: 0,
      overdueInstallments: 0,
      totalInstallments: 5,
      monthsWithData: 12,
      totalMonthsPossible: 12,
    };
    const result = calculateHealthScore(input);
    expect(result.scoreGeral).toBe(100);
    expect(result.comprometimentoRenda).toBe(100);
    expect(result.adimplencia).toBe(100);
  });

  it("returns low score for bad financials", () => {
    const input: HealthScoreInput = {
      totalIncome: 5000,
      totalExpense: 5500,
      totalDebt: 50000,
      emergencyReserve: 0,
      budgetDeviation: 60,
      overdueInstallments: 3,
      totalInstallments: 5,
      monthsWithData: 1,
      totalMonthsPossible: 12,
    };
    const result = calculateHealthScore(input);
    expect(result.scoreGeral).toBeLessThan(30);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((r) => r.severity === "critical")).toBe(true);
  });

  it("handles zero income", () => {
    const input: HealthScoreInput = {
      totalIncome: 0, totalExpense: 0, totalDebt: 0, emergencyReserve: 0,
      budgetDeviation: 0, overdueInstallments: 0, totalInstallments: 0,
      monthsWithData: 0, totalMonthsPossible: 0,
    };
    const result = calculateHealthScore(input);
    expect(result.scoreGeral).toBeGreaterThanOrEqual(0);
  });
});

// ─── Cashflow Forecast ────────────────────────────────────────────

describe("calculateCashflowForecast", () => {
  it("returns current balance when no recurrences", () => {
    const input: CashflowForecastInput = {
      currentBalance: 5000,
      recurringTransactions: [],
      recentTransactions: [],
      upcomingInstallments: [],
    };
    const result = calculateCashflowForecast(input);
    expect(result.currentBalance).toBe(5000);
    expect(result.horizons).toHaveLength(3);
    expect(result.horizons[0].projectedBalance).toBe(5000);
  });

  it("considers recurring expenses", () => {
    const input: CashflowForecastInput = {
      currentBalance: 10000,
      recurringTransactions: [
        { id: "r1", descricao: "Aluguel", valor: 2000, tipo: "expense", frequencia: "monthly", dia_mes: 5, ativa: true, categoria_id: null, scope: "private" },
      ],
      recentTransactions: [],
      upcomingInstallments: [],
    };
    const result = calculateCashflowForecast(input);
    // 30-day horizon should show reduced balance
    const h30 = result.horizons.find((h) => h.days === 30)!;
    expect(h30.totalOutflows).toBeGreaterThan(0);
  });

  it("warns on negative projected balance", () => {
    const input: CashflowForecastInput = {
      currentBalance: 100,
      recurringTransactions: [
        { id: "r1", descricao: "Conta", valor: 5000, tipo: "expense", frequencia: "monthly", dia_mes: 15, ativa: true, categoria_id: null, scope: "private" },
      ],
      recentTransactions: [],
      upcomingInstallments: [],
    };
    const result = calculateCashflowForecast(input);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ─── Goal Progress ────────────────────────────────────────────────

describe("calculateGoalProgress", () => {
  it("returns empty for no goals", () => {
    expect(calculateGoalProgress([], [])).toEqual([]);
  });

  it("calculates progress correctly", () => {
    const goals: GoalRaw[] = [
      { id: "g1", nome: "Viagem", valor_alvo: 10000, valor_atual: 3000, prazo: "2027-01-01", prioridade: "alta", ativo: true },
    ];
    const contribs: GoalContributionRaw[] = [
      { id: "c1", goal_id: "g1", valor: 3000, data: "2026-01-15" },
    ];
    const result = calculateGoalProgress(goals, contribs);
    expect(result).toHaveLength(1);
    expect(result[0].progressPercent).toBe(30);
    expect(result[0].remainingAmount).toBe(7000);
    expect(result[0].monthlyContributionNeeded).toBeGreaterThan(0);
  });

  it("caps progress at 100%", () => {
    const goals: GoalRaw[] = [
      { id: "g1", nome: "Meta Concluída", valor_alvo: 1000, valor_atual: 1500, prazo: null, prioridade: null, ativo: true },
    ];
    const result = calculateGoalProgress(goals, []);
    expect(result[0].progressPercent).toBe(100);
    expect(result[0].remainingAmount).toBe(0);
  });
});

// ─── Loan Indicators ──────────────────────────────────────────────

describe("calculateLoanIndicators", () => {
  it("returns empty for no loans", () => {
    const result = calculateLoanIndicators([], [], []);
    expect(result.loans).toHaveLength(0);
    expect(result.totalSaldoDevedor).toBe(0);
  });

  it("calculates loan indicators", () => {
    const loans: LoanRaw[] = [
      { id: "l1", nome: "Consignado", valor_original: 50000, saldo_devedor: 30000, taxa_juros_mensal: 1.5, cet_anual: 19.5, parcelas_total: 48, parcelas_restantes: 24, valor_parcela: 1500, metodo_amortizacao: "price", tipo: "consignado", credor: "Banco X", data_inicio: "2024-01-01", ativo: true },
    ];
    const installments: InstallmentRaw[] = [
      { id: "i1", emprestimo_id: "l1", numero: 25, valor: 1500, data_vencimento: "2026-04-01", data_pagamento: null, status: "pendente" },
    ];
    const result = calculateLoanIndicators(loans, installments, []);
    expect(result.loans).toHaveLength(1);
    expect(result.loans[0].saldoAtual).toBe(30000);
    expect(result.loans[0].parcelasRestantes).toBe(24);
    expect(result.loans[0].custoEstimadoRestante).toBe(36000);
    expect(result.totalSaldoDevedor).toBe(30000);
  });

  it("excludes inactive loans", () => {
    const loans: LoanRaw[] = [
      { id: "l1", nome: "Quitado", valor_original: 10000, saldo_devedor: 0, taxa_juros_mensal: 0, cet_anual: 0, parcelas_total: 12, parcelas_restantes: 0, valor_parcela: 0, metodo_amortizacao: "price", tipo: "pessoal", credor: null, data_inicio: null, ativo: false },
    ];
    const result = calculateLoanIndicators(loans, [], []);
    expect(result.loans).toHaveLength(0);
  });
});
