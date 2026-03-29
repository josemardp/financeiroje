export type SmartCaptureFileKind = "image" | "pdf" | "docx" | "doc" | "xlsx" | "xls" | "unsupported";

export type DocumentImportErrorCode =
  | "DOC_LEGACY_NOT_SUPPORTED"
  | "XLS_LEGACY_NOT_SUPPORTED"
  | "DOCX_EMPTY_CONTENT"
  | "XLSX_EMPTY_CONTENT"
  | "XLSX_MULTIPLE_TRANSACTIONS"
  | "FILE_CORRUPTED"
  | "DOCUMENT_PROCESSING_ERROR";

export class DocumentImportError extends Error {
  code: DocumentImportErrorCode;
  constructor(code: DocumentImportErrorCode, message: string) {
    super(message);
    this.name = "DocumentImportError";
    this.code = code;
  }
}

type ParsedScope = "private" | "family" | "business";

type StructuredDocumentResult = {
  text: string;
  confidence: number;
  metadata?: {
    merchantName?: string;
    totalAmount?: number;
    date?: string;
    tipo?: "income" | "expense" | null;
    categoria?: string;
    escopo?: ParsedScope;
    warnings?: string[];
    moeda?: string;
  };
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type OfficeDependencies = {
  cleanDescription: (text: string) => string;
  parseTransactionText: (text: string) => {
    valor: number | null;
    tipo: "income" | "expense" | null;
    descricao: string;
    data: string;
    categoriaSugerida: string | null;
    escopo: ParsedScope;
    confianca: "alta" | "media" | "baixa";
    warnings: string[];
  };
};

type ExplicitFields = {
  description: string | null;
  date: string | null;
  amount: number | null;
  type: "income" | "expense" | null;
  category: string | null;
  scope: ParsedScope | null;
};

const DOCX_MIME_TYPES = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;
const DOC_MIME_TYPES = ["application/msword"] as const;
const XLSX_MIME_TYPES = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] as const;
const XLS_MIME_TYPES = ["application/vnd.ms-excel"] as const;
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"] as const;

const FIELD_LABELS = {
  description: ["descricao", "descricao", "estabelecimento", "comerciante", "merchant", "historico", "hist", "descricao curta"],
  date: ["data", "dt"],
  amount: ["valor", "valor total", "total", "montante"],
  type: ["tipo", "natureza"],
  category: ["categoria"],
  scope: ["escopo"],
} as const;

const ALL_LABELS = [
  ...FIELD_LABELS.description,
  ...FIELD_LABELS.date,
  ...FIELD_LABELS.amount,
  ...FIELD_LABELS.type,
  ...FIELD_LABELS.category,
  ...FIELD_LABELS.scope,
];

const FAMILY_HINTS = /\b(familia|casa|uso familiar|despesa familia|mercado da familia)\b/i;
const BUSINESS_HINTS = /\b(mei|empresa|negocio|cnpj|fornecedor|cliente|nota fiscal|servico prestado)\b/i;

function getFileName(file: File | Blob) {
  return file instanceof File ? file.name.toLowerCase() : "";
}

export function getSmartCaptureFileKind(file: File | Blob): SmartCaptureFileKind {
  const mimeType = (file.type || "").toLowerCase();
  const fileName = getFileName(file);
  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) return "pdf";
  if (IMAGE_MIME_TYPES.includes(mimeType as any) || /\.(png|jpe?g)$/i.test(fileName)) return "image";
  if (DOCX_MIME_TYPES.includes(mimeType as any) || fileName.endsWith(".docx")) return "docx";
  if (DOC_MIME_TYPES.includes(mimeType as any) || fileName.endsWith(".doc")) return "doc";
  if (XLSX_MIME_TYPES.includes(mimeType as any) || fileName.endsWith(".xlsx")) return "xlsx";
  if (XLS_MIME_TYPES.includes(mimeType as any) || fileName.endsWith(".xls")) return "xls";
  return "unsupported";
}

