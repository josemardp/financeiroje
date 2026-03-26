/**
 * FinanceAI — OCR Adapter
 * Chama a edge function smart-capture-ocr e devolve resultado compatível com o SmartCapture.
 * O resultado nunca é persistido automaticamente.
 */

import { supabase } from "@/integrations/supabase/client";

export interface OcrExtractionResult {
  text: string;
  confidence: number;
  metadata?: {
    merchantName?: string;
    totalAmount?: number;
    date?: string;
  };
}

type OcrEdgeResponse = {
  extracted_fields?: {
    valor?: number | null;
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

function blobToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Falha ao converter arquivo para base64."));
        return;
      }
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo para OCR."));
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

function buildRawText(payload: OcrEdgeResponse) {
  if (payload.raw_text?.trim()) {
    return payload.raw_text.trim();
  }

  const fields = payload.extracted_fields;
  if (!fields) return "";

  return [
    fields.descricao,
    fields.valor != null ? `R$ ${fields.valor}` : null,
    fields.data,
    fields.categoria,
    ...(fields.warnings || []),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

export class OcrAdapter {
  static async extract(imageFile: File | Blob): Promise<OcrExtractionResult> {
    const mimeType = imageFile.type || "application/octet-stream";
    const base64 = await blobToBase64(imageFile);

    const { data, error } = await supabase.functions.invoke("smart-capture-ocr", {
      body: {
        file_base64: base64,
        mime_type: mimeType,
        file_name: imageFile instanceof File ? imageFile.name : "smart-capture-file",
      },
    });

    if (error) {
      throw new Error(error.message || "Falha ao processar OCR na edge function.");
    }

    const payload = (data || {}) as OcrEdgeResponse;
    const fields = payload.extracted_fields || {};
    const text = buildRawText(payload);

    if (!text) {
      throw new Error("Nenhum texto legível foi retornado pela edge function de OCR.");
    }

    return {
      text,
      confidence: normalizeConfidence(fields.confidence ?? payload.confidence),
      metadata: {
        merchantName: fields.descricao || undefined,
        totalAmount: typeof fields.valor === "number" ? fields.valor : undefined,
        date: fields.data || undefined,
      },
    };
  }
}
