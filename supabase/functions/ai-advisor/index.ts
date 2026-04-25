import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Context-Used, X-Cache, X-Prompt-Variants",
};

type PromptVariantOption = {
  key: string;
  promptFragment?: string;
};

const SYSTEM_PROMPT_FALLBACK = `Você é um Coach Financeiro Pessoal e Psicólogo Financeiro — parceiro estratégico do usuário no longo prazo.
Responda em português brasileiro, com base nos dados financeiros reais fornecidos no contexto.
NUNCA invente dados. Se não tiver no contexto, diga que não tem.
Ao terminar cada resposta, adicione uma linha: INSIGHT_COACH: [observação comportamental, máx 150 chars]`;

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

function hashUint32(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

function normalizeVariantOptions(variants: unknown): PromptVariantOption[] {
  const source = Array.isArray(variants)
    ? variants
    : variants && typeof variants === "object" && Array.isArray((variants as { options?: unknown[] }).options)
      ? (variants as { options: unknown[] }).options
      : [];

  return source.flatMap((variant) => {
    if (typeof variant === "string") {
      return [{ key: variant }];
    }

    if (!variant || typeof variant !== "object") {
      return [];
    }

    const record = variant as Record<string, unknown>;
    const rawKey = record.key ?? record.variant_key ?? record.id ?? record.name;
    if (typeof rawKey !== "string" || !rawKey.trim()) {
      return [];
    }

    const rawPrompt = record.prompt_fragment ?? record.prompt ?? record.instructions ?? record.text;
    return [{
      key: rawKey,
      promptFragment: typeof rawPrompt === "string" && rawPrompt.trim()
        ? rawPrompt.trim()
        : undefined,
    }];
  });
}

function assignVariants(userId: string, experimentKey: string, variants: unknown): PromptVariantOption | null {
  const options = normalizeVariantOptions(variants);
  if (options.length === 0) return null;

  const hash = hashUint32(`${userId}:${experimentKey}`);
  return options[hash % options.length];
}

function buildVariantPromptSection(assignments: Record<string, PromptVariantOption>): string {
  const lines = Object.entries(assignments)
    .flatMap(([experimentKey, variant]) => (
      variant.promptFragment
        ? [`- ${experimentKey}/${variant.key}: ${variant.promptFragment}`]
        : []
    ));

  if (lines.length === 0) return "";

  return `\n\nPROMPT_VARIANTS_ATIVOS:\n${lines.join("\n")}`;
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
  ctxFp: string,
  variantFp: string
): string {
  const normalized = userMessage.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 300);
  return djb2(`${userId}:${scope}:${model}:${normalized}:${ctxFp}:${variantFp}`);
}

function ttlMinutes(intent: string): number {
  const map: Record<string, number> = {
    decision: 15, weekly_review: 45, monthly_focus: 60, progress: 90,
    escape_red: 30, goal: 60, reserve: 60, purchase: 15, cutting: 30,
    checklist: 60, generic: 45, mercado: 5,
  };
  return map[intent] ?? 30;
}

function cachedSSEResponse(text: string, promptVariantKeys: Record<string, string>): Response {
  const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
  return new Response(chunk, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "X-Cache": "HIT",
      "X-Context-Used": JSON.stringify({ memories: [], patterns: [] }),
      "X-Prompt-Variants": JSON.stringify(promptVariantKeys),
    },
  });
}

// ── Fontes de dados de mercado em tempo real ───────────────────────────────

/**
 * Busca cotações (AwesomeAPI) e indicadores oficiais (BCB) em paralelo.
 * Nenhuma chave necessária — APIs públicas gratuitas e sem limite.
 */