export async function extractStructuredDocument(file: File, dependencies: OfficeDependencies): Promise<StructuredDocumentResult> {
  const kind = getSmartCaptureFileKind(file);
  if (kind === "doc") throw new DocumentImportError("DOC_LEGACY_NOT_SUPPORTED", "Arquivos .doc ainda nao sao suportados nesta fase.");
  if (kind === "xls") throw new DocumentImportError("XLS_LEGACY_NOT_SUPPORTED", "Arquivos .xls ainda nao sao suportados nesta fase. Use .xlsx.");
  if (kind !== "docx" && kind !== "xlsx") {
    throw new DocumentImportError("DOCUMENT_PROCESSING_ERROR", "Formato de documento nao suportado neste fluxo.");
  }
  const entries = await readZipEntries(await file.arrayBuffer());
  return kind === "docx" ? extractFromDocx(entries, dependencies) : extractFromXlsx(entries, dependencies);
}

function extractFromDocx(entries: Map<string, string>, dependencies: OfficeDependencies): StructuredDocumentResult {
  const xml = entries.get("word/document.xml");
  if (!xml) throw new DocumentImportError("FILE_CORRUPTED", "O arquivo Word parece corrompido ou incompleto.");
  const rawText = normalizeDocumentText(wordXmlToText(xml));
  if (!rawText) throw new DocumentImportError("DOCX_EMPTY_CONTENT", "O arquivo Word nao contem texto util para capturar.");
  const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);
  const collapsed = normalizeSpacing(rawText.replace(/\n/g, " "));
  const extracted = extractExplicitFields(collapsed);
  const narrativeLines = lines.filter((line) => !looksLikeLabel(line)).slice(0, 4);
  const scope = inferScope([collapsed, ...narrativeLines].join(" "), extracted.scope);
  const description = selectDescription(extracted.description, narrativeLines, dependencies.cleanDescription);
  const parserText = buildParserText({
    description,
    amount: extracted.amount,
    date: extracted.date,
    tipo: extracted.type,
    categoria: extracted.category,
    scope,
    narrativeLines,
  });
  if (!parserText) throw new DocumentImportError("DOCX_EMPTY_CONTENT", "O arquivo Word nao contem texto util para capturar.");
  return finalizeStructuredResult(parserText, extracted, scope, [], dependencies);
}

function extractFromXlsx(entries: Map<string, string>, dependencies: OfficeDependencies): StructuredDocumentResult {
  const workbookXml = entries.get("xl/workbook.xml");
  const relsXml = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) throw new DocumentImportError("FILE_CORRUPTED", "A planilha parece corrompida ou incompleta.");
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");
  const sheetTargets = parseWorkbookSheets(workbookXml, relsXml);
  if (sheetTargets.length === 0) throw new DocumentImportError("XLSX_EMPTY_CONTENT", "A planilha .xlsx nao contem abas validas para capturar.");

  const warnings: string[] = [];
  for (const target of sheetTargets) {
    const sheetXml = entries.get(target);
    if (!sheetXml) continue;
    const rows = parseSheetRows(sheetXml, sharedStrings);
    if (rows.length === 0) continue;

    const kv = detectKeyValueTransaction(rows);
    if (kv.type === "multiple") throw new DocumentImportError("XLSX_MULTIPLE_TRANSACTIONS", "Esta planilha parece conter multiplas transacoes. O Smart Capture aceita apenas uma transacao por vez neste fluxo.");
    if (kv.type === "single") {
      const scope = inferScope(buildContextText(kv.fields, []), kv.fields.scope);
      const parserText = buildParserText({
        description: kv.fields.description,
        amount: kv.fields.amount,
        date: kv.fields.date,
        tipo: kv.fields.type,
        categoria: kv.fields.category,
        scope,
        narrativeLines: [],
      });
      if (!parserText) throw new DocumentImportError("XLSX_EMPTY_CONTENT", "A planilha .xlsx nao contem uma transacao unica clara para capturar.");
      warnings.push(`Planilha lida como pares chave/valor na aba ${target.split("/").pop() || "principal"}.`);
      return finalizeStructuredResult(parserText, kv.fields, scope, warnings, dependencies);
    }

    const table = detectHeaderTableTransaction(rows);
    if (table.type === "multiple") throw new DocumentImportError("XLSX_MULTIPLE_TRANSACTIONS", "Esta planilha parece conter multiplas transacoes. O Smart Capture aceita apenas uma transacao por vez neste fluxo.");
    if (table.type === "single") {
      const scope = inferScope(buildContextText(table.fields, table.narrativeLines), table.fields.scope);
      const parserText = buildParserText({
        description: table.fields.description,
        amount: table.fields.amount,
        date: table.fields.date,
        tipo: table.fields.type,
        categoria: table.fields.category,
        scope,
        narrativeLines: table.narrativeLines,
      });
      if (!parserText) throw new DocumentImportError("XLSX_EMPTY_CONTENT", "A planilha .xlsx nao contem uma transacao unica clara para capturar.");
      warnings.push(`Planilha lida como tabela com uma unica linha util na aba ${target.split("/").pop() || "principal"}.`);
      return finalizeStructuredResult(parserText, table.fields, scope, warnings, dependencies);
    }
  }

  throw new DocumentImportError("XLSX_EMPTY_CONTENT", "A planilha .xlsx nao contem uma transacao unica clara para capturar.");
}

