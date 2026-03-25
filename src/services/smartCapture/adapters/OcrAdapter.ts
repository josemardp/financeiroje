/**
 * FinanceAI — OCR Adapter
 * Responsável por extrair texto de imagens (fotos de recibos/comprovantes).
 * Preparado para integração com Google Vision ou similar.
 */

export interface OcrExtractionResult {
  text: string;
  confidence: number;
  metadata?: {
    merchantName?: string;
    totalAmount?: number;
    date?: string;
  };
}

export class OcrAdapter {
  /**
   * Extrai texto de um arquivo de imagem (File/Blob).
   * Atualmente implementa um mock/fallback que simula a extração.
   */
  static async extract(imageFile: File | Blob): Promise<OcrExtractionResult> {
    console.log("Processando imagem:", imageFile.size);
    
    // Simulação de processamento pesado
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // TODO: Implementar chamada real para API (ex: Google Cloud Vision ou Tesseract.js)
    // const formData = new FormData();
    // formData.append("image", imageFile);
    // const response = await fetch("api/ocr", { method: "POST", body: formData });
    
    // Fallback/Mock para demonstração do fluxo
    return {
      text: "RESTAURANTE SABOR REAL\nCNPJ: 12.345.678/0001-90\nVALOR TOTAL: R$ 89,90\nDATA: 25/03/2026",
      confidence: 0.88,
      metadata: {
        merchantName: "Restaurante Sabor Real",
        totalAmount: 89.90,
        date: "2026-03-25"
      }
    };
  }
}
