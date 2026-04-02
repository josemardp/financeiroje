/**
 * FinanceAI — OCR Adapter
 * Extrai texto e campos estruturados de imagens via Edge Function smart-capture-ocr.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  validateOcrImageFile,
  type OcrSupportedMimeType,
} from "@/services/smartCapture/ocrImageFormats";

export interface OcrStructuredMetadata {
  merchantName?: string;
  totalAmount?: number;
  date?: string;
  transactionType?: "income" | "expense" | "unknown";
  amount?: number | null;
  description?: string;
  scope?: "private" | "family" | "business" | "unknown";
  categoryHint?: string;
  counterparty?: string;
  evidence?: string[];
  confidence?: "alta" | "media" | "baixa";
  installmentText?: string | null;
}

export interface OcrExtractionResult {
  text: string;
  confidence: number;
  metadata?: OcrStructuredMetadata;
}

export type OcrAdapterErrorCode =
  | "invalid_format"
  | "auth"
  | "backend_unavailable"
  | "backend_key_missing"
  | "invalid_contract"
  | "provider_error"
  | "processing_failed";

export class OcrAdapterError extends Error {
  readonly code: OcrAdapterErrorCode;
  readonly status?: number;
  readonly details?: string;

  constructor(
    code: OcrAdapterErrorCode,
    message: string,
    options?: { status?: number; details?: string }
  ) {
    super(message);
    this.name = "OcrAdapterError";
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

const MAX_OCR_IMAGE_DIMENSION = 1800;
const MAX_OCR_UPLOAD_BYTES = 2 * 1024 * 1024;
const OCR_OUTPUT_MIME = "image/jpeg";
const OCR_OUTPUT_QUALITY = 0.88;
const OCR_TIMEOUT_MS = 30_000;

function formatDateToPtBr(date?: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatAmountToPtBr(amount?: number | null) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return "";
  return amount.toFixed(2).replace(".", ",");
}

function buildStructuredNarrative(
  metadata: OcrStructuredMetadata | undefined,
  fallbackText: string
) {
  if (!metadata) return fallbackText;

  const amount = formatAmountToPtBr(metadata.amount ?? metadata.totalAmount);
  const date = formatDateToPtBr(metadata.date);
  const description =
    metadata.description?.trim() ||
    metadata.merchantName?.trim() ||
    metadata.counterparty?.trim() ||
    "";
  const scope =
    metadata.scope === "family"
      ? "família"
      : metadata.scope === "business"
        ? "negócio"
        : metadata.scope === "private"
          ? "pessoal"
          : "";

  const parts: string[] = [];

  if (metadata.transactionType === "expense") {
    parts.push("paguei");
  } else if (metadata.transactionType === "income") {
    parts.push("recebi");
  }

  if (amount) {
    parts.push(`R$ ${amount}`);
  }

  if (description) {
    parts.push(`referente a ${description}`);
  }

  if (date) {
    parts.push(`em ${date}`);
  }

  if (scope) {
    parts.push(`no escopo ${scope}`);
  }

  const structuredText = parts.join(" ").trim();
  return structuredText || fallbackText;
}

async function normalizeImageForOcr(
  imageFile: File | Blob,
  supportedMimeType?: OcrSupportedMimeType | null
): Promise<File | Blob> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    return imageFile;
  }

  const mimeType = supportedMimeType || imageFile.type || "";
  if (!mimeType.startsWith("image/")) {
    return imageFile;
  }

  const shouldKeepOriginal =
    imageFile.size <= MAX_OCR_UPLOAD_BYTES && mimeType !== "image/webp";
  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(imageFile);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale =
      longestSide > MAX_OCR_IMAGE_DIMENSION
        ? MAX_OCR_IMAGE_DIMENSION / longestSide
        : 1;

    if (scale === 1 && shouldKeepOriginal) {
      return imageFile;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      return imageFile;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const normalizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, OCR_OUTPUT_MIME, OCR_OUTPUT_QUALITY);
    });

    if (!normalizedBlob) {
      return imageFile;
    }

    const normalizedName =
      imageFile instanceof File
        ? imageFile.name.replace(/\.[^.]+$/, ".jpg")
        : "ocr-image.jpg";

    return new File([normalizedBlob], normalizedName, {
      type: OCR_OUTPUT_MIME,
      lastModified: Date.now(),
    });
  } catch {
    return imageFile;
  } finally {
    bitmap?.close();
  }
}

function mapEdgeError(status: number, payload: any): OcrAdapterError {
  const message =
    typeof payload?.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : `Erro ${status} no OCR.`;

  switch (payload?.code) {
    case "OCR_UNSUPPORTED_MIME":
      return new OcrAdapterError("invalid_format", message, { status });
    case "OCR_AUTH_REQUIRED":
    case "OCR_INVALID_SESSION":
      return new OcrAdapterError("auth", message, { status });
    case "OCR_BACKEND_KEY_MISSING":
      return new OcrAdapterError("backend_key_missing", message, { status });
    case "OCR_PROVIDER_ERROR":
      return new OcrAdapterError("provider_error", message, {
        status,
        details:
          typeof payload?.provider_status === "number"
            ? `provider_status=${payload.provider_status}`
            : undefined,
      });
    case "OCR_INVALID_RESPONSE":
      return new OcrAdapterError("invalid_contract", message, { status });
    default:
      break;
  }

  if (status === 401) {
    return new OcrAdapterError(
      "auth",
      "Sessão inválida ou expirada. Faça login novamente e tente outra vez.",
      { status }
    );
  }

  if (status === 415) {
    return new OcrAdapterError("invalid_format", message, { status });
  }

  if (status === 502 || status === 503) {
    return new OcrAdapterError("backend_unavailable", message, { status });
  }

  if (status === 422) {
    return new OcrAdapterError("invalid_contract", message, { status });
  }

  return new OcrAdapterError("processing_failed", message, { status });
}

function isValidMetadata(payload: unknown): payload is OcrStructuredMetadata | undefined {
  if (payload === undefined) return true;
  return typeof payload === "object" && payload !== null;
}

export class OcrAdapter {
  static async extract(imageFile: File | Blob): Promise<OcrExtractionResult> {
    const validation = validateOcrImageFile({
      name: imageFile instanceof File ? imageFile.name : "",
      type: imageFile.type,
    });

    if (!validation.ok) {
      throw new OcrAdapterError("invalid_format", validation.reason);
    }

    const normalizedImage = await normalizeImageForOcr(
      imageFile,
      validation.normalizedMimeType
    );

    const formData = new FormData();
    const fileName =
      normalizedImage instanceof File ? normalizedImage.name : "image.jpg";
    formData.append("image", normalizedImage, fileName);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new OcrAdapterError(
        "auth",
        "Sessão não encontrada. Faça login novamente."
      );
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new OcrAdapterError(
        "backend_unavailable",
        "VITE_SUPABASE_URL não está disponível no frontend."
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/smart-capture-ocr`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        throw new OcrAdapterError(
          "backend_unavailable",
          "Tempo limite excedido no OCR (30s). Tente uma imagem menor."
        );
      }
      throw new OcrAdapterError(
        "backend_unavailable",
        "Não foi possível alcançar a edge function smart-capture-ocr."
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw mapEdgeError(response.status, payload);
    }

    if (!payload || typeof payload !== "object") {
      throw new OcrAdapterError(
        "invalid_contract",
        "A edge function OCR retornou um payload inválido."
      );
    }

    const extractedText =
      typeof payload?.text === "string" ? payload.text.trim() : "";

    if (!extractedText) {
      throw new OcrAdapterError(
        "invalid_contract",
        "OCR não retornou texto utilizável para esta imagem."
      );
    }

    const metadata = payload?.metadata as OcrStructuredMetadata | undefined;

    if (!isValidMetadata(metadata)) {
      throw new OcrAdapterError(
        "invalid_contract",
        "OCR retornou metadata fora do contrato esperado."
      );
    }

    return {
      text: buildStructuredNarrative(metadata, extractedText),
      confidence: typeof payload?.confidence === "number" ? payload.confidence : 0.6,
      metadata,
    };
  }
}
