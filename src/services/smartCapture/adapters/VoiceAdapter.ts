/**
 * FinanceAI — Voice Adapter
 * Transcreve áudio via Edge Function smart-capture-voice (OpenAI Whisper).
 */
import { supabase } from "@/integrations/supabase/client";

export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  duration?: number;
}

const VOICE_TIMEOUT_MS = 30_000;

export class VoiceAdapter {
  static async transcribe(
    audioBlob: Blob,
    fileName: string = "audio.webm",
    signal?: AbortSignal
  ): Promise<VoiceTranscriptionResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("VITE_SUPABASE_URL não está disponível. Verifique as variáveis de ambiente.");
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, fileName);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Sessão não encontrada. Faça login novamente.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);
    const combinedSignal = signal
      ? anySignal([signal, controller.signal])
      : controller.signal;

    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/smart-capture-voice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
        signal: combinedSignal,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        throw new Error("Tempo limite excedido na transcrição de voz (30s). Tente um áudio mais curto.");
      }
      throw new Error("Não foi possível alcançar o servidor de transcrição de voz.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || `Erro ${response.status} na transcrição`);
    }

    const result = await response.json();
    return {
      text: result.text,
      confidence: result.confidence ?? 0.9,
    };
  }
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
