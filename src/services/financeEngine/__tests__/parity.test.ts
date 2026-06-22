/**
 * Contrato de Paridade — Frontend vs Backend Finance Engine
 *
 * Este arquivo define os contratos numéricos que AMBOS os motores devem honrar:
 *   - Frontend:  src/services/financeEngine/  (TypeScript puro, roda no browser)
 *   - Backend:   supabase/functions/finance-engine/index.ts  (Deno Edge Function)
 *
 * Quando um teste aqui falhar, o frontend divergiu do contrato.
 * Quando o backend produzir resultado diferente para o mesmo fixture, o backend
 * precisa ser corrigido.
 *
 * Divergências intencionais documentadas ao final de cada describe.
 */

import { describe, it, expect } from "vitest";
import { calculateMonthlySummary } from "../monthlySummary";
import { calculateBudgetDeviation } from "../budgetDeviation";
import { calculateHealthScore } from "../healthScore";
import { calculateGoalProgress } from "../goalProgress";
import { calculateLoanIndicators } from "../loanIndicators";
import type {
  TransactionRaw,
  BudgetRaw,
  HealthScoreInput,
  GoalRaw,
  GoalContributionRaw,
  LoanRaw,
  InstallmentRaw,
  ExtraAmortizationRaw,
} from "../types";

// ─── Shared fixtures ─────────────────────────────────────────────────────────

function tx(override: Partial<TransactionRaw> & Pick<TransactionRaw, "id" | "valor" | "tipo">): TransactionRaw {
  return {
    data: "2026-03-10",
    descricao: null,
    categoria_id: null,
    categoria_nome: null,
    categoria_icone: null,
    scope: "private",
    data_status: "confirmed",
    source_type: "manual",
    confidence: "alta",
    e_mei: false,
    ...override,
  };
}

// ─── calculateMonthlySummary ──────────────────────────────────────────────────
// Contract: BACKEND must match all assertions below.

describe("[PARITY] calculateMonthlySummary", () => {
  it("zero income + zero expense → balance 0, savingsRate 0", () => {
    const r = calculateMonthlySummary([]);
    expect(r.totalIncome).toBe(0);
    expect(r.totalExpense).toBe(0);
    expect(r.balance).toBe(0);
    expect(r.savingsRate).toBe(0);
  });

  it("savingsRate = (income - expense) / income * 100, rounded to 2dp", () => {
    const r = calculateMonthlySummary([
      tx({ id: "1", valor: 3000, tipo: "income" }),
      tx({ id: "2", valor: 1000, tipo: "expense" }),
    ]);
    expect(r.totalIncome).toBe(3000);
    expect(r.totalExpense).toBe(1000);
    expect(r.balance).toBe(2000);
    expect(r.savingsRate).toBeCloseTo(66.67, 1);
  });

  it("null categoria_id maps to categoryId null (not the internal sentinel key)", () => {
    const r = calculateMonthlySummary([
      tx({ id: "1", valor: 500, tipo: "expense", categoria_id: null }),
    ]);
    expect(r.expenseByCategory[0].categoryId).toBeNull();
  });

  it("data_status null is treated as confirmed (not suggested)", () => {
    const r = calculateMonthlySummary([
      tx({ id: "1", valor: 100, tipo: "expense", data_status: null }),
    ]);
    expect(r.confirmedCount).toBe(1);
    expect(r.suggestedCount).toBe(0);
  });

  it("categories sorted descending by total", () => {
    const r = calculateMonthlySummary([
      tx({ id: "1", valor: 200, tipo: "expense", categoria_id: "c1", categoria_nome: "Alimentação" }),
      tx({ id: "2", valor: 800, tipo: "expense", categoria_id: "c2", categoria_nome: "Moradia" }),
    ]);
    expect(r.expenseByCategory[0].categoryName).toBe("Moradia");
    expect(r.expenseByCategory[1].categoryName).toBe("Alimentação");
  });
});

// ─── calculateBudgetDeviation ─────────────────────────────────────────────────
// Contract: BACKEND must match all assertions below.
//
// Intentional API difference: frontend takes (budgets, txns, month, year) and
// filters by month/year internally. Backend receives pre-filtered data and
// omits the month/year params — this is a deliberate API boundary difference,
// not a bug.

