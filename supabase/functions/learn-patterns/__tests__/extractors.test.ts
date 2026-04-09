import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { extractMerchantPatterns, extractValueRanges } from "../index.ts";

// ── extractMerchantPatterns ────────────────────────────────────────────────

const makeTx = (id: string, descricao: string, categoria_id: string | null) => ({
  id,
  user_id: "u1",
  scope: "private",
  descricao,
  valor: "50",
  categoria_id,
  data: "2026-01-01",
});

Deno.test("extractMerchantPatterns: dominância >60% grava padrão", () => {
  const txs = [
    makeTx("1", "POSTO IPIRANGA LTDA", "cat-combustivel"),
    makeTx("2", "POSTO IPIRANGA", "cat-combustivel"),
    makeTx("3", "POSTO IPIRANGA 001", "cat-combustivel"),
  ];
  const result = extractMerchantPatterns(txs);
  assertEquals(result.length, 1);
  assertEquals(result[0].category_id, "cat-combustivel");
  assertEquals(result[0].hit_count, 3);
});

Deno.test("extractMerchantPatterns: dominância <60% não grava", () => {
  const txs = [
    makeTx("1", "SUPERMERCADO ABC", "cat-mercado"),
    makeTx("2", "SUPERMERCADO ABC", "cat-higiene"),
    makeTx("3", "SUPERMERCADO ABC", "cat-mercado"),
    makeTx("4", "SUPERMERCADO ABC", "cat-higiene"),
    makeTx("5", "SUPERMERCADO ABC", "cat-lazer"),
  ];
  const result = extractMerchantPatterns(txs);
  assertEquals(result.length, 0);
});

Deno.test("extractMerchantPatterns: menos de 2 ocorrências não grava", () => {
  const txs = [makeTx("1", "LOJA UNICA", "cat-vestuario")];
  const result = extractMerchantPatterns(txs);
  assertEquals(result.length, 0);
});

Deno.test("extractMerchantPatterns: sem categoria_id é ignorado", () => {
  const txs = [
    makeTx("1", "IFOOD", null),
    makeTx("2", "IFOOD", null),
    makeTx("3", "IFOOD", null),
  ];
  const result = extractMerchantPatterns(txs);
  assertEquals(result.length, 0);
});

Deno.test("extractMerchantPatterns: confidence calculada conforme plano", () => {
  const txs = [
    makeTx("1", "FARMACIA DROGASIL", "cat-saude"),
    makeTx("2", "FARMACIA DROGASIL", "cat-saude"),
  ];
  const result = extractMerchantPatterns(txs);
  assertEquals(result.length, 1);
  // dominance = 1.0 → confidence = min(0.95, 0.5 + 1.0 * 0.5) = 0.95
  assertEquals(result[0].confidence, 0.95);
});

// ── extractValueRanges ─────────────────────────────────────────────────────

const makeValTx = (id: string, categoria_id: string, valor: number) => ({
  id,
  user_id: "u1",
  scope: "private",
  descricao: "desc",
  valor: String(valor),
  categoria_id,
  data: "2026-01-01",
});

Deno.test("extractValueRanges: menos de 5 amostras não grava", () => {
  const txs = [
    makeValTx("1", "cat-a", 100),
    makeValTx("2", "cat-a", 200),
    makeValTx("3", "cat-a", 150),
    makeValTx("4", "cat-a", 180),
  ];
  const result = extractValueRanges(txs);
  assertEquals(result.length, 0);
});

Deno.test("extractValueRanges: 5 ou mais amostras grava com p10/p50/p90 corretos", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const txs = values.map((v, i) => makeValTx(String(i), "cat-mercado", v));
  const result = extractValueRanges(txs);
  assertEquals(result.length, 1);
  assertEquals(result[0].pattern_key, "cat-mercado");
  assertEquals(result[0].n_amostras, 10);
  assertEquals(result[0].p10, 20);
  assertEquals(result[0].p50, 60);
  assertEquals(result[0].p90, 100);
});

Deno.test("extractValueRanges: confidence conforme plano (log10)", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const txs = values.map((v, i) => makeValTx(String(i), "cat-x", v));
  const result = extractValueRanges(txs);
  const expected = Math.min(0.9, 0.5 + Math.log10(10) * 0.1);
  assertEquals(result[0].confidence, expected);
});
