import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_PHRASE = "EXCLUIR MINHA CONTA";

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
        request_type: "delete_account",
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

    await adminClient
      .from("privacy_requests")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        result: {
          action: "auth.admin.deleteUser",
          storage_bucket: "documents",
        },
      })
      .eq("id", requestInsert.data.id);

    const deleteResult = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteResult.error) {
      throw deleteResult.error;
    }

    await reauthClient.auth.signOut();

    return new Response(JSON.stringify({
      ok: true,
      message: "Conta excluída com sucesso.",
      requestId: requestInsert.data.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : "Erro inesperado ao excluir conta.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
