/**
 * FinanceAI  OCR Adapter (Fase 4.4)
 * Fluxo real: Imagem JPG/PNG + PDF (Extracao Nativa ou Rasterizacao).
 */

import { supabase } from "@/integrations/supabase/client";
import {
  DocumentImportError,
  extractStructuredDocument,
  getSmartCaptureFileKind,
} from "../documentImport";
import { cleanDescription, parseTransactionText } from "../textParser";
import { processPdf, PdfProcessingError } from "../pdfService";

export interface OcrExtractionResult {
  text: string;
  confidence: number;
  metadata?: {
    merchantName?: string;
    totalAmount?: number;
    date?: string;
    tipo?: "income" | "expense" | null;
    categoria?: string;
    escopo?: "private" | "family" | "business";
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
  | "OCR_EMPTY_TEXT"
  | "PDF_LOAD_FAILED"
  | "PDF_TEXT_EXTRACTION_FAILED"
  | "PDF_RASTERIZE_FAILED"
  | "PDF_TOO_LARGE"
  | "PDF_PROCESSING_ERROR"
  | "DOC_LEGACY_NOT_SUPPORTED"
  | "XLS_LEGACY_NOT_SUPPORTED"
  | "DOCX_EMPTY_CONTENT"
  | "XLSX_EMPTY_CONTENT"
  | "XLSX_MULTIPLE_TRANSACTIONS"
  | "FILE_CORRUPTED"
  | "DOCUMENT_PROCESSING_ERROR"
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

function isSupportedImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as any);
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
    reader.onerror = () => reject(new OcrCaptureError("UNKNOWN_OCR_ERROR", "Falha ao ler arquivo para OCR."));
    reader.readAsDataURL(file);
  });
}

function normalizeConfidence(value: string | number | null | undefined) {
  if (typeof value === "number") {
    if (value > 1) return Number((value / 100).toFixed(2));
    return Number(value.toFixed(2));
  }
  switch (value) {
    case "alta": return 0.9;
    case "media": return 0.7;
    case "baixa": return 0.4;
    default: return 0.6;
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

export class OcrAdapter {
  static async extract(file: File | Blob): Promise<OcrExtractionResult> {
    const kind = getSmartCaptureFileKind(file);
    const mimeType = file.type || "application/octet-stream";

    if (kind === "doc") {
      throw new OcrCaptureError("DOC_LEGACY_NOT_SUPPORTED", "Arquivos .doc ainda nao sao suportados nesta fase.");
    }

    if (kind === "xls") {
      throw new OcrCaptureError("XLS_LEGACY_NOT_SUPPORTED", "Arquivos .xls ainda nao sao suportados nesta fase. Use .xlsx.");
    }

    if ((kind === "docx" || kind === "xlsx") && file instanceof File) {
      try {
        return await extractStructuredDocument(file, {
          cleanDescription,
          parseTransactionText,
        });
      } catch (err) {
        if (err instanceof DocumentImportError) {
          throw new OcrCaptureError(err.code as OcrErrorCode, err.message);
        }

        console.error("[OcrAdapter] Erro inesperado ao processar documento Office:", err);
        throw new OcrCaptureError(
          "DOCUMENT_PROCESSING_ERROR",
          "Falha ao processar o documento enviado. Revise o arquivo e tente novamente.",
        );
      }
    }

    if (kind === "pdf" && file instanceof File) {
      try {
        const pdfResult = await processPdf(file);

        if (!pdfResult.isRasterized && pdfResult.text.length > 50) {
          const parsed = parseTransactionText(pdfResult.text);
          const confidenceMap = { alta: 0.9, media: 0.7, baixa: 0.4 };

          return {
            text: pdfResult.text,
            confidence: confidenceMap[parsed.confianca] ?? 0.6,
            metadata: {
              merchantName: parsed.descricao || undefined,
              totalAmount: parsed.valor ?? undefined,
              date: parsed.data || undefined,
              tipo: parsed.tipo,
              categoria: parsed.categoriaSugerida || undefined,
              escopo: parsed.escopo,
              warnings: [
                ...(pdfResult.pagesProcessed > 1 ? [`Processadas ${pdfResult.pagesProcessed} paginas.`] : []),
                ...parsed.warnings,
              ],
              moeda: "BRL",
            },
          };
        }

        if (pdfResult.images && pdfResult.images.length > 0) {
          return await this.extractFromImage(pdfResult.images[0], "page1.jpg");
        }

        throw new OcrCaptureError("OCR_EMPTY_TEXT", "Nao foi possivel extrair texto util deste PDF.");
      } catch (err) {
        if (err instanceof OcrCaptureError) throw err;
        if (err instanceof PdfProcessingError) {
          throw new OcrCaptureError(err.code as OcrErrorCode, err.message);
        }
        console.error("[OcrAdapter] Erro inesperado ao processar PDF:", err);
        throw new OcrCaptureError("PDF_PROCESSING_ERROR", "Erro ao processar o arquivo PDF. Tente enviar como foto.");
      }
    }

    if (kind === "image" || isSupportedImageMimeType(mimeType)) {
      return await this.extractFromImage(file, file instanceof File ? file.name : "image.jpg");
    }

    throw new OcrCaptureError("UNSUPPORTED_FILE_TYPE", "Formato nao suportado. Use PDF, JPG, PNG, DOCX ou XLSX.");
  }

  private static async extractFromImage(file: File | Blob, fileName: string): Promise<OcrExtractionResult> {
    const base64 = await blobToBase64(file);
    const mimeType = file.type || "image/jpeg";

    const { data, error } = await supabase.functions.invoke("smart-capture-ocr", {
      body: { file_base64: base64, mime_type: mimeType, file_name: fileName },
    });

    if (error) throw new OcrCaptureError("UPSTREAM_OCR_ERROR", error.message || "Falha no backend de OCR.");

    const payload = data || {};
    if (payload.ok === false) throw new OcrCaptureError(payload.code || "UNKNOWN_OCR_ERROR", payload.message || "Falha no OCR.");

    const fields = payload.extracted_fields || {};
    const text = toTrimmedString(payload.raw_text);

    if (!text || text.length < 5) throw new OcrCaptureError("OCR_EMPTY_TEXT", "Texto extraido insuficiente.");

    return {
      text,
      confidence: normalizeConfidence(fields.confidence),
      metadata: {
        merchantName: fields.descricao ? cleanDescription(String(fields.descricao)) : undefined,
        totalAmount: toNullableNumber(fields.valor) ?? undefined,
        date: toTrimmedString(fields.data) || undefined,
        tipo: fields.tipo || null,
        categoria: toTrimmedString(fields.categoria) || undefined,
        escopo: fields.escopo || "private",
        warnings: fields.warnings || [],
        moeda: toTrimmedString(fields.moeda) || "BRL",
      },
    };
  }
}
