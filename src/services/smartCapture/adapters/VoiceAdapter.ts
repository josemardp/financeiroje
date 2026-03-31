import { supabase } from "@/integrations/supabase/client";

export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  duration?: number;
  metadata?: {
    valor?: number;
    tipo?: "income" | "expense" | null;
    descricao?: string;
    data?: string;
    categoria?: string;
    moeda?: string;
    warnings?: string[];
  };
}

export type VoiceErrorCode =
  | "UNSUPPORTED_AUDIO_TYPE"
  | "AUTH_REQUIRED"
  | "VOICE_NOT_CONFIGURED"
  | "INVALID_EDGE_PAYLOAD"
  | "UPSTREAM_VOICE_ERROR"
  | "VOICE_EMPTY_TEXT"
  | "AUDIO_TOO_LARGE"
  | "UNKNOWN_VOICE_ERROR";

export class VoiceCaptureError extends Error {
  code: VoiceErrorCode;
  status?: number;

  constructor(code: VoiceErrorCode, message: string, status?: number) {
    super(message);
    this.name = "VoiceCaptureError";
    this.code = code;
    this.status = status;
  }
}

function blobToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new VoiceCaptureError("UNKNOWN_VOICE_ERROR", "Falha ao converter arquivo de áudio para base64."));
        return;
      }
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new VoiceCaptureError("UNKNOWN_VOICE_ERROR", "Falha ao ler arquivo de áudio."));
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

export class VoiceAdapter {
  static async transcribe(audioBlob: Blob): Promise<VoiceTranscriptionResult> {
    const mimeType = audioBlob.type || "audio/webm";
    const fileName = `voice-capture-${Date.now()}.${mimeType.split('/')[1]}`;

    const base64 = await blobToBase64(audioBlob);

    const { data, error } = await supabase.functions.invoke("smart-capture-voice", {
      body: { audio_base64: base64, mime_type: mimeType, file_name: fileName },
    });

    if (error) {
      if (error.status === 401) {
        throw new VoiceCaptureError("AUTH_REQUIRED", "Sessão inválida. Faça login novamente.", 401);
      } else if (error.status === 500 && error.message.includes("OPENAI_API_KEY")) {
        throw new VoiceCaptureError("VOICE_NOT_CONFIGURED", "A chave da API de voz não está configurada no backend.", 500);
      } else if (error.status === 413) {
        throw new VoiceCaptureError("AUDIO_TOO_LARGE", "Arquivo de áudio muito grande. Tente um áudio mais curto.", 413);
      }
      throw new VoiceCaptureError("UPSTREAM_VOICE_ERROR", error.message || "Falha no backend de transcrição de voz.", error.status);
    }

    const payload = data || {};
    if (payload.ok === false) {
      throw new VoiceCaptureError(payload.code || "UNKNOWN_VOICE_ERROR", payload.message || "Falha na transcrição de voz.");
    }

    const transcription = toTrimmedString(payload.transcription);
    if (!transcription) {
      throw new VoiceCaptureError("VOICE_EMPTY_TEXT", "Texto transcrito insuficiente ou vazio.");
    }

    const extractedFields = payload.extracted_fields || {};

    return {
      text: transcription,
      confidence: normalizeConfidence(payload.confidence),
      metadata: {
        valor: toNullableNumber(extractedFields.valor) ?? undefined,
        tipo: extractedFields.tipo || null,
        descricao: toTrimmedString(extractedFields.descricao) || undefined,
        data: toTrimmedString(extractedFields.data) || undefined,
        categoria: toTrimmedString(extractedFields.categoria) || undefined,
        moeda: toTrimmedString(extractedFields.moeda) || "BRL",
        warnings: extractedFields.warnings || [],
      },
    };
  }
}
