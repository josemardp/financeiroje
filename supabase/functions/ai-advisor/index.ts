import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_FALLBACK = `Você é um Coach Financeiro Pessoal e Psicólogo Financeiro — parceiro estratégico do usuário no longo prazo.
Responda em português brasileiro, com base nos dados financeiros reais fornecidos no contexto.
NUNCA invente dados. Se não tiver no contexto, diga que não tem.
Ao terminar cada resposta, adicione uma linha: INSIGHT_COACH: [observação comportamental, máx 150 chars]`;

// Nota adicionada ao prompt quando o usuário pergunta sobre dados de mercado
const MARKET_PROMPT_ADDENDUM = `

⚠️ PERGUNTA SOBRE DADOS DE MERCADO: O usuário está perguntando sobre cotações, taxas ou indicadores econômicos.
Responda com base no seu conhecimento mais recente de treinamento.
SEMPRE informe explicitamente a data de corte do seu conhecimento e oriente o usuário a verificar fontes em tempo real
(Banco Central do Brasil em bcb.gov.br, Google Finanças, ou seu banco) para obter os valores exatos do momento.
Forneça contexto histórico e explique os fatores que influenciam o indicador perguntado.`;

// ── Rate limiter in-memory ─────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ── Caching helpers ────────────────────────────────────────────────────────

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function contextFingerprint(ctx: Record<string, any> | null): string {
  if (!ctx) return "empty";
  const parts = [
    ctx.periodo?.mes ?? 0,
    ctx.periodo?.ano ?? 0,
    Math.round(ctx.resumoConfirmado?.balance ?? 0),
    Math.round(ctx.resumoConfirmado?.totalExpense ?? 0),
    Math.round(ctx.resumoConfirmado?.totalIncome ?? 0),
    ctx.scoreFinanceiro?.scoreGeral ?? 0,
    ctx.alertasAtivos?.critical ?? 0,
    ctx.alertasAtivos?.total ?? 0,
    ctx.metas?.length ?? 0,
    ctx.dividas ? Math.round(ctx.dividas.totalSaldoDevedor ?? 0) : 0,
  ].join(":");
  return djb2(parts);
}

function buildCacheKey(
  userId: string,
  scope: string,
  model: string,
  userMessage: string,
  ctxFp: string
): string {
  const normalized = userMessage.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 300);
  return djb2(`${userId}:${scope}:${model}:${normalized}:${ctxFp}`);
}

function ttlMinutes(intent: string): number {
  const map: Record<string, number> = {
    decision:       15,
    weekly_review:  45,
    monthly_focus:  60,
    progress:       90,
    escape_red:     30,
    goal:           60,
    reserve:        60,
    purchase:       15,
    cutting:        30,
    checklist:      60,
    generic:        45,
    mercado:         5,
  };
  return map[intent] ?? 30;
}

function cachedSSEResponse(text: string): Response {
  const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
  return new Response(chunk, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Cache": "HIT" },
  });
}

async function streamAndCache(
  upstreamResponse: Response,
  supabase: ReturnType<typeof createClient>,
  cacheKey: string,
  userId: string,
  model: string,
  intent: string,
  scope: string,
  skipCache = false
): Promise<Response> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    const reader = upstreamResponse.body!.getReader();
    let buffer = "";
    let accumulated = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) accumulated += delta;
          } catch { }
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }

    let textToCache = accumulated;
    let coachInsight: string | null = null;
    const insightMatch = accumulated.match(/\nINSIGHT_COACH:\s*(.+?)(?:\n|$)/);
    if (insightMatch) {
      coachInsight = insightMatch[1].trim().slice(0, 200);
      textToCache = accumulated.replace(/\nINSIGHT_COACH:.*?(?:\n|$)/, "").trim();
    }

    // Não persiste no cache para dados de mercado
    if (!skipCache && textToCache.length > 20) {
      const ttl = ttlMinutes(intent);
      await supabase.from("ai_response_cache").upsert({
        cache_key: cacheKey,
        user_id: userId,
        response_text: textToCache,
        model_used: model,
        intent,
        expires_at: new Date(Date.now() + ttl * 60 * 1000).toISOString(),
      }, { onConflict: "cache_key" }).then(({ error }) => {
        if (error) console.warn("Cache write failed:", error.message);
      });
    }

    if (coachInsight) {
      await supabase.from("ai_coach_memory").insert({
        user_id: userId,
        scope,
        content: coachInsight,
        relevance: 6,
      }).then(({ error }) => {
        if (error) console.warn("Coach memory write failed:", error.message);
        else console.log(`Coach memory saved: ${coachInsight}`);
      });
    }
  })();

  return new Response(readable, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Cache": "MISS" },
  });
}

