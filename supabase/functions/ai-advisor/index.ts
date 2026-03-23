import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
Use estes marcadores para estruturar sua resposta:

[FATO] - Para informações confirmadas pelos dados
[ALERTA] - Para avisos sobre problemas detectados
[SUGESTÃO] - Para recomendações interpretativas
[PROJEÇÃO] - Para estimativas futuras (sempre rotular como projeção)
[PERGUNTA] - Para perguntas que ajudem a esclarecer a situação

LINGUAGEM:
- Fale em português brasileiro, tom acolhedor mas profissional
- Evite "parece que" — seja direto sobre o que os dados mostram
- Se um dado é projeção, diga "baseado nas recorrências cadastradas"
- Se um dado é sugestão, diga "sugiro que"
- Nunca diga "eu calculei" — diga "os dados mostram que"

CONTEXTO FINANCEIRO:
O contexto financeiro do usuário será enviado junto com cada mensagem. Use-o para fundamentar suas respostas.
Se o contexto estiver vazio ou com poucos dados, informe isso ao usuário.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context message
    let contextMessage = "";
    if (context) {
      contextMessage = `\n\nCONTEXTO FINANCEIRO ATUAL (calculado pela engine determinística — NÃO recalcule):
${JSON.stringify(context, null, 2)}`;
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