async function fetchMarketData(): Promise<string> {
  const [ratesRes, selicRes, ipcaRes] = await Promise.allSettled([
    fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL", {
      signal: AbortSignal.timeout(4000),
    }),
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json", {
      signal: AbortSignal.timeout(4000),
    }),
    fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json", {
      signal: AbortSignal.timeout(4000),
    }),
  ]);

  const lines: string[] = [];

  if (ratesRes.status === "fulfilled" && ratesRes.value.ok) {
    try {
      const rates = await ratesRes.value.json();
      const usd = rates["USDBRL"];
      const eur = rates["EURBRL"];
      const btc = rates["BTCBRL"];
      if (usd) lines.push(`💵 Dólar (USD/BRL): R$ ${parseFloat(usd.bid).toFixed(2)} compra / R$ ${parseFloat(usd.ask).toFixed(2)} venda — atualizado ${usd.create_date}`);
      if (eur) lines.push(`💶 Euro (EUR/BRL): R$ ${parseFloat(eur.bid).toFixed(2)} compra / R$ ${parseFloat(eur.ask).toFixed(2)} venda`);
      if (btc) lines.push(`₿ Bitcoin (BTC/BRL): R$ ${parseFloat(btc.bid).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`);
    } catch { /* parse falhou */ }
  }

  if (selicRes.status === "fulfilled" && selicRes.value.ok) {
    try {
      const [s] = await selicRes.value.json();
      if (s) lines.push(`🏦 Taxa Selic: ${s.valor}% a.a. (data de referência: ${s.data})`);
    } catch (_e) { /* falha silenciosa — dados de mercado são opcionais */ }
  }

  if (ipcaRes.status === "fulfilled" && ipcaRes.value.ok) {
    try {
      const [i] = await ipcaRes.value.json();
      if (i) lines.push(`📈 IPCA: ${i.valor}% no mês (data de referência: ${i.data})`);
    } catch (_e) { /* falha silenciosa — dados de mercado são opcionais */ }
  }

  return lines.length > 0
    ? `\n\n📊 DADOS DE MERCADO EM TEMPO REAL (use estes valores na sua resposta — são dados oficiais coletados agora):\n${lines.join("\n")}`
    : "";
}

/**
 * Busca resultados web via Tavily Search API (1.000 requisições/mês grátis).
 * Chave configurada em TAVILY_API_KEY nas secrets do Supabase.
 */
async function fetchTavilySearch(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
        max_results: 5,
        topic: "news",
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn("Tavily Search error:", res.status);
      return "";
    }

    const data = await res.json();
    const results: any[] = data.results?.slice(0, 5) ?? [];
    if (results.length === 0) return "";

    const snippets = results
      .map((r: any) => `• **${r.title}**: ${r.content?.slice(0, 200) ?? ""}`)
      .join("\n");

    return `\n\n🔍 PESQUISA WEB EM TEMPO REAL (notícias recentes):\n${snippets}`;
  } catch (e) {
    console.warn("Tavily Search failed:", e);
    return "";
  }
}

// ── Tipos válidos para decision_outcomes ──────────────────────────────────

const VALID_RECOMMENDATION_TYPES = new Set([
  "antecipar_divida", "reforcar_reserva", "cortar_recorrente", "priorizar_meta",
  "adiar_compra", "redistribuir_orcamento", "revisar_categoria", "outro",
]);

// ── Extrator robusto de INSIGHT_COACH_JSON ─────────────────────────────────

/**
 * Localiza INSIGHT_COACH_JSON no texto acumulado e extrai o JSON por
 * balanceamento de chaves — não depende de JSON de uma linha.
 * Retorna null se o marcador não existir ou o JSON estiver malformado.
 */
function extractInsightJson(text: string): { json: string; cleaned: string } | null {
  const marker = "\nINSIGHT_COACH_JSON:";
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return null;

  const braceStart = text.indexOf("{", markerIdx + marker.length);
  if (braceStart === -1) return null;

  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) { braceEnd = i; break; }
    }
  }
  if (braceEnd === -1) return null;

  const json = text.slice(braceStart, braceEnd + 1);

  // Remove o bloco inteiro (do \n antes do marcador até depois do })
  // incluindo eventual \n após o fechamento
  let afterBlock = braceEnd + 1;
  if (afterBlock < text.length && text[afterBlock] === "\n") afterBlock++;
  const cleaned = (text.slice(0, markerIdx) + text.slice(afterBlock)).trim();

  return { json, cleaned };
}

// ── Extrator de RECOMMENDATION_JSON (Sprint 5 — T5.2) ────────────────────

/**
 * Mesma lógica de brace-matching do extractInsightJson.
 * Retorna o JSON bruto e o texto limpo (sem o marcador).
 */
