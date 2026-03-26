import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPORT_TABLES = [
  "profiles",
  "accounts",
  "transactions",
  "recurring_transactions",
  "budgets",
  "loans",
  "extra_amortizations",
  "goals",
  "goal_contributions",
  "subscriptions",
  "family_values",
  "documents",
  "alerts",
  "ai_conversations",
  "ai_messages",
  "health_scores",
  "monthly_closings",
  "onboarding_progress",
  "assets",
  "asset_valuations",
  "mei_settings",
  "audit_logs",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, message: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Ambiente Supabase incompleto.");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, message: "Sessão inválida ou expirada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const exportedAt = new Date().toISOString();
    const requestInsert = await adminClient
      .from("privacy_requests")
      .insert({
        user_id: user.id,
        user_id_snapshot: user.id,
        request_type: "export",
        status: "processing",
      })
      .select("id")
      .single();

    if (requestInsert.error) {
      throw requestInsert.error;
    }

    const payload: Record<string, unknown> = {
      exportedAt,
      user: {
        id: user.id,
        email: user.email,
      },
      tables: {},
    };

    for (const tableName of EXPORT_TABLES) {
      const query = adminClient.from(tableName).select("*");
      let response;

      if (tableName === "asset_valuations") {
        const { data: assets } = await adminClient.from("assets").select("id").eq("user_id", user.id);
        const assetIds = (assets || []).map((asset) => asset.id);
        response = assetIds.length ? await query.in("asset_id", assetIds) : { data: [], error: null };
      } else if (tableName === "goal_contributions") {
        const { data: goals } = await adminClient.from("goals").select("id").eq("user_id", user.id);
        const goalIds = (goals || []).map((goal) => goal.id);
        response = goalIds.length ? await query.in("goal_id", goalIds) : { data: [], error: null };
      } else if (tableName === "ai_messages") {
        const { data: conversations } = await adminClient.from("ai_conversations").select("id").eq("user_id", user.id);
        const conversationIds = (conversations || []).map((conversation) => conversation.id);
        response = conversationIds.length ? await query.in("conversation_id", conversationIds) : { data: [], error: null };
      } else {
        response = await query.eq("user_id", user.id);
      }

      if (response.error) {
        throw response.error;
      }

      (payload.tables as Record<string, unknown[]>)[tableName] = response.data || [];
    }

    await adminClient
      .from("privacy_requests")
      .update({
        status: "completed",
        processed_at: exportedAt,
        result: { exported_tables: EXPORT_TABLES },
      })
      .eq("id", requestInsert.data.id);

    return new Response(JSON.stringify({
      ok: true,
      message: "Exportação preparada com sucesso.",
      requestId: requestInsert.data.id,
      payload,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : "Erro inesperado ao exportar dados.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
