import { useState } from "react";
import { OcrAdapter, OcrCaptureError, type OcrExtractionResult } from "../adapters/OcrAdapter";
import { toast } from "sonner";

function getOcrToast(error: unknown) {
  if (error instanceof OcrCaptureError) {
    switch (error.code) {
      case "UNSUPPORTED_FILE_TYPE":
        return {
          title: "Formato não suportado",
          description: "Use PDF, JPG, PNG ou DOCX neste fluxo.",
        };
      case "DOC_LEGACY_NOT_SUPPORTED":
        return {
          title: "Word legado ainda não suportado",
          description: "Arquivos .doc continuam bloqueados nesta fase. Use .docx.",
        };
      case "DOCX_EMPTY_CONTENT":
        return {
          title: "Word sem conteádo útil",
          description: error.message || "O arquivo .docx não contém texto útil para capturar.",
        };
      case "FILE_CORRUPTED":
        return {
          title: "Arquivo corrompido ou inválido",
          description: error.message || "Revise o arquivo e tente novamente.",
        };
      case "DOCUMENT_PROCESSING_ERROR":
        return {
          title: "Falha ao processar documento Word",
          description: error.message || "Não foi possível ler o arquivo Word enviado.",
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
      case "PDF_LOAD_FAILED":
        return {
          title: "Falha ao abrir PDF",
          description: error.message || "O arquivo pode estar corrompido ou protegido por senha.",
        };
      case "PDF_TEXT_EXTRACTION_FAILED":
        return {
          title: "Falha ao extrair texto do PDF",
          description: error.message || "Não foi possível ler oconteúdo. Tente enviar como foto.",
        };
      case "PDF_RASTERIZE_FAILED":
        return {
          title: "Falha ao renderizar PDF",
          description: error.message || "O PDF pode ser muito complexo. Tente enviar como foto.",
        };
      case "PDF_TOO_LARGE":
        return {
          title: "PDF muito grande",
          description: error.message || "Reduza o tamanho do arquivo e tente novamente.",
        };
      case "PDF_PROCESSING_ERROR":
        return {
          title: "Erro no processamento do PDF",
          description: error.message || "Tente enviar o documento como foto (JPG/PNG).",
        };
      default:
        return {
          title: "Falha no OCR",
          description: error.message || "Não foi possível processar o arquivo.",
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
    description: "Erro inesperado ao processar o arquivo.",
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
