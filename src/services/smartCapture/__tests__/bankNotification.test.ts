import { describe, expect, it } from "vitest";
import { checkBankNotificationAmounts } from "../bankNotification";

describe("checkBankNotificationAmounts", () => {
  it.each([
    ["Nubank: compra de R$ 47,90 no Mercado Pago aprovada", [47.9]],
    ["Itaú: PIX recebido de Ana no valor de R$ 1.250,50", [1250.5]],
    ["C6 Bank: compra aprovada de 32,00 em IFOOD", [32]],
    ["Santander: débito de R$ 9,99 realizado", [9.99]],
    ["Mercado Pago: recebeu R$ 150,00", [150]],
    ["PicPay: pagamento de R$ 24,50 confirmado", [24.5]],
    ["Caixa: crédito de R$ 800,00 em conta", [800]],
    ["Inter: compra de R$ 199,90 aprovada", [199.9]],
  ])("extrai valor literal de notificação: %s", (text, expected) => {
    expect(checkBankNotificationAmounts(text).amounts).toEqual(expected);
    expect(checkBankNotificationAmounts(text).hasExactlyOneAmount).toBe(true);
  });

  it("exige um único valor candidato", () => {
    const result = checkBankNotificationAmounts(
      "Nubank: compra de R$ 47,90 aprovada. Limite disponível: R$ 300,00"
    );

    expect(result.amounts).toEqual([47.9, 300]);
    expect(result.hasExactlyOneAmount).toBe(false);
  });

  it("não inventa valor quando ele não está no texto", () => {
    const result = checkBankNotificationAmounts("Nubank: compra aprovada no Mercado X");

    expect(result.amounts).toEqual([]);
    expect(result.hasExactlyOneAmount).toBe(false);
  });
});
