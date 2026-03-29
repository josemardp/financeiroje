
export type SmartCaptureFileKind = "image" | "pdf" | "docx" | "doc" | "unsupported";

export type DocumentImportErrorCode =
  | "DOC_LEGACY_NOT_SUPPORTED"
  | "DOCX_EMPTY_CONTENT"
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

const DOCX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
const DOC_MIME_TYPES = ["application/msword"] as const;
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"] as const;

const FIELD_LABELS = {
  description: ["descricao", "descri\u00e7\u00e3o", "estabelecimento", "comerciante", "merchant"],
  date: ["data", "dt"],
  amount: ["valor", "valor total", "total"],
  type: ["tipo", "natureza"],
  category: ["categoria"],
  scope: ["escopo"],
  observation: ["observacao", "observa\u00e7\u00e3o", "obs"],
} as const;

const ALL_LABELS = [
  ...FIELD_LABELS.description,
  ...FIELD_LABELS.date,
  ...FIELD_LABELS.amount,
  ...FIELD_LABELS.type,
  ...FIELD_LABELS.category,
  ...FIELD_LABELS.scope,
  ...FIELD_LABELS.observation,
];

const TEST_NOISE_PATTERNS = [
  /\bteste smart capture\b/i,
  /\barquivo simples\b/i,
  /\bvalidar extracao\b/i,
  /\bvalidar extra\u00e7\u00e3o\b/i,
  /\buma unica transacao\b/i,
  /\buma unica transa\u00e7\u00e3o\b/i,
  /\bconsidere apenas esta transacao(?: neste arquivo)?\b/i,
  /\bconsidere apenas esta transa\u00e7\u00e3o(?: neste arquivo)?\b/i,
  /\bcriado apenas(?: para)? teste(?: de)? fluxo(?: de)? captura inteligente\b/i,
];

const FAMILY_HINTS =
  /\b(familia|fam\u00edlia|casa|compras casa|mercado da familia|mercado da fam\u00edlia|uso familiar|despesa familia|despesa fam\u00edlia)\b/i;
const BUSINESS_HINTS =
  /\b(mei|empresa|negocio|neg\u00f3cio|cnpj|fornecedor|cliente|servico prestado|servi\u00e7o prestado|nota fiscal)\b/i;

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

  return "unsupported";
}

export async function extractStructuredDocument(
  file: File,
  dependencies: {
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
  },
): Promise<StructuredDocumentResult> {
  const kind = getSmartCaptureFileKind(file);

  if (kind === "doc") {
    throw new DocumentImportError("DOC_LEGACY_NOT_SUPPORTED", "Arquivos .doc ainda nao sao suportados nesta fase.");
  }

  if (kind !== "docx") {
    throw new DocumentImportError("DOCUMENT_PROCESSING_ERROR", "Formato de documento nao suportado neste fluxo.");
  }

  const xml = (await readZipEntries(await file.arrayBuffer())).get("word/document.xml");
  if (!xml) {
    throw new DocumentImportError("FILE_CORRUPTED", "O arquivo Word parece corrompido ou incompleto.");
  }

  const rawText = normalizeDocumentText(wordXmlToText(xml));
  if (!rawText) {
    throw new DocumentImportError("DOCX_EMPTY_CONTENT", "O arquivo Word nao contem texto util para capturar.");
  }

  const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);
  const collapsedText = normalizeSpacing(rawText.replace(/\n/g, " "));
  const extracted = extractExplicitFields(collapsedText);
  const reduced = reduceDocumentNoise(lines, extracted);
  const scope = inferScope(reduced.contextText, extracted.scope);
  const description = selectDescription(extracted.description, reduced.narrativeLines, dependencies.cleanDescription);
  const parserText = buildParserText({
    description,
    amount: extracted.amount,
    date: extracted.date,
    tipo: extracted.type,
    categoria: extracted.category,
    scope,
    narrativeLines: reduced.narrativeLines,
  });

  if (!parserText) {
    throw new DocumentImportError("DOCX_EMPTY_CONTENT", "O arquivo Word nao contem texto util para capturar.");
  }

  const parsed = dependencies.parseTransactionText(parserText);
  const warnings = [
    ...(reduced.removedNoise ? ["Texto do DOCX resumido para reduzir ruido e instrucoes artificiais."] : []),
    ...(reduced.removedObservation ? ["Observacoes do documento foram desconsideradas para evitar poluicao."] : []),
    ...parsed.warnings,
  ];

  return {
    text: parserText,
    confidence: parsed.confianca === "alta" ? 0.9 : parsed.confianca === "media" ? 0.7 : 0.4,
    metadata: {
      merchantName:
        description || (parsed.descricao ? dependencies.cleanDescription(parsed.descricao) : undefined),
      totalAmount: extracted.amount ?? parsed.valor ?? undefined,
      date: extracted.date || parsed.data || undefined,
      tipo: extracted.type ?? parsed.tipo,
      categoria: extracted.category || parsed.categoriaSugerida || undefined,
      escopo: scope || parsed.escopo,
      warnings,
      moeda: "BRL",
    },
  };
}

