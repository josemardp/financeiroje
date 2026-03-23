import { describe, it, expect } from "vitest";
import { parseTransactionText } from "../smartCapture/textParser";
import { analyzeDataQuality } from "../dataQuality";
import { generateAlerts } from "../alertEngine";
import { parseAiResponse } from "../aiAdvisor/responseParser";

// ── Smart Capture Parser ──
describe("parseTransactionText", () => {
  it("extracts valor and tipo from expense text", () => {
    const r = parseTransactionText("gastei 52 reais com pizza hoje");
    expect(r.valor).toBe(52);
    expect(r.tipo).toBe("expense");
    expect(r.confianca).not.toBe("baixa");
  });

  it("detects income", () => {
    const r = parseTransactionText("entrou 4500 de salário");
    expect(r.tipo).toBe("income");
    expect(r.valor).toBe(4500);
  });

  it("detects business scope", () => {
    const r = parseTransactionText("gasto da Esdra Cosméticos 230 em embalagem");
    expect(r.escopo).toBe("business");
  });

  it("marks missing fields", () => {
    const r = parseTransactionText("comprei algo ontem");
    expect(r.camposFaltantes).toContain("valor");
  });

  it("detects yesterday date", () => {
    const r = parseTransactionText("mercado 320 ontem");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(r.data).toBe(yesterday.toISOString().split("T")[0]);
  });
});

// ── AI Response Parser ──
describe("parseAiResponse", () => {
  it("parses structured blocks", () => {
    const text = `[FATO] Suas receitas são R$ 5000
Dado confirmado pela engine.

[ALERTA] Orçamento estourado
Categoria alimentação ultrapassou o limite.

[SUGESTÃO] Reduza gastos
Considere alternativas mais baratas.`;

    const result = parseAiResponse(text);
    expect(result.blocks.length).toBe(3);
    expect(result.blocks[0].type).toBe("fact");
    expect(result.blocks[1].type).toBe("alert");
    expect(result.blocks[2].type).toBe("suggestion");
  });

  it("handles plain text without markers", () => {
    const result = parseAiResponse("Resposta simples sem marcadores.");
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].type).toBe("fact");
  });
});

// ── Data Quality ──
describe("analyzeDataQuality", () => {
  it("detects transactions without category", () => {
    const report = analyzeDataQuality({
      transactions: [
        { id: "1", descricao: "Test", categoria_id: null, data_status: "confirmed", valor: 100, tipo: "expense", data: "2024-01-01" },
      ],
      budgets: [], recurringTransactions: [], goals: [], loans: [], documents: [],
    });
    expect(report.issues.some(i => i.type === "missing_category")).toBe(true);
  });

  it("detects suggested pending", () => {
    const report = analyzeDataQuality({
      transactions: [
        { id: "1", descricao: "Test", categoria_id: "cat1", data_status: "suggested", valor: 50, tipo: "expense", data: "2024-01-01" },
      ],
      budgets: [], recurringTransactions: [], goals: [], loans: [], documents: [],
    });
    expect(report.issues.some(i => i.type === "pending_suggested")).toBe(true);
  });

  it("detects suspected duplicates", () => {
    const tx = { id: "1", descricao: "mercado", categoria_id: "c1", data_status: "confirmed", valor: 100, tipo: "expense", data: "2024-01-05" };
    const report = analyzeDataQuality({
      transactions: [tx, { ...tx, id: "2" }],
      budgets: [], recurringTransactions: [], goals: [], loans: [], documents: [],
    });
    expect(report.issues.some(i => i.type === "suspected_duplicates")).toBe(true);
  });
});

// ── Alert Engine ──
describe("generateAlerts", () => {
  const baseInput = {
    totalIncome: 5000, totalExpense: 4000, balance: 1000,
    budgetItems: [], loans: [], installments: [],
    suggestedCount: 0, savingsRate: 20,
    projectedBalance7d: null, projectedBalance30d: null,
    emergencyReserve: 0, monthlyExpense: 4000,
  };

  it("generates alert for low savings rate", () => {
    const alerts = generateAlerts({ ...baseInput, savingsRate: 5 });
    expect(alerts.some(a => a.tipo === "economia_baixa")).toBe(true);
  });

  it("generates alert for exceeded budget", () => {
    const alerts = generateAlerts({
      ...baseInput,
      budgetItems: [{ categoryName: "Alimentação", planned: 500, actual: 700, deviationPercent: 40, status: "exceeded" }],
    });
    expect(alerts.some(a => a.tipo === "orcamento_estourado")).toBe(true);
  });

  it("generates alert for negative projected balance", () => {
    const alerts = generateAlerts({ ...baseInput, projectedBalance7d: -500 });
    expect(alerts.some(a => a.tipo === "saldo_projetado_negativo")).toBe(true);
    expect(alerts.find(a => a.tipo === "saldo_projetado_negativo")?.nivel).toBe("critical");
  });

  it("generates alert for suggested pending", () => {
    const alerts = generateAlerts({ ...baseInput, suggestedCount: 3 });
    expect(alerts.some(a => a.tipo === "suggested_pendentes")).toBe(true);
  });
});
