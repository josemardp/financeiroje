import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  user_id: string;
  scope: string;
  descricao: string | null;
  valor: number | string;
  categoria_id: string | null;
  data: string;
}

interface MerchantPattern {
  pattern_key: string;
  category_id: string;
  hit_count: number;
  confidence: number;
  sample_descriptions: string[];
}

interface ValueRangePattern {
  pattern_key: string;
  category_id: string;
  p10: number;
  p50: number;
  p90: number;
  n_amostras: number;
  confidence: number;
}

interface DocRulePattern {
  issuer_keyword: string;
  field_affected: string;
  rule: string;
  hit_count: number;
}

interface PatternRow {
  user_id: string;
  scope: string;
  pattern_type: string;
  pattern_key: string;
  pattern_value: object;
  hit_count: number;
  last_seen_at: string;
  confidence: number;
  source: string;
}

interface ExistingPatternRow {
  pattern_type: string;
  pattern_key: string;
  source: string;
  confidence: number;
  hit_count: number;
}

// ── Algoritmos (seção 5.5 do plano) ───────────────────────────────────────

export function normalizeMerchant(desc: string): string {
  return desc
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ltda|me|eireli|s\/?a|epp)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 0)
    .slice(0, 3)
    .join(" ");
}

export function extractMerchantPatterns(txs: Transaction[]): MerchantPattern[] {
  const buckets = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (!tx.descricao) continue;
    const key = normalizeMerchant(tx.descricao);
    if (key.length < 3) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(tx);
  }

  const patterns: MerchantPattern[] = [];
  for (const [key, group] of buckets) {
    if (group.length < 2) continue;

    const catCounts = new Map<string, number>();
    for (const tx of group) {
      if (tx.categoria_id) {
        catCounts.set(tx.categoria_id, (catCounts.get(tx.categoria_id) ?? 0) + 1);
      }
    }
    const sorted = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) continue;
    const [topCatId, topCount] = sorted[0];
    const dominance = topCount / group.length;
    if (dominance < 0.6) continue;

    patterns.push({
      pattern_key: key,
      category_id: topCatId,
      hit_count: topCount,
      confidence: Math.min(0.95, 0.5 + dominance * 0.5),
      sample_descriptions: group.slice(0, 3).map((t) => t.descricao ?? ""),
    });
  }
  return patterns;
}

export function extractValueRanges(txs: Transaction[]): ValueRangePattern[] {
  const buckets = new Map<string, number[]>();
  for (const tx of txs) {
    if (!tx.categoria_id) continue;
    if (!buckets.has(tx.categoria_id)) buckets.set(tx.categoria_id, []);
    buckets.get(tx.categoria_id)!.push(Number(tx.valor));
  }

  const patterns: ValueRangePattern[] = [];
  for (const [catId, values] of buckets) {
    if (values.length < 5) continue;
    values.sort((a, b) => a - b);
    patterns.push({
      pattern_key: catId,
      category_id: catId,
      p10: values[Math.floor(values.length * 0.1)],
      p50: values[Math.floor(values.length * 0.5)],
      p90: values[Math.floor(values.length * 0.9)],
      n_amostras: values.length,
      confidence: Math.min(0.9, 0.5 + Math.log10(values.length) * 0.1),
    });
  }
  return patterns;
}