describe("[PARITY] calculateBudgetDeviation", () => {
  const budget = (override: Partial<BudgetRaw> = {}): BudgetRaw => ({
    id: "b1",
    categoria_id: "c1",
    categoria_nome: "Alimentação",
    categoria_icone: "🛒",
    valor_planejado: 1000,
    mes: 3,
    ano: 2026,
    scope: "private",
    ...override,
  });

  it("empty budgets → overallStatus ok, items empty", () => {
    const r = calculateBudgetDeviation([], [], 3, 2026);
    expect(r.items).toHaveLength(0);
    expect(r.overallStatus).toBe("ok");
    expect(r.totalPlanned).toBe(0);
  });

  it("on-budget (deviation ≤ 0) → status ok", () => {
    const r = calculateBudgetDeviation(
      [budget()],
      [tx({ id: "t1", valor: 900, tipo: "expense", categoria_id: "c1", data: "2026-03-15" })],
      3, 2026
    );
    expect(r.items[0].status).toBe("ok");
    expect(r.overallStatus).toBe("ok");
  });

  it("over budget by 1–10% → status warning (NOT exceeded)", () => {
    // deviation = 100 / 1000 = 10%
    const r = calculateBudgetDeviation(
      [budget()],
      [tx({ id: "t1", valor: 1100, tipo: "expense", categoria_id: "c1", data: "2026-03-15" })],
      3, 2026
    );
    expect(r.items[0].deviationPercent).toBe(10);
    expect(r.items[0].status).toBe("warning");
    expect(r.overallStatus).toBe("warning");
  });

  it("over budget by >10% → status exceeded", () => {
    // deviation = 150 / 1000 = 15%
    const r = calculateBudgetDeviation(
      [budget()],
      [tx({ id: "t1", valor: 1150, tipo: "expense", categoria_id: "c1", data: "2026-03-15" })],
      3, 2026
    );
    expect(r.items[0].status).toBe("exceeded");
    expect(r.overallStatus).toBe("exceeded");
  });

  it("planned=0 with actual>0 → deviationPercent=100 (not 0 or NaN)", () => {
    const r = calculateBudgetDeviation(
      [budget({ valor_planejado: 0 })],
      [tx({ id: "t1", valor: 500, tipo: "expense", categoria_id: "c1", data: "2026-03-15" })],
      3, 2026
    );
    expect(r.items[0].deviationPercent).toBe(100);
    expect(Number.isFinite(r.items[0].deviationPercent)).toBe(true);
  });

  it("only confirmed transactions count as actual (suggested counted separately)", () => {
    const r = calculateBudgetDeviation(
      [budget()],
      [
        tx({ id: "t1", valor: 600, tipo: "expense", categoria_id: "c1", data: "2026-03-15", data_status: "confirmed" }),
        tx({ id: "t2", valor: 300, tipo: "expense", categoria_id: "c1", data: "2026-03-16", data_status: "suggested" }),
      ],
      3, 2026
    );
    expect(r.items[0].actual).toBe(600);
    expect(r.items[0].suggestedActual).toBe(300);
  });

  it("income transactions are ignored", () => {
    const r = calculateBudgetDeviation(
      [budget()],
      [tx({ id: "t1", valor: 9999, tipo: "income", categoria_id: "c1", data: "2026-03-15" })],
      3, 2026
    );
    expect(r.items[0].actual).toBe(0);
  });

  it("overallStatus threshold is >10% (not >5%)", () => {
    // Exactly 10% deviation on overall — should be 'warning', not 'exceeded'
    const r = calculateBudgetDeviation(
      [budget({ valor_planejado: 1000 })],
      [tx({ id: "t1", valor: 1100, tipo: "expense", categoria_id: "c1", data: "2026-03-15" })],
      3, 2026
    );
    expect(r.totalDeviationPercent).toBe(10);
    expect(r.overallStatus).toBe("warning"); // NOT 'exceeded' — backend had this wrong
  });
});

// ─── calculateHealthScore ─────────────────────────────────────────────────────
// Contract: BACKEND is identical — no known divergences.

