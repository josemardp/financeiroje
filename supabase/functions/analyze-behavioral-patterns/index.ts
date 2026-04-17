import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──────────────────────────────────────────────────────────────────

interface EngagementEvent {
  id: string;
  user_id: string;
  event_type: string;
  context_data: Record<string, unknown>;
  scope: string;
  created_at: string;
}

interface Transaction {
  id: string;
  user_id: string;
  scope: string;
  valor: number | string;
  categoria_id: string | null;
  created_at: string;
}

interface DetectionResult {
  intensity: number;
  confidence: number;
  evidence: object;
}

interface PatternDetector {
  tag_key: string;
  detect: (events: EngagementEvent[], txs: Transaction[]) => DetectionResult | null;
}

interface ActiveUserScope {
  user_id: string;
  scope: string;
}

// ── Detectors ──────────────────────────────────────────────────────────────

function detectAnxietyDebtFocus(
  events: EngagementEvent[],
  _txs: Transaction[],
): DetectionResult | null {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last30 = events.filter((e) => new Date(e.created_at) >= since30d);
  const loanViews = last30.filter(
    (e) =>
      e.event_type === "screen_view" &&
      e.context_data.screenName === "Loans",
  );
  if (loanViews.length < 5) return null;
  const dailyAvg = loanViews.length / 30;
  const intensity = Math.min(1, dailyAvg / 0.5);
  return {
    intensity,
    confidence: Math.min(1, loanViews.length / 15),
    evidence: { loanViewsLast30: loanViews.length, dailyAvg },
  };
}

function detectLateNightSpending(
  _events: EngagementEvent[],
  txs: Transaction[],
): DetectionResult | null {
  if (txs.length === 0) return null;
  const lateTxs = txs.filter((t) => {
    const hour = new Date(t.created_at).getHours();
    return hour >= 22 || hour <= 2;
  });
  if (lateTxs.length < 3) return null;
  const ratio = lateTxs.length / txs.length;
  return {
    intensity: Math.min(1, ratio * 3),
    confidence: Math.min(1, lateTxs.length / 10),
    evidence: { lateTxCount: lateTxs.length, ratio },
  };
}

// Stub: análise dos últimos 6 meses de saldos nos últimos 5 dias do mês
// Implementação planejada em iteração futura do Sprint 6
function detectFimDeMesPressionado(
  _events: EngagementEvent[],
  _txs: Transaction[],
): DetectionResult | null {
  return null;
}

const DETECTORS: PatternDetector[] = [
  { tag_key: "anxiety_debt_focus",     detect: detectAnxietyDebtFocus },
  { tag_key: "late_night_spending",    detect: detectLateNightSpending },
  { tag_key: "fim_de_mes_pressionado", detect: detectFimDeMesPressionado },
];

// ── Guard de eventos válidos ───────────────────────────────────────────────

function filterValidEvents(events: EngagementEvent[]): EngagementEvent[] {
  return events.filter((e) => {
    const durationMs = e.context_data.durationMs;
    if (durationMs === undefined || durationMs === null) return true;
    return Number(durationMs) >= 2000;
  });
}

// ── Data fetching ──────────────────────────────────────────────────────────

// Equivalente a:
// SELECT user_id, scope, COUNT(*) AS cnt
// FROM user_engagement_events
// WHERE created_at >= since
// GROUP BY user_id, scope
// HAVING COUNT(*) >= minEvents
// O cliente supabase-js v2 não expõe GROUP BY nativamente; agregação feita
// em TypeScript após fetch dos campos (user_id, scope) — sem custo extra para
// o volume esperado (aplicativo familiar, 2 usuários).
async function fetchActiveUserScopes(
  supabase: SupabaseClient,
  since: string,
  minEvents: number,
): Promise<ActiveUserScope[]> {
  const { data, error } = await supabase
    .from("user_engagement_events")
    .select("user_id, scope")
    .gte("created_at", since);

  if (error || !data) {
    console.error("fetchActiveUserScopes error:", error?.message);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data as Array<{ user_id: string; scope: string }>) {
    const key = `${row.user_id}::${row.scope}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minEvents)
    .map(([key]) => {
      const sep = key.indexOf("::");
      return { user_id: key.slice(0, sep), scope: key.slice(sep + 2) };
    });
}

async function fetchEvents(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  since: string,
): Promise<EngagementEvent[]> {
  const { data, error } = await supabase
    .from("user_engagement_events")
    .select("id, user_id, event_type, context_data, scope, created_at")
    .eq("user_id", userId)
    .eq("scope", scope)
    .gte("created_at", since);

  if (error) {
    console.error("fetchEvents error:", error.message);
    return [];
  }
  return (data ?? []) as EngagementEvent[];
}

async function fetchTransactions(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  since: string,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, user_id, scope, valor, categoria_id, created_at")
    .eq("user_id", userId)
    .eq("scope", scope)
    .eq("data_status", "confirmed")
    .gte("data", since.split("T")[0]);

  if (error) {
    console.error("fetchTransactions error:", error.message);
    return [];
  }
  return (data ?? []) as Transaction[];
}

// ── Upsert ────────────────────────────────────────────────────────────────

async function upsertBehavioralTags(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  detections: Array<{ tag_key: string; result: DetectionResult }>,
): Promise<number> {
  if (detections.length === 0) return 0;

  const now       = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const rows = detections.map(({ tag_key, result }) => ({
    user_id:     userId,
    scope,
    tag_key,
    intensity:   result.intensity,
    confidence:  result.confidence,
    evidence:    result.evidence,
    detected_at: now,
    expires_at:  expiresAt,
  }));

  const { error } = await supabase
    .from("behavioral_tags")
    .upsert(rows as unknown as Record<string, unknown>[], {
      onConflict: "user_id,scope,tag_key",
    });

  if (error) {
    console.error("upsertBehavioralTags error:", error.message);
    return 0;
  }
  return rows.length;
}

// ── Core ──────────────────────────────────────────────────────────────────

async function analyzeUserScope(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  since30d: string,
  since90d: string,
): Promise<number> {
  const rawEvents = await fetchEvents(supabase, userId, scope, since30d);
  const events    = filterValidEvents(rawEvents);
  const txs       = await fetchTransactions(supabase, userId, scope, since90d);

  const detections: Array<{ tag_key: string; result: DetectionResult }> = [];
  for (const detector of DETECTORS) {
    const result = detector.detect(events, txs);
    if (result !== null) detections.push({ tag_key: detector.tag_key, result });
  }

  return upsertBehavioralTags(supabase, userId, scope, detections);
}

// ── Handler ───────────────────────────────────────────────────────────────

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const activeUserScopes = await fetchActiveUserScopes(supabase, since30d, 50);

    let usersAnalyzed = 0;
    let tagsWritten   = 0;

    for (const { user_id, scope } of activeUserScopes) {
      tagsWritten += await analyzeUserScope(supabase, user_id, scope, since30d, since90d);
      usersAnalyzed++;
    }

    return new Response(
      JSON.stringify({ ok: true, users_analyzed: usersAnalyzed, tags_written: tagsWritten }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-behavioral-patterns error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

if (import.meta.main) {
  serve(handler);
}
