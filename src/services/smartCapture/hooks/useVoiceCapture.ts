import { useCallback, useRef, useState } from "react";
import { VoiceAdapter, VoiceTranscriptionResult } from "../adapters/VoiceAdapter";
import { toast } from "sonner";

export function useVoiceCapture() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<VoiceTranscriptionResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];

      let selectedMime = "";
      for (const mime of preferredTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      mimeTypeRef.current = selectedMime || "audio/webm";

      const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mime = mimeTypeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });

        const ext = mime.includes("webm")
          ? "webm"
          : mime.includes("ogg")
            ? "ogg"
            : mime.includes("mp4")
              ? "m4a"
              : "webm";

        setIsTranscribing(true);

        try {
          const transcription = await VoiceAdapter.transcribe(audioBlob, `audio.${ext}`);
          setResult(transcription);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Erro na transcrição de voz";
          toast.error(msg);
          console.error(error);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Gravando áudio...");
    } catch (error) {
      toast.error("Permissão de microfone negada ou não suportada pelo navegador");
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const resetVoice = useCallback(() => {
    setResult(null);
    setIsRecording(false);
    setIsTranscribing(false);
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
