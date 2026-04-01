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

export class VoiceAdapter {
  static async transcribe(audioBlob: Blob, fileName: string = "audio.webm"): Promise<VoiceTranscriptionResult> {
    const formData = new FormData();
    formData.append("audio", audioBlob, fileName);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Sessão não encontrada. Faça login novamente.");
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/smart-capture-voice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

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