async function extractDocumentRules(
  supabase: SupabaseClient,
  userId: string,
): Promise<DocRulePattern[]> {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await supabase
    .from("capture_learning_events")
    .select("ocr_text, field_diff_json, corrected_fields")
    .eq("user_id", userId)
    .in("source_type", ["ocr", "document", "voice"])
    .gt("created_at", since)
    .not("ocr_text", "is", null);

  if (!events || events.length === 0) return [];

  const groups = new Map<string, { issuer: string; field: string; corrections: string[] }>();

  for (const event of events) {
    if (!Array.isArray(event.corrected_fields) || event.corrected_fields.length === 0) continue;
    if (!event.ocr_text) continue;

    const issuerMatch = (event.ocr_text as string).match(/\b([A-Z][A-Z0-9]{2,})\b/);
    if (!issuerMatch) continue;
    const issuer = issuerMatch[1];

    const diff = event.field_diff_json;
    const diffIsObject =
      diff !== null &&
      typeof diff === "object" &&
      !Array.isArray(diff);

    for (const field of event.corrected_fields as string[]) {
      let afterValue: string | undefined;
      if (diffIsObject) {
        const fieldEntry = (diff as Record<string, unknown>)[field];
        if (
          fieldEntry !== null &&
          typeof fieldEntry === "object" &&
          !Array.isArray(fieldEntry)
        ) {
          const after = (fieldEntry as Record<string, unknown>)["after"];
          if (after !== undefined && after !== null) {
            afterValue = String(after);
          }
        }
      }
      if (!afterValue) continue;

      const groupKey = `${issuer}::${field}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { issuer, field, corrections: [] });
      }
      groups.get(groupKey)!.corrections.push(afterValue);
    }
  }

  const rules: DocRulePattern[] = [];
  for (const [, group] of groups) {
    if (group.corrections.length < 3) continue;

    const valueCounts = new Map<string, number>();
    for (const v of group.corrections) {
      valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1);
    }
    const [[dominantValue]] = [...valueCounts.entries()].sort((a, b) => b[1] - a[1]);

    rules.push({
      issuer_keyword: group.issuer,
      field_affected: group.field,
      rule: `${group.issuer}: campo '${group.field}' costuma ser '${dominantValue}'`,
      hit_count: group.corrections.length,
    });
  }
  return rules;
}

// ── Upsert com proteção de source='corrected' ──────────────────────────────

async function upsertPatternsBatch(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  rows: PatternRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const { data: existing } = await supabase
    .from("user_patterns")
    .select("pattern_type, pattern_key, source, confidence, hit_count")
    .eq("user_id", userId)
    .eq("scope", scope);

  const existingMap = new Map<
    string,
    { source: string; confidence: number; hit_count: number }
  >();
  for (const row of (existing ?? []) as ExistingPatternRow[]) {
    existingMap.set(`${row.pattern_type}::${row.pattern_key}`, row);
  }

  const adjusted = rows.map((row) => {
    const found = existingMap.get(`${row.pattern_type}::${row.pattern_key}`);
    if (!found) return row;

    return {
      ...row,
      hit_count: found.hit_count + row.hit_count,
      last_seen_at: new Date().toISOString(),
      source:
        found.source === "corrected" || row.source === "corrected"
          ? "corrected"
          : "observed",
      confidence: Math.max(Number(found.confidence), row.confidence),
    };
  });

  const { error } = await supabase
    .from("user_patterns")
    .upsert(adjusted as unknown as Record<string, unknown>[], { onConflict: "user_id,scope,pattern_type,pattern_key" });

  if (error) {
    console.error("upsertPatternsBatch error:", error.message);
    return 0;
  }
  return adjusted.length;
}

// ── Helper: busca nomes de categorias ─────────────────────────────────────

async function fetchCategoryNames(
  supabase: SupabaseClient,
  categoryIds: string[],
): Promise<Map<string, string>> {
  if (categoryIds.length === 0) return new Map();
  const { data } = await supabase
    .from("categories")
    .select("id, nome")
    .in("id", categoryIds);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ id: string; nome: string | null }>) {
    map.set(row.id, row.nome ?? row.id);
  }
  return map;
}

// ── Mode handlers ──────────────────────────────────────────────────────────

async function handleFull(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: txs, error } = await supabase
    .from("transactions")
    .select("id, user_id, scope, descricao, valor, categoria_id, data")
    .eq("user_id", userId)
    .eq("data_status", "confirmed")
    .gte("data", since);

  if (error || !txs) {
    console.error("handleFull: fetch error", error?.message);
    return 0;
  }

  const docRules = await extractDocumentRules(supabase, userId);

  const byScope = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const s = (tx.scope as string) ?? "private";
    if (!byScope.has(s)) byScope.set(s, []);
    byScope.get(s)!.push(tx as Transaction);
  }

  let totalWritten = 0;

  for (const [scope, scopeTxs] of byScope) {
    const merchantPatterns = extractMerchantPatterns(scopeTxs);
    const valueRanges = extractValueRanges(scopeTxs);

    const allCatIds = [
      ...new Set([
        ...merchantPatterns.map((p) => p.category_id),
        ...valueRanges.map((p) => p.category_id),
      ]),
    ];
    const catNames = await fetchCategoryNames(supabase, allCatIds);
    const now = new Date().toISOString();
    const rows: PatternRow[] = [];

    for (const p of merchantPatterns) {
      rows.push({
        user_id: userId,
        scope,
        pattern_type: "merchant_category",
        pattern_key: p.pattern_key,
        pattern_value: {
          type: "merchant_category",
          merchant_normalized: p.pattern_key,
          category_id: p.category_id,
          category_name: catNames.get(p.category_id) ?? p.category_id,
          sample_descriptions: p.sample_descriptions,
        },
        hit_count: p.hit_count,
        last_seen_at: now,
        confidence: p.confidence,
        source: "observed",
      });
    }

    for (const p of valueRanges) {
      rows.push({
        user_id: userId,
        scope,
        pattern_type: "category_value_range",
        pattern_key: p.pattern_key,
        pattern_value: {
          type: "category_value_range",
          category_id: p.category_id,
          category_name: catNames.get(p.category_id) ?? p.category_id,
          p10: p.p10,
          p50: p.p50,
          p90: p.p90,
          n_amostras: p.n_amostras,
        },
        hit_count: p.n_amostras,
        last_seen_at: now,
        confidence: p.confidence,
        source: "observed",
      });
    }

    for (const p of docRules) {
      rows.push({
        user_id: userId,
        scope,
        pattern_type: "document_disambiguation",
        pattern_key: `${p.issuer_keyword}::${p.field_affected}`,
        pattern_value: {
          type: "document_disambiguation",
          issuer_keyword: p.issuer_keyword,
          rule: p.rule,
          field_affected: p.field_affected,
        },
        hit_count: p.hit_count,
        last_seen_at: now,
        confidence: 0.7,
        source: "observed",
      });
    }

    totalWritten += await upsertPatternsBatch(supabase, userId, scope, rows);
  }

  return totalWritten;
}

async function handleIncremental(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
): Promise<number> {
  const { data: tx, error } = await supabase
    .from("transactions")
    .select("id, user_id, scope, descricao, valor, categoria_id, data")
    .eq("id", transactionId)
    .maybeSingle();

  if (error || !tx) {
    console.error("handleIncremental: not found", transactionId);
    return 0;
  }
  if (!tx.descricao || !tx.categoria_id) return 0;

  const scope = (tx.scope as string) ?? "private";
  const patternKey = normalizeMerchant(tx.descricao as string);
  if (patternKey.length < 3) return 0;

  const catNames = await fetchCategoryNames(supabase, [tx.categoria_id as string]);
  const now = new Date().toISOString();

  return await upsertPatternsBatch(supabase, userId, scope, [
    {
      user_id: userId,
      scope,
      pattern_type: "merchant_category",
      pattern_key: patternKey,
      pattern_value: {
        type: "merchant_category",
        merchant_normalized: patternKey,
        category_id: tx.categoria_id,
        category_name: catNames.get(tx.categoria_id as string) ?? tx.categoria_id,
        sample_descriptions: [tx.descricao as string],
      },
      hit_count: 1,
      last_seen_at: now,
      confidence: 0.5,
      source: "observed",
    },
  ]);
}

async function handleFromCorrection(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
  newCategoryId: string,
): Promise<number> {
  const { data: tx, error } = await supabase
    .from("transactions")
    .select("id, user_id, scope, descricao, valor, categoria_id, data")
    .eq("id", transactionId)
    .maybeSingle();

  if (error || !tx) {
    console.error("handleFromCorrection: not found", transactionId);
    return 0;
  }
  if (!tx.descricao) return 0;

  const scope = (tx.scope as string) ?? "private";
  const patternKey = normalizeMerchant(tx.descricao as string);
  if (patternKey.length < 3) return 0;

  const catNames = await fetchCategoryNames(supabase, [newCategoryId]);
  const now = new Date().toISOString();
  const rows: PatternRow[] = [];

  rows.push({
    user_id: userId,
    scope,
    pattern_type: "merchant_category",
    pattern_key: patternKey,
    pattern_value: {
      type: "merchant_category",
      merchant_normalized: patternKey,
      category_id: newCategoryId,
      category_name: catNames.get(newCategoryId) ?? newCategoryId,
      sample_descriptions: [tx.descricao as string],
    },
    hit_count: 1,
    last_seen_at: now,
    confidence: 0.95,
    source: "corrected",
  });

  const docRules = await extractDocumentRules(supabase, userId);
  for (const p of docRules) {
    rows.push({
      user_id: userId,
      scope,
      pattern_type: "document_disambiguation",
      pattern_key: `${p.issuer_keyword}::${p.field_affected}`,
      pattern_value: {
        type: "document_disambiguation",
        issuer_keyword: p.issuer_keyword,
        rule: p.rule,
        field_affected: p.field_affected,
      },
      hit_count: p.hit_count,
      last_seen_at: now,
      confidence: 0.7,
      source: "observed",
    });
  }

  return await upsertPatternsBatch(supabase, userId, scope, rows);
}

// ── Handler principal ──────────────────────────────────────────────────────

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { mode, user_id, transaction_id, new_category_id } = await req.json();

    if (!mode || !user_id) {
      return new Response(
        JSON.stringify({ error: "mode e user_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let patternsWritten = 0;

    switch (mode) {
      case "full":
        patternsWritten = await handleFull(supabase, user_id);
        break;
      case "incremental":
        if (!transaction_id) {
          return new Response(
            JSON.stringify({ error: "transaction_id obrigatório para modo incremental" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        patternsWritten = await handleIncremental(supabase, user_id, transaction_id);
        break;
      case "from_correction":
        if (!transaction_id || !new_category_id) {
          return new Response(
            JSON.stringify({ error: "transaction_id e new_category_id obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        patternsWritten = await handleFromCorrection(
          supabase, user_id, transaction_id, new_category_id,
        );
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Modo desconhecido: ${mode}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return new Response(
      JSON.stringify({ ok: true, patterns_written: patternsWritten }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("learn-patterns error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

if (import.meta.main) {
  serve(handler);
}
