/**
 * FinanceAI — OCR Adapter
 * Extrai texto e campos estruturados de imagens via Edge Function smart-capture-ocr.
 */
import { supabase } from "@/integrations/supabase/client";

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

const MAX_OCR_IMAGE_DIMENSION = 1800;
const MAX_OCR_UPLOAD_BYTES = 2 * 1024 * 1024;
const OCR_OUTPUT_MIME = "image/jpeg";
const OCR_OUTPUT_QUALITY = 0.88;

function formatDateToPtBr(date?: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatAmountToPtBr(amount?: number | null) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return "";
  return amount.toFixed(2).replace(".", ",");
}

function buildStructuredNarrative(metadata: OcrStructuredMetadata | undefined, fallbackText: string) {
  if (!metadata) return fallbackText;

  const amount = formatAmountToPtBr(metadata.amount ?? metadata.totalAmount);
  const date = formatDateToPtBr(metadata.date);
  const description = metadata.description?.trim() || metadata.merchantName?.trim() || metadata.counterparty?.trim() || "";
  const scope = metadata.scope === "family"
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

async function normalizeImageForOcr(imageFile: File | Blob): Promise<File | Blob> {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return imageFile;
  }

  const mimeType = imageFile.type || "";
  if (!mimeType.startsWith("image/")) {
    return imageFile;
  }

  const shouldKeepOriginal = imageFile.size <= MAX_OCR_UPLOAD_BYTES && mimeType !== "image/webp";
  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(imageFile);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = longestSide > MAX_OCR_IMAGE_DIMENSION ? MAX_OCR_IMAGE_DIMENSION / longestSide : 1;

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

    const normalizedName = imageFile instanceof File
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

export class OcrAdapter {
  static async extract(imageFile: File | Blob): Promise<OcrExtractionResult> {
    const normalizedImage = await normalizeImageForOcr(imageFile);
    const formData = new FormData();
    const fileName = normalizedImage instanceof File ? normalizedImage.name : "image.jpg";
    formData.append("image", normalizedImage, fileName);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Sessão não encontrada. Faça login novamente.");
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/smart-capture-ocr`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || `Erro ${response.status} no OCR`);
    }

    const extractedText = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!extractedText) {
      throw new Error("OCR não retornou texto utilizável para esta imagem.");
    }

    const metadata = payload?.metadata as OcrStructuredMetadata | undefined;

    return {
      text: buildStructuredNarrative(metadata, extractedText),
      confidence: typeof payload?.confidence === "number" ? payload.confidence : 0.6,
      metadata,
    };
  }
}
