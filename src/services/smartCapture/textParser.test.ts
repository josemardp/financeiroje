import { describe, expect, it } from "vitest";
import { parseTransactionText } from "./textParser";

describe("parseTransactionText", () => {
  it("mantém tipo null quando o texto é ambíguo", () => {
    const result = parseTransactionText("PIX JOAO SILVA 350,00");

    expect(result.tipo).toBeNull();
    expect(result.warnings).toContain("tipo não identificado claramente");
  });

  it("detecta escopo business por contexto de negócio", () => {
    const result = parseTransactionText("NF SERVIÇO PRESTADO CLIENTE XPTO R$ 800,00");

    expect(result.escopo).toBe("business");
  });

  it("detecta escopo family por contexto de casa/família", () => {
    const result = parseTransactionText("COMPRAS CASA MERCADO 120,00");

    expect(result.escopo).toBe("family");
  });

  it("escolhe o valor principal quando houver múltiplos candidatos", () => {
    const result = parseTransactionText("Subtotal 100,00 Taxa 5,00 Total 105,00");

    expect(result.valor).toBe(105);
    expect(result.warnings).toContain("valor principal escolhido entre múltiplos candidatos");
  });

  it("identifica receita quando houver sinal claro de entrada", () => {
    const result = parseTransactionText("Recebi salário 4500,00 em 05/03/2026");

    expect(result.tipo).toBe("income");
  });

  it("identifica despesa quando houver sinal claro de saída", () => {
    const result = parseTransactionText("Paguei mercado 320,00 em 04/03/2026");

    expect(result.tipo).toBe("expense");
  });
});