function finalizeStructuredResult(
  parserText: string,
  extracted: ExplicitFields,
  scope: ParsedScope | null,
  extraWarnings: string[],
  dependencies: OfficeDependencies,
): StructuredDocumentResult {
  const parsed = dependencies.parseTransactionText(parserText);
  return {
    text: parserText,
    confidence: parsed.confianca === "alta" ? 0.9 : parsed.confianca === "media" ? 0.7 : 0.4,
    metadata: {
      merchantName: extracted.description || (parsed.descricao ? dependencies.cleanDescription(parsed.descricao) : undefined),
      totalAmount: extracted.amount ?? parsed.valor ?? undefined,
      date: extracted.date || parsed.data || undefined,
      tipo: extracted.type ?? parsed.tipo,
      categoria: extracted.category || parsed.categoriaSugerida || undefined,
      escopo: scope || parsed.escopo,
      warnings: [...extraWarnings, ...parsed.warnings],
      moeda: "BRL",
    },
  };
}

function detectKeyValueTransaction(rows: string[][]): { type: "none" | "single" | "multiple"; fields: ExplicitFields } {
  const pairs = rows
    .map((row) => row.map((cell) => normalizeSpacing(cell)))
    .filter((row) => row.filter(Boolean).length >= 2)
    .filter((row) => row.filter(Boolean).length <= 3)
    .map((row) => ({ key: normalizeLabel(row[0] || ""), value: sanitizeFieldValue(row[1] || row[2] || null) }));

  const fields: ExplicitFields = { description: null, date: null, amount: null, type: null, category: null, scope: null };
  let matches = 0;
  for (const pair of pairs) {
    if (!pair.key || !pair.value) continue;
    if (isKnownLabel(pair.key, FIELD_LABELS.description)) {
      fields.description = pair.value;
      matches += 1;
      continue;
    }
    if (isKnownLabel(pair.key, FIELD_LABELS.date)) {
      fields.date = normalizeDate(pair.value);
      matches += 1;
      continue;
    }
    if (isKnownLabel(pair.key, FIELD_LABELS.amount)) {
      fields.amount = parseAmount(pair.value);
      matches += 1;
      continue;
    }
    if (isKnownLabel(pair.key, FIELD_LABELS.type)) {
      fields.type = normalizeType(pair.value);
      matches += 1;
      continue;
    }
    if (isKnownLabel(pair.key, FIELD_LABELS.category)) {
      fields.category = pair.value;
      matches += 1;
      continue;
    }
    if (isKnownLabel(pair.key, FIELD_LABELS.scope)) {
      fields.scope = normalizeScope(pair.value);
      matches += 1;
    }
  }
  if (matches >= 3 && hasSingleTransactionFields(fields)) return { type: "single", fields };
  if (pairs.length >= 4 && matches < 3) return { type: "none", fields };
  return { type: "none", fields };
}

