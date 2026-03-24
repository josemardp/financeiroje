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

// Simple in-memory rate limiter (per user, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth validation ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
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
    const ALLOWED_MODELS = ["google/gemini-3-flash-preview", "openai/gpt-5-mini"];
    const selectedModel = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : "google/gemini-3-flash-preview";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context message with explicit scope
    let contextMessage = "";
    if (context) {
      const scope = context.escopo || "private";
      contextMessage = `\n\nESCOPO ATUAL: ${scope}\nRESPONDA APENAS SOBRE DADOS DO ESCOPO "${scope}".\n\nCONTEXTO FINANCEIRO ATUAL (calculado pela engine determinística — NÃO recalcule):\n${JSON.stringify(context, null, 2)}`;
    }

    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
