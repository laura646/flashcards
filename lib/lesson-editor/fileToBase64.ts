// ─────────────────────────────────────────────────────────────────────────────
// fileToBase64 — file -> bare base64 (no data: prefix) for /api/generate-content.
//
// Ported VERBATIM from the legacy editor app/admin/lessons/page.tsx (L469-480).
// The legacy file is left 100% untouched; this is the single non-legacy copy the
// new /admin-beta editor's AI flow imports.
// ─────────────────────────────────────────────────────────────────────────────

// (legacy page.tsx 469-480) — copied verbatim
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Extension -> MIME helper. Mirrors the legacy typeMap used when uploading
// exercise source files (page.tsx 1888-1892). Falls back to the file's own
// .type, then to application/pdf, at the call site.
const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

// Resolve a MIME type from a filename's extension; returns undefined when the
// extension is unknown so callers can fall back to file.type.
export function mimeFromFilename(name: string): string | undefined {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return EXT_MIME[ext]
}

// The image extensions the single-image exercise path treats specially
// (legacy page.tsx 1876).
export const IMAGE_EXTS = ['jpg', 'jpeg', 'png'] as const

export function isImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return (IMAGE_EXTS as readonly string[]).includes(ext)
}
