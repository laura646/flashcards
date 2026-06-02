import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

// Speech-to-text via OpenAI Whisper.
//
// Accepts a multipart/form-data POST with field `audio` (the browser
// MediaRecorder blob — webm/ogg/mp4/wav all accepted by Whisper).
// Returns { text: "transcribed text" }.
//
// Language is forced to English so a French utterance comes back as the
// English approximation; this matches the existing dialogue prompt logic
// that gently steers students back to English.
//
// Cost: ~$0.006 / minute. A 30-message dialogue session ≈ $0.05 in
// transcription cost per student.

export const maxDuration = 30 // seconds

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // OpenAI's hard cap is 25 MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 20 transcriptions / min / user — same ceiling as the TTS route.
  const { allowed } = rateLimit(`stt:${session.user.email}`, 20)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const audio = formData.get('audio')
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'audio field required' }, { status: 400 })
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: 'Empty audio' }, { status: 400 })
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio too large (max 25 MB)' }, { status: 400 })
  }

  // OpenAI's transcription endpoint takes a multipart upload too.
  // Pass through with our own credentials.
  const upstreamForm = new FormData()
  // Whisper needs a filename hint with the right extension to detect the
  // codec. The browser MediaRecorder default is audio/webm.
  const ext = (audio.type || '').includes('mp4') ? 'm4a'
    : (audio.type || '').includes('mpeg') ? 'mp3'
    : (audio.type || '').includes('wav') ? 'wav'
    : 'webm'
  upstreamForm.append('file', audio, `recording.${ext}`)
  upstreamForm.append('model', 'whisper-1')
  upstreamForm.append('language', 'en')        // force English transcription
  upstreamForm.append('response_format', 'json')

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('Whisper error:', res.status, errText)
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
    }
    const data = (await res.json()) as { text?: string }
    return NextResponse.json({ text: (data.text || '').trim() })
  } catch (err) {
    console.error('Whisper exception:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
