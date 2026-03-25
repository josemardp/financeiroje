import { useState } from "react";
import { OcrAdapter, OcrExtractionResult } from "../adapters/OcrAdapter";
import { toast } from "sonner";

export function useOcrCapture() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OcrExtractionResult | null>(null);

  const processImage = async (file: File) => {
    setIsProcessing(true);
    try {
      const extraction = await OcrAdapter.extract(file);
      setResult(extraction);
    } catch (error) {
      toast.error("Erro no processamento da imagem (OCR)");
      console.error(error);
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
    resetOcr
  };
}
