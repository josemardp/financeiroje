import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

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

function inferMimeType(fileName: string) {
  const normalized = fileName.toLowerCase();

  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";

  return "image/jpeg";
}

function toBase64(arrayBuffer: ArrayBuffer) {
  return encodeBase64(new Uint8Array(arrayBuffer));
}

function extractOpenAiText(payload: any) {
  const rawContent = payload?.choices?.[0]?.message?.content;

  if (typeof rawContent === "string") {
    return rawContent.trim();
  }

  if (Array.isArray(rawContent)) {
    return rawContent
      .map((item) => typeof item?.text === "string" ? item.text : "")
      .join("\n")
      .trim();
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento.", code: "OCR_RATE_LIMITED" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: "Arquivo de imagem não enviado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: "Imagem muito grande para OCR (limite: 10MB)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeType = imageFile.type?.startsWith("image/")
      ? imageFile.type
      : inferMimeType(imageFile.name || "image.jpg");

    if (!mimeType.startsWith("image/")) {
      return new Response(
        JSON.stringify({ error: "Formato de imagem não suportado para OCR." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = toBase64(arrayBuffer);
    const dataUri = `data:${mimeType};base64,${base64}`;

    const ocrRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente de OCR financeiro. Extraia apenas o texto visível da imagem, preservando valores, datas, nomes, estabelecimentos e identificadores relevantes. Não invente nada. Retorne somente o texto extraído.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia o texto desta imagem de comprovante, recibo ou documento financeiro." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!ocrRes.ok) {
      const errText = await ocrRes.text();
      console.error("OpenAI Vision error:", ocrRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro na extração de texto da imagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ocrData = await ocrRes.json();
    const extractedText = extractOpenAiText(ocrData);

    if (!extractedText) {
      return new Response(
        JSON.stringify({ error: "OCR não retornou texto utilizável para esta imagem." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        text: extractedText,
        confidence: extractedText.length >= 40 ? 0.72 : 0.55,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("smart-capture-ocr error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
