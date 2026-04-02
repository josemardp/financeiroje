import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

type StructuredTransactionType = "income" | "expense" | "unknown";
type StructuredScope = "private" | "family" | "business" | "unknown";
type StructuredConfidence = "alta" | "media" | "baixa";

interface StructuredOcrPayload {
  extracted_text: string;
  transaction_type: StructuredTransactionType;
  amount: number | null;
  date: string | null;
  description: string | null;
  merchant_name: string | null;
  counterparty: string | null;
  scope: StructuredScope;
  category_hint: string | null;
  confidence: StructuredConfidence;
  evidence: string[];
  installment_text: string | null;
}

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

function toBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.length;
  let binary = "";
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function extractMessageContent(payload: any) {
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

function parseLocalizedAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 && value <= 1_000_000 ? value : null;
  }

  if (typeof value !== "string") return null;

  const cleaned = value.replace(/R\$/gi, "").replace(/\s+/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : null;
}

function normalizeTransactionType(value: unknown): StructuredTransactionType {
  return value === "income" || value === "expense" ? value : "unknown";
}

function normalizeScope(value: unknown): StructuredScope {
  return value === "private" || value === "family" || value === "business" ? value : "unknown";
}

function normalizeConfidence(value: unknown): StructuredConfidence {
  return value === "alta" || value === "media" ? value : "baixa";
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

function sanitizeNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEvidence(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function parseStructuredPayload(content: string): StructuredOcrPayload | null {
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    const extractedText = sanitizeNullableString(parsed?.extracted_text ?? parsed?.text) ?? "";
    if (!extractedText) return null;

    return {
      extracted_text: extractedText,
      transaction_type: normalizeTransactionType(parsed?.transaction_type),
      amount: parseLocalizedAmount(parsed?.amount ?? parsed?.total_amount),
      date: normalizeDate(parsed?.date),
      description: sanitizeNullableString(parsed?.description),
      merchant_name: sanitizeNullableString(parsed?.merchant_name),
      counterparty: sanitizeNullableString(parsed?.counterparty),
      scope: normalizeScope(parsed?.scope),
      category_hint: sanitizeNullableString(parsed?.category_hint),
      confidence: normalizeConfidence(parsed?.confidence),
      evidence: normalizeEvidence(parsed?.evidence),
      installment_text: sanitizeNullableString(parsed?.installment_text),
    } satisfies StructuredOcrPayload;
  } catch {
    return null;
  }
}

function confidenceToNumber(confidence: StructuredConfidence) {
  switch (confidence) {
    case "alta":
      return 0.9;
    case "media":
      return 0.7;
    default:
      return 0.45;
  }
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
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
                 "Você é um extrator inteligente de transações financeiras a partir de imagens. Responda somente com JSON válido. Interprete do ponto de vista do usuário que está registrando a transação. amount deve ser sempre o valor principal total da transação. Nunca use o valor unitário da parcela como amount quando houver um total maior explícito. Exemplo: se a imagem tiver 'R$ 365,67' e também '12x de R$ 30,47', amount deve ser 365.67. date deve ser convertida para ISO YYYY-MM-DD e você deve entender formatos como '28 Mar, 2026', '28 março 2026' e '28/03/2026'. Se houver comprovante de venda, link de pagamento, compra em cartão, PIX enviado, transferência enviada, boleto pago, débito ou pagamento efetuado pelo usuário, classifique como expense. Só classifique como income quando houver evidência inequívoca de entrada de dinheiro para o usuário, como PIX recebido, transferência recebida, depósito recebido ou salário creditado. A palavra crédito em compra no cartão normalmente ainda é despesa, não receita. Em description prefira o estabelecimento ou o contexto principal da transação. Em evidence inclua trechos curtos que provem amount, date, parcelas, origem e destino quando existirem. installment_text deve capturar o texto original do parcelamento (ex: '3x', '12x de R$ 30,47', '2x sem juros'). Se não houver parcelamento, installment_text deve ser null. Não invente valor, data ou descrição. Se não houver segurança, use null ou unknown. Retorne obrigatoriamente um JSON com as chaves: extracted_text, transaction_type, amount, date, description, merchant_name, counterparty, scope, category_hint, confidence, evidence, installment_text.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise esta imagem financeira e devolva somente o JSON solicitado. Priorize o valor total principal da transação. Se houver parcelas, registre o total em amount e cite a parcela apenas em evidence. Se conseguir identificar origem e destino, use isso para decidir corretamente entre despesa e receita." },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 1200,
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
    const content = extractMessageContent(ocrData);
    const structured = parseStructuredPayload(content);

    if (!structured?.extracted_text) {
      return new Response(
        JSON.stringify({ error: "OCR não retornou dados estruturados utilizáveis para esta imagem." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        text: structured.extracted_text,
        confidence: confidenceToNumber(structured.confidence),
        metadata: {
          merchantName: structured.merchant_name ?? undefined,
          totalAmount: structured.amount ?? undefined,
          date: structured.date ?? undefined,
          transactionType: structured.transaction_type,
          amount: structured.amount,
          description: structured.description ?? undefined,
          scope: structured.scope,
          categoryHint: structured.category_hint ?? undefined,
          counterparty: structured.counterparty ?? undefined,
          evidence: structured.evidence,
          confidence: structured.confidence,
          installmentText: structured.installment_text ?? undefined,
        },
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
