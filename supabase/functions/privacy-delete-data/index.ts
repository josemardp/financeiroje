import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_PHRASE = "EXCLUIR MEUS DADOS";

function normalizePhrase(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

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

    const { currentPassword, reason, confirmationPhrase } = await req.json();

    if (!currentPassword || typeof currentPassword !== "string") {
      return new Response(JSON.stringify({ ok: false, message: "Senha atual obrigatória." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (normalizePhrase(confirmationPhrase || "") !== REQUIRED_PHRASE) {
      return new Response(JSON.stringify({ ok: false, message: `Confirmação inválida. Digite: ${REQUIRED_PHRASE}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reauthClient = createClient(supabaseUrl, anonKey);
    const reauth = await reauthClient.auth.signInWithPassword({
      email: user.email || "",
      password: currentPassword,
    });

    if (reauth.error) {
      return new Response(JSON.stringify({ ok: false, message: "Senha atual inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const requestInsert = await adminClient
      .from("privacy_requests")
      .insert({
        user_id: user.id,
        user_id_snapshot: user.id,
        request_type: "delete_data",
        status: "processing",
        reason: typeof reason === "string" ? reason : null,
        confirmation_phrase: REQUIRED_PHRASE,
      })
      .select("id")
      .single();

    if (requestInsert.error) {
      throw requestInsert.error;
    }

    const { data: documents } = await adminClient
      .from("documents")
      .select("file_url")
      .eq("user_id", user.id);

    const documentPaths = (documents || [])
      .map((doc) => {
        const fileUrl = doc.file_url;
        if (!fileUrl) return null;
        const marker = "/documents/";
        const index = fileUrl.indexOf(marker);
        return index >= 0 ? fileUrl.slice(index + marker.length) : null;
      })
      .filter((value): value is string => Boolean(value));

    if (documentPaths.length > 0) {
      await adminClient.storage.from("documents").remove(documentPaths);
    }

    const { data: loans } = await adminClient.from("loans").select("id").eq("user_id", user.id);
    const loanIds = (loans || []).map((loan) => loan.id);

    const { data: goals } = await adminClient.from("goals").select("id").eq("user_id", user.id);
    const goalIds = (goals || []).map((goal) => goal.id);

    const { data: conversations } = await adminClient.from("ai_conversations").select("id").eq("user_id", user.id);
    const conversationIds = (conversations || []).map((conversation) => conversation.id);

    const { data: assets } = await adminClient.from("assets").select("id").eq("user_id", user.id);
    const assetIds = (assets || []).map((asset) => asset.id);

    if (conversationIds.length > 0) {
      await adminClient.from("ai_messages").delete().in("conversation_id", conversationIds);
    }

    if (goalIds.length > 0) {
      await adminClient.from("goal_contributions").delete().in("goal_id", goalIds);
    }

    if (loanIds.length > 0) {
      await adminClient.from("loan_installments").delete().in("emprestimo_id", loanIds);
      await adminClient.from("extra_amortizations").delete().in("emprestimo_id", loanIds);
    }

    if (assetIds.length > 0) {
      await adminClient.from("asset_valuations").delete().in("asset_id", assetIds);
    }

    const ownedTables = [
      "transactions",
      "recurring_transactions",
      "budgets",
      "subscriptions",
      "family_values",
      "documents",
      "alerts",
      "health_scores",
      "monthly_closings",
      "onboarding_progress",
      "accounts",
      "loans",
      "goals",
      "ai_conversations",
      "assets",
      "mei_settings",
      "audit_logs",
    ] as const;

    for (const tableName of ownedTables) {
      const result = await adminClient.from(tableName).delete().eq("user_id", user.id);
      if (result.error) {
        throw result.error;
      }
    }

    await adminClient
      .from("profiles")
      .update({
        preferences: {},
        familia_id: null,
        avatar_url: null,
        perfil: null,
      })
      .eq("user_id", user.id);

    await adminClient
      .from("privacy_requests")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        result: {
          cleared_tables: ownedTables,
          storage_bucket: "documents",
        },
      })
      .eq("id", requestInsert.data.id);

    await reauthClient.auth.signOut();

    return new Response(JSON.stringify({
      ok: true,
      message: "Dados operacionais excluídos com sucesso.",
      requestId: requestInsert.data.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : "Erro inesperado ao excluir dados.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