describe("[PARITY] calculateHealthScore", () => {
  it("weights: comprometimento 0.25, reserva 0.25, orcamento 0.20, adimplencia 0.20, regularidade 0.10", () => {
    // All components at 100 → scoreGeral = 100
    const input: HealthScoreInput = {
      totalIncome: 10000, totalExpense: 4000,
      totalDebt: 0, emergencyReserve: 60000, emergencyReserveConfigured: true,
      budgetConfigured: true, budgetDeviation: 0,
      overdueInstallments: 0, totalInstallments: 10,
      monthsWithData: 12, totalMonthsPossible: 12,
    };
    const r = calculateHealthScore(input);
    expect(r.scoreGeral).toBe(100);
    expect(r.availableComponents).toBe(5);
  });

  it("comprometimento threshold: income=1000, expense=500 (50%) → score 100", () => {
    const input: HealthScoreInput = {
      totalIncome: 1000, totalExpense: 500,
      totalDebt: 0, emergencyReserve: 0, emergencyReserveConfigured: false,
      budgetConfigured: false, budgetDeviation: 0,
      overdueInstallments: 0, totalInstallments: 0,
      monthsWithData: 1, totalMonthsPossible: 1,
    };
    const r = calculateHealthScore(input);
    expect(r.comprometimentoRenda).toBe(100);
  });

  it("comprometimento threshold: expense > income → score < 40", () => {
    const input: HealthScoreInput = {
      totalIncome: 1000, totalExpense: 1100,
      totalDebt: 0, emergencyReserve: 0, emergencyReserveConfigured: false,
      budgetConfigured: false, budgetDeviation: 0,
      overdueInstallments: 0, totalInstallments: 0,
      monthsWithData: 1, totalMonthsPossible: 1,
    };
    const r = calculateHealthScore(input);
    expect(r.comprometimentoRenda).toBeLessThanOrEqual(40);
  });

  it("null components excluded from weighted average", () => {
    const input: HealthScoreInput = {
      totalIncome: 0, totalExpense: 0, // comprometimento = null
      totalDebt: 0, emergencyReserve: 0, emergencyReserveConfigured: false, // reserva = null
      budgetConfigured: false, budgetDeviation: 0, // controle = null
      overdueInstallments: 0, totalInstallments: 0, // adimplencia = null
      monthsWithData: 3, totalMonthsPossible: 6,
    };
    const r = calculateHealthScore(input);
    expect(r.availableComponents).toBe(1); // only regularidade
    expect(r.scoreGeral).not.toBeNull();
  });
});

// ─── calculateGoalProgress ────────────────────────────────────────────────────
// Contract: BACKEND must match all assertions below.
//
// Intentional difference: isOnTrack logic is richer in frontend (tracks
// contribution history). Backend uses simplified progressPercent > 0.
// This is documented and accepted.

describe("[PARITY] calculateGoalProgress", () => {
  it("empty goals → []", () => {
    expect(calculateGoalProgress([], [])).toEqual([]);
  });

  it("currentValue = MAX(valor_atual, totalContributed) — NOT sum", () => {
    // valor_atual=3000 already includes prior contributions
    // adding contribution of 3000 should NOT double-count to 6000
    const goals: GoalRaw[] = [
      { id: "g1", nome: "Viagem", valor_alvo: 10000, valor_atual: 3000, prazo: null, prioridade: null, ativo: true },
    ];
    const contribs: GoalContributionRaw[] = [
      { id: "c1", goal_id: "g1", valor: 3000, data: "2026-01-01" },
    ];
    const r = calculateGoalProgress(goals, contribs);
    // Math.max(3000, 3000) = 3000 → 30%, NOT 60%
    expect(r[0].progressPercent).toBe(30);
    expect(r[0].remainingAmount).toBe(7000);
  });

  it("progressPercent capped at 100% even if valor_atual > valor_alvo", () => {
    const goals: GoalRaw[] = [
      { id: "g1", nome: "Meta Concluída", valor_alvo: 1000, valor_atual: 1500, prazo: null, prioridade: null, ativo: true },
    ];
    const r = calculateGoalProgress(goals, []);
    expect(r[0].progressPercent).toBe(100);
    expect(r[0].remainingAmount).toBe(0);
  });

  it("monthlyContributionNeeded is null when no prazo", () => {
    const goals: GoalRaw[] = [
      { id: "g1", nome: "Sem prazo", valor_alvo: 5000, valor_atual: 1000, prazo: null, prioridade: null, ativo: true },
    ];
    const r = calculateGoalProgress(goals, []);
    expect(r[0].monthlyContributionNeeded).toBeNull();
  });

  it("monthlyContributionNeeded > 0 when prazo set and progress < 100%", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const prazo = futureDate.toISOString().split("T")[0];

    const goals: GoalRaw[] = [
      { id: "g1", nome: "Com prazo", valor_alvo: 10000, valor_atual: 2000, prazo, prioridade: null, ativo: true },
    ];
    const r = calculateGoalProgress(goals, []);
    expect(r[0].monthlyContributionNeeded).toBeGreaterThan(0);
  });

  it("goalId and goalName preserved in result", () => {
    const goals: GoalRaw[] = [
      { id: "abc-123", nome: "Minha Meta", valor_alvo: 1000, valor_atual: 0, prazo: null, prioridade: "alta", ativo: true },
    ];
    const r = calculateGoalProgress(goals, []);
    expect(r[0].goalId).toBe("abc-123");
    expect(r[0].goalName).toBe("Minha Meta");
  });
});

