import { describe, expect, it } from "vitest";
import { parseTransactionText } from "@/services/smartCapture/textParser";

describe("smart capture phase 2 parser", () => {
  it("marks missing value as incomplete", () => {
    const parsed = parseTransactionText("paguei mercado ontem");
    expect(parsed.camposFaltantes).toContain("valor");
    expect(parsed.confianca).toBe("baixa");
  });

  it("parses expense text with explicit value", () => {
    const parsed = parseTransactionText("gastei 52 reais com pizza hoje");
    expect(parsed.valor).toBe(52);
    expect(parsed.tipo).toBe("expense");
    expect(parsed.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses income text correctly", () => {
    const parsed = parseTransactionText("recebi 4500 de salario hoje");
    expect(parsed.tipo).toBe("income");
    expect(parsed.valor).toBe(4500);
  });

  it("suggests business scope when text indicates MEI/business", () => {
    const parsed = parseTransactionText("paguei 300 reais para fornecedor da empresa");
    expect(parsed.escopo).toBe("business");
  });

  it("keeps category missing when not detected", () => {
    const parsed = parseTransactionText("gastei 100 reais com algo aleatorio hoje");
    expect(parsed.camposFaltantes).toContain("categoria");
  });
});