function extractRecommendationJson(text: string): { json: string; cleaned: string } | null {
  const marker = "\nRECOMMENDATION_JSON:";
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return null;

  const braceStart = text.indexOf("{", markerIdx + marker.length);
  if (braceStart === -1) return null;

  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) { braceEnd = i; break; }
    }
  }
  if (braceEnd === -1) return null;

  const json = text.slice(braceStart, braceEnd + 1);
  let afterBlock = braceEnd + 1;
  if (afterBlock < text.length && text[afterBlock] === "\n") afterBlock++;
  const cleaned = (text.slice(0, markerIdx) + text.slice(afterBlock)).trim();

  return { json, cleaned };
}

// ── Extrator de META_REFLECTION_JSON (Sprint 8 — T8.3) ───────────────────

function extractMetaReflectionJson(text: string): { json: string; cleaned: string } | null {
  const marker = "\nMETA_REFLECTION_JSON:";
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return null;

  const braceStart = text.indexOf("{", markerIdx + marker.length);
  if (braceStart === -1) return null;

  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) { braceEnd = i; break; }
    }
  }
  if (braceEnd === -1) return null;

  const json = text.slice(braceStart, braceEnd + 1);
  let afterBlock = braceEnd + 1;
  if (afterBlock < text.length && text[afterBlock] === "\n") afterBlock++;
  const cleaned = (text.slice(0, markerIdx) + text.slice(afterBlock)).trim();

  return { json, cleaned };
}

// ── Sanitizador de Input (Sprint 8 — T8.4) ───────────────────────────────

function sanitizeInput(input: string): string {
  if (!input) return "";
  const patterns = [
    /ignore\s+previous\s+instructions/gi,
    /you\s+are\s+now/gi,
    /system:/gi,
    /forget\s+everything/gi,
    /new\s+instructions/gi,
    /roleplay\s+as/gi,
    /disregard/gi,
    /pretend/gi,
    /act\s+as/gi,
    /override/gi,
    /<system>/gi,
    /<instruction>/gi,
    /\[\[SYSTEM\]\]/gi
  ];

  let s = input.replace(/<\/user_data>/gi, "[TAG_BLOCK]");
  patterns.forEach(p => s = s.replace(p, "[REDACTED]"));
  
  return `<user_data>\n${s.trim()}\n</user_data>`;
}

// ── Stream + cache ─────────────────────────────────────────────────────────

