import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'

export const maxDuration = 15

// Unified image-search across two free sources (Pexels + Pixabay).
//
// Why both: Pexels has clean photography; Pixabay adds illustrations and
// vectors which are often clearer on vocab cards for abstract or simple
// nouns. Either source can be missing or fail — we return whatever the
// other one gave us, so the feature degrades gracefully (a missing
// PIXABAY_API_KEY just means Pexels-only results, not a 500).

interface ImageHit {
  id: string                     // namespaced to avoid collisions across sources
  url: string                    // medium-size display URL
  thumb: string                  // small thumb for the picker grid
  alt: string
  credit: string                 // photographer / contributor name
  source: 'pexels' | 'pixabay'
  type: 'photo' | 'illustration'
}

async function searchPexels(query: string): Promise<ImageHit[]> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return []
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15`,
      { headers: { Authorization: key } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.photos || []).map(
      (p: { id: number; src: { medium: string; small: string }; alt: string; photographer: string }) => ({
        id: `pexels-${p.id}`,
        url: p.src.medium,
        thumb: p.src.small,
        alt: p.alt || query,
        credit: p.photographer,
        source: 'pexels' as const,
        type: 'photo' as const,
      })
    )
  } catch {
    return []
  }
}

async function searchPixabay(query: string, type: 'photo' | 'illustration'): Promise<ImageHit[]> {
  const key = process.env.PIXABAY_API_KEY
  if (!key) return []
  try {
    const params = new URLSearchParams({
      key,
      q: query,
      image_type: type,
      per_page: '15',
      safesearch: 'true',
    })
    const res = await fetch(`https://pixabay.com/api/?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.hits || []).map(
      (p: { id: number; webformatURL: string; previewURL: string; tags: string; user: string }) => ({
        id: `pixabay-${p.id}`,
        url: p.webformatURL,
        thumb: p.previewURL,
        alt: p.tags || query,
        credit: p.user,
        source: 'pixabay' as const,
        type,
      })
    )
  } catch {
    return []
  }
}

// Interleave results across sources so the grid feels mixed rather than
// "all Pexels first, then Pixabay".
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = []
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i])
    if (i < b.length) out.push(b[i])
  }
  return out
}

export async function GET(req: NextRequest) {
  try {
    await requireRole('superadmin', 'teacher')
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const query = req.nextUrl.searchParams.get('q')
  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  const typeParam = req.nextUrl.searchParams.get('type')
  const type: 'photo' | 'illustration' = typeParam === 'illustration' ? 'illustration' : 'photo'

  // Pexels has no illustration index, so we only ask it on the photo tab.
  const [pexels, pixabay] = await Promise.all([
    type === 'photo' ? searchPexels(query) : Promise.resolve<ImageHit[]>([]),
    searchPixabay(query, type),
  ])

  const images = interleave(pexels, pixabay)

  // Helpful flag so the UI can show "set up Pixabay to see more" if relevant.
  const pixabayConfigured = !!process.env.PIXABAY_API_KEY

  return NextResponse.json({ images, pixabayConfigured })
}
