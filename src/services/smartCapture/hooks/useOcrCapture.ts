import { useState } from "react";
import {
  OcrAdapter,
  OcrAdapterError,
  type OcrExtractionResult,
} from "../adapters/OcrAdapter";
import { toast } from "sonner";

function getOcrToast(error: unknown) {
  if (error instanceof OcrAdapterError) {
    switch (error.code) {
      case "invalid_format":
        return {
          title: "Formato de imagem não suportado",
          description: error.message,
        };
      case "auth":
        return {
          title: "Sessão expirada",
          description: error.message,
        };
      case "backend_key_missing":
        return {
          title: "OCR indisponível no servidor",
          description: error.message,
        };
      case "backend_unavailable":
        return {
          title: "Backend OCR indisponível",
          description: error.message,
        };
      case "invalid_contract":
        return {
          title: "Resposta inválida do OCR",
          description: error.message,
        };
      case "provider_error":
        return {
          title: "Falha no provedor OCR",
          description: error.message,
        };
      default:
        return {
          title: "Falha ao processar a imagem",
          description: error.message,
        };
    }
  }

  return {
    title: "Falha ao processar a imagem",
    description:
      error instanceof Error
        ? error.message
        : "Erro no processamento da imagem (OCR).",
  };
}

export function useOcrCapture() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OcrExtractionResult | null>(null);

  const processImage = async (file: File) => {
    setIsProcessing(true);

    try {
      const extraction = await OcrAdapter.extract(file);
      setResult(extraction);
    } catch (error) {
      const toastPayload = getOcrToast(error);
      toast.error(toastPayload.title, {
        description: toastPayload.description,
      });
      console.error("useOcrCapture.processImage", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetOcr = () => {
    setResult(null);
    setIsProcessing(false);
  };

  return {
    isProcessing,
    result,
    processImage,
    resetOcr,
  };
}
