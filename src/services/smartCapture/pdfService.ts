/**
 * FinanceAI — PDF Service (Fase 4.4)
 * Suporte real a PDF: Extração de texto nativo + Rasterização para OCR.
 */

import * as pdfjs from 'pdfjs-dist';

// Configuração do worker para ambiente web/vite
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export interface PdfProcessingResult {
  text: string;
  isRasterized: boolean;
  pagesProcessed: number;
  images?: Blob[];
}

const MAX_PAGES = 3;

export async function processPdf(file: File): Promise<PdfProcessingResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  const numPages = Math.min(pdf.numPages, MAX_PAGES);
  let fullText = "";
  const images: Blob[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    
    fullText += pageText + "\n";

    // Se o texto for muito curto, vamos rasterizar a página para OCR
    if (pageText.trim().length < 50) {
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        const blob = await new Promise<Blob | null>((resolve) => 
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8)
        );
        
        if (blob) images.push(blob);
      }
    }
  }

  const hasUsefulText = fullText.trim().length > 100;

  return {
    text: fullText.trim(),
    isRasterized: !hasUsefulText && images.length > 0,
    pagesProcessed: numPages,
    images: !hasUsefulText ? images : undefined
  };
}
