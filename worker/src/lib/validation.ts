export const ALLOWED_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

export const MAX_BODY_BYTES: number = 5 * 1024 * 1024  // 5 MB

export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType)
}

export function validateBodySize(contentLength: string | null): boolean {
  if (contentLength === null) return true  // absence of header is allowed; will be caught by actual read
  const bytes = parseInt(contentLength, 10)
  if (isNaN(bytes)) return true
  return bytes <= MAX_BODY_BYTES
}