function detectHeaderTableTransaction(rows: string[][]): { type: "none" | "single" | "multiple"; fields: ExplicitFields; narrativeLines: string[] } {
  const nonEmptyRows = rows
    .map((row) => row.map((cell) => normalizeSpacing(cell)))
    .filter((row) => row.some(Boolean));
  if (nonEmptyRows.length < 2) {
    return { type: "none", fields: emptyFields(), narrativeLines: [] };
  }

  const headerIndex = nonEmptyRows.findIndex((row) => row.some((cell) => isAnyKnownLabel(cell)));
  if (headerIndex < 0 || headerIndex === nonEmptyRows.length - 1) {
    return { type: "none", fields: emptyFields(), narrativeLines: [] };
  }

  const header = nonEmptyRows[headerIndex].map(normalizeLabel);
  const dataRows = nonEmptyRows.slice(headerIndex + 1).filter((row) => row.some(Boolean));
  const usefulRows = dataRows.filter((row) => row.some((cell, idx) => isUsefulDataCell(header[idx] || "", cell)));
  if (usefulRows.length > 1) {
    return { type: "multiple", fields: emptyFields(), narrativeLines: [] };
  }
  if (usefulRows.length === 0) {
    return { type: "none", fields: emptyFields(), narrativeLines: [] };
  }

  const row = usefulRows[0];
  const fields: ExplicitFields = { description: null, date: null, amount: null, type: null, category: null, scope: null };
  for (let i = 0; i < header.length; i += 1) {
    const label = header[i] || "";
    const value = sanitizeFieldValue(row[i] || null);
    if (!value) continue;
    if (isKnownLabel(label, FIELD_LABELS.description)) fields.description = value;
    else if (isKnownLabel(label, FIELD_LABELS.date)) fields.date = normalizeDate(value);
    else if (isKnownLabel(label, FIELD_LABELS.amount)) fields.amount = parseAmount(value);
    else if (isKnownLabel(label, FIELD_LABELS.type)) fields.type = normalizeType(value);
    else if (isKnownLabel(label, FIELD_LABELS.category)) fields.category = value;
    else if (isKnownLabel(label, FIELD_LABELS.scope)) fields.scope = normalizeScope(value);
  }

  if (!hasSingleTransactionFields(fields)) {
    return { type: "none", fields, narrativeLines: row.filter(Boolean).slice(0, 2) };
  }
  return { type: "single", fields, narrativeLines: row.filter(Boolean).slice(0, 2) };
}

function buildContextText(fields: ExplicitFields, lines: string[]) {
  return [fields.description, fields.category, fields.scope, ...lines].filter(Boolean).join(" ");
}

function hasSingleTransactionFields(fields: ExplicitFields) {
  return Boolean(fields.description || fields.amount !== null || fields.date || fields.type || fields.category || fields.scope);
}

function emptyFields(): ExplicitFields {
  return { description: null, date: null, amount: null, type: null, category: null, scope: null };
}

function isUsefulDataCell(label: string, value: string) {
  if (!value) return false;
  return isAnyKnownLabel(label) || parseAmount(value) !== null || normalizeDate(value) !== null || normalizeType(value) !== null;
}

function isAnyKnownLabel(value: string) {
  const label = normalizeLabel(value);
  return ALL_LABELS.some((item) => normalizeLabel(item) === label);
}

