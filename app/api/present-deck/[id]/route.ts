import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Streams a presentation deck (stored in Supabase Storage) back as text/html.
// Supabase serves uploaded HTML as `text/plain` + nosniff (its anti-XSS
// default), which won't render in an iframe — so we look up the deck URL from
// the lesson's `presentation` block and re-serve the bytes with the correct
// content-type. Deck content is teaching material (already public at the
// storage URL); this only fixes the content-type for the /present viewer.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Staff-only (matches the /present viewer's gate); the route was previously
  // unauthenticated, exposing decks by enumerable lesson id.
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (!session?.user?.email || (role !== 'superadmin' && role !== 'teacher')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const { data: block } = await supabase
    .from('lesson_blocks')
    .select('content')
    .eq('lesson_id', id)
    .eq('block_type', 'presentation')
    .order('order_index')
    .limit(1)
    .maybeSingle()

  const content = (block?.content as { kind?: string; deck_url?: string; external_url?: string } | null) || null
  const kind = content?.kind === 'pdf' ? 'pdf' : content?.kind === 'slides' ? 'slides' : 'html'

  // ?meta=1 → JSON descriptor for the /present viewer: which kind this deck
  // is and where to point the tab. URLs are validated per kind (our own
  // storage for files; docs.google.com for Slides links) — never arbitrary.
  if (_req.nextUrl.searchParams.get('meta')) {
    const storageBase0 = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    if (kind === 'slides') {
      const u = content?.external_url || ''
      if (!/^https:\/\/docs\.google\.com\/presentation\//.test(u)) {
        return NextResponse.json({ error: 'Invalid Slides link' }, { status: 400 })
      }
      return NextResponse.json({ kind, url: u })
    }
    const fileUrl = content?.deck_url || ''
    if (!storageBase0 || !fileUrl.startsWith(`${storageBase0}/storage/v1/object/public/`)) {
      return NextResponse.json({ error: 'Invalid deck URL' }, { status: 400 })
    }
    return NextResponse.json({ kind, url: kind === 'pdf' ? fileUrl : `/api/present-deck/${id}` })
  }

  // The streaming path below is the HTML content-type proxy — html decks only.
  if (kind !== 'html') return new NextResponse('Not an HTML deck', { status: 400 })

  const deckUrl = content?.deck_url
  if (!deckUrl) return new NextResponse('Presentation not found', { status: 404 })

  // SSRF guard: only ever fetch/re-serve decks from our own Supabase Storage,
  // never an arbitrary URL a teacher may have stored in the block content.
  const storageBase = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  if (!storageBase || !deckUrl.startsWith(`${storageBase}/storage/v1/object/public/`)) {
    return new NextResponse('Invalid deck URL', { status: 400 })
  }

  const upstream = await fetch(deckUrl)
  if (!upstream.ok || !upstream.body) return new NextResponse('Failed to load deck', { status: 502 })

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
