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

  const deckUrl = (block?.content as { deck_url?: string } | null)?.deck_url
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
