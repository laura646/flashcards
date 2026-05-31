// Shared TTS helper. Wraps OpenAI's text-to-speech API and falls back to
// ElevenLabs if OPENAI_API_KEY is missing — so the migration can be flipped
// just by adding/removing the env var without code changes.
//
// Why OpenAI: ~$0.015 / 1000 chars on tts-1, roughly 10× cheaper than
// ElevenLabs at comparable quality for ESL listening practice.

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech'
const OPENAI_VOICE = 'nova' // clear, neutral female English voice
const OPENAI_MODEL = 'tts-1' // fast + cheap; tts-1-hd costs 2× for marginal gain

const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL'

/**
 * Generate audio bytes (mp3) for the given text. Returns null on failure.
 * Provider auto-selected: OpenAI if OPENAI_API_KEY is set, otherwise ElevenLabs.
 */
export async function ttsToBuffer(text: string): Promise<Buffer | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const res = await fetch(OPENAI_TTS_URL, {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          input: text,
          voice: OPENAI_VOICE,
          response_format: 'mp3',
        }),
      })
      if (!res.ok) {
        console.error('OpenAI TTS error:', res.status, await res.text().catch(() => ''))
        return null
      }
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      console.error('OpenAI TTS exception:', err)
      return null
    }
  }

  // Fallback: ElevenLabs (kept so we don't break if OPENAI_API_KEY missing).
  const elevenKey = process.env.ELEVENLABS_API_KEY
  if (!elevenKey) {
    console.error('No TTS provider configured (set OPENAI_API_KEY)')
    return null
  }
  try {
    const res = await fetch(ELEVENLABS_URL, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
    if (!res.ok) {
      console.error('ElevenLabs error:', res.status, await res.text().catch(() => ''))
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('ElevenLabs exception:', err)
    return null
  }
}

/**
 * Stable cache key for a piece of TTS text. Includes a provider/voice
 * tag so swapping providers invalidates the cache automatically (no stale
 * ElevenLabs audios served after the switch).
 */
export async function ttsCacheKey(text: string): Promise<string> {
  const provider = process.env.OPENAI_API_KEY ? `openai-${OPENAI_VOICE}` : 'eleven-bella'
  const enc = new TextEncoder()
  const data = enc.encode(`${provider}|${text}`)
  // Use SubtleCrypto so we work in both Node 20+ and Edge runtimes.
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24)
}