function extractExplicitFields(text: string) {
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
  const regex = new RegExp(
    `(?:^|\\b)(?:${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=(?:\\b(?:${stopPattern})\\s*:)|$)`,
    "i",
  );
  const match = text.match(regex);
  return match?.[1]?.trim() || null;
}

function reduceDocumentNoise(
  lines: string[],
  extracted: {
    description: string | null;
    date: string | null;
    amount: number | null;
    type: "income" | "expense" | null;
    category: string | null;
    scope: ParsedScope | null;
  },
) {
  let removedNoise = false;
  let removedObservation = false;

  const narrativeLines = lines
    .map((line) => stripKnownLabelPrefix(line))
    .map((line) => normalizeSpacing(line))
    .filter(Boolean)
    .filter((line) => {
      if (TEST_NOISE_PATTERNS.some((pattern) => pattern.test(line))) {
        removedNoise = true;
        return false;
      }

      if (/^observacao\b/i.test(line) || /^observa\u00e7\u00e3o\b/i.test(line)) {
        removedObservation = true;
        return false;
      }

      if (/^criado apenas\b/i.test(line) || /^considere apenas\b/i.test(line)) {
        removedNoise = true;
        return false;
      }

      if (looksLikeLabel(line)) {
        removedNoise = true;
        return false;
      }

      return line.length >= 3;
    })
    .slice(0, 4);

  const contextParts = [
    extracted.description,
    extracted.category,
    extracted.scope === "family" ? "familia" : extracted.scope === "business" ? "negocio" : null,
    ...narrativeLines,
  ].filter(Boolean) as string[];

  return {
    narrativeLines,
    contextText: contextParts.join(" "),
    removedNoise,
    removedObservation,
  };
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
    data.scope
      ? `Escopo: ${data.scope === "family" ? "Familia" : data.scope === "business" ? "Negocio" : "Pessoal"}`
      : null,
  ].filter(Boolean) as string[];

  const fallbackLines = data.narrativeLines.filter((line) => !looksLikePureNoise(line)).slice(0, 2);
  return (lines.length > 0 ? [...lines, ...fallbackLines] : fallbackLines).join("\n").trim();
}

function selectDescription(
  labeledDescription: string | null,
  narrativeLines: string[],
  cleanDescription: (text: string) => string,
) {
  const candidates = [
    labeledDescription,
    ...narrativeLines.filter((line) => !looksLikeInstruction(line) && !looksLikeLabel(line)),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = sanitizeDescription(candidate, cleanDescription);
    if (cleaned) return cleaned;
  }

  return null;
}

