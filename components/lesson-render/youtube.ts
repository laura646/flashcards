// ── YouTube ID extractor ──
// Lifted verbatim from app/lessons/[id]/page.tsx (was the module-local
// getYouTubeId arrow). Same regex, same return contract (id string | null).
export function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/
  )
  return match ? match[1] : null
}
