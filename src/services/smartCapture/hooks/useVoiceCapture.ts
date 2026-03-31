import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { VoiceAdapter, VoiceCaptureError, VoiceTranscriptionResult, VoiceErrorCode } from "../adapters/VoiceAdapter";

function getVoiceToast(error: unknown) {
  if (error instanceof VoiceCaptureError) {
    switch (error.code) {
      case "UNSUPPORTED_AUDIO_TYPE":
        return {
          title: "Formato de áudio não suportado",
          description: "Por favor, use um formato de áudio comum como MP3, WAV ou WebM.",
        };
      case "AUTH_REQUIRED":
        return {
          title: "Sessão inválida",
          description: "Faça login novamente e tente mais uma vez.",
        };
      case "VOICE_NOT_CONFIGURED":
        return {
          title: "Serviço de voz não configurado",
          description: "A chave da API de voz não está configurada no backend. Contate o suporte.",
        };
      case "INVALID_EDGE_PAYLOAD":
        return {
          title: "Resposta inválida do serviço de voz",
          description: "O backend respondeu, mas não retornou um formato de texto utilizável.",
        };
      case "UPSTREAM_VOICE_ERROR":
        return {
          title: "Falha no provedor de voz",
          description: error.message || "O serviço externo falhou ao processar o áudio.",
        };
      case "VOICE_EMPTY_TEXT":
        return {
          title: "Áudio sem texto detectado",
          description: "Não foi possível transcrever nenhum texto útil do áudio fornecido.",
        };
      case "AUDIO_TOO_LARGE":
        return {
          title: "Áudio muito grande",
          description: error.message || "O arquivo de áudio excede o limite. Tente um áudio mais curto.",
        };
      case "UNKNOWN_VOICE_ERROR":
      default:
        return {
          title: "Falha na captura de voz",
          description: error.message || "Ocorreu um erro inesperado ao processar o áudio.",
        };
    }
  }

  if (error instanceof Error) {
    return {
      title: "Falha na captura de voz",
      description: error.message,
    };
  }

  return {
    title: "Falha na captura de voz",
    description: "Erro inesperado ao processar o áudio.",
  };
}

export function useVoiceCapture() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<VoiceTranscriptionResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    setResult(null);
    setIsTranscribing(false);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        try {
          const transcriptionResult = await VoiceAdapter.transcribe(audioBlob);
          setResult(transcriptionResult);
          toast.success("Transcrição de voz concluída!", {
            description: "Revise no Modo Espelho abaixo.",
          });
        } catch (error) {
          const toastPayload = getVoiceToast(error);
          toast.error(toastPayload.title, {
            description: toastPayload.description,
          });
          console.error("[useVoiceCapture] Voice transcription failure:", error);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current.onerror = (event) => {
        const toastPayload = getVoiceToast(new VoiceCaptureError("UNKNOWN_VOICE_ERROR", event.error?.message || "Erro na gravação de áudio."));
        toast.error(toastPayload.title, {
          description: toastPayload.description,
        });
        setIsRecording(false);
        setIsTranscribing(false);
        console.error("[useVoiceCapture] MediaRecorder error:", event.error);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info("Gravando áudio...");
    } catch (error) {
      const toastPayload = getVoiceToast(new VoiceCaptureError("UNKNOWN_VOICE_ERROR", error instanceof Error ? error.message : "Falha ao acessar o microfone."));
      toast.error(toastPayload.title, {
        description: toastPayload.description,
      });
      setIsRecording(false);
      setIsTranscribing(false);
      console.error("[useVoiceCapture] Microfone access error:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const resetVoice = () => {
    setResult(null);
    setIsRecording(false);
    setIsTranscribing(false);
    audioChunksRef.current = [];
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    result,
    startRecording,
    stopRecording,
    resetVoice,
  };
}
