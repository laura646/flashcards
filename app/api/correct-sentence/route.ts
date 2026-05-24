import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole } from '@/lib/roles'
import { rateLimit } from '@/lib/rate-limit'

// Small helper for the Error Correction editor: takes a sentence with
// (presumed) errors and returns its grammatically-correct version.
// Used by the "🪄 Auto-correct" button so teachers don't have to retype
// the corrected version themselves.

export const maxDuration = 15

const MAX_TEXT = 500

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { allowed } = rateLimit(`correct:${auth.email}`, 30)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again in a moment.' }, { status: 429 })
  }

  try {
    const { text } = await req.json()
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    if (text.length > MAX_TEXT) {
      return NextResponse.json({ error: `Text too long (max ${MAX_TEXT} characters)` }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Rewrite the following English sentence so it is grammatically correct. Preserve the meaning and keep it short. Reply with ONLY the corrected sentence — no quotes, no explanation, no preamble.\n\nSentence: ${text.trim()}`,
        },
      ],
    })

    const block = res.content[0]
    const corrected = block && block.type === 'text' ? block.text.trim() : ''
    if (!corrected) {
      return NextResponse.json({ error: 'AI returned no correction' }, { status: 500 })
    }

    // Strip surrounding quotes if the model added them despite the instruction.
    const cleaned = corrected.replace(/^["'`]+|["'`]+$/g, '').trim()

    return NextResponse.json({ corrected: cleaned })
  } catch (err) {
    console.error('correct-sentence error:', err)
    return NextResponse.json({ error: 'Failed to correct sentence' }, { status: 500 })
  }
}
