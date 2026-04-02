export const OCR_SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const OCR_BLOCKED_IMAGE_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
] as const;

const OCR_SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
] as const;

const OCR_BLOCKED_IMAGE_EXTENSIONS = [
  ".heic",
  ".heif",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg",
] as const;

const KNOWN_IMAGE_EXTENSIONS = new Set<string>([
  ...OCR_SUPPORTED_IMAGE_EXTENSIONS,
  ...OCR_BLOCKED_IMAGE_EXTENSIONS,
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".svg": "image/svg+xml",
};

export const OCR_IMAGE_FILE_ACCEPT = [
  ...OCR_SUPPORTED_IMAGE_MIME_TYPES,
  ...OCR_SUPPORTED_IMAGE_EXTENSIONS,
].join(",");

export type OcrSupportedMimeType = (typeof OCR_SUPPORTED_IMAGE_MIME_TYPES)[number];

export interface OcrImageValidationResult {
  ok: boolean;
  code: "supported" | "unsupported_format" | "blocked_format";
  declaredMimeType: string | null;
  inferredMimeType: string | null;
  normalizedMimeType: OcrSupportedMimeType | null;
  extension: string | null;
  reason: string;
}

function normalizeMimeType(mimeType?: string | null): string | null {
  if (!mimeType) return null;
  return mimeType.trim().toLowerCase() || null;
}

function extractExtension(fileName?: string | null): string | null {
  if (!fileName) return null;
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] ?? null;
}

function normalizeSupportedMimeType(mimeType: string): OcrSupportedMimeType | null {
  if (mimeType === "image/jpg") return "image/jpeg";
  return OCR_SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as OcrSupportedMimeType)
    ? (mimeType as OcrSupportedMimeType)
    : null;
}

function formatMimeLabel(mimeType: string | null, extension: string | null): string {
  if (extension) return extension.replace(".", "").toUpperCase();
  if (!mimeType) return "desconhecido";
  const [, subtype = mimeType] = mimeType.split("/");
  return subtype.replace("+xml", "").toUpperCase();
}

export function getSupportedOcrImageFormatsLabel() {
  return "JPG, JPEG, PNG, WEBP e GIF";
}

export function looksLikeImageFile(file: Pick<File, "name" | "type">) {
  const mimeType = normalizeMimeType(file.type);
  const extension = extractExtension(file.name);

  return Boolean(
    (mimeType && mimeType.startsWith("image/")) ||
      (extension && KNOWN_IMAGE_EXTENSIONS.has(extension))
  );
}

export function validateOcrImageFile(
  file: Pick<File, "name" | "type">
): OcrImageValidationResult {
  const declaredMimeType = normalizeMimeType(file.type);
  const extension = extractExtension(file.name);
  const inferredMimeType = extension ? MIME_BY_EXTENSION[extension] ?? null : null;

  const blockedMimeType =
    (declaredMimeType &&
      OCR_BLOCKED_IMAGE_MIME_TYPES.includes(
        declaredMimeType as (typeof OCR_BLOCKED_IMAGE_MIME_TYPES)[number]
      ) &&
      declaredMimeType) ||
    (inferredMimeType &&
      OCR_BLOCKED_IMAGE_MIME_TYPES.includes(
        inferredMimeType as (typeof OCR_BLOCKED_IMAGE_MIME_TYPES)[number]
      ) &&
      inferredMimeType) ||
    null;

  if (blockedMimeType) {
    return {
      ok: false,
      code: "blocked_format",
      declaredMimeType,
      inferredMimeType,
      normalizedMimeType: null,
      extension,
      reason: `Formato ${formatMimeLabel(blockedMimeType, extension)} não é suportado no OCR. Use ${getSupportedOcrImageFormatsLabel()}.`,
    };
  }

  if (
    declaredMimeType &&
    declaredMimeType.startsWith("image/") &&
    !OCR_SUPPORTED_IMAGE_MIME_TYPES.includes(
      declaredMimeType as (typeof OCR_SUPPORTED_IMAGE_MIME_TYPES)[number]
    )
  ) {
    return {
      ok: false,
      code: "unsupported_format",
      declaredMimeType,
      inferredMimeType,
      normalizedMimeType: null,
      extension,
      reason: `Formato de imagem não suportado para OCR. Use ${getSupportedOcrImageFormatsLabel()}.`,
    };
  }

  const candidateMimeType =
    (declaredMimeType && normalizeSupportedMimeType(declaredMimeType)) ||
    (inferredMimeType && normalizeSupportedMimeType(inferredMimeType)) ||
    null;

  if (!candidateMimeType) {
    return {
      ok: false,
      code: "unsupported_format",
      declaredMimeType,
      inferredMimeType,
      normalizedMimeType: null,
      extension,
      reason: `Formato de imagem não suportado para OCR. Use ${getSupportedOcrImageFormatsLabel()}.`,
    };
  }

  return {
    ok: true,
    code: "supported",
    declaredMimeType,
    inferredMimeType,
    normalizedMimeType: candidateMimeType,
    extension,
    reason: "",
  };
}