async function streamAndCache(
  upstreamResponse: Response,
  supabase: ReturnType<typeof createClient>,
  cacheKey: string,
  userId: string,
  model: string,
  intent: string,
  scope: string,
  skipCache = false,
  memoryIds: string[] = [],
  contextSnapshot: Record<string, unknown> | null = null,
  promptVariantKeys: Record<string, string> = {}
): Promise<Response> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
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
          } catch (_e) { /* linha SSE malformada — ignorar e continuar */ }
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }

    let textToCache = accumulated;
    let coachInsight: { type: string; key: string; content: string; relevance: number } | null = null;

    // Tenta formato novo INSIGHT_COACH_JSON (brace-matching — suporta JSON multilinha)
    const jsonExtract = extractInsightJson(accumulated);
    if (jsonExtract) {
      try {
        const parsed = JSON.parse(jsonExtract.json);
        if (parsed.type && parsed.key && parsed.content) {
          coachInsight = {
            type: String(parsed.type).slice(0, 30),
            key: String(parsed.key).slice(0, 80),
            content: String(parsed.content).slice(0, 300),
            relevance: Math.max(1, Math.min(10, Number(parsed.relevance) || 5)),
          };
        }
      } catch { /* JSON malformado — ignora, sem fallback para evitar ruído */ }
      textToCache = jsonExtract.cleaned;
    } else {
      // Fallback: formato legado INSIGHT_COACH (compat até 2026-05-10)
      const legacyMatch = accumulated.match(/\nINSIGHT_COACH:\s*(.+?)(?:\n|$)/);
      if (legacyMatch) {
        const content = legacyMatch[1].trim().slice(0, 200);
        coachInsight = {
          type: "observation",
          key: `legacy_${djb2(content).slice(0, 20)}`,
          content,
          relevance: 6,
        };
        textToCache = accumulated.replace(/\nINSIGHT_COACH:\s*.+?(?:\n|$)/, "").trim();
      }
    }

    if (!skipCache && textToCache.length > 20) {
      const ttl = ttlMinutes(intent);
      await supabase.from("ai_response_cache").upsert({
        cache_key: cacheKey, user_id: userId, response_text: textToCache,
        model_used: model, intent,
        expires_at: new Date(Date.now() + ttl * 60 * 1000).toISOString(),
      }, { onConflict: "cache_key" }).then(({ error }) => {
        if (error) console.warn("Cache write failed:", error.message);
      });
    }

    if (coachInsight) {
      const ttlMap: Record<string, number | null> = {
        observation:     60,
        concern:         30,
        preference:      null,
        goal_context:    180,
        value_alignment: null,
      };
      const ttlDays = ttlMap[coachInsight.type] ?? 60;

      await supabase.rpc("upsert_coach_memory", {
        p_user_id:     userId,
        p_scope:       scope,
        p_memory_type: coachInsight.type,
        p_pattern_key: coachInsight.key,
        p_content:     coachInsight.content,
        p_relevance:   coachInsight.relevance,
        p_ttl_days:    ttlDays,
      }).then(({ error }) => {
        if (error) console.warn("Coach memory upsert failed:", error.message);
        else console.log(`Coach memory upserted: type=${coachInsight!.type} key=${coachInsight!.key}`);
      });
    }

    // ── Sprint 5 T5.2 — extrair e persistir RECOMMENDATION_JSON ────────────
    // Extrai de `accumulated` (texto original) para evitar conflito com outros extratores.
    // Remove o marcador de `textToCache` separadamente para não expô-lo ao usuário.
    const recExtract = extractRecommendationJson(accumulated);
    if (recExtract) {
      textToCache = extractRecommendationJson(textToCache)?.cleaned ?? textToCache;
      try {
        const rec = JSON.parse(recExtract.json);
        if (
          typeof rec.type === "string" && VALID_RECOMMENDATION_TYPES.has(rec.type) &&
          typeof rec.summary === "string" && rec.summary.length > 0 &&
          rec.payload !== undefined && typeof rec.payload === "object" &&
          JSON.stringify(rec.payload).length < 5000
        ) {
          await supabase.from("decision_outcomes").insert({
            user_id:                userId,
            scope:                  scope as "private" | "family" | "business",
            recommendation_type:    rec.type,
            recommendation_summary: String(rec.summary).slice(0, 500),
            recommendation_payload: rec.payload,
            context_snapshot:       contextSnapshot ?? {},
            // message_id: null — referência opcional; sem ID de turno rastreável neste fluxo
          }).then(({ error }) => {
            if (error) console.warn("decision_outcomes insert failed:", error.message);
            else console.log(`decision_outcomes inserted: type=${rec.type}`);
          });
        } else {
          console.warn("RECOMMENDATION_JSON ignorado: tipo inválido ou campos obrigatórios ausentes");
        }
      } catch {
        console.warn("RECOMMENDATION_JSON malformado — ignorado");
      }
    }
    // ── fim T5.2 ────────────────────────────────────────────────────────────

    // ── Sprint 8 T8.3 — extrair e persistir META_REFLECTION_JSON ───────────
    const metaExtract = extractMetaReflectionJson(accumulated);
    if (metaExtract) {
      textToCache = extractMetaReflectionJson(textToCache)?.cleaned ?? textToCache;
      try {
        const meta = JSON.parse(metaExtract.json);
        if (meta.observation_type && meta.observation) {
          await supabase.from("ai_self_observations").insert({
            user_id:            userId,
            observation_type:   meta.observation_type,
            observation:        meta.observation,
            message_id:         meta.message_id || null,
            related_pattern_id: meta.related_pattern_id || null,
            related_memory_id:  meta.related_memory_id || null,
          }).then(({ error }) => {
            if (error) console.warn("ai_self_observations insert failed:", error.message);
            else console.log(`ai_self_observations inserted: type=${meta.observation_type}`);
          });
        }
      } catch {
        console.warn("META_REFLECTION_JSON malformado — ignorado");
      }
    }
    // ── fim T8.3 ────────────────────────────────────────────────────────────
  })();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "X-Cache": "MISS",
      "X-Context-Used": JSON.stringify({ memories: memoryIds, patterns: [] }),
      "X-Prompt-Variants": JSON.stringify(promptVariantKeys),
    },
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
      { role: "system", content: [{ type: "text", text: systemContent, cache_control: { type: "ephemeral" } }] },
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

    const sanitizedMessages = (messages as Array<{ role: string; content: string }>).map(m => ({
      ...m,
      content: m.role === "user" ? sanitizeInput(m.content) : m.content
    }));

    const ALLOWED_MODELS = [
      "google/gemini-3-flash-preview",
      "openai/gpt-4o-mini",
      "anthropic/claude-haiku-4-5",
    ];
    const selectedModel = ALLOWED_MODELS.includes(requestedModel)
      ? requestedModel
      : "google/gemini-3-flash-preview";

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const frontendSystemPrompt = sanitizedMessages.find(m => m.role === "system")?.content ?? "";
    const userMessages = sanitizedMessages.filter(m => m.role !== "system");
    const lastUserMsg = [...userMessages].reverse().find(m => m.role === "user")?.content ?? "";
    const intent = (context?.userIntentHint as string) ?? "generic";
    const scope = (context?.escopo as string) ?? "private";
    const isMarketQuery = intent === "mercado";
    const { data: activePromptExperiments, error: promptVariantsError } = await supabase
      .from("prompt_variants")
      .select("experiment_key, variants")
      .eq("active", true);

    if (promptVariantsError) {
      console.warn("prompt_variants fetch failed:", promptVariantsError.message);
    }

    const assignedVariants = Object.fromEntries(
      (activePromptExperiments ?? [])
        .map((experiment) => {
          const selected = assignVariants(userId, experiment.experiment_key, experiment.variants);
          return selected ? [experiment.experiment_key, selected] : null;
        })
        .filter((entry): entry is [string, PromptVariantOption] => entry !== null)
    );

    const promptVariantKeys = Object.fromEntries(
      Object.entries(assignedVariants).map(([experimentKey, variant]) => [experimentKey, variant.key])
    );
    const promptVariantFingerprint = Object.entries(promptVariantKeys)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([experimentKey, variantKey]) => `${experimentKey}:${variantKey}`)
      .join("|") || "none";
    const variantPromptSection = buildVariantPromptSection(assignedVariants);

    supabase
      .from("ai_response_cache")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date().toISOString())
      .then(() => {});

    const ctxFp = contextFingerprint(context);
    const cacheKey = buildCacheKey(userId, scope, selectedModel, lastUserMsg, ctxFp, promptVariantFingerprint);

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
        return cachedSSEResponse(cached.response_text, promptVariantKeys);
      }
    }

    const nowIso = new Date().toISOString();

    // Curadoria por tipo: preferences sempre, concerns ativos, observations top-rankeados
    const [
      { data: preferences },
      { data: concerns },
      { data: observations },
      { data: values },
      { data: userPrefs },
    ] = await Promise.all([
      supabase.from("ai_coach_memory")
        .select("id, content, memory_type, pattern_key")
        .eq("user_id", userId).eq("scope", scope)
        .eq("memory_type", "preference").is("superseded_by", null)
        .order("relevance", { ascending: false }).limit(3),
      supabase.from("ai_coach_memory")
        .select("id, content, memory_type, pattern_key")
        .eq("user_id", userId).eq("scope", scope)
        .eq("memory_type", "concern").is("superseded_by", null)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("reinforcement_count", { ascending: false }).limit(3),
      supabase.from("ai_coach_memory")
        .select("id, content, memory_type, pattern_key, reinforcement_count")
        .eq("user_id", userId).eq("scope", scope)
        .eq("memory_type", "observation").is("superseded_by", null)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("reinforcement_count", { ascending: false }).limit(4),
      supabase.from("ai_coach_memory")
        .select("id, content, memory_type")
        .eq("user_id", userId).eq("scope", scope)
        .eq("memory_type", "value_alignment").is("superseded_by", null)
        .order("relevance", { ascending: false })
        .order("created_at", { ascending: false }).limit(3),
      supabase.from("user_ai_preferences").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const coachMemoriesSection = [
      preferences?.length ? `\n💎 PREFERÊNCIAS DO USUÁRIO:\n${preferences.map((p: any) => `- ${p.content}`).join("\n")}` : "",
      values?.length ? `\n🌟 VALORES E IDENTIDADE:\n${values.map((v: any) => `- ${v.content}`).join("\n")}` : "",
      concerns?.length ? `\n⚠️ PREOCUPAÇÕES ATIVAS:\n${concerns.map((c: any) => `- ${c.content}`).join("\n")}` : "",
      observations?.length ? `\n🧠 PADRÕES OBSERVADOS:\n${observations.map((o: any) => `- ${o.content} (visto ${o.reinforcement_count}x)`).join("\n")}` : "",
    ].filter(Boolean).join("\n");

    const memoryIds: string[] = [
      ...(preferences  ?? []).map((p: any) => p.id as string),
      ...(concerns     ?? []).map((c: any) => c.id as string),
      ...(observations ?? []).map((o: any) => o.id as string),
      ...(values       ?? []).map((v: any) => v.id as string),
    ].filter(Boolean);

    const basePrompt = frontendSystemPrompt || SYSTEM_PROMPT_FALLBACK;

    // Evitar duplicação se o prompt já vier com as preferências do frontend (T10.5)
    const hasPrefsInPrompt = basePrompt.includes("PREFERÊNCIAS DECLARADAS DO USUÁRIO") || 
                             basePrompt.includes("preferencias_usuario:");

    const userPrefsSection = (userPrefs && !hasPrefsInPrompt)
      ? (() => {
          const lines: string[] = [];
          lines.push(`- tom: ${userPrefs.tom_voz}`);
          lines.push(`- nivel_detalhamento: ${userPrefs.nivel_detalhamento}`);
          lines.push(`- frequencia_alertas: ${userPrefs.frequencia_alertas}`);
          if (userPrefs.prioridade_default) lines.push(`- prioridade_default: ${userPrefs.prioridade_default}`);
          if (userPrefs.tratar_parcelamentos) lines.push(`- tratar_parcelamentos: ${userPrefs.tratar_parcelamentos}`);
          if (userPrefs.contexto_identidade) lines.push(`- contexto_identidade: ${userPrefs.contexto_identidade}`);
          if (userPrefs.valores_pessoais?.length) lines.push(`- valores_pessoais: ${(userPrefs.valores_pessoais as string[]).join(", ")}`);
          if (userPrefs.compromissos_fixos?.length) {
            const cs = (userPrefs.compromissos_fixos as Array<{ descricao: string; dia?: number; valor?: number }>)
              .map(c => `${c.descricao}${c.dia ? ` dia${c.dia}` : ""}${c.valor ? ` R$${c.valor}` : ""}`)
              .join(", ");
            lines.push(`- compromissos_fixos: ${cs}`);
          }
          if (userPrefs.contexto_religioso) lines.push(`- contexto_religioso: ${userPrefs.contexto_religioso}`);
          return `\n\npreferencias_usuario:\n${lines.join("\n")}`;
        })()
      : "";

    let systemContent = basePrompt + variantPromptSection + userPrefsSection + coachMemoriesSection;

    // T5.5 — validação: bloco de aderência histórica presente no prompt?
    console.log(systemContent.includes("ADERÊNCIA HISTÓRICA")
      ? "aderencia_section_present"
      : "aderencia_section_absent");

    // ── Enriquecimento de contexto para perguntas de mercado ───────────────
    if (isMarketQuery) {
      const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

      // Busca dados em paralelo: cotações + BCB + Tavily Search
      const [marketData, tavilyResults] = await Promise.all([
        fetchMarketData(),
        TAVILY_API_KEY ? fetchTavilySearch(lastUserMsg, TAVILY_API_KEY) : Promise.resolve(""),
      ]);

      const realTimeContext = marketData + tavilyResults;

      if (realTimeContext.trim()) {
        systemContent += realTimeContext;
        systemContent += "\n\nIMPORTANTE: Os dados acima são em tempo real. Use-os diretamente na sua resposta sem inventar outros valores.";
      } else {
        systemContent += "\n\n⚠️ Não foi possível obter dados em tempo real agora. Informe ao usuário e oriente a verificar bcb.gov.br ou Google Finanças.";
      }

      console.log(`Market query enriched — marketData=${marketData.length}chars tavily=${tavilyResults.length}chars`);
    }

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
      body: JSON.stringify({ model: selectedModel, messages: aiMessages, stream: true }),
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

    return streamAndCache(
      response,
      supabase,
      cacheKey,
      userId,
      selectedModel,
      intent,
      scope,
      isMarketQuery,
      memoryIds,
      context ?? null,
      promptVariantKeys,
    );

  } catch (e) {
    console.error("ai-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
