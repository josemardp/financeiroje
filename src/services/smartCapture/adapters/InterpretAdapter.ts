/**
 * FinanceAI — Interpret Adapter
 * Unified adapter that interprets text from any source (free text, voice, PDF, DOCX)
 * using the local parseTransactionText engine and returns a structured result
 * compatible with OcrExtractionResult for the Mirror Mode flow.
 */
import { parseTransactionText } from "@/services/smartCapture/textParser";
import type { OcrExtractionResult, OcrStructuredMetadata } from "./OcrAdapter";

export type InterpretSourceKind =
  | "free_text"
  | "voice_transcript"
  | "pdf_text"
  | "docx_text"
  | "xlsx_text";

export interface InterpretRequest {
  text: string;
  sourceKind: InterpretSourceKind;
}

export type InterpretResult = OcrExtractionResult;

const CONFIDENCE_MAP: Record<string, number> = {
  alta: 0.95,
  media: 0.7,
  baixa: 0.4,
};

export class InterpretAdapter {
  static async interpret(request: InterpretRequest): Promise<InterpretResult> {
    const { text, sourceKind } = request;

    if (!text || !text.trim()) {
      throw new Error("Texto vazio para interpretação.");
    }

    const parsed = parseTransactionText(text.trim());

    const metadata: OcrStructuredMetadata = {
      amount: parsed.valor,
      totalAmount: parsed.valor ?? undefined,
      date: parsed.data || undefined,
      transactionType: parsed.tipo || "unknown",
      description: parsed.descricao || undefined,
      scope: parsed.escopo || "private",
      categoryHint: parsed.categoriaSugerida || undefined,
      confidence: parsed.confianca,
      evidence: [
        `source: ${sourceKind}`,
        ...parsed.observacoes.slice(0, 5),
      ],
    };

    const confidenceNumeric = CONFIDENCE_MAP[parsed.confianca] ?? 0.5;

    return {
      text: parsed.textoOriginal || text.trim(),
      confidence: confidenceNumeric,
      metadata,
    };
  }
}
