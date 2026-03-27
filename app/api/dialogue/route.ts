import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { blockId, message, targetWords, scenario, chatHistory } = body

  if (!blockId || !message) {
    return NextResponse.json({ error: 'Block ID and message required' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })

  try {
    // Build conversation history for Claude
    const messages: { role: 'user' | 'assistant'; content: string }[] = []

    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    messages.push({ role: 'user', content: message })

    const wordsListStr = (targetWords || []).join(', ')
    const usedWords = detectUsedWords(message, targetWords || [])

    const systemPrompt = `You are a friendly and encouraging English conversation partner for an ESL student. Your name is Laura's AI Assistant.

SCENARIO: ${scenario || 'General English practice conversation'}

TARGET VOCABULARY WORDS the student should practice using: ${wordsListStr}

YOUR GOALS:
1. Have a natural, engaging conversation about the scenario topic
2. Gently steer the conversation so the student has opportunities to use the target vocabulary words
3. If the student uses a target word correctly, briefly acknowledge it naturally (don't be over-the-top)
4. If the student makes a grammar or vocabulary mistake, gently correct them in a supportive way — rephrase what they said correctly and continue the conversation
5. If the student uses a target word incorrectly, explain the correct usage briefly
6. Ask follow-up questions to keep the conversation going
7. Keep your responses concise (2-4 sentences usually) — this is a conversation, not a lecture
8. If many target words haven't been used yet, try to bring up topics that would naturally require those words
9. Use simple, clear English appropriate for an intermediate learner
10. Be warm and supportive — the student should feel comfortable making mistakes

IMPORTANT: Stay in character as a conversation partner. Don't list the target words or make the practice feel like a test. Keep it natural and fun.

If the student writes in a language other than English, gently encourage them to try in English and help them express their thought.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    })

    const textContent = response.content.find(c => c.type === 'text')
    const aiMessage = textContent && textContent.type === 'text' ? textContent.text : 'I\'m having trouble responding. Could you try again?'

    // Save messages to database
    await Promise.all([
      supabase.from('dialogue_messages').insert({
        block_id: blockId,
        user_email: session.user.email,
        role: 'user',
        content: message,
        words_used: usedWords,
      }),
      supabase.from('dialogue_messages').insert({
        block_id: blockId,
        user_email: session.user.email,
        role: 'assistant',
        content: aiMessage,
        words_used: [],
      }),
    ])

    return NextResponse.json({
      message: aiMessage,
      wordsUsed: usedWords,
    })
  } catch (err) {
    console.error('Dialogue API error:', err)
    return NextResponse.json({ error: 'AI conversation failed' }, { status: 500 })
  }
}

function detectUsedWords(message: string, targetWords: string[]): string[] {
  const lowerMessage = message.toLowerCase()
  return targetWords.filter(word => {
    const lowerWord = word.toLowerCase()
    // Check for the word or its common forms
    return lowerMessage.includes(lowerWord) ||
      lowerMessage.includes(lowerWord + 's') ||
      lowerMessage.includes(lowerWord + 'ed') ||
      lowerMessage.includes(lowerWord + 'ing') ||
      lowerMessage.includes(lowerWord + 'd')
  })
}

// GET endpoint to load chat history
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const blockId = req.nextUrl.searchParams.get('blockId')
  if (!blockId) {
    return NextResponse.json({ error: 'Block ID required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('dialogue_messages')
      .select('*')
      .eq('block_id', blockId)
      .eq('user_email', session.user.email)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ messages: data || [] })
  } catch (err) {
    console.error('Dialogue GET error:', err)
    return NextResponse.json({ error: 'Failed to load chat' }, { status: 500 })
  }
}
