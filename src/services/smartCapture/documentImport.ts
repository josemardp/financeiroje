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

type ParsedMetadata = {
  merchantName?: string;
  totalAmount?: number;
  date?: string;
  tipo?: "income" | "expense" | null;
  categoria?: string;
  escopo?: "private" | "family" | "business";
  warnings?: string[];
  moeda?: string;
};

type StructuredDocumentResult = {
  text: string;
  confidence: number;
  metadata?: ParsedMetadata;
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"] as const;
const DOCX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
const DOC_MIME_TYPES = ["application/msword"] as const;

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
      escopo: "private" | "family" | "business";
      confianca: "alta" | "media" | "baixa";
      warnings: string[];
    };
  },
): Promise<StructuredDocumentResult> {
  const kind = getSmartCaptureFileKind(file);

  if (kind === "doc") {
    throw new DocumentImportError("DOC_LEGACY_NOT_SUPPORTED", "Arquivos .doc ainda não suportados nesta fase.");
  }

  if (kind !== "docx") {
    throw new DocumentImportError("DOCUMENT_PROCESSING_ERROR", "Formato de documento não suportado neste fluxo.");
  }

  const entries = await readZipEntries(await file.arrayBuffer());
  const documentXml = entries.get("word/document.xml");

  if (!documentXml) {
    throw new DocumentImportError("FILE_CORRUPTED", "O arquivo Word parece corrompido ou incompleto.");
  }

  const rawText = wordXmlToText(documentXml);
  const sanitized = sanitizeDocumentText(rawText);

  if (!sanitized.text) {
    throw new DocumentImportError("DOCX_EMPTY_CONTENT", "O arquivo Word não contém texto útil para capturar.");
  }

  const parsed = dependencies.parseTransactionText(sanitized.text);

  return {
    text: sanitized.text,
    confidence: confidenceToNumber(parsed.confianca),
    metadata: {
      merchantName: parsed.descricao ? dependencies.cleanDescription(parsed.descricao) : undefined,
      totalAmount: parsed.valor ?? undefined,
      date: parsed.data || undefined,
      tipo: parsed.tipo,
      categoria: parsed.categoriaSugerida || undefined,
      escopo: parsed.escopo,
      warnings: [...sanitized.warnings, ...parsed.warnings],
      moeda: "BRL",
    },
  };
}

function confidenceToNumber(value: "alta" | "media" | "baixa") {
  if (value === "alta") return 0.9;
  if (value === "media") return 0.7;
  return 0.4;
}

function sanitizeDocumentText(text: string) {
  const warnings: string[] = [];
  const normalized = decodeXmlEntities(text)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const originalLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const filteredLines = originalLines.filter((line) => {
    const lower = normalizeKey(line);
    if (!lower) return false;
    if (/^(pagina|página)\s+\d+/.test(lower)) return false;
    if (/^(observacoes|observações|assinatura|assinaturas|documento|anexo)$/.test(lower)) return false;
    if (/^emitido em\b/.test(lower)) return false;
    if (/^assinado digitalmente\b/.test(lower)) return false;
    return true;
  });

  if (filteredLines.length < originalLines.length) {
    warnings.push("Texto do documento higienizado para remover ruídos.");
  }

  if (filteredLines.length > 12) {
    warnings.push("Documento com bastante conteúdo adicional; revise os campos no Modo Espelho.");
  }

  return {
    text: filteredLines.join("\n").trim(),
    warnings,
  };
}

function normalizeKey(value: string) {
  return decodeXmlEntities(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function wordXmlToText(xml: string) {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/</w:p>/g, "\n")
    .replace(/</w:tr>/g, "\n")
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

async function readZipEntries(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const totalEntries = readUInt16LE(bytes, eocdOffset + 10);
  const centralDirectoryOffset = readUInt32LE(bytes, eocdOffset + 16);
  const entries = new Map<string, string>();

  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (readUInt32LE(bytes, offset) !== 0x02014b50) {
      throw new DocumentImportError("FILE_CORRUPTED", "Arquivo compactado inválido.");
    }

    const compressionMethod = readUInt16LE(bytes, offset + 10);
    const compressedSize = readUInt32LE(bytes, offset + 20);
    const uncompressedSize = readUInt32LE(bytes, offset + 24);
    const fileNameLength = readUInt16LE(bytes, offset + 28);
    const extraLength = readUInt16LE(bytes, offset + 30);
    const commentLength = readUInt16LE(bytes, offset + 32);
    const localHeaderOffset = readUInt32LE(bytes, offset + 42);

    const fileNameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const name = new TextDecoder().decode(fileNameBytes);

    const entry: ZipEntry = {
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    };

    const content = await extractZipEntry(bytes, entry);
    if (content !== null) {
      entries.set(name, content);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function extractZipEntry(bytes: Uint8Array, entry: ZipEntry) {
  if (entry.name.endsWith("/")) return null;

  const localOffset = entry.localHeaderOffset;
  if (readUInt32LE(bytes, localOffset) !== 0x04034b50) {
    throw new DocumentImportError("FILE_CORRUPTED", "Cabeçalho local ZIP inálido.");
  }

  const fileNameLength = readUInt16LE(bytes, localOffset + 26);
  const extraLength = readUInt16LE(bytes, localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressed = bytes.slice(dataStart, dataEnd);

  let contentBytes: Uint8Array;
  if (entry.compressionMethod === 0) {
    contentBytes = compressed;
  } else if (entry.compressionMethod === 8) {
    contentBytes = await inflateRaw(compressed);
  } else {
    throw new DocumentImportError("DOCUMENT_PROCESSING_ERROR", "Método de compressão do documento não suportado.");
  }

  if (entry.uncompressedSize && contentBytes.length !== entry.uncompressedSize) {
    throw new DocumentImportError("FILE_CORRUPTED", "Conteúdo do documento está inconsistente.");
  }

  return new TextDecoder().decode(contentBytes);
}

async function inflateRaw(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new DocumentImportError("DOCUMENT_PROCESSING_ERROR", "Leitura direta do documento não suportada neste navegador.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const decompressedBuffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressedBuffer);
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32LE(bytes, offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new DocumentImportError("FILE_CORRUPTED", "Estrutura ZIP inválida.");
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