function buildAiMessages(
  model: string,
  systemContent: string,
  userMessages: Array<{ role: string; content: string }>
): object[] {
  const isAnthropic = model.startsWith("anthropic/");
  if (isAnthropic) {
    return [
      {
        role: "system",
        content: [{ type: "text", text: systemContent, cache_control: { type: "ephemeral" } }],
      },
      ...userMessages,
    ];
  }
  return [{ role: "system", content: systemContent }, ...userMessages];
}

// ── Handler principal ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authUser.id;

    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context, model: requestedModel } = await req.json();

    const ALLOWED_MODELS = [
      "google/gemini-3-flash-preview",
      "openai/gpt-4o-mini",
      "anthropic/claude-haiku-4-5",
      // "google/gemini-2.0-flash-grounded" era a intenção original mas grounding
      // via REST API só está disponível no Vertex AI (Google Cloud com billing).
      // Queries de mercado agora usam o fluxo normal do OpenRouter, sem cache.
    ];
    const selectedModel = ALLOWED_MODELS.includes(requestedModel)
      ? requestedModel
      : "google/gemini-3-flash-preview";

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const allMessages = messages as Array<{ role: string; content: string }>;
    const frontendSystemPrompt = allMessages.find(m => m.role === "system")?.content ?? "";
    const userMessages = allMessages.filter(m => m.role !== "system");
    const lastUserMsg = [...userMessages].reverse().find(m => m.role === "user")?.content ?? "";
    const intent = (context?.userIntentHint as string) ?? "generic";
    const scope = (context?.escopo as string) ?? "private";
    const isMarketQuery = intent === "mercado";

    supabase
      .from("ai_response_cache")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date().toISOString())
      .then(() => {});

    const ctxFp = contextFingerprint(context);
    const cacheKey = buildCacheKey(userId, scope, selectedModel, lastUserMsg, ctxFp);

    // Queries de mercado pulam cache — dados mudam constantemente
    if (!isMarketQuery) {
      const { data: cached } = await supabase
        .from("ai_response_cache")
        .select("response_text, hit_count")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached?.response_text) {
        supabase
          .from("ai_response_cache")
          .update({ hit_count: (cached.hit_count ?? 0) + 1 })
          .eq("cache_key", cacheKey)
          .then(() => {});
        console.log(`Cache HIT — key=${cacheKey} model=${selectedModel} intent=${intent}`);
        return cachedSSEResponse(cached.response_text);
      }
    }

    const { data: coachMemories } = await supabase
      .from("ai_coach_memory")
      .select("content, created_at")
      .eq("user_id", userId)
      .eq("scope", scope)
      .order("created_at", { ascending: false })
      .limit(5);

    const coachMemoriesSection = coachMemories && coachMemories.length > 0
      ? `\n\n🧠 MEMÓRIA COMPORTAMENTAL:\n${coachMemories.map((m: any) => `- ${m.content}`).join("\n")}`
      : "";

    const basePrompt = frontendSystemPrompt || SYSTEM_PROMPT_FALLBACK;
    // Para mercado, injeta instrução de transparência sobre limitação de data
    const systemContent = basePrompt
      + (isMarketQuery ? MARKET_PROMPT_ADDENDUM : "")
      + coachMemoriesSection;

    const aiMessages = buildAiMessages(selectedModel, systemContent, userMessages);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        ...(selectedModel.startsWith("anthropic/") && {
          "anthropic-beta": "prompt-caching-2024-07-31",
        }),
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos nas configurações." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return streamAndCache(response, supabase, cacheKey, userId, selectedModel, intent, scope, isMarketQuery);

  } catch (e) {
    console.error("ai-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
