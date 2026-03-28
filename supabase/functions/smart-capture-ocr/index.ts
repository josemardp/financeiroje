// Edge Function: smart-capture-ocr (Fase 4.4 - Suporte Real a Imagem/OCR)
// Suporta: JPG, PNG (PDF tratado no frontend via rasterização/extração real)

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

function normalizeTipo(value: unknown): "income" | "expense" | null {
  if (value === "income" || value === "expense") return value;
  return null;
}

function normalizeEscopo(value: unknown): "private" | "family" | "business" {
  if (value === "private" || value === "family" || value === "business") return value;
  return "private";
}

function normalizeConfidence(value: unknown): "alta" | "media" | "baixa" {
  if (value === "alta" || value === "media" || value === "baixa") return value;
  return "media";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return jsonResponse({ ok: false, code: "AUTH_REQUIRED", message: "Não autorizado." }, 401);
    }

    const body = await req.json();
    const { file_base64, mime_type, file_name } = body ?? {};

    if (!file_base64 || !mime_type) {
      return jsonResponse({ ok: false, code: "INVALID_EDGE_PAYLOAD", message: "Payload inválido." }, 400);
    }

    // PDF agora deve ser tratado no frontend (extração ou rasterização para imagem)
    if (!SUPPORTED_IMAGE_TYPES.has(mime_type)) {
      return jsonResponse({ 
        ok: false, 
        code: "UNSUPPORTED_FILE_TYPE", 
        message: "O backend OCR suporta apenas imagens JPG/PNG. PDFs devem ser processados no cliente." 
      }, 415);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return jsonResponse({ ok: false, code: "OCR_NOT_CONFIGURED", message: "OPENAI_API_KEY não configurada." }, 500);
    }

    const prompt = `
Você é um especialista em extração de dados financeiros brasileiros.
Analise a imagem de comprovante, recibo ou nota fiscal.

Extraia com precisão máxima:
1. VALOR: O valor principal da transação. 
   - Priorize: 'Total', 'Valor Total', 'Valor Pago', 'Valor do PIX'.
   - Ignore: códigos, NSU, parcelas isoladas, troco, taxas menores se houver um total claro.
   - Se houver múltiplos valores e o principal não for óbvio, escolha o mais provável e adicione warning "valor principal escolhido entre múltiplos candidatos".
2. DATA: A data da transação (YYYY-MM-DD). Priorize a data do evento real.
3. TIPO: 'income' (recebimentos) ou 'expense' (gastos). 
   - IMPORTANTE: Se não houver sinal claro de entrada ou saída, use null. NUNCA assuma 'expense' por padrão.
4. DESCRIÇÃO: Nome humano e limpo. Remova ruídos (PAG*, SAO PAULO, etc). Transforme: "PAG*IFOOD" -> "Ifood".
5. CATEGORIA: Sugira uma (Alimentação, Transporte, Saúde, Moradia, Renda, Assinaturas, Educação, Vestuário, Pet, Contas, Dívidas).
6. ESCOPO: 'business' (sinais de MEI/empresa/cliente/fornecedor/nota fiscal/CNPJ), 'family' (sinais de família/casa), ou 'private' (fallback).
7. CONFIDENCE: 'alta' (valor e data claros), 'media', 'baixa'.
8. WARNINGS: Liste problemas reais: "mais de um valor encontrado", "OCR com baixa legibilidade", "tipo inferido por contexto".

Responda SOMENTE com JSON válido:
{
  "valor": number | null,
  "tipo": "income" | "expense" | null,
  "data": "YYYY-MM-DD" | null,
  "categoria": string | null,
  "descricao": string | null,
  "escopo": "private" | "family" | "business",
  "confidence": "alta" | "media" | "baixa",
  "warnings": string[],
  "raw_text": "Texto bruto completo extraído para auditoria"
}
`.trim();

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mime_type};base64,${file_base64}` } },
            ],
          },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      return jsonResponse({ ok: false, code: "UPSTREAM_OCR_ERROR", message: `Falha no provedor OCR (${openAiResponse.status}).`, details: errorText }, 502);
    }

    const openAiJson = await openAiResponse.json();
    const modelText = openAiJson?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(modelText);

    if (!parsed) {
      return jsonResponse({ ok: false, code: "INVALID_EDGE_PAYLOAD", message: "O modelo não retornou JSON válido." }, 502);
    }

    const rawText = toTrimmedString(parsed.raw_text);
    if (!rawText || rawText.length < 5) {
      return jsonResponse({ ok: false, code: "OCR_EMPTY_TEXT", message: "Não foi possível extrair texto legível desta imagem." }, 422);
    }

    return jsonResponse({
      ok: true,
      raw_text: rawText,
      extracted_fields: {
        valor: toNullableNumber(parsed.valor),
        tipo: normalizeTipo(parsed.tipo),
        data: toTrimmedString(parsed.data),
        categoria: toTrimmedString(parsed.categoria),
        descricao: toTrimmedString(parsed.descricao),
        escopo: normalizeEscopo(parsed.escopo),
        confidence: normalizeConfidence(parsed.confidence),
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      },
      source: "openai-vision",
      origin: file_name || "smart-capture-file",
    });
  } catch (err) {
    return jsonResponse({ ok: false, code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Processing failed" }, 500);
  }
});
