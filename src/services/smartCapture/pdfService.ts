/**
 * FinanceAI — PDF Service (Fase 4.4)
 * Suporte real a PDF: Extração de texto nativo + Rasterização para OCR.
 * Worker carregado localmente via Vite (sem CDN frágil).
 */

import * as pdfjs from 'pdfjs-dist';

// Worker local via Vite — bundled, sem dependência de CDN
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export interface PdfProcessingResult {
  text: string;
  isRasterized: boolean;
  pagesProcessed: number;
  images?: Blob[];
}

export type PdfErrorCode =
  | "PDF_LOAD_FAILED"
  | "PDF_TEXT_EXTRACTION_FAILED"
  | "PDF_RASTERIZE_FAILED"
  | "PDF_TOO_LARGE"
  | "PDF_UNKNOWN_ERROR";

export class PdfProcessingError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.name = "PdfProcessingError";
    this.code = code;
  }
}

const MAX_PAGES = 3;
const MAX_FILE_SIZE_MB = 15;

export async function processPdf(file: File): Promise<PdfProcessingResult> {
  // Validar tamanho
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    throw new PdfProcessingError(
      "PDF_TOO_LARGE",
      `PDF muito grande (${sizeMB.toFixed(1)} MB). Limite: ${MAX_FILE_SIZE_MB} MB.`
    );
  }

  let pdf: pdfjs.PDFDocumentProxy;

  // 1. Carregar o PDF
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    pdf = await loadingTask.promise;
  } catch (err) {
    console.error("[pdfService] Falha ao carregar PDF:", err);
    throw new PdfProcessingError(
      "PDF_LOAD_FAILED",
      "Não foi possível abrir o PDF. Verifique se o arquivo não está corrompido ou protegido por senha."
    );
  }

  const numPages = Math.min(pdf.numPages, MAX_PAGES);
  let fullText = "";
  const images: Blob[] = [];

  for (let i = 1; i <= numPages; i++) {
    // 2. Extrair texto de cada página
    let pageText = "";
    let page: pdfjs.PDFPageProxy;

    try {
      page = await pdf.getPage(i);
    } catch (err) {
      console.error(`[pdfService] Falha ao obter página ${i}:`, err);
      continue; // pula página problemática
    }

    try {
      const textContent = await page.getTextContent();
      pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    } catch (err) {
      console.error(`[pdfService] Falha na extração de texto da página ${i}:`, err);
      // Sem texto, vamos tentar rasterizar
    }

    // 3. Rasterizar se texto insuficiente
    if (pageText.trim().length < 50) {
      try {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          } as any).promise;

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8)
          );

          if (blob) images.push(blob);
        }
      } catch (err) {
        console.error(`[pdfService] Falha ao rasterizar página ${i}:`, err);
        // Continua sem a imagem desta página
      }
    }
  }

  const hasUsefulText = fullText.trim().length > 100;

  // Se não conseguiu nem texto nem imagens, erro
  if (!hasUsefulText && images.length === 0) {
    throw new PdfProcessingError(
      "PDF_TEXT_EXTRACTION_FAILED",
      "Não foi possível extrair texto nem imagens deste PDF. Tente enviar como foto (JPG/PNG)."
    );
  }

  return {
    text: fullText.trim(),
    isRasterized: !hasUsefulText && images.length > 0,
    pagesProcessed: numPages,
    images: !hasUsefulText ? images : undefined
  };
}
