import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (role !== 'superadmin' && role !== 'teacher') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })

  try {
    // Generate flashcards from class summary text
    if (action === 'generate-flashcards') {
      const { summary } = body
      if (!summary) {
        return NextResponse.json({ error: 'Summary text required' }, { status: 400 })
      }

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `You are an English language teaching assistant. Analyze this class summary and:

1. **Suggest a lesson title** — a short, descriptive title for this lesson (e.g., "Travel Vocabulary & Airport Conversations", "Business Email Writing"). Keep it concise but informative.

2. **Extract vocabulary words** that were taught. For each word, provide:
   - word: the vocabulary word or phrase
   - phonetic: simple phonetic pronunciation guide (e.g., "KAM-ping" not IPA)
   - meaning: a clear, student-friendly definition (1-2 sentences)
   - example: a natural example sentence using the word
   - notes: any teaching notes, common mistakes, or tips (optional, leave empty string if none)

Return ONLY a valid JSON object (no markdown, no explanation):
{"title": "Suggested Lesson Title", "flashcards": [{"word": "example", "phonetic": "ig-ZAM-pul", "meaning": "Something that represents a group or type.", "example": "Can you give me an example?", "notes": ""}]}

Class summary:
${summary}`
        }]
      })

      const textContent = message.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }

      try {
        const result = JSON.parse(textContent.text)
        // Support both old array format and new object format
        if (Array.isArray(result)) {
          return NextResponse.json({ flashcards: result })
        }
        return NextResponse.json({ flashcards: result.flashcards || [], suggestedTitle: result.title || '' })
      } catch {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          if (Array.isArray(result)) {
            return NextResponse.json({ flashcards: result })
          }
          return NextResponse.json({ flashcards: result.flashcards || [], suggestedTitle: result.title || '' })
        }
        const arrMatch = textContent.text.match(/\[[\s\S]*\]/)
        if (arrMatch) {
          const flashcards = JSON.parse(arrMatch[0])
          return NextResponse.json({ flashcards })
        }
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
    }

    // Generate exercises from screenshot image or text
    if (action === 'generate-exercises') {
      const { image, imageType, text: inputText, preferredType } = body
      if (!image && !inputText) {
        return NextResponse.json({ error: 'Image or text content required' }, { status: 400 })
      }

      const exerciseTypeGuide = `
Choose the BEST exercise type for the content. Available types:

CLASSIC TYPES (use standard questions array):
- "multiple_choice" — choose the correct answer from options
- "fill_blank" — type the correct word/phrase
- "match_halves" — match sentence beginnings with endings
- "unjumble" — rearrange words to form correct sentences
- "transform" — change sentences (e.g., positive to negative)

NEW INTERACTIVE TYPES (each has its own data format):
- "true_or_false" — student decides if a statement is true or false
- "hangman" — student guesses letters to reveal a word, given a clue
- "type_answer" — student types the correct answer (no options given)
- "complete_sentence" — drag-and-drop words into blanks in a text
- "group_sort" — drag-and-drop items into correct category groups

${preferredType ? `IMPORTANT: The teacher wants exercise type "${preferredType}". Generate content for that type specifically.` : 'Choose the type that best matches the content.'}

Return ONLY a valid JSON object. The format depends on the exercise type:

FOR "multiple_choice", "fill_blank", "match_halves", "unjumble", "transform":
{
  "title": "Exercise title",
  "subtitle": "Brief description",
  "icon": "relevant emoji",
  "instructions": "Clear instructions",
  "exercise_type": "the_type",
  "questions": [{"id": 1, "prompt": "Question text", "options": ["a", "b", "c"], "correctIndex": 0, "hint": "optional"}]
}

FOR "true_or_false":
{
  "title": "Exercise title",
  "subtitle": "Brief description",
  "icon": "✓✗",
  "instructions": "Read each statement and decide if it is true or false.",
  "exercise_type": "true_or_false",
  "questions": [{"id": 1, "statement": "The past tense of go is goed.", "isTrue": false, "explanation": "The correct past tense is 'went'."}]
}

FOR "hangman":
{
  "title": "Exercise title",
  "subtitle": "Brief description",
  "icon": "🎯",
  "instructions": "Guess the word letter by letter using the clue.",
  "exercise_type": "hangman",
  "questions": [{"id": 1, "word": "VOCABULARY", "clue": "A collection of words known to a person"}]
}

FOR "type_answer":
{
  "title": "Exercise title",
  "subtitle": "Brief description",
  "icon": "⌨️",
  "instructions": "Type the correct answer for each question.",
  "exercise_type": "type_answer",
  "questions": [{"id": 1, "prompt": "What is the past tense of 'go'?", "answer": "went", "hint": "optional hint"}]
}

FOR "complete_sentence":
{
  "title": "Exercise title",
  "subtitle": "Brief description",
  "icon": "📝",
  "instructions": "Drag the correct words into the blanks.",
  "exercise_type": "complete_sentence",
  "questions": [{"id": 1, "text": "I {{1}} to the store and {{2}} some milk.", "blanks": {"1": "went", "2": "bought"}, "wordBank": ["went", "bought", "gone", "buyed"]}]
}

FOR "group_sort":
{
  "title": "Exercise title",
  "subtitle": "Brief description",
  "icon": "🗂️",
  "instructions": "Sort each item into the correct group.",
  "exercise_type": "group_sort",
  "groupData": {"groups": [{"name": "Countable", "items": ["apple", "book"]}, {"name": "Uncountable", "items": ["water", "advice"]}]}
}

Return ONLY valid JSON, no markdown, no explanation.`

      // Build messages based on whether we have an image or text
      const contentParts: Anthropic.Messages.ContentBlockParam[] = []
      if (image) {
        const mediaType = imageType || 'image/png'
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: image,
          },
        })
        contentParts.push({
          type: 'text',
          text: `You are an English language teaching assistant. Analyze this textbook exercise screenshot and recreate it as an interactive digital exercise.\n\n${exerciseTypeGuide}`
        })
      } else {
        contentParts.push({
          type: 'text',
          text: `You are an English language teaching assistant. Based on this text content, create an interactive exercise.\n\nContent:\n${inputText}\n\n${exerciseTypeGuide}`
        })
      }

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: contentParts }]
      })

      const textContent = message.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }

      try {
        const exercise = JSON.parse(textContent.text)
        return NextResponse.json({ exercise })
      } catch {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const exercise = JSON.parse(jsonMatch[0])
          return NextResponse.json({ exercise })
        }
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
    }

    // Import from Google Doc: fetch content, generate flashcards + summary + mistakes
    if (action === 'import-google-doc') {
      const { url } = body
      if (!url) {
        return NextResponse.json({ error: 'Google Doc URL required' }, { status: 400 })
      }

      // Extract document ID from various Google Docs URL formats
      const docIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
      if (!docIdMatch) {
        return NextResponse.json({ error: 'Could not extract document ID from URL. Please provide a valid Google Docs link.' }, { status: 400 })
      }
      const docId = docIdMatch[1]

      // Fetch the document as plain text (works for publicly shared docs)
      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`
      let docText: string
      try {
        const docRes = await fetch(exportUrl)
        if (!docRes.ok) {
          if (docRes.status === 401 || docRes.status === 403) {
            return NextResponse.json({
              error: 'Cannot access this document. Please make it publicly accessible: Open the doc → Share → Change to "Anyone with the link" → Viewer.'
            }, { status: 403 })
          }
          throw new Error(`Failed to fetch document: ${docRes.status}`)
        }
        docText = await docRes.text()
        if (!docText.trim()) {
          return NextResponse.json({ error: 'The document appears to be empty.' }, { status: 400 })
        }
      } catch (fetchErr: unknown) {
        if (fetchErr instanceof Error && fetchErr.message.includes('Failed to fetch document')) {
          throw fetchErr
        }
        return NextResponse.json({ error: 'Failed to fetch the Google Doc. Make sure it is publicly shared.' }, { status: 400 })
      }

      // Send to Claude to generate all four: title, flashcards, summary, and mistakes
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `You are an expert English language teaching assistant. Analyze this class document and generate four things:

1. **TITLE**: Suggest a concise, descriptive lesson title (e.g., "Travel Vocabulary & Airport Conversations", "Business Email Writing"). Keep it short but informative.

2. **FLASHCARDS**: Extract all vocabulary words/phrases that were taught. For each word provide:
   - word, phonetic (simple pronunciation like "KAM-ping", not IPA), meaning (clear 1-2 sentence definition), example (natural sentence), notes (teaching tips, empty string if none)

3. **SUMMARY**: Write a concise class summary (2-4 paragraphs) covering what was taught, key topics, and learning objectives.

4. **MISTAKES**: Identify common student errors mentioned or implied in the document. For each mistake provide:
   - original: the incorrect sentence/phrase students might say
   - correction: the correct version
   - explanation: why it's wrong and how to remember the correct form
   - practice: an array of 1-2 multiple choice questions testing this correction, each with: prompt, options (array of 3-4 choices), correctIndex

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "title": "Suggested Lesson Title",
  "flashcards": [{"word": "", "phonetic": "", "meaning": "", "example": "", "notes": ""}],
  "summary": "...",
  "mistakes": [{"original": "", "correction": "", "explanation": "", "practice": [{"prompt": "", "options": ["", "", ""], "correctIndex": 0}]}]
}

If the document doesn't contain enough information for any section, return an empty array for flashcards/mistakes or a brief note for summary.

Here is the class document:
${docText}`
        }]
      })

      const textContent = message.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }

      try {
        const result = JSON.parse(textContent.text)
        return NextResponse.json({
          suggestedTitle: result.title || '',
          flashcards: result.flashcards || [],
          summary: result.summary || '',
          mistakes: result.mistakes || [],
          docText: docText.slice(0, 500) + (docText.length > 500 ? '...' : '')
        })
      } catch {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          return NextResponse.json({
            suggestedTitle: result.title || '',
            flashcards: result.flashcards || [],
            summary: result.summary || '',
            mistakes: result.mistakes || [],
            docText: docText.slice(0, 500) + (docText.length > 500 ? '...' : '')
          })
        }
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Generate content error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
