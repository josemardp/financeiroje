/**
 * FinanceAI — OCR Adapter (Fase 2)
 * Fluxo atual: somente imagem JPG/PNG.
 */

import { supabase } from "@/integrations/supabase/client";
import { cleanDescription } from "../textParser";

export interface OcrExtractionResult {
  text: string;
  confidence: number;
  metadata?: {
    merchantName?: string;
    totalAmount?: number;
    date?: string;
    tipo?: "income" | "expense" | null;
    categoria?: string;
    warnings?: string[];
    moeda?: string;
  };
}

export type OcrErrorCode =
  | "UNSUPPORTED_FILE_TYPE"
  | "AUTH_REQUIRED"
  | "OCR_NOT_CONFIGURED"
  | "INVALID_EDGE_PAYLOAD"
  | "UPSTREAM_OCR_ERROR"
  | "UNKNOWN_OCR_ERROR";

export class OcrCaptureError extends Error {
  code: OcrErrorCode;
  status?: number;

  constructor(code: OcrErrorCode, message: string, status?: number) {
    super(message);
    this.name = "OcrCaptureError";
    this.code = code;
    this.status = status;
  }
}

const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"] as const;

type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

type OcrEdgeSuccessResponse = {
  ok?: true;
  extracted_fields?: {
    valor?: number | string | null;
    tipo?: string | null;
    data?: string | null;
    categoria?: string | null;
    descricao?: string | null;
    moeda?: string | null;
    confidence?: string | number | null;
    warnings?: string[] | null;
  };
  confidence?: string | number | null;
  warnings?: string[] | null;
  raw_text?: string | null;
  source?: string | null;
  origin?: string | null;
};

type OcrEdgeErrorResponse = {
  ok?: false;
  code?: string;
  message?: string;
  error?: string;
};

type OcrEdgeResponse = OcrEdgeSuccessResponse | OcrEdgeErrorResponse;

function isSupportedImageMimeType(mimeType: string): mimeType is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as SupportedImageMimeType);
}

function blobToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new OcrCaptureError("UNKNOWN_OCR_ERROR", "Falha ao converter arquivo para base64."));
        return;
      }

      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new OcrCaptureError("UNKNOWN_OCR_ERROR", "Falha ao ler arquivo para OCR."));
    };

    reader.readAsDataURL(file);
  });
}

function normalizeConfidence(value: string | number | null | undefined) {
  if (typeof value === "number") {
    if (value > 1) return Number((value / 100).toFixed(2));
    return Number(value.toFixed(2));
  }

  switch (value) {
    case "alta":
      return 0.9;
    case "media":
      return 0.7;
    case "baixa":
      return 0.4;
    default:
      return 0.6;
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

function mapEdgeCode(code?: string): OcrErrorCode {
  switch (code) {
    case "UNSUPPORTED_FILE_TYPE":
      return "UNSUPPORTED_FILE_TYPE";
    case "AUTH_REQUIRED":
      return "AUTH_REQUIRED";
    case "OCR_NOT_CONFIGURED":
      return "OCR_NOT_CONFIGURED";
    case "INVALID_EDGE_PAYLOAD":
      return "INVALID_EDGE_PAYLOAD";
    case "UPSTREAM_OCR_ERROR":
      return "UPSTREAM_OCR_ERROR";
    default:
      return "UNKNOWN_OCR_ERROR";
  }
}

function mapInvokeError(error: { message?: string; context?: unknown }): OcrCaptureError {
  const message = error.message || "Falha ao processar OCR na edge function.";

  if (/401|unauthorized|jwt|auth/i.test(message)) {
    return new OcrCaptureError("AUTH_REQUIRED", message, 401);
  }

  if (/unsupported|415/i.test(message)) {
    return new OcrCaptureError("UNSUPPORTED_FILE_TYPE", message, 415);
  }

  if (/configur|openai|api key/i.test(message)) {
    return new OcrCaptureError("OCR_NOT_CONFIGURED", message, 500);
  }

  return new OcrCaptureError("UPSTREAM_OCR_ERROR", message, 500);
}

function buildRawText(payload: OcrEdgeSuccessResponse) {
  if (payload.raw_text?.trim()) {
    return payload.raw_text.trim();
  }

  const fields = payload.extracted_fields;
  if (!fields) return "Texto não extraído";

  return [
    toTrimmedString(fields.descricao),
    toNullableNumber(fields.valor) != null ? `R$ ${toNullableNumber(fields.valor)}` : null,
    toTrimmedString(fields.data),
    toTrimmedString(fields.categoria),
    ...(fields.warnings || []),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

export class OcrAdapter {
  static async extract(imageFile: File | Blob): Promise<OcrExtractionResult> {
    const mimeType = imageFile.type || "application/octet-stream";

    if (!isSupportedImageMimeType(mimeType)) {
      throw new OcrCaptureError(
        "UNSUPPORTED_FILE_TYPE",
        "Formato ainda não suportado neste OCR. Use JPG ou PNG."
      );
    }

    const base64 = await blobToBase64(imageFile);

    const { data, error } = await supabase.functions.invoke("smart-capture-ocr", {
      body: {
        file_base64: base64,
        mime_type: mimeType,
        file_name: imageFile instanceof File ? imageFile.name : "smart-capture-file",
      },
    });

    if (error) {
      throw mapInvokeError(error);
    }

    const payload = (data || {}) as OcrEdgeResponse;

    if ("ok" in payload && payload.ok === false) {
      throw new OcrCaptureError(
        mapEdgeCode(payload.code),
        payload.message || payload.error || "Falha no backend de OCR."
      );
    }

    const successPayload = payload as OcrEdgeSuccessResponse;
    const fields = successPayload.extracted_fields || {};
    const text = buildRawText(successPayload);

    // Refine description with deterministic rules
    const refinedDescription = fields.descricao ? cleanDescription(String(fields.descricao)) : undefined;

    // Tipo amigável sem forçar expense
    let tipo: "income" | "expense" | null = null;
    if (fields.tipo === "income" || fields.tipo === "expense") {
      tipo = fields.tipo;
    }

    return {
      text,
      confidence: normalizeConfidence(fields.confidence ?? successPayload.confidence),
      metadata: {
        merchantName: refinedDescription || toTrimmedString(fields.descricao) || undefined,
        totalAmount: toNullableNumber(fields.valor) ?? undefined,
        date: toTrimmedString(fields.data) || undefined,
        tipo,
        categoria: toTrimmedString(fields.categoria) || undefined,
        warnings: fields.warnings || successPayload.warnings || [],
        moeda: toTrimmedString(fields.moeda) || "BRL",
      },
    };
  }
}
