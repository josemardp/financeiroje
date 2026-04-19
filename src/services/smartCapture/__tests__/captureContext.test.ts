import { describe, it, expect } from "vitest";
import { formatPatterns } from "../captureContext";

type PatternRow = {
  pattern_type: string;
  pattern_key: string;
  pattern_value: Record<string, unknown>;
  confidence: number;
  hit_count: number;
};

describe("formatPatterns", () => {
  it("retorna string vazia para lista vazia", () => {
    expect(formatPatterns([])).toBe("");
  });

  it("formata merchant_category com sample_descriptions", () => {
    const p: PatternRow = {
      pattern_type: "merchant_category",
      pattern_key: "ifood",
      pattern_value: { sample_descriptions: ["iFood Pedido"], category_name: "Alimentação" },
      confidence: 0.9,
      hit_count: 10,
    };
    const out = formatPatterns([p]);
    expect(out).toContain("padroes_aprendidos:");
    expect(out).toContain("iFood Pedido → Alimentação");
    expect(out).toContain("90%");
    expect(out).toContain("10 ocorrências");
  });

  it("formata merchant_category sem sample_descriptions (usa pattern_key)", () => {
    const p: PatternRow = {
      pattern_type: "merchant_category",
      pattern_key: "posto-shell",
      pattern_value: { category_name: "Transporte" },
      confidence: 0.75,
      hit_count: 5,
    };
    const out = formatPatterns([p]);
    expect(out).toContain("posto-shell → Transporte");
  });

  it("formata category_value_range com percentis", () => {
    const p: PatternRow = {
      pattern_type: "category_value_range",
      pattern_key: "cat-alimentacao",
      pattern_value: { category_name: "Alimentação", p10: 50, p50: 120, p90: 300 },
      confidence: 0.8,
      hit_count: 20,
    };
    const out = formatPatterns([p]);
    expect(out).toContain("categoria Alimentação");
    expect(out).toContain("R$50-R$300");
    expect(out).toContain("mediana R$120");
  });

  it("formata document_disambiguation com rule", () => {
    const p: PatternRow = {
      pattern_type: "document_disambiguation",
      pattern_key: "boleto-fatura",
      pattern_value: { rule: "Boleto com 'FATURA' = despesa cartão" },
      confidence: 0.95,
      hit_count: 3,
    };
    const out = formatPatterns([p]);
    expect(out).toContain("Boleto com 'FATURA' = despesa cartão");
  });

  it("ignora document_disambiguation sem rule sem crashar", () => {
    const p: PatternRow = {
      pattern_type: "document_disambiguation",
      pattern_key: "x",
      pattern_value: {},
      confidence: 0.7,
      hit_count: 1,
    };
    expect(formatPatterns([p])).toBe("");
  });

  it("ignora pattern_type desconhecido", () => {
    const p: PatternRow = {
      pattern_type: "unknown_future_type",
      pattern_key: "x",
      pattern_value: {},
      confidence: 0.8,
      hit_count: 2,
    };
    expect(formatPatterns([p])).toBe("");
  });

  it("múltiplos padrões produzem múltiplas linhas", () => {
    const patterns: PatternRow[] = [
      {
        pattern_type: "merchant_category",
        pattern_key: "mc",
        pattern_value: { category_name: "Cat1" },
        confidence: 0.8,
        hit_count: 5,
      },
      {
        pattern_type: "category_value_range",
        pattern_key: "cv",
        pattern_value: { category_name: "Cat2", p10: 10, p50: 50, p90: 100 },
        confidence: 0.7,
        hit_count: 8,
      },
    ];
    const out = formatPatterns(patterns);
    const lines = out.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });
});
