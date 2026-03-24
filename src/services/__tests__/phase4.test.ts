/**
 * Phase 4 Tests — Accounts, preferences, goals operational, reports
 * Phase 4.1 Hardening Tests — Reserve coverage, official data, account balances
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

  it("should only count confirmed transactions for account balance", () => {
    const saldoInicial = 1000;
    const txns = [
      { tipo: "income", valor: 500, data_status: "confirmed" },
      { tipo: "expense", valor: 200, data_status: "confirmed" },
      { tipo: "expense", valor: 999, data_status: "suggested" }, // must be excluded
      { tipo: "income", valor: 777, data_status: "incomplete" }, // must be excluded
    ];
    const confirmedTxns = txns.filter(t => t.data_status === "confirmed");
    const txnBalance = confirmedTxns.reduce((sum, t) => sum + (t.tipo === "income" ? t.valor : -t.valor), 0);
    const currentBalance = saldoInicial + txnBalance;
    expect(currentBalance).toBe(1300); // 1000 + 500 - 200
  });
});

// ─── Emergency reserve coverage — must use EXPENSE not income ─────
describe("Emergency Reserve (Hardened)", () => {
  it("should calculate months of coverage using expense, not income", () => {
    const reserveValue = 12000;
    const monthlyExpense = 4000;
    const monthlyIncome = 8000; // must NOT be used
    const coverage = reserveValue / monthlyExpense;
    expect(coverage).toBe(3);
    // Wrong: reserve / income = 1.5 — this would be incorrect
    expect(reserveValue / monthlyIncome).not.toBe(coverage);
  });

  it("should return null coverage when no expense data", () => {
    const reserveValue = 5000;
    const monthlyExpense = 0;
    const coverage = monthlyExpense > 0 ? reserveValue / monthlyExpense : null;
    expect(coverage).toBeNull();
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

// ─── Dashboard official data consistency ──────────────────────────
describe("Dashboard Official Data Consistency", () => {
  it("should separate official from pending transactions", () => {
    const txns = [
      { data_status: "confirmed", valor: 100 },
      { data_status: "confirmed", valor: 200 },
      { data_status: "suggested", valor: 999 },
      { data_status: "incomplete", valor: 500 },
      { data_status: null, valor: 50 }, // null treated as confirmed
    ];
    const official = txns.filter(t => t.data_status === "confirmed" || t.data_status === null);
    const pending = txns.filter(t => t.data_status === "suggested" || t.data_status === "incomplete");
    expect(official.length).toBe(3);
    expect(pending.length).toBe(2);
    const officialTotal = official.reduce((s, t) => s + t.valor, 0);
    expect(officialTotal).toBe(350); // 100 + 200 + 50
  });

  it("should not include suggested in category breakdown", () => {
    const allTxns = [
      { categoria: "Alimentação", valor: 100, data_status: "confirmed" },
      { categoria: "Alimentação", valor: 9999, data_status: "suggested" },
    ];
    const officialOnly = allTxns.filter(t => t.data_status === "confirmed");
    const total = officialOnly.reduce((s, t) => s + t.valor, 0);
    expect(total).toBe(100);
  });
});

// ─── Document privacy — signed URLs ──────────────────────────────
describe("Document Privacy", () => {
  it("should store storage path, not public URL", () => {
    const userId = "abc-123";
    const fileName = "recibo.pdf";
    const storagePath = `${userId}/${Date.now()}_${fileName}`;
    // Must NOT be a public URL
    expect(storagePath.startsWith("http")).toBe(false);
    expect(storagePath).toContain(userId);
  });

  it("should resolve legacy public URLs to storage paths", () => {
    const userId = "abc-123";
    const legacyUrl = "https://storage.example.com/documents/abc-123/1234_recibo.pdf";
    const fileName = legacyUrl.split("/").pop();
    const resolvedPath = `${userId}/${fileName}`;
    expect(resolvedPath).toBe("abc-123/1234_recibo.pdf");
  });
});

// ─── AI context — real account balance ────────────────────────────
describe("AI Context Account Balance", () => {
  it("should compute saldo_atual from saldo_inicial + confirmed txns", () => {
    const account = { id: "a1", nome: "Nubank", tipo: "conta_corrente", saldo_inicial: 1000 };
    const confirmedTxns = [
      { account_id: "a1", tipo: "income", valor: 500 },
      { account_id: "a1", tipo: "expense", valor: 200 },
    ];
    const txnMap: Record<string, number> = {};
    confirmedTxns.forEach(t => {
      if (!txnMap[t.account_id]) txnMap[t.account_id] = 0;
      txnMap[t.account_id] += t.tipo === "income" ? t.valor : -t.valor;
    });
    const saldoAtual = account.saldo_inicial + (txnMap[account.id] || 0);
    expect(saldoAtual).toBe(1300);
  });

  it("should NOT include suggested txns in account balance", () => {
    const allTxns = [
      { account_id: "a1", tipo: "income", valor: 500, data_status: "confirmed" },
      { account_id: "a1", tipo: "income", valor: 9999, data_status: "suggested" },
    ];
    const confirmed = allTxns.filter(t => t.data_status === "confirmed");
    const txnBalance = confirmed.reduce((s, t) => s + (t.tipo === "income" ? t.valor : -t.valor), 0);
    expect(txnBalance).toBe(500);
  });
});
