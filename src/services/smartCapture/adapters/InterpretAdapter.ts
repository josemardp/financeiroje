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
  | "docx_text"
  | "ocr_text";

export interface InterpretRequest {
  text: string;
  sourceKind: InterpretSourceKind;
  signal?: AbortSignal;
  userName?: string;
  userContext?: string;
}

export interface InterpretResult extends OcrExtractionResult {
  metadata?: OcrStructuredMetadata;
  missingFields?: string[];
}

const INTERPRET_TIMEOUT_MS = 30_000;

function normalizeMissingFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Retorna um AbortSignal que aborta quando qualquer um dos sinais abortar */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export class InterpretAdapter {
  static async interpret(request: InterpretRequest): Promise<InterpretResult> {
    const inputText = request.text?.trim();

    if (!inputText) {
      throw new Error("Texto vazio para interpretação.");
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("VITE_SUPABASE_URL não está disponível. Verifique as variáveis de ambiente.");
    }

    let { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }

    if (!session?.access_token) {
      throw new Error("Sessão não encontrada. Faça login novamente.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INTERPRET_TIMEOUT_MS);
    const combinedSignal = request.signal
      ? anySignal([request.signal, controller.signal])
      : controller.signal;

    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/smart-capture-interpret`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text: inputText,
          source_kind: request.sourceKind,
          user_name: request.userName ?? null,
          user_context: request.userContext ?? null,
        }),
        signal: combinedSignal,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        throw new Error("Tempo limite excedido na interpretação (30s). Tente um texto mais curto.");
      }
      throw new Error("Não foi possível alcançar o servidor de interpretação.");
    } finally {
      clearTimeout(timeoutId);
    }

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
