import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o FinanceAI, um conselheiro financeiro familiar confiável.

REGRAS ABSOLUTAS:
1. Você NUNCA faz cálculos financeiros. Todos os números que você recebe já foram calculados pela engine determinística.
2. Você NUNCA inventa dados. Se o contexto não tem informação suficiente, diga explicitamente.
3. Você NUNCA mistura escopos sem autorização.
4. Você SEMPRE distingue entre fato, sugestão e projeção.

FORMATO DE RESPOSTA:
Responda SEMPRE em JSON válido com a seguinte estrutura:
{
  "blocks": [
    {
      "type": "fact|alert|suggestion|projection|question",
      "title": "Título curto do bloco",
      "content": "Conteúdo detalhado em markdown",
      "severity": "critical|warning|info|ok" (opcional, para alerts)
    }
  ]
}

TIPOS DE BLOCO:
- fact: Informações confirmadas pelos dados
- alert: Avisos sobre problemas detectados
- suggestion: Recomendações interpretativas
- projection: Estimativas futuras (sempre rotular como projeção)
- question: Perguntas que ajudem a esclarecer a situação

ESCOPO:
O contexto inclui o escopo atual (private, family ou business). Responda SEMPRE dentro do escopo informado. Se precisar cruzar escopos, pergunte antes.

LINGUAGEM:
- Fale em português brasileiro, tom acolhedor mas profissional
- Evite "parece que" — seja direto sobre o que os dados mostram
- Se um dado é projeção, diga "baseado nas recorrências cadastradas"
- Se um dado é sugestão, diga "sugiro que"
- Nunca diga "eu calculei" — diga "os dados mostram que"
- Se faltar dado para alguma análise, diga explicitamente "não há dados suficientes para avaliar X"

