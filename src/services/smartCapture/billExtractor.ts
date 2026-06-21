export interface PhoneBillData {
  totalAmount: number | null;
  dueDate: string | null;
  carrier: string;
  phoneLines: string[];
  referencePeriod: string | null;
  confidence: "alta" | "media" | "baixa";
  evidence: string[];
}

const CURRENCY_RE = /R\$\s*(\d{1,4}(?:[.,]\d{3})*[.,]\d{2})/gi;

function parseBRL(raw: string): number {
  // "1.234,56" → 1234.56  |  "1234.56" → 1234.56
  const clean = raw.replace(/\./g, "").replace(",", ".");
  return parseFloat(clean);
}

function linesAround(lines: string[], idx: number, n = 3): string {
  return lines.slice(Math.max(0, idx - 1), Math.min(lines.length, idx + n + 1)).join(" ");
}

function extractTotalAmount(lines: string[]): { value: number | null; evidence: string | null } {
  const PRIORITY_LABELS = [
    "total a pagar", "total do documento", "valor do documento", "total da fatura",
  ];
  const SECONDARY_LABELS = ["valor total", "total"];

  // 1. Busca pelos labels de maior prioridade
  for (const label of PRIORITY_LABELS) {
    const idx = lines.findIndex((l) => l.toLowerCase().includes(label));
    if (idx === -1) continue;
    const context = linesAround(lines, idx, 3);
    const matches = [...context.matchAll(CURRENCY_RE)];
    if (matches.length) {
      const value = parseBRL(matches[0][1]);
      if (value > 0) return { value, evidence: `'${context.trim().slice(0, 80)}' → totalAmount` };
    }
  }

  // 2. Label secundário nas últimas 30 linhas
  const tail = lines.slice(-30);
  for (const label of SECONDARY_LABELS) {
    const idx = tail.findIndex((l) => l.toLowerCase().includes(label));
    if (idx === -1) continue;
    const context = linesAround(tail, idx, 3);
    const matches = [...context.matchAll(CURRENCY_RE)];
    if (matches.length) {
      const value = parseBRL(matches[0][1]);
      if (value > 0) return { value, evidence: `'${context.trim().slice(0, 80)}' → totalAmount (tail)` };
    }
  }

  // 3. Fallback: maior R$ no documento
  const all = [...lines.join(" ").matchAll(CURRENCY_RE)];
  if (all.length) {
    const max = all.reduce((a, b) => (parseBRL(a[1]) >= parseBRL(b[1]) ? a : b));
    const value = parseBRL(max[1]);
    if (value > 0) return { value, evidence: `Maior valor encontrado no documento: R$ ${max[1]} → totalAmount (fallback)` };
  }

  return { value: null, evidence: null };
}

function extractDueDate(lines: string[]): { value: string | null; evidence: string | null } {
  const DATE_LABELS = ["data de vencimento", "vencimento"];
  const DATE_RE = /(\d{2})\/(\d{2})\/(\d{2,4})/;

  for (const label of DATE_LABELS) {
    const idx = lines.findIndex((l) => l.toLowerCase().includes(label));
    if (idx === -1) continue;
    const context = linesAround(lines, idx, 3);
    const m = context.match(DATE_RE);
    if (m) {
      const [, dd, mm, yy] = m;
      const year = yy.length === 2 ? `20${yy}` : yy;
      const iso = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      return { value: iso, evidence: `'${context.trim().slice(0, 80)}' → dueDate` };
    }
  }
  return { value: null, evidence: null };
}

function extractPhoneLines(text: string): string[] {
  const re = /\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g;
  const found = new Set<string>();
  for (const m of text.matchAll(re)) {
    found.add(m[0].replace(/\s/g, ""));
    if (found.size >= 3) break;
  }
  return Array.from(found);
}

function extractReferencePeriod(lines: string[]): { value: string | null; evidence: string | null } {
  const LABELS = ["referente a", "periodo", "ciclo", "competencia"];
  const PERIOD_RE = /(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[\s/\\-]*\d{4}|\d{2}\/\d{4}/i;

  for (const label of LABELS) {
    const idx = lines.findIndex((l) => l.toLowerCase().includes(label));
    if (idx === -1) continue;
    const context = linesAround(lines, idx, 3);
    const m = context.match(PERIOD_RE);
    if (m) return { value: m[0].trim(), evidence: `'${context.trim().slice(0, 80)}' → referencePeriod` };
  }
  return { value: null, evidence: null };
}

export function extractPhoneBillData(text: string, carrier: string): PhoneBillData {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const evidence: string[] = [];

  const { value: totalAmount, evidence: evAmount } = extractTotalAmount(lines);
  if (evAmount) evidence.push(evAmount);

  const { value: dueDate, evidence: evDate } = extractDueDate(lines);
  if (evDate) evidence.push(evDate);

  const phoneLines = extractPhoneLines(text);
  if (phoneLines.length) evidence.push(`Linhas encontradas: ${phoneLines.join(", ")}`);

  const { value: referencePeriod, evidence: evPeriod } = extractReferencePeriod(lines);
  if (evPeriod) evidence.push(evPeriod);

  const confidence: PhoneBillData["confidence"] =
    totalAmount !== null && dueDate !== null ? "alta"
    : totalAmount !== null || dueDate !== null ? "media"
    : "baixa";

  return { totalAmount, dueDate, carrier, phoneLines, referencePeriod, confidence, evidence };
}
