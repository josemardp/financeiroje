/**
 * FinanceAI — OCR Adapter
 * OCR real em client-side via Tesseract.js.
 * O resultado nunca é persistido automaticamente.
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

function extractMetadata(text: string) {
  const totalMatch =
    text.match(/(?:valor\s+total|total)\s*[:\-]?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/i) ||
    text.match(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/i);

  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  const merchantMatch = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 4 && !/\b(cnpj|cpf|data|total|valor)\b/i.test(line));

  const totalAmount = totalMatch
    ? Number.parseFloat(totalMatch[1].replace(/\./g, "").replace(",", "."))
    : undefined;

  const date = dateMatch
    ? `${dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
    : undefined;

  return {
    merchantName: merchantMatch,
    totalAmount,
    date,
  };
}

export class OcrAdapter {
  static async extract(imageFile: File | Blob): Promise<OcrExtractionResult> {
    const Tesseract = await import("tesseract.js");
    const result = await Tesseract.recognize(imageFile, "por+eng");
    const text = result.data.text.trim();

    if (!text) {
      throw new Error("Nenhum texto legível foi encontrado na imagem.");
    }

    return {
      text,
      confidence: Number((result.data.confidence / 100).toFixed(2)),
      metadata: extractMetadata(text),
    };
  }
}
