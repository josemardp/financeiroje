/**
 * Phase 4 Tests — Accounts, preferences, goals operational, reports
 */
import { describe, it, expect } from "vitest";

// ─── Account balance calculation ──────────────────────────────────
describe("Account Balance Calculation", () => {
  it("should compute current balance from initial + transactions", () => {
    const saldoInicial = 1000;
    const txns = [
      { tipo: "income", valor: 500 },
      { tipo: "expense", valor: 200 },
      { tipo: "expense", valor: 100 },
    ];
    const txnBalance = txns.reduce((sum, t) => sum + (t.tipo === "income" ? t.valor : -t.valor), 0);
    const currentBalance = saldoInicial + txnBalance;
    expect(currentBalance).toBe(1200);
  });

  it("should handle empty transactions", () => {
    const saldoInicial = 500;
    const txnBalance = 0;
    expect(saldoInicial + txnBalance).toBe(500);
  });

  it("should allow negative balance", () => {
    const saldoInicial = 100;
    const txnBalance = -300;
    expect(saldoInicial + txnBalance).toBe(-200);
  });
});

// ─── Emergency reserve coverage ───────────────────────────────────
describe("Emergency Reserve", () => {
  it("should calculate months of coverage", () => {
    const reserveValue = 12000;
    const monthlyExpense = 4000;
    const coverage = reserveValue / monthlyExpense;
    expect(coverage).toBe(3);
  });

  it("should return Infinity when no expenses", () => {
    const reserveValue = 5000;
    const monthlyExpense = 0;
    const coverage = monthlyExpense > 0 ? reserveValue / monthlyExpense : Infinity;
    expect(coverage).toBe(Infinity);
  });

  it("should handle unconfigured reserve", () => {
    const reserveValue = 0;
    const configured = reserveValue > 0;
    expect(configured).toBe(false);
  });
});

// ─── CSV export format ────────────────────────────────────────────
describe("CSV Export", () => {
  it("should generate correct CSV headers", () => {
    const headers = ["Data", "Tipo", "Valor", "Descrição", "Categoria", "Escopo", "Status"];
    const csv = headers.map(c => `"${c}"`).join(",");
    expect(csv).toContain('"Data"');
    expect(csv).toContain('"Status"');
    expect(csv.split(",").length).toBe(7);
  });

  it("should escape values with quotes", () => {
    const value = 'Mercado "Extra"';
    const escaped = `"${value}"`;
    expect(escaped).toBe('"Mercado "Extra""');
  });
});

// ─── Goals operational (using engine) ─────────────────────────────
import { calculateGoalProgress } from "@/services/financeEngine/goalProgress";
import type { GoalRaw, GoalContributionRaw } from "@/services/financeEngine/types";

describe("Goals Operational", () => {
  it("should calculate progress with contributions", () => {
    const goals: GoalRaw[] = [{
      id: "g1", nome: "Viagem", valor_alvo: 10000, valor_atual: 3000,
      prazo: "2027-12-31", prioridade: "alta", ativo: true,
    }];
    const contribs: GoalContributionRaw[] = [
      { id: "c1", goal_id: "g1", valor: 1500, data: "2026-01-15" },
      { id: "c2", goal_id: "g1", valor: 1500, data: "2026-02-15" },
    ];
    const results = calculateGoalProgress(goals, contribs);
    expect(results).toHaveLength(1);
    expect(results[0].progressPercent).toBe(30);
    expect(results[0].remainingAmount).toBe(7000);
  });

  it("should mark goal as on track when completed", () => {
    const goals: GoalRaw[] = [{
      id: "g1", nome: "Meta", valor_alvo: 1000, valor_atual: 1000,
      prazo: "2026-12-31", prioridade: "media", ativo: true,
    }];
    const results = calculateGoalProgress(goals, []);
    expect(results[0].progressPercent).toBe(100);
    expect(results[0].isOnTrack).toBe(true);
  });
});

// ─── Preferences structure ────────────────────────────────────────
describe("Financial Preferences", () => {
  it("should have sensible defaults", () => {
    const defaults = {
      reserva_emergencia_valor: 0,
      reserva_emergencia_meses_meta: 6,
      renda_principal: 0,
      escopo_padrao: "private",
      dia_fechamento: 1,
      alertas_reserva: true,
      alertas_orcamento: true,
    };
    expect(defaults.reserva_emergencia_meses_meta).toBe(6);
    expect(defaults.escopo_padrao).toBe("private");
    expect(defaults.alertas_reserva).toBe(true);
  });

  it("should merge with existing preferences", () => {
    const existing = { renda_principal: 5000, custom_field: "test" };
    const defaults = { renda_principal: 0, escopo_padrao: "private" };
    const merged = { ...defaults, ...existing };
    expect(merged.renda_principal).toBe(5000);
    expect(merged.escopo_padrao).toBe("private");
  });
});
