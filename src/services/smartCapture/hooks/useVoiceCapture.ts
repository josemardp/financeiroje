import { useRef, useState } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}
export interface VoiceCaptureResult {
  text: string;
  confidence: number;
}

export function useVoiceCapture() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<VoiceCaptureResult | null>(null);

  const createRecognition = () => {
    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      throw new Error("Reconhecimento de voz não suportado neste navegador.");
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    return recognition;
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Captura de microfone indisponível neste navegador.");
      }

      await navigator.mediaDevices.getUserMedia({ audio: true });

      const recognition = createRecognition();
      recognitionRef.current = recognition;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const first = event.results?.[0]?.[0];
        if (!first) return;

        setResult({
          text: first.transcript.trim(),
          confidence: Number.isFinite(first.confidence) && first.confidence > 0 ? first.confidence : 0.85,
        });
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        toast.error("Erro na transcrição de voz", {
          description: event.error || "Falha ao interpretar o áudio.",
        });
        setIsRecording(false);
        setIsTranscribing(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setIsTranscribing(false);
      };

      setResult(null);
      setIsRecording(true);
      setIsTranscribing(true);
      recognition.start();
      toast.info("Gravando e transcrevendo em tempo real...");
    } catch (error) {
      toast.error("Captura de voz indisponível", {
        description: error instanceof Error ? error.message : "Falha ao acessar o microfone.",
      });
      setIsRecording(false);
      setIsTranscribing(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const resetVoice = () => {
    setResult(null);
    setIsRecording(false);
    setIsTranscribing(false);
  };

  return {
    isRecording,
    isTranscribing,
    result,
    startRecording,
    stopRecording,
    resetVoice,
  };
}
