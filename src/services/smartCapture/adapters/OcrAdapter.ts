/**
 * FinanceAI — OCR Adapter
 * Extrai texto de imagens via Edge Function smart-capture-ocr (OpenAI Vision).
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

export class OcrAdapter {
  static async extract(imageFile: File | Blob): Promise<OcrExtractionResult> {
    const formData = new FormData();
    const fileName = imageFile instanceof File ? imageFile.name : "image.jpg";
    formData.append("image", imageFile, fileName);

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

    return {
      text: extractedText,
      confidence: typeof payload?.confidence === "number" ? payload.confidence : 0.6,
      metadata: payload?.metadata,
    };
  }
}
