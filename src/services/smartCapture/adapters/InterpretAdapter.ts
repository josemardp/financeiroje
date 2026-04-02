/**
 * FinanceAI — Interpret Adapter
 * Interpreta texto estruturado via Edge Function smart-capture-interpret.
 */
import { supabase } from "@/integrations/supabase/client";
import type { OcrExtractionResult, OcrStructuredMetadata } from "./OcrAdapter";

export type InterpretSourceKind =
  | "free_text"
  | "voice_transcript"
  | "pdf_text"
  | "docx_text";

export interface InterpretRequest {
  text: string;
  sourceKind: InterpretSourceKind;
}

export interface InterpretResult extends OcrExtractionResult {
  metadata?: OcrStructuredMetadata;
  missingFields?: string[];
}

function normalizeMissingFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export class InterpretAdapter {
  static async interpret(request: InterpretRequest): Promise<InterpretResult> {
    const inputText = request.text?.trim();

    if (!inputText) {
      throw new Error("Texto vazio para interpretação.");
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Sessão não encontrada. Faça login novamente.");
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const response = await fetch(`${supabaseUrl}/functions/v1/smart-capture-interpret`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        text: inputText,
        source_kind: request.sourceKind,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || `Erro ${response.status} na interpretação`);
    }

    return {
      text:
        typeof payload?.text === "string" && payload.text.trim()
          ? payload.text.trim()
          : inputText,
      confidence:
        typeof payload?.confidence === "number" && Number.isFinite(payload.confidence)
          ? payload.confidence
          : 0.7,
      metadata: payload?.metadata,
      missingFields: normalizeMissingFields(payload?.missingFields),
    };
  }
}
