// Edge Function: smart-capture-ocr
// Fluxo atual: somente imagem JPG/PNG
// PDF, DOCX e Excel ficam explicitamente fora deste fluxo por enquanto

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function extractOutputText(result: any): string {
  if (typeof result?.output_text === "string" && result.output_text.trim()) {
    return result.output_text.trim();
  }

  if (Array.isArray(result?.output_text)) {
    const joined = result.output_text.filter((item: unknown) => typeof item === "string").join("\n").trim();
    if (joined) return joined;
  }

  if (Array.isArray(result?.output)) {
    const collected = result.output
      .flatMap((outputItem: any) => (Array.isArray(outputItem?.content) ? outputItem.content : []))
      .map((contentItem: any) => {
        if (typeof contentItem?.text === "string") return contentItem.text;
        if (typeof contentItem?.text?.value === "string") return contentItem.text.value;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();

    if (collected) return collected;
  }

  return "";
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const sanitized = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(sanitized);
  } catch {
    const firstBrace = sanitized.indexOf("{");
    const lastBrace = sanitized.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(sanitized.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTipo(value: unknown, descricao: string | null): "income" | "expense" {
  if (value === "income" || value === "expense") {
    return value;
  }

  const source = `${value ?? ""} ${descricao ?? ""}`.toLowerCase();

  if (/\b(recebi|receita|entrou|sal[aá]rio|renda|ganho|pix recebido)\b/.test(source)) {
    return "income";
  }

  return "expense";
}

function normalizeConfidence(value: unknown): "alta" | "media" | "baixa" {
  if (typeof value === "string") {
    if (value === "alta" || value === "media" || value === "baixa") return value;
  }

  if (typeof value === "number") {
    if (value >= 0.85) return "alta";
    if (value >= 0.6) return "media";
    return "baixa";
  }

  return "media";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return jsonResponse(
        {
          ok: false,
          code: "AUTH_REQUIRED",
          message: "Não autorizado.",
        },
        401
      );
    }

    const body = await req.json();
    const { file_base64, mime_type, file_name } = body ?? {};

    if (!file_base64 || !mime_type) {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_EDGE_PAYLOAD",
          message: "Payload inválido.",
        },
        400
      );
    }

    if (!SUPPORTED_IMAGE_TYPES.has(mime_type)) {
      return jsonResponse(
        {
          ok: false,
          code: "UNSUPPORTED_FILE_TYPE",
          message: "Formato ainda não suportado neste OCR. Use JPG ou PNG. PDF, Word e Excel ainda não estão liberados neste fluxo.",
        },
        415
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return jsonResponse(
        {
          ok: false,
          code: "OCR_NOT_CONFIGURED",
          message: "OPENAI_API_KEY não configurada.",
        },
        500
      );
    }

    const prompt = `
Você vai analisar uma imagem de comprovante, recibo, nota simples ou print financeiro.

Responda SOMENTE com JSON válido, sem markdown, sem explicações, com este formato:
{
  "valor": number | null,
  "tipo": "income" | "expense" | null,
  "data": "YYYY-MM-DD" | null,
  "categoria": string | null,
  "descricao": string | null,
  "moeda": "BRL",
  "confidence": "alta" | "media" | "baixa",
  "warnings": string[],
  "raw_text": string
}

Regras:
- Se não tiver certeza do valor, use null.
- Se não tiver certeza da data, use null.
- Se não tiver certeza do tipo, use null.
- Sempre tente preencher "raw_text" com o texto lido da imagem.
- Considere contexto brasileiro.
`.trim();

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_base64: file_base64 },
            ],
          },
        ],
      }),
    });

    const rawOpenAiBody = await openAiResponse.text();

    if (!openAiResponse.ok) {
      return jsonResponse(
        {
          ok: false,
          code: "UPSTREAM_OCR_ERROR",
          message: `Falha no provedor OCR (${openAiResponse.status}). ${rawOpenAiBody.slice(0, 400)}`,
        },
        502
      );
    }

    let openAiJson: any;
    try {
      openAiJson = JSON.parse(rawOpenAiBody);
    } catch {
      return jsonResponse(
        {
          ok: false,
          code: "UPSTREAM_OCR_ERROR",
          message: "O provedor OCR respondeu com JSON inválido.",
        },
        502
      );
    }

    const modelText = extractOutputText(openAiJson);
    const parsed = extractJsonObject(modelText);

    if (!parsed) {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_EDGE_PAYLOAD",
          message: "O modelo não retornou JSON utilizável.",
        },
        502
      );
    }

    const descricao = toTrimmedString(parsed.descricao);
    const valor = toNullableNumber(parsed.valor);
    const data = toTrimmedString(parsed.data);
    const categoria = toTrimmedString(parsed.categoria);
    const rawText =
      toTrimmedString(parsed.raw_text) ||
      [
        descricao,
        valor != null ? `R$ ${valor}` : null,
        data,
        categoria,
      ]
        .filter(Boolean)
        .join("\n")
        .trim();

    if (!rawText) {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_EDGE_PAYLOAD",
          message: "O OCR respondeu sem texto utilizável.",
        },
        502
      );
    }

    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((item: unknown) => typeof item === "string")
      : [];

    return jsonResponse({
      ok: true,
      raw_text: rawText,
      extracted_fields: {
        valor,
        tipo: normalizeTipo(parsed.tipo, descricao),
        data,
        categoria,
        descricao,
        moeda: toTrimmedString(parsed.moeda) || "BRL",
        confidence: normalizeConfidence(parsed.confidence),
        warnings,
      },
      confidence: normalizeConfidence(parsed.confidence),
      warnings,
      source: "openai-responses",
      origin: file_name || "smart-capture-file",
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        code: "UPSTREAM_OCR_ERROR",
        message: err instanceof Error ? err.message : "Processing failed",
      },
      500
    );
  }
});
