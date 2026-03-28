import { useState } from "react";
import { OcrAdapter, OcrCaptureError, type OcrExtractionResult } from "../adapters/OcrAdapter";
import { toast } from "sonner";

function getOcrToast(error: unknown) {
  if (error instanceof OcrCaptureError) {
    switch (error.code) {
      case "UNSUPPORTED_FILE_TYPE":
        return {
          title: "Formato ainda não suportado",
          description: "Use PDF, JPG ou PNG. Word e Excel ainda não estão liberados neste fluxo.",
        };
      case "AUTH_REQUIRED":
        return {
          title: "Sessão inválida",
          description: "Faça login novamente e tente mais uma vez.",
        };
      case "OCR_NOT_CONFIGURED":
        return {
          title: "OCR não configurado",
          description: "A chave do OCR não está configurada no backend.",
        };
      case "INVALID_EDGE_PAYLOAD":
        return {
          title: "Resposta inválida do OCR",
          description: "O backend respondeu, mas não retornou texto utilizável.",
        };
      case "UPSTREAM_OCR_ERROR":
        return {
          title: "Falha no provedor OCR",
          description: error.message || "O serviço externo falhou ao processar a imagem.",
        };
      default:
        return {
          title: "Falha no OCR",
          description: error.message || "Não foi possível processar a imagem.",
        };
    }
  }

  if (error instanceof Error) {
    return {
      title: "Falha no OCR",
      description: error.message,
    };
  }

  return {
    title: "Falha no OCR",
    description: "Erro inesperado ao processar a imagem.",
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
      console.error("[useOcrCapture] OCR failure:", error);
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
