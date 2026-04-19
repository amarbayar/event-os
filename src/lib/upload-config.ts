const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const IMAGE_FIELD_KEYS = new Set([
  "headshotUrl",
  "logoUrl",
  "mainImageUrl",
  "companyLogoUrl",
]);

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = new Set(Object.keys(MIME_EXTENSION_MAP));

export const IMAGE_UPLOAD_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif";
export const GENERIC_UPLOAD_ACCEPT =
  `${IMAGE_UPLOAD_ACCEPT},application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document`;

function sanitizeSegment(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeUploadFolder(folder: string): string {
  const sanitized = folder
    .split("/")
    .map(sanitizeSegment)
    .filter(Boolean)
    .join("/");

  return sanitized || "general";
}

export function getExtensionForMimeType(
  mimeType: string,
  originalName: string
): string {
  const mapped = MIME_EXTENSION_MAP[mimeType];
  if (mapped) return mapped;

  const match = originalName.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() || "bin";
}

export function isAllowedUploadMimeType(mimeType: string): boolean {
  return ALLOWED_UPLOAD_MIME_TYPES.has(mimeType);
}

export function isImageUploadField(
  fieldKey?: string | null,
  itemName?: string
): boolean {
  if (fieldKey && IMAGE_FIELD_KEYS.has(fieldKey)) return true;
  return !!itemName && /(photo|image|logo|headshot)/i.test(itemName);
}

export function getChecklistUploadDescriptor(params: {
  entityType: string;
  entityId: string;
  fieldKey?: string | null;
  itemName?: string;
}) {
  const preview = isImageUploadField(params.fieldKey, params.itemName);
  const fieldSegment =
    sanitizeSegment(params.fieldKey || params.itemName || "file") || "file";

  return {
    accept: preview ? IMAGE_UPLOAD_ACCEPT : GENERIC_UPLOAD_ACCEPT,
    preview,
    folder: sanitizeUploadFolder(
      `${params.entityType}/${params.entityId}/${fieldSegment}`
    ),
  };
}
