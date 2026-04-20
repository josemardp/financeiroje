import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 384;
const EMBEDDING_VERSION = "1";
const BATCH_SIZE = 100;
const MIN_CONTENT_LENGTH = 50;

interface PendingMessageRow {
  id: string;
  content: string;
}

function isEligibleForEmbedding(row: PendingMessageRow): boolean {
  return row.content.length > MIN_CONTENT_LENGTH;
}

async function generateEmbeddingsBatch(texts: string[]): Promise<Array<number[] | null>> {
  if (texts.length === 0) return [];

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embeddings API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rows = Array.isArray(data?.data) ? data.data : [];

  return texts.map((_, index) => {
    const embedding = rows[index]?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse body — cron envia {}, frontend envia { mode, text } para mode="embed"
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* body vazio ou sem content-type */ }

  // ── mode="embed": embedding único — usado por findRelatedConversations ─────
  if (body.mode === "embed") {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 10) {
      return new Response(
        JSON.stringify({ error: "text muito curto (mínimo 10 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const embeddings = await generateEmbeddingsBatch([text]);
    const embedding = embeddings[0];
    if (!embedding) {
      return new Response(JSON.stringify({ error: "Falha ao gerar embedding" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, embedding }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // ── fim mode="embed" ───────────────────────────────────────────────────────

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("ai_messages")
      .select("id, content")
      .is("content_embedding", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      throw new Error(`Failed to fetch pending ai_messages: ${error.message}`);
    }

    const pending = ((data ?? []) as PendingMessageRow[])
      .filter(isEligibleForEmbedding)
      .slice(0, BATCH_SIZE);

    if (pending.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          selected: 0,
          updated: 0,
          failed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const embeddings = await generateEmbeddingsBatch(pending.map((row) => row.content));
    const now = new Date().toISOString();

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i++) {
      const embedding = embeddings[i];

      if (!embedding) {
        failed++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("ai_messages")
        .update({
          content_embedding: embedding,
          embedded_at: now,
          embedding_version: EMBEDDING_VERSION,
        })
        .eq("id", pending[i].id)
        .is("content_embedding", null);

      if (updateError) {
        console.error("embed-ai-messages update failed", pending[i].id, updateError.message);
        failed++;
        continue;
      }

      updated++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        selected: pending.length,
        updated,
        failed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("embed-ai-messages error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
