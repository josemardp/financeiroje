import { parseTransactionText } from "@/services/smartCapture/textParser";

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

  it("detects business scope from business keywords", () => {
    const r = parseTransactionText("gasto da empresa Esdra Cosméticos 230");
    expect(r.escopo).toBe("business");
  });

  it("detects business scope from MEI keyword", () => {
    const r = parseTransactionText("pagamento mei 500");
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

  it("entende data com mês textual abreviado", () => {
    const parsed = parseTransactionText(
      "Comprovante de venda 28 Mar, 2026 valor total R$ 365,67"
    );

    expect(parsed.data).toBe("2026-03-28");
  });

  it("prioriza valor total sobre valor da parcela", () => {
    const parsed = parseTransactionText(`
      InfinitePay
      Comprovante de venda
      R$ 365,67
      28 Mar, 2026
      Crédito
      12x de R$ 30,47
    `);

    expect(parsed.valor).toBe(365.67);
  });
  
  it("interpreta entradas telegráficas 'valor estabelecimento'", () => {
    const r = parseTransactionText("25,75 farmácia");
    expect(r.valor).toBe(25.75);
    expect(r.categoriaSugerida).toBe("Saúde");
  });

  it("interpreta entradas telegráficas 'estabelecimento valor'", () => {
    const r = parseTransactionText("mercado 34,90");
    expect(r.valor).toBe(34.9);
    expect(r.categoriaSugerida).toBe("Alimentação");
  });

  it("interpreta entradas telegráficas com valor inteiro", () => {
    const r = parseTransactionText("89 uber");
    expect(r.valor).toBe(89);
    expect(r.categoriaSugerida).toBe("Transporte");
  });
});