function isKnownLabel(value: string, labels: readonly string[]) {
  const label = normalizeLabel(value);
  return labels.some((item) => normalizeLabel(item) === label);
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractExplicitFields(text: string): ExplicitFields {
  return {
    description: sanitizeFieldValue(extractLabeledValue(text, FIELD_LABELS.description)),
    date: normalizeDate(extractLabeledValue(text, FIELD_LABELS.date)),
    amount: parseAmount(extractLabeledValue(text, FIELD_LABELS.amount)),
    type: normalizeType(extractLabeledValue(text, FIELD_LABELS.type)),
    category: sanitizeFieldValue(extractLabeledValue(text, FIELD_LABELS.category)),
    scope: normalizeScope(extractLabeledValue(text, FIELD_LABELS.scope)),
  };
}

function extractLabeledValue(text: string, labels: readonly string[]) {
  const labelPattern = labels.map(escapeRegExp).join("|");
  const stopPattern = ALL_LABELS.map(escapeRegExp).join("|");
  const regex = new RegExp(`(?:^|\\b)(?:${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=(?:\\b(?:${stopPattern})\\s*:)|$)`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() || null;
}

function buildParserText(data: {
  description: string | null;
  amount: number | null;
  date: string | null;
  tipo: "income" | "expense" | null;
  categoria: string | null;
  scope: ParsedScope | null;
  narrativeLines: string[];
}) {
  const lines = [
    data.date ? `Data: ${data.date}` : null,
    data.description ? `Descricao: ${data.description}` : null,
    data.amount !== null ? `Valor: ${formatCurrencyBRL(data.amount)}` : null,
    data.tipo ? `Tipo: ${data.tipo === "expense" ? "Despesa" : "Receita"}` : null,
    data.categoria ? `Categoria: ${data.categoria}` : null,
    data.scope ? `Escopo: ${data.scope === "family" ? "Familia" : data.scope === "business" ? "Negocio" : "Pessoal"}` : null,
    ...data.narrativeLines.filter(Boolean).slice(0, 2),
  ].filter(Boolean) as string[];
  return lines.join("\n").trim();
}

function selectDescription(labeledDescription: string | null, narrativeLines: string[], cleanDescription: (text: string) => string) {
  const candidates = [labeledDescription, ...narrativeLines];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = cleanDescription((sanitizeFieldValue(candidate) || "").replace(/\s+/g, " ").trim()).trim();
    if (cleaned && cleaned.length >= 3 && !looksLikeLabel(cleaned)) return cleaned.slice(0, 80);
  }
  return null;
}

function inferScope(text: string, explicitScope: ParsedScope | null): ParsedScope | null {
  if (explicitScope) return explicitScope;
  if (BUSINESS_HINTS.test(text)) return "business";
  if (FAMILY_HINTS.test(text)) return "family";
  return null;
}

function sanitizeFieldValue(value: string | null) {
  if (!value) return null;
  const sanitized = normalizeSpacing(value.replace(/\s+/g, " "));
  return sanitized || null;
}

function normalizeScope(value: string | null): ParsedScope | null {
  if (!value) return null;
  const text = normalizeLabel(value);
  if (/\b(familia|casa|uso familiar)\b/.test(text)) return "family";
  if (/\b(mei|empresa|negocio|business|cnpj)\b/.test(text)) return "business";
  if (/\b(private|pessoal|particular)\b/.test(text)) return "private";
  return null;
}

function normalizeType(value: string | null) {
  if (!value) return null;
  const text = normalizeLabel(value);
  if (/\b(receita|income|entrada|credito|recebimento)\b/.test(text)) return "income";
  if (/\b(despesa|expense|saida|debito|pagamento|compra)\b/.test(text)) return "expense";
  return null;
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  const text = normalizeSpacing(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const br = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (br) {
    const day = br[1].padStart(2, "0");
    const month = br[2].padStart(2, "0");
    const rawYear = br[3] || `${new Date().getFullYear()}`;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (numeric > 20000 && numeric < 60000) return excelSerialToDate(numeric);
  }
  return null;
}

function excelSerialToDate(serial: number) {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

function parseAmount(value: string | null) {
  if (!value) return null;
  const match = value.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}|\d+)/i);
  if (!match) return null;
  const raw = match[1];
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrencyBRL(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function looksLikeLabel(text: string) {
  return ALL_LABELS.some((label) => normalizeLabel(label) === normalizeLabel(text.replace(/:\s*$/, "")));
}

function normalizeDocumentText(text: string) {
  return decodeXmlEntities(text).replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeSpacing(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function wordXmlToText(xml: string) {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:t>\s*<w:t[^>]*>/g, " ")
    .replace(/<[^>]+>/g, "");
}

function parseWorkbookSheets(workbookXml: string, relsXml: string): string[] {
  const rels = new Map<string, string>();

  const relTagRegex = /<Relationship\b([^>]*)\/?>/g;
  let relTagMatch: RegExpExecArray | null;

  while ((relTagMatch = relTagRegex.exec(relsXml)) !== null) {
    const attrs = relTagMatch[1] || "";
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    let target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];

    if (!id || !target) continue;

    if (target.startsWith("/")) target = target.slice(1);
    if (!target.startsWith("xl/")) target = `xl/${target}`;

    rels.set(id, target);
  }

  const sheets: string[] = [];
  const sheetRegex = /<sheet[^>]+r:id="([^"]+)"[^>]*\/?>/g;
  let sheetMatch: RegExpExecArray | null;

  while ((sheetMatch = sheetRegex.exec(workbookXml)) !== null) {
    const target = rels.get(sheetMatch[1]);
    if (target) sheets.push(target);
  }

  return sheets;
}

