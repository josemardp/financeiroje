/**
 * FinanceAI — Extração de Texto de Arquivos
 * Suporta PDF (textual), DOCX e XLSX.
 * PDFs escaneados devem usar OCR remoto.
 */

export interface FileExtractionResult {
  text: string;
  source: string; // "pdf" | "docx" | "xlsx"
  pageCount?: number;
}

export async function extractTextFromPdf(file: File): Promise<FileExtractionResult> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source using local copy via Vite
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    pages.push(pageText);
  }

  const fullText = pages.join("\n").trim();

  if (!fullText || fullText.length < 10) {
    throw new Error(
      "Não foi possível extrair texto deste PDF. Ele parece ser escaneado. Tente usar o modo Foto/OCR."
    );
  }

  return { text: fullText, source: "pdf", pageCount: pdf.numPages };
}

export async function extractTextFromDocx(file: File): Promise<FileExtractionResult> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  if (!result.value || result.value.trim().length < 5) {
    throw new Error("Não foi possível extrair texto deste documento Word.");
  }

  return { text: result.value.trim(), source: "docx" };
}

export async function extractTextFromSpreadsheet(file: File): Promise<FileExtractionResult> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const texts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      texts.push(csv);
    }
  }

  const fullText = texts.join("\n").trim();
  if (!fullText) {
    throw new Error("Não foi possível extrair dados desta planilha.");
  }

  return { text: fullText, source: "xlsx" };
}

export async function extractTextFromSupportedFile(file: File): Promise<FileExtractionResult> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("PDF muito grande (limite: 15MB). Tente um arquivo menor.");
    }
    return extractTextFromPdf(file);
  }

  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return extractTextFromDocx(file);
  }

  if (name.endsWith(".doc")) {
    throw new Error("Formato .doc não é suportado. Converta para .docx e tente novamente.");
  }

  if (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/vnd.ms-excel" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    return extractTextFromSpreadsheet(file);
  }

  throw new Error(`Formato de arquivo não suportado: ${name}`);
}
