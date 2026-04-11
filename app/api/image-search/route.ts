import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'

export const maxDuration = 15

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

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Image search not configured. Add PEXELS_API_KEY to environment variables.' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&size=small`,
      { headers: { Authorization: apiKey } }
    )

    if (!res.ok) {
      throw new Error(`Pexels API error: ${res.status}`)
    }

    const data = await res.json()
    const images = (data.photos || []).map((photo: { id: number; src: { medium: string; small: string }; alt: string; photographer: string }) => ({
      id: photo.id,
      url: photo.src.medium,
      thumb: photo.src.small,
      alt: photo.alt,
      photographer: photo.photographer,
    }))

    return NextResponse.json({ images })
  } catch (err) {
    console.error('Image search error:', err)
    return NextResponse.json({ error: 'Failed to search images' }, { status: 500 })
  }
}
