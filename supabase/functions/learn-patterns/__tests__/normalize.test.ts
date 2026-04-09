import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeMerchant } from "../index.ts";

Deno.test("normalizeMerchant: remove sufixo LTDA e números", () => {
  assertEquals(normalizeMerchant("POSTO IPIRANGA LTDA"), "posto ipiranga");
});

Deno.test("normalizeMerchant: remove S/A e números", () => {
  assertEquals(normalizeMerchant("MERCPGO 12345 S/A"), "mercpgo");
});

Deno.test("normalizeMerchant: remove acento", () => {
  assertEquals(normalizeMerchant("PADARIA SÃO PEDRO"), "padaria sao pedro");
});

Deno.test("normalizeMerchant: limita a 3 tokens", () => {
  assertEquals(normalizeMerchant("SUPERMERCADO BOM PRECO LTDA FILIAL"), "supermercado bom preco");
});

Deno.test("normalizeMerchant: remove pontuação e normaliza espaços", () => {
  assertEquals(normalizeMerchant("PIX - ESDRA A.P. ME"), "pix esdra a");
});

Deno.test("normalizeMerchant: input já limpo", () => {
  assertEquals(normalizeMerchant("ifood"), "ifood");
});
