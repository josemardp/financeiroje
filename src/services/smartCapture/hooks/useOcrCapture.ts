import { useState } from "react";
import { OcrAdapter, OcrCaptureError, type OcrExtractionResult } from "../adapters/OcrAdapter";
import { toast } from "sonner";

function getOcrToast(error: unknown) {
  if (error instanceof OcrCaptureError) {
    switch (error.code) {
      case "UNSUPPORTED_FILE_TYPE":
        return {
          title: "Formato nao suportado",
          description: "Use PDF, JPG, PNG, DOCX ou XLSX neste fluxo.",
        };
      case "DOC_LEGACY_NOT_SUPPORTED":
        return {
          title: "Word legado ainda nao suportado",
          description: "Arquivos .doc continuam bloqueados nesta fase. Use .docx.",
        };
      case "XLS_LEGACY_NOT_SUPPORTED":
        return {
          title: "Excel legado ainda nao suportado",
          description: ".xls ainda nao e suportado nesta fase. Use .xlsx.",
        };
      case "DOCX_EMPTY_CONTENT":
        return {
          title: "Word sem conteudo util",
          description: error.message || "O arquivo .docx nao contem texto util para capturar.",
        };
      case "XLSX_EMPTY_CONTENT":
        return {
          title: "Planilha sem conteudo util",
          description: error.message || "A planilha .xlsx nao contem uma transacao unica clara para capturar.",
        };
      case "XLSX_MULTIPLE_TRANSACTIONS":
        return {
          title: "Planilha com multiplas transacoes",
          description: error.message || "O Smart Capture aceita apenas uma transacao por vez neste fluxo.",
        };
      case "FILE_CORRUPTED":
        return {
          title: "Arquivo corrompido ou invalido",
          description: error.message || "Revise o arquivo e tente novamente.",
        };
      case "DOCUMENT_PROCESSING_ERROR":
        return {
          title: "Falha ao processar documento",
          description: error.message || "Nao foi possivel ler o documento enviado.",
        };
      case "AUTH_REQUIRED":
        return {
          title: "Sessao invalida",
          description: "Faca login novamente e tente mais uma vez.",
        };
      case "OCR_NOT_CONFIGURED":
        return {
          title: "OCR nao configurado",
          description: "A chave do OCR nao esta configurada no backend.",
        };
      case "INVALID_EDGE_PAYLOAD":
        return {
          title: "Resposta invalida do OCR",
          description: "O backend respondeu, mas nao retornou texto utilizavel.",
        };
      case "UPSTREAM_OCR_ERROR":
        return {
          title: "Falha no provedor OCR",
          description: error.message || "O servico externo falhou ao processar a imagem.",
        };
      case "PDF_LOAD_FAILED":
        return {
          title: "Falha ao abrir PDF",
          description: error.message || "O arquivo pode estar corrompido ou protegido por senha.",
        };
      case "PDF_TEXT_EXTRACTION_FAILED":
        return {
          title: "Falha ao extrair texto do PDF",
          description: error.message || "Nao foi possivel ler o conteudo. Tente enviar como foto.",
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
          description: error.message || "Nao foi possivel processar o arquivo.",
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
