import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado", code: "OCR_AUTH_REQUIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada.", code: "OCR_INVALID_SESSION" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OCR indisponível: chave de API não configurada.", code: "OCR_BACKEND_KEY_MISSING" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Recebe FormData com campo "image" enviado pelo OcrAdapter
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: "Nenhuma imagem enviada. Use o campo 'image'.", code: "OCR_UNSUPPORTED_MIME" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supportedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    const mimeType = imageFile.type || "image/jpeg";

    if (!supportedMimes.includes(mimeType)) {
      return new Response(
        JSON.stringify({
          error: `Formato de imagem não suportado: ${mimeType}. Use JPG, PNG, WEBP ou GIF.`,
          code: "OCR_UNSUPPORTED_MIME",
        }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Converte o arquivo para base64 para enviar ao GPT-4o Vision
    const arrayBuffer = await imageFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Você é um extrator de dados financeiros a partir de imagens de recibos, comprovantes e notas fiscais. Extraia o texto completo visível e retorne um JSON com dois campos:\n\n'text': transcreva literalmente TODO o texto visível na imagem, preservando rótulos como Origem, Destino, Beneficiário, Pagador, De, Para, Parcelas, Meio, NSU, etc. Não resuma — copie o texto real.\n\n'metadata': objeto com os campos extraídos e interpretados:\n- transactionType: 'income' se o documento indica recebimento pelo usuário, 'expense' se pagamento/compra/débito, 'unknown' se incerto\n- amount: valor total (número) ou null. Se houver parcelamento, use o total, não a parcela\n- totalAmount: igual a amount\n- date: data da transação em ISO YYYY-MM-DD ou null\n- description: frase curta descrevendo a transação ex: 'Pagamento EBENA', 'PIX recebido de João', 'Compra Mercado X'. Use Destino/Beneficiário para despesas, Origem/Pagador para receitas\n- merchantName: nome do estabelecimento/empresa que recebeu (despesa) ou pagou (receita)\n- counterparty: nome da outra parte (Destino para despesa, Origem para receita)\n- scope: 'private'|'family'|'business'|'unknown'\n- categoryHint: categoria sugerida em português\n- confidence: 'alta'|'media'|'baixa'\n- evidence: array de strings com evidências encontradas na imagem\n- installmentText: texto exato de parcelamento visível (ex: '12x de R$ 30,47') ou null\n\nNunca invente dados que não estejam visíveis na imagem.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados financeiros desta imagem e retorne o JSON conforme instruído:" },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1200,
      }),
    });

    if (!openAiRes.ok) {
      const errBody = await openAiRes.text();
      console.error("OpenAI OCR error:", openAiRes.status, errBody);
      return new Response(
        JSON.stringify({ error: "Erro no provedor OCR.", code: "OCR_PROVIDER_ERROR", provider_status: openAiRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openAiData = await openAiRes.json();
    const rawContent = openAiData?.choices?.[0]?.message?.content;

    let parsed: any = {};
    try {
      parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : (rawContent ?? {});
    } catch {
      return new Response(
        JSON.stringify({ error: "Resposta da IA não pôde ser parseada.", code: "OCR_INVALID_RESPONSE" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractedText = typeof parsed?.text === "string" ? parsed.text.trim() : "";

    if (!extractedText) {
      return new Response(
        JSON.stringify({ error: "OCR não conseguiu extrair texto desta imagem.", code: "OCR_INVALID_RESPONSE" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conf = parsed?.metadata?.confidence;
    const confidence = conf === "alta" ? 0.9 : conf === "media" ? 0.7 : 0.5;

    return new Response(
      JSON.stringify({
        text: extractedText,
        confidence,
        metadata: parsed?.metadata ?? {},
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("smart-capture-ocr error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido no OCR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