function sanitizeDescription(text: string, cleanDescription: (text: string) => string) {
  const cleaned = cleanDescription(
    (sanitizeFieldValue(text) || "")
      .replace(/\b(arquivo|teste|captura inteligente|validar extracao)\b/gi, "")
      .replace(/\b(uma unica transacao)\b/gi, "")
      .replace(/\b(uma unica transa\u00e7\u00e3o)\b/gi, "")
      .replace(/\b(observacao|observa\u00e7\u00e3o)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 3) return null;
  if (looksLikeInstruction(cleaned)) return null;
  return cleaned.slice(0, 80).trim();
}

function sanitizeFieldValue(value: string | null) {
  if (!value) return null;

  const sanitized = normalizeSpacing(
    value
      .replace(/\b(considere apenas esta transacao(?: neste arquivo)?)\b/gi, "")
      .replace(/\b(considere apenas esta transa\u00e7\u00e3o(?: neste arquivo)?)\b/gi, "")
      .replace(/\b(criado apenas(?: para)? teste(?: de)? fluxo(?: de)? captura inteligente)\b/gi, "")
      .replace(/\b(teste smart capture|arquivo simples|validar extracao|validar extra\u00e7\u00e3o)\b/gi, "")
      .replace(/\b(uma unica transacao|uma unica transa\u00e7\u00e3o)\b/gi, "")
      .replace(/\b(observacao|observa\u00e7\u00e3o)\s*:/gi, "")
      .replace(/\s+/g, " "),
  );

  return sanitized || null;
}

function inferScope(text: string, explicitScope: ParsedScope | null): ParsedScope | null {
  if (explicitScope) return explicitScope;
  if (BUSINESS_HINTS.test(text)) return "business";
  if (FAMILY_HINTS.test(text)) return "family";
  return null;
}

function normalizeScope(value: string | null): ParsedScope | null {
  if (!value) return null;
  const text = normalizeSpacing(value).toLowerCase();

  if (/\b(familia|fam\u00edlia|casa|compras casa|uso familiar|despesa familia|despesa fam\u00edlia)\b/.test(text)) {
    return "family";
  }
  if (/\b(mei|empresa|negocio|neg\u00f3cio|business|cnpj)\b/.test(text)) {
    return "business";
  }
  if (/\b(private|pessoal|particular)\b/.test(text)) {
    return "private";
  }

  return null;
}

function normalizeType(value: string | null) {
  if (!value) return null;
  const text = normalizeSpacing(value).toLowerCase();

  if (/\b(receita|income|entrada|credito|cr\u00e9dito|recebimento)\b/.test(text)) return "income";
  if (/\b(despesa|expense|saida|sa\u00edda|debito|d\u00e9bito|pagamento|compra)\b/.test(text)) return "expense";

  return null;
}

function normalizeDate(value: string | null) {
  if (!value) return null;

  const text = normalizeSpacing(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const brMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (!brMatch) return null;

  const day = brMatch[1].padStart(2, "0");
  const month = brMatch[2].padStart(2, "0");
  const rawYear = brMatch[3] || `${new Date().getFullYear()}`;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;

  return `${year}-${month}-${day}`;
}

function parseAmount(value: string | null) {
  if (!value) return null;

  const match = value.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/i);
  if (!match) return null;

  const normalized = match[1].includes(",")
    ? match[1].replace(/\./g, "").replace(",", ".")
    : match[1];

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrencyBRL(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function stripKnownLabelPrefix(line: string) {
  return line
    .replace(/^(descricao|descri\u00e7\u00e3o|data|valor|tipo|categoria|escopo|observacao|observa\u00e7\u00e3o)\s*:\s*/i, "")
    .trim();
}

function looksLikeInstruction(text: string) {
  return TEST_NOISE_PATTERNS.some((pattern) => pattern.test(text)) || /^criado apenas\b/i.test(text);
}

function looksLikeLabel(text: string) {
  return /^(descricao|descri\u00e7\u00e3o|data|valor|tipo|categoria|escopo|observacao|observa\u00e7\u00e3o)\s*:?\s*$/i.test(
    text,
  );
}

function looksLikePureNoise(text: string) {
  return looksLikeInstruction(text) || /^considere apenas\b/i.test(text);
}

function normalizeDocumentText(text: string) {
  return decodeXmlEntities(text)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
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
    if (readUInt32LE(bytes, offset) !== 0x02014b50) {
      throw new DocumentImportError("FILE_CORRUPTED", "Arquivo compactado invalido.");
    }

    const compressionMethod = readUInt16LE(bytes, offset + 10);
    const compressedSize = readUInt32LE(bytes, offset + 20);
    const uncompressedSize = readUInt32LE(bytes, offset + 24);
    const fileNameLength = readUInt16LE(bytes, offset + 28);
    const extraLength = readUInt16LE(bytes, offset + 30);
    const commentLength = readUInt16LE(bytes, offset + 32);
    const localHeaderOffset = readUInt32LE(bytes, offset + 42);

    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    const content = await extractZipEntry(bytes, {
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    if (content !== null) entries.set(name, content);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function extractZipEntry(bytes: Uint8Array, entry: ZipEntry) {
  if (entry.name.endsWith("/")) return null;

  const localOffset = entry.localHeaderOffset;
  if (readUInt32LE(bytes, localOffset) !== 0x04034b50) {
    throw new DocumentImportError("FILE_CORRUPTED", "Cabecalho local ZIP invalido.");
  }

  const fileNameLength = readUInt16LE(bytes, localOffset + 26);
  const extraLength = readUInt16LE(bytes, localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);

  let contentBytes: Uint8Array;
  if (entry.compressionMethod === 0) {
    contentBytes = compressed;
  } else if (entry.compressionMethod === 8) {
    contentBytes = await inflateRaw(compressed);
  } else {
    throw new DocumentImportError("DOCUMENT_PROCESSING_ERROR", "Metodo de compressao do documento nao suportado.");
  }

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
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0;
}