function parseSharedStrings(xml: string) {
  if (!xml) return [] as string[];
  const items = xml.match(/<si[\s\S]*?<\/si>/g) || [];
  return items.map((item) => decodeXmlEntities(item.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim());
}

function parseSheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowCells = new Map<number, string>();
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1] || "";
      const body = cellMatch[2] || "";
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1] || "A";
      const index = columnRefToIndex(ref);
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] || "";
      let value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] || "";
      if (type === "s") value = sharedStrings[Number(value)] || "";
      else value = decodeXmlEntities(value);
      rowCells.set(index, normalizeSpacing(value));
    }
    if (rowCells.size > 0) {
      const maxIndex = Math.max(...rowCells.keys());
      const row = Array.from({ length: maxIndex + 1 }, (_, idx) => rowCells.get(idx) || "");
      rows.push(row);
    }
  }
  return rows;
}

function columnRefToIndex(ref: string) {
  let index = 0;
  for (const char of ref) index = index * 26 + (char.charCodeAt(0) - 64);
  return Math.max(index - 1, 0);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/gi, "\n");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readZipEntries(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const totalEntries = readUInt16LE(bytes, eocdOffset + 10);
  const centralDirectoryOffset = readUInt32LE(bytes, eocdOffset + 16);
  const entries = new Map<string, string>();
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (readUInt32LE(bytes, offset) !== 0x02014b50) throw new DocumentImportError("FILE_CORRUPTED", "Arquivo compactado invalido.");
    const compressionMethod = readUInt16LE(bytes, offset + 10);
    const compressedSize = readUInt32LE(bytes, offset + 20);
    const uncompressedSize = readUInt32LE(bytes, offset + 24);
    const fileNameLength = readUInt16LE(bytes, offset + 28);
    const extraLength = readUInt16LE(bytes, offset + 30);
    const commentLength = readUInt16LE(bytes, offset + 32);
    const localHeaderOffset = readUInt32LE(bytes, offset + 42);
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    const content = await extractZipEntry(bytes, { name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    if (content !== null) entries.set(name, content);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function extractZipEntry(bytes: Uint8Array, entry: ZipEntry) {
  if (entry.name.endsWith("/")) return null;
  const localOffset = entry.localHeaderOffset;
  if (readUInt32LE(bytes, localOffset) !== 0x04034b50) throw new DocumentImportError("FILE_CORRUPTED", "Cabecalho local ZIP invalido.");
  const fileNameLength = readUInt16LE(bytes, localOffset + 26);
  const extraLength = readUInt16LE(bytes, localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
  let contentBytes: Uint8Array;
  if (entry.compressionMethod === 0) contentBytes = compressed;
  else if (entry.compressionMethod === 8) contentBytes = await inflateRaw(compressed);
  else throw new DocumentImportError("DOCUMENT_PROCESSING_ERROR", "Metodo de compressao do documento nao suportado.");
  if (entry.uncompressedSize && contentBytes.length !== entry.uncompressedSize) {
    throw new DocumentImportError("FILE_CORRUPTED", "Conteudo do documento esta inconsistente.");
  }
  return new TextDecoder().decode(contentBytes);
}

async function inflateRaw(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new DocumentImportError("DOCUMENT_PROCESSING_ERROR", "Leitura direta do documento nao suportada neste navegador.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32LE(bytes, offset) === 0x06054b50) return offset;
  }
  throw new DocumentImportError("FILE_CORRUPTED", "Estrutura ZIP invalida.");
}

function readUInt16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32LE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}
