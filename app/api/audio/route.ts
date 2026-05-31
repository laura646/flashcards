import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'
import { ttsToBuffer, ttsCacheKey } from '@/lib/tts'

// Per-play TTS for AudioButton (flashcards, dictation, etc.). Two-tier:
//   1. Hash text + voice → look up cached mp3 in Supabase Storage
//   2. Cache hit  → stream stored bytes back (no TTS call)
//      Cache miss → call OpenAI TTS, upload to storage, then return bytes
// First time anyone plays a given text → 1 TTS call. Every subsequent play
// across all students → 0 TTS calls. ~10× cheaper than ElevenLabs on top.

const MAX_TEXT_LENGTH = 500 // characters — prevent abuse of TTS API
const CACHE_BUCKET = 'exercise-images' // reuses existing bucket
const CACHE_PREFIX = 'audio/tts-cache' // folder inside the bucket

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key!)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 20 TTS requests per minute per user
  const { allowed } = rateLimit(`audio:${session.user.email}`, 20)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  try {
    const { text } = await req.json()
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` }, { status: 400 })
    }

    const supabase = getSupabase()
    const cacheKey = await ttsCacheKey(text)
    const cachePath = `${CACHE_PREFIX}/${cacheKey}.mp3`

    // 1. Try the cache first.
    const dl = await supabase.storage.from(CACHE_BUCKET).download(cachePath)
    if (dl.data) {
      const buf = Buffer.from(await dl.data.arrayBuffer())
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Tts-Cache': 'hit',
        },
      })
    }

    // 2. Cache miss — generate, store, return.
    const audio = await ttsToBuffer(text)
    if (!audio) {
      return NextResponse.json({ error: 'TTS failed' }, { status: 502 })
    }
    // Fire-and-forget the upload — don't block the response on storage I/O.
    supabase.storage
      .from(CACHE_BUCKET)
      .upload(cachePath, audio, {
        contentType: 'audio/mpeg',
        cacheControl: '31536000',
        upsert: false,
      })
      .then((r) => {
        if (r.error && !String(r.error.message).toLowerCase().includes('already exists')) {
          console.error('TTS cache upload error:', r.error)
        }
      })

    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Tts-Cache': 'miss',
      },
    })
  } catch (error) {
    console.error('Audio API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
