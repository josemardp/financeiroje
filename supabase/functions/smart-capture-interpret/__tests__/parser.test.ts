import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { extractLiteralNotificationAmounts, parseLocalizedAmount } from "../index.ts";

Deno.test("parseLocalizedAmount: handles simple number", () => {
  assertEquals(parseLocalizedAmount(47.9), 47.9);
});

Deno.test("parseLocalizedAmount: handles R$ prefix and comma", () => {
  assertEquals(parseLocalizedAmount("R$ 47,90"), 47.9);
  assertEquals(parseLocalizedAmount("R$47,90"), 47.9);
});

Deno.test("parseLocalizedAmount: handles dots as thousands separator", () => {
  assertEquals(parseLocalizedAmount("R$ 1.250,50"), 1250.5);
  assertEquals(parseLocalizedAmount("1.250,50"), 1250.5);
});

Deno.test("parseLocalizedAmount: handles comma only", () => {
  assertEquals(parseLocalizedAmount("47,90"), 47.9);
});

Deno.test("parseLocalizedAmount: rejects invalid numbers", () => {
  assertEquals(parseLocalizedAmount("invalid"), null);
  assertEquals(parseLocalizedAmount("R$ -10,00"), null);
});

Deno.test("extractLiteralNotificationAmounts: keeps only literal notification amounts", () => {
  assertEquals(
    extractLiteralNotificationAmounts("Nubank: compra de R$ 47,90 no Mercado Pago aprovada"),
    [47.9],
  );
  assertEquals(
    extractLiteralNotificationAmounts("Compra aprovada no Mercado Pago"),
    [],
  );
  assertEquals(
    extractLiteralNotificationAmounts("Compra de R$ 47,90. Limite: R$ 300,00"),
    [47.9, 300],
  );
});