CONTEXTO FINANCEIRO:
O contexto financeiro do usuário será enviado junto com cada mensagem. Use-o para fundamentar suas respostas.
Se o contexto estiver vazio ou com poucos dados, informe isso ao usuário.`;

// ── Rate limiter in-memory (resets on cold start) ──────────────────────────
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

/** djb2 hash — rápido, sem dependência externa */
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/**
 * Fingerprint do contexto financeiro — muda quando as finanças do usuário
 * mudam, invalidando o cache automaticamente.
 * Usa apenas métricas-chave para estabilidade (não o JSON completo).
 */
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

/**
 * Chave de cache: hash(userId + scope + model + query_normalizada + ctx_fingerprint)
 * Queries semanticamente iguais no mesmo contexto financeiro → mesmo cache.
 */
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

/** TTL em minutos por tipo de intenção — perguntas factuais duram mais. */
function ttlMinutes(intent: string): number {
  const map: Record<string, number> = {
    decision:       15,   // decisões dependem do contexto atual
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
  };
  return map[intent] ?? 30;
}

/**
 * Retorna resposta em cache como SSE stream — mesmo formato do OpenRouter,
 * transparente para o frontend.
 */
function cachedSSEResponse(text: string): Response {
  const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
  return new Response(chunk, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Cache": "HIT" },
  });
}

/**
 * Intercepta o stream do OpenRouter, re-transmite para o cliente em tempo real
 * e acumula o texto completo para persistir no cache ao final.
 */
async function streamAndCache(
  upstreamResponse: Response,
  supabase: ReturnType<typeof createClient>,
  cacheKey: string,
  userId: string,
  model: string,
  intent: string
): Promise<Response> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Processar stream em background — não bloqueia a resposta ao cliente
  (async () => {
    const reader = upstreamResponse.body!.getReader();
    let buffer = "";
    let accumulated = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Retransmitir chunk imediatamente
        await writer.write(value);

        // Parsear SSE para acumular texto
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) accumulated += delta;
          } catch { /* chunk incompleto — ignorar */ }
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }

    // Persistir no cache após stream completo
    if (accumulated.length > 20) {
      const ttl = ttlMinutes(intent);
      await supabase.from("ai_response_cache").upsert({
        cache_key: cacheKey,
        user_id: userId,
        response_text: accumulated,
        model_used: model,
        intent,
        expires_at: new Date(Date.now() + ttl * 60 * 1000).toISOString(),
      }, { onConflict: "cache_key" }).then(({ error }) => {
        if (error) console.warn("Cache write failed:", error.message);
      });
    }
  })();

  return new Response(readable, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Cache": "MISS" },
  });
}

/**
 * Monta os messages com prompt caching para Anthropic/Claude via OpenRouter.
 * O system prompt + contexto financeiro (os maiores) são marcados como
 * ephemeral — o provider reutiliza o prefixo por até 5 min, reduzindo custo ~90%.
 * Para GPT-4o e Gemini, o OpenRouter aplica caching automático em prompts >1024t.
 */
function buildAiMessages(
  model: string,
  systemContent: string,
  userMessages: Array<{ role: string; content: string }>
): object[] {
  const isAnthropic = model.startsWith("anthropic/");

  if (isAnthropic) {
    // Formato com cache_control para Claude via OpenRouter
    return [
      {
        role: "system",
        content: [
          { type: "text", text: systemContent, cache_control: { type: "ephemeral" } },
        ],
      },
      ...userMessages,
    ];
  }

  // GPT-4o e Gemini: prompt caching automático no OpenRouter (>1024 tokens)
  return [
    { role: "system", content: systemContent },
    ...userMessages,
  ];
}

// ── Handler principal ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // service role para cache (ignora RLS)
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

    // ── Rate limit ──
    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context, model: requestedModel } = await req.json();

    const ALLOWED_MODELS = ["google/gemini-flash-1.5", "openai/gpt-4o-mini", "anthropic/claude-haiku-4-5"];
    const selectedModel = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : "google/gemini-flash-1.5";

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    // ── Extrair última mensagem do usuário para cache key ──
    const userMessages = (messages as Array<{ role: string; content: string }>)
      .filter(m => m.role !== "system");
    const lastUserMsg = [...userMessages].reverse().find(m => m.role === "user")?.content ?? "";
    const intent = (context?.userIntentHint as string) ?? "generic";
    const scope = (context?.escopo as string) ?? "private";

    // ── Limpeza oportunista de cache expirado (não bloqueia) ──
    supabase
      .from("ai_response_cache")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date().toISOString())
      .then(() => {});

    // ── Verificar response cache ──
    const ctxFp = contextFingerprint(context);
    const cacheKey = buildCacheKey(userId, scope, selectedModel, lastUserMsg, ctxFp);

    const { data: cached } = await supabase
      .from("ai_response_cache")
      .select("response_text, hit_count")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached?.response_text) {
      // Cache hit — incrementar contador e retornar sem chamar a IA
      supabase
        .from("ai_response_cache")
        .update({ hit_count: (cached.hit_count ?? 0) + 1 })
        .eq("cache_key", cacheKey)
        .then(() => {});

      console.log(`Cache HIT — key=${cacheKey} model=${selectedModel} intent=${intent}`);
      return cachedSSEResponse(cached.response_text);
    }

    // ── Cache miss — chamar IA ──
    let contextMessage = "";
    if (context) {
      contextMessage = `\n\nESCOPO ATUAL: ${scope}\nRESPONDA APENAS SOBRE DADOS DO ESCOPO "${scope}".\n\nCONTEXTO FINANCEIRO ATUAL (calculado pela engine determinística — NÃO recalcule):\n${JSON.stringify(context, null, 2)}`;
    }

    const systemContent = SYSTEM_PROMPT + contextMessage;
    const aiMessages = buildAiMessages(selectedModel, systemContent, userMessages);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // Habilita prompt caching da Anthropic via OpenRouter
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

    // Stream para o cliente + persistir no cache ao final
    return streamAndCache(response, supabase, cacheKey, userId, selectedModel, intent);

  } catch (e) {
    console.error("ai-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