// ─── calculateLoanIndicators ──────────────────────────────────────────────────
// Contract: BACKEND must match all assertions below.
//
// Feature gap: backend does not process extraAmortizations (no 3rd param).
// This is accepted until backend is updated.

describe("[PARITY] calculateLoanIndicators", () => {
  const loan = (override: Partial<LoanRaw> = {}): LoanRaw => ({
    id: "l1",
    nome: "Consignado",
    valor_original: 50000,
    saldo_devedor: 30000,
    taxa_juros_mensal: 1.5,
    cet_anual: 19.5,
    parcelas_total: 48,
    parcelas_restantes: 24,
    valor_parcela: 1500,
    metodo_amortizacao: "price",
    tipo: "consignado",
    credor: "Banco",
    data_inicio: "2024-01-01",
    ativo: true,
    ...override,
  });

  it("empty loans → empty summary", () => {
    const r = calculateLoanIndicators([], [], []);
    expect(r.loans).toHaveLength(0);
    expect(r.totalSaldoDevedor).toBe(0);
    expect(r.totalCustoRestante).toBe(0);
    expect(r.totalParcelas).toBe(0);
  });

  it("saldoAtual uses loan.saldo_devedor when provided (not recalculates)", () => {
    const r = calculateLoanIndicators([loan()], [], []);
    expect(r.loans[0].saldoAtual).toBe(30000);
  });

  it("custoEstimadoRestante = parcelas_restantes * valor_parcela", () => {
    const r = calculateLoanIndicators([loan()], [], []);
    expect(r.loans[0].custoEstimadoRestante).toBe(36000); // 24 * 1500
  });

  it("active loans only — ativo: false is excluded", () => {
    const r = calculateLoanIndicators(
      [loan({ ativo: false })],
      [], []
    );
    expect(r.loans).toHaveLength(0); // backend had this bug (no ativo filter)
  });

  it("extraAmortizations included in totalJaPago", () => {
    const extra: ExtraAmortizationRaw[] = [
      { id: "e1", emprestimo_id: "l1", valor: 5000, data: "2026-01-01", observacao: null },
    ];
    const r = calculateLoanIndicators([loan({ saldo_devedor: null })], [], extra);
    // totalJaPago includes extra: 5000
    expect(r.loans[0].totalJaPago).toBeGreaterThanOrEqual(5000);
  });

  it("totalSaldoDevedor aggregates all active loans", () => {
    const r = calculateLoanIndicators([
      loan({ id: "l1", saldo_devedor: 10000 }),
      loan({ id: "l2", saldo_devedor: 20000 }),
    ], [], []);
    expect(r.totalSaldoDevedor).toBe(30000);
  });

  it("impactoAmortizacaoExtra is 0 when taxa_juros_mensal is 0", () => {
    const r = calculateLoanIndicators([loan({ taxa_juros_mensal: 0 })], [], []);
    expect(r.loans[0].impactoAmortizacaoExtra).toBe(0);
  });
});
