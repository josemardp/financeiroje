import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Exige confirmação explícita no body para evitar exclusão acidental
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return new Response(JSON.stringify({ error: "Confirmação obrigatória: envie { \"confirm\": true }" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // serviceClient obrigatório: capture_learning_events tem RLS FOR DELETE USING (false)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = user.id;

    const [
      { count: cPreferences, error: ePreferences },
      { count: cMemory,      error: eMemory      },
      { count: cPatterns,    error: ePatterns    },
      { count: cCapture,     error: eCapture     },
    ] = await Promise.all([
      serviceClient.from("user_ai_preferences")    .delete({ count: "exact" }).eq("user_id", userId),
      serviceClient.from("ai_coach_memory")         .delete({ count: "exact" }).eq("user_id", userId),
      serviceClient.from("user_patterns")           .delete({ count: "exact" }).eq("user_id", userId),
      serviceClient.from("capture_learning_events") .delete({ count: "exact" }).eq("user_id", userId),
    ]);

    const errors = [ePreferences, eMemory, ePatterns, eCapture].filter(Boolean);
    if (errors.length > 0) {
      console.error("Purge errors:", errors);
      return new Response(JSON.stringify({ error: "Erro parcial na exclusão", details: errors.map(e => e?.message) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    return new Response(JSON.stringify({
      purged_at: new Date().toISOString(),
      deleted: {
        user_ai_preferences:     cPreferences ?? 0,
        ai_coach_memory:         cMemory      ?? 0,
        user_patterns:           cPatterns    ?? 0,
        capture_learning_events: cCapture     ?? 0,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });

  } catch (e) {
    console.error("user-data-purge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  }
});
