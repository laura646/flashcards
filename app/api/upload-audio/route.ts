import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { ttsToBuffer } from '@/lib/tts'

// Two modes:
//   1. UPLOAD — body: { fileData (base64), fileType, fileName? }
//      → validates + stores → returns { url }
//   2. GENERATE — body: { generate: true, text }
//      → calls ElevenLabs TTS, stores the resulting MP3 once → returns { url }
//      So when a student plays the dictation later, no fresh TTS call is
//      made (saves API quota + keeps audio identical across plays).
//
// Storage: reuses the existing exercise-images bucket under audio/.

export const maxDuration = 30

const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10 MB per sentence
const MAX_TTS_TEXT = 500 // matches /api/audio

const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
])

function extFromType(t: string): string {
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3'
  if (t.includes('wav')) return 'wav'
  if (t.includes('m4a') || t.includes('mp4')) return 'm4a'
  if (t.includes('ogg')) return 'ogg'
  if (t.includes('webm')) return 'webm'
  return 'mp3'
}

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key!)
}

async function storeAudio(buffer: Buffer, contentType: string): Promise<string | null> {
  const supabase = getSupabase()
  const ext = extFromType(contentType)
  const path = `audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from('exercise-images')
    .upload(path, buffer, {
      contentType,
      cacheControl: '31536000',
    })
  if (error) {
    console.error('Audio upload error:', error)
    return null
  }
  const { data } = supabase.storage.from('exercise-images').getPublicUrl(path)
  return data.publicUrl
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (
    !session?.user ||
    !['teacher', 'superadmin'].includes((session.user as { role?: string }).role || '')
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // Mode 2: AI generate (TTS) + store once
    if (body.generate === true) {
      const text = String(body.text || '').trim()
      if (!text) {
        return NextResponse.json({ error: 'Text is required for AI generation' }, { status: 400 })
      }
      if (text.length > MAX_TTS_TEXT) {
        return NextResponse.json(
          { error: `Text too long (max ${MAX_TTS_TEXT} characters)` },
          { status: 400 }
        )
      }
      const email = session.user.email || ''
      const { allowed } = rateLimit(`audio-gen:${email}`, 20)
      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment.' },
          { status: 429 }
        )
      }

      const audioBuf = await ttsToBuffer(text)
      if (!audioBuf) {
        return NextResponse.json({ error: 'TTS generation failed (no provider configured?)' }, { status: 500 })
      }
      const url = await storeAudio(audioBuf, 'audio/mpeg')
      if (!url) return NextResponse.json({ error: 'Failed to save audio' }, { status: 500 })
      return NextResponse.json({ url })
    }

    // Mode 1: file upload (base64)
    const { fileData, fileType } = body
    if (!fileData || !fileType) {
      return NextResponse.json({ error: 'File data and type required' }, { status: 400 })
    }
    if (!ALLOWED_AUDIO_TYPES.has(fileType)) {
      return NextResponse.json(
        { error: 'Only MP3, WAV, M4A, OGG, or WebM audio files are allowed.' },
        { status: 400 }
      )
    }
    const buffer = Buffer.from(fileData, 'base64')
    if (buffer.length > MAX_AUDIO_SIZE) {
      return NextResponse.json({ error: 'Audio file too large. Maximum 10 MB.' }, { status: 400 })
    }
    const url = await storeAudio(buffer, fileType)
    if (!url) return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
    return NextResponse.json({ url })
  } catch (err) {
    console.error('upload-audio error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
