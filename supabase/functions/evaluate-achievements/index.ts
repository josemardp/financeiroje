import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withTelemetry } from "../_shared/telemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──────────────────────────────────────────────────────────────────

interface AchievementCriteria {
  type: string;
  [key: string]: unknown;
}

interface CatalogRow {
  id: string;
  category: string;
  title: string;
  description: string;
  icon: string | null;
  criteria: AchievementCriteria;
}

interface EvalResult {
  unlocked: boolean;
  evidence: Record<string, unknown> | null;
}

interface ActiveUser {
  user_id: string;
  scope: string;
}

// ── Active users ───────────────────────────────────────────────────────────

async function fetchActiveUsers(
  supabase: SupabaseClient,
  since30d: string,
  minEvents: number,
): Promise<ActiveUser[]> {
  const { data, error } = await supabase
    .from("user_engagement_events")
    .select("user_id, scope")
    .gte("created_at", since30d);

  if (error || !data) {
    console.error("fetchActiveUsers error:", error?.message);
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

// ── Catalog ────────────────────────────────────────────────────────────────

async function fetchCatalog(supabase: SupabaseClient): Promise<CatalogRow[]> {
  const { data, error } = await supabase
    .from("achievements_catalog")
    .select("id, category, title, description, icon, criteria");

  if (error || !data) {
    console.error("fetchCatalog error:", error?.message);
    return [];
  }
  return data as CatalogRow[];
}

// ── Evaluators ─────────────────────────────────────────────────────────────

async function evalTransactionsCount(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  criteria: AchievementCriteria,
): Promise<EvalResult> {
  const required = typeof criteria.count === "number" ? criteria.count : null;
  if (required === null) return { unlocked: false, evidence: null };

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("scope", scope)
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);

  if (error) {
    console.error("evalTransactionsCount error:", error.message);
    return { unlocked: false, evidence: null };
  }

  const count = (data ?? []).length;
  if (count >= required) {
    return { unlocked: true, evidence: { count, month: monthStart.slice(0, 7) } };
  }
  return { unlocked: false, evidence: null };
}

function weekStartKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function evalWeeklyClosingViews(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  criteria: AchievementCriteria,
): Promise<EvalResult> {
  const requiredWeeks = typeof criteria.weeks === "number" ? criteria.weeks : null;
  if (requiredWeeks === null) return { unlocked: false, evidence: null };

  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("user_engagement_events")
    .select("created_at")
    .eq("user_id", userId)
    .eq("scope", scope)
    .eq("event_type", "screen_view")
    .filter("context_data->>screenName", "eq", "MonthlyClosing")
    .gte("created_at", since);

  if (error) {
    console.error("evalWeeklyClosingViews error:", error.message);
    return { unlocked: false, evidence: null };
  }

  const weeks = new Set<string>();
  for (const row of (data ?? []) as Array<{ created_at: string }>) {
    weeks.add(weekStartKey(row.created_at));
  }

  const weeksWithView = weeks.size;
  if (weeksWithView >= requiredWeeks) {
    return { unlocked: true, evidence: { weeks_with_closing_view: weeksWithView } };
  }
  return { unlocked: false, evidence: null };
}

async function evalAppUsageWindow(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  criteria: AchievementCriteria,
): Promise<EvalResult> {
  const requiredHits   = typeof criteria.hits   === "number" ? criteria.hits   : null;
  const requiredWindow = typeof criteria.window  === "number" ? criteria.window : null;
  if (requiredHits === null || requiredWindow === null) return { unlocked: false, evidence: null };

  const since = new Date(Date.now() - requiredWindow * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("user_engagement_events")
    .select("created_at")
    .eq("user_id", userId)
    .eq("scope", scope)
    .gte("created_at", since);

  if (error) {
    console.error("evalAppUsageWindow error:", error.message);
    return { unlocked: false, evidence: null };
  }

  const days = new Set<string>();
  for (const row of (data ?? []) as Array<{ created_at: string }>) {
    days.add(row.created_at.slice(0, 10));
  }

  const daysActive = days.size;
  if (daysActive >= requiredHits) {
    return { unlocked: true, evidence: { days_active: daysActive, window: requiredWindow } };
  }
  return { unlocked: false, evidence: null };
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

async function evaluate(
  supabase: SupabaseClient,
  userId: string,
  scope: string,
  criteria: AchievementCriteria,
): Promise<EvalResult> {
  switch (criteria.type) {
    case "transactions_count":
      return evalTransactionsCount(supabase, userId, scope, criteria);
    case "weekly_closing_views":
      return evalWeeklyClosingViews(supabase, userId, scope, criteria);
    case "app_usage_window":
      return evalAppUsageWindow(supabase, userId, scope, criteria);
    default:
      // criteria.type sem fonte de verdade validada — retorna null intencionalmente
      return { unlocked: false, evidence: null };
  }
}

// ── Insert ─────────────────────────────────────────────────────────────────

async function insertAchievement(
  supabase: SupabaseClient,
  userId: string,
  achievementId: string,
  evidence: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase
    .from("user_achievements")
    .upsert(
      { user_id: userId, achievement_id: achievementId, evidence },
      { onConflict: "user_id,achievement_id", ignoreDuplicates: true },
    );

  if (error) {
    console.error(`insertAchievement error (${achievementId}):`, error.message);
    return false;
  }
  return true;
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

    const telemetryClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    return await withTelemetry({
      serviceClient: telemetryClient,
      component_type: "edge_function",
      component_name: "evaluate-achievements:batch",
      metadata: {
        since_days: 30,
        min_events: 10,
      },
      fn: async () => {
        const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [activeUsers, catalog] = await Promise.all([
          fetchActiveUsers(supabase, since30d, 10),
          fetchCatalog(supabase),
        ]);

        let usersEvaluated       = 0;
        let achievementsUnlocked = 0;

        for (const { user_id, scope } of activeUsers) {
          for (const row of catalog) {
            if (!row.criteria || typeof row.criteria.type !== "string") continue;

            const result = await evaluate(supabase, user_id, scope, row.criteria);
            if (result.unlocked && result.evidence) {
              const inserted = await insertAchievement(supabase, user_id, row.id, result.evidence);
              if (inserted) achievementsUnlocked++;
            }
          }
          usersEvaluated++;
        }

        return new Response(
          JSON.stringify({ ok: true, users_evaluated: usersEvaluated, achievements_unlocked: achievementsUnlocked }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      },
    });
  } catch (e) {
    console.error("evaluate-achievements error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

if (import.meta.main) {
  serve(handler);
}
