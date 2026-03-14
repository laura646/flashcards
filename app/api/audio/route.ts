import { NextRequest, NextResponse } from 'next/server'

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL' // Sarah — clear, natural British-English voice

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 })
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('ElevenLabs error:', err)
    return NextResponse.json({ error: 'Audio generation failed' }, { status: 500 })
  }

  const audioBuffer = await response.arrayBuffer()
  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400', // cache for 24h
    },
  })
}
