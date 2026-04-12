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

    // anonClient: leitura respeitando RLS — cada tabela tem policy SELECT para o próprio usuário
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

    const userId = user.id;

    const [
      { data: preferences, error: ePreferences },
      { data: coachMemory, error: eMemory },
      { data: patterns, error: ePatterns },
      { data: captureEvents, error: eCapture },
    ] = await Promise.all([
      anonClient
        .from("user_ai_preferences")
        .select("tom_voz, nivel_detalhamento, frequencia_alertas, contexto_identidade, valores_pessoais, compromissos_fixos, usar_versiculos_acf, contexto_religioso, prioridade_default, tratar_parcelamentos, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),

      anonClient
        .from("ai_coach_memory")
        .select("id, scope, memory_type, pattern_key, content, relevance, reinforcement_count, last_reinforced_at, expires_at, superseded_by, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),

      anonClient
        .from("user_patterns")
        .select("id, scope, pattern_type, pattern_key, pattern_value, hit_count, last_seen_at, confidence, source, created_at, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),

      anonClient
        .from("capture_learning_events")
        .select("id, scope, source_type, raw_input, ocr_text, ai_suggested_json, user_confirmed_json, field_diff_json, accepted_fields, corrected_fields, confidence_before, time_in_mirror_ms, transaction_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const errors = [ePreferences, eMemory, ePatterns, eCapture].filter(Boolean);
    if (errors.length > 0) {
      console.error("Export read errors:", errors);
      return new Response(JSON.stringify({ error: "Erro ao ler dados", details: errors.map(e => e?.message) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const payload = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      data: {
        user_ai_preferences: preferences ?? null,
        ai_coach_memory: coachMemory ?? [],
        user_patterns: patterns ?? [],
        capture_learning_events: captureEvents ?? [],
      },
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="financeiroje-dados-${userId.slice(0, 8)}-${dateStr}.json"`,
      },
    });

  } catch (e) {
    console.error("user-data-export error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  }
});
