import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from '@/lib/rate-limit'

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB max file upload

const EXERCISE_GEN_PROMPT = `You are an expert ESL teaching assistant. Analyze this exercise document and convert EACH exercise into a structured digital exercise format.

The document contains one or more exercises. For EACH exercise found, pick the best matching digital format from these types:

EXERCISE TYPES AND THEIR JSON FORMATS:

1. "multiple_choice" — choose the correct answer from options
   {"id": 1, "prompt": "Question text", "options": ["a", "b", "c", "d"], "correctIndex": 0, "hint": ""}

2. "fill_blank" — type the missing word/phrase (prompt uses ___ for the blank)
   {"id": 1, "prompt": "She ___ to school every day.", "options": ["goes", "go", "going", "gone"], "correctIndex": 0, "hint": ""}

3. "match_halves" — match keywords/beginnings with definitions/endings (drag-and-drop matching)
   {"id": 1, "left": "to create", "right": "chairs"}

4. "unjumble" — rearrange words to form correct sentences
   {"id": 1, "prompt": "school / to / I / go / every day", "options": ["I go to school every day"], "correctIndex": 0, "hint": ""}

5. "transform" — change sentences (e.g., positive→negative, active→passive)
   {"id": 1, "prompt": "Make negative: She likes coffee.", "options": ["She doesn't like coffee.", "She not likes coffee.", "She don't like coffee."], "correctIndex": 0, "hint": ""}

6. "true_or_false" — decide if a statement is true or false
   {"id": 1, "statement": "The past tense of go is goed.", "isTrue": false, "explanation": "The correct past tense is 'went'."}

7. "hangman" — guess letters to reveal a word given a clue
   {"id": 1, "word": "VOCABULARY", "clue": "A collection of words known to a person"}

8. "type_answer" — type the correct answer freely
   {"id": 1, "prompt": "What is the past tense of 'go'?", "answer": "went", "hint": ""}

9. "complete_sentence" — drag words into blanks in a text
   {"id": 1, "text": "I {{1}} to the store and {{2}} some milk.", "blanks": {"1": "went", "2": "bought"}, "wordBank": ["went", "bought", "gone", "buyed"]}

10. "group_sort" — sort items into correct category groups
    (uses groupData instead of questions)
    "groupData": {"groups": [{"name": "Category A", "items": ["item1", "item2"]}, {"name": "Category B", "items": ["item3", "item4"]}]}

11. "dictation" — listen and type what you hear
   {"id": 1, "text": "She went to school yesterday.", "audio_url": "", "speed": "normal"}

12. "error_correction" — find and correct errors in sentences
   {"id": 1, "incorrect": "She go to school yesterday.", "correct": "She went to school yesterday.", "hints": "Check the verb tense."}

13. "rank_order" — rank items according to a criterion (e.g. smallest to largest, earliest to latest)
   {"id": 1, "criterion": "Rank from smallest to largest", "items": ["ant", "cat", "elephant", "whale"]}
   Items must be in the CORRECT order. The app shuffles them.

14. "text_sequencing" — arrange sentences or paragraphs in the correct order
   {"id": 1, "segments": ["First, preheat the oven.", "Then, mix the ingredients.", "Next, pour into the pan.", "Finally, bake for 30 minutes."], "level": "sentence"}
   Segments must be in the CORRECT order. level is "sentence" or "paragraph". The app shuffles them.

15. "anagram" — unscramble letters to form a word
   {"id": 1, "word": "language", "clue": "A system of communication"}
   The app scrambles the letters automatically.

16. "cloze_listening" — listen to audio and fill in missing words
   {"id": 1, "text": "The {{1}} sat on the {{2}}.", "blanks": {"1": "cat", "2": "mat"}, "audio_url": ""}
   text has {{n}} placeholders, blanks maps numbers to correct words. audio_url is optional (TTS auto-generated if empty). No word bank — student types freely.

RULES:
- Convert EVERY exercise from the document, not just some
- Pick the exercise type that best matches the original exercise format

TYPE SELECTION PRIORITY (IMPORTANT — avoid overusing type_answer):
- "choose the correct alternative/answer" → multiple_choice (NOT type_answer)
- "select the right option" → multiple_choice
- "correct the mistakes/errors" → error_correction (student finds and fixes errors in sentences)
- "find the errors" → error_correction
- "listen and write/type" → dictation
- "write the nationality/word" → fill_blank (provide options) or type_answer (only if very short 1-word answers)
- "make positive/negative" → transform
- "fill in the gaps/blanks" → fill_blank or complete_sentence
- "match the beginnings with endings" → match_halves
- "put the words in order" → unjumble
- Conversations with blanks → complete_sentence (preferred) or fill_blank
- Categorization/sorting → group_sort
- True/false statements → true_or_false
- Vocabulary guessing with clues → hangman
- "put in order/sequence" (sentences or paragraphs) → text_sequencing
- "rank/order by" (criteria-based ordering) → rank_order
- Vocabulary unscramble / word puzzles → anagram
- "listen and fill in the gaps/blanks" → cloze_listening

AVOID type_answer unless the exercise genuinely requires free-text typing with no options. Prefer multiple_choice, fill_blank, or transform when the original exercise has clear correct answers that can be presented as options. Students learn better with interactive formats than open-text typing.

- Include the answer key data (correctIndex, answer, isTrue, etc.) based on the document's answer key
- Each exercise should have 4-10 questions typically
- Generate clear, student-friendly titles and instructions

Return ONLY a valid JSON array of exercises (no markdown, no explanation):
[
  {
    "title": "Exercise title",
    "subtitle": "Brief description",
    "icon": "relevant emoji",
    "instructions": "Clear student instructions",
    "exercise_type": "the_type",
    "questions": [...],
    "groupData": null
  }
]

For group_sort type, set questions to [] and use groupData.
For all other types, set groupData to null.

Here is the exercise document:
`

function parseExercisesResponse(text: string) {
  try {
    const exercises = JSON.parse(text)
    return { exercises: Array.isArray(exercises) ? exercises : [exercises] }
  } catch {
    const arrMatch = text.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      const exercises = JSON.parse(arrMatch[0])
      return { exercises: Array.isArray(exercises) ? exercises : [exercises] }
    }
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) {
      const exercise = JSON.parse(objMatch[0])
      return { exercises: [exercise] }
    }
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (role !== 'superadmin' && role !== 'teacher') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 10 AI generation requests per minute per user
  const { allowed } = rateLimit(`generate:${session?.user?.email}`, 10)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
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
- "unjumble" — rearrange words to form correct sentences
- "transform" — change sentences (e.g., positive to negative)

NEW INTERACTIVE TYPES (each has its own data format):
- "match_halves" — drag-and-drop matching of keywords to definitions
- "true_or_false" — student decides if a statement is true or false
- "hangman" — student guesses letters to reveal a word, given a clue
- "type_answer" — student types the correct answer (no options given)
- "complete_sentence" — drag-and-drop words into blanks in a text
- "group_sort" — drag-and-drop items into correct category groups

${preferredType ? `IMPORTANT: The teacher wants exercise type "${preferredType}". Generate content for that type specifically.` : 'Choose the type that best matches the content.'}

Return ONLY a valid JSON object. The format depends on the exercise type:

FOR "multiple_choice", "fill_blank", "unjumble", "transform":
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

    // Convert exercise questions from one type to another using AI
    if (action === 'convert-exercise-type') {
      const { exercise, newType } = body
      if (!exercise || !newType) {
        return NextResponse.json({ error: 'Exercise data and new type required' }, { status: 400 })
      }

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `You are an ESL teaching assistant. Convert this exercise from "${exercise.exercise_type}" to "${newType}" format.

Current exercise:
- Title: ${exercise.title}
- Instructions: ${exercise.instructions}
- Questions: ${JSON.stringify(exercise.questions)}
${exercise.groupData ? `- Group data: ${JSON.stringify(exercise.groupData)}` : ''}

TARGET FORMAT for "${newType}":

${({
  multiple_choice: `"questions": [{"id": 1, "prompt": "Question text", "options": ["a", "b", "c", "d"], "correctIndex": 0, "hint": ""}]
- Each question needs a prompt, 3-4 options with one correct answer, and the correctIndex pointing to the right one.`,
  fill_blank: `"questions": [{"id": 1, "prompt": "She ___ to school every day.", "options": ["goes", "go", "going", "gone"], "correctIndex": 0, "hint": ""}]
- Each question has a sentence with ___ for the blank, plus options.`,
  match_halves: `"questions": [{"id": 1, "left": "to create", "right": "chairs"}, {"id": 2, "left": "it looks", "right": "colorful"}]
- Each pair has a "left" (keyword/beginning) and "right" (definition/ending). Students drag left tiles to match right definitions.`,
  unjumble: `"questions": [{"id": 1, "prompt": "school / to / I / go / every day", "options": ["I go to school every day"], "correctIndex": 0, "hint": ""}]
- prompt has jumbled words separated by " / ", options[0] is the correct sentence.`,
  transform: `"questions": [{"id": 1, "prompt": "Make negative: She likes coffee.", "options": ["She doesn't like coffee.", "She not likes coffee.", "She don't like coffee."], "correctIndex": 0, "hint": ""}]
- prompt includes the transformation instruction, options are possible transformations.`,
  true_or_false: `"questions": [{"id": 1, "statement": "The past tense of go is goed.", "isTrue": false, "explanation": "The correct past tense is 'went'."}]
- Each question has a statement, isTrue boolean, and explanation.`,
  hangman: `"questions": [{"id": 1, "word": "VOCABULARY", "clue": "A collection of words known to a person"}]
- Each question has a word (UPPERCASE) and a clue.`,
  type_answer: `"questions": [{"id": 1, "prompt": "What is the past tense of 'go'?", "answer": "went", "hint": ""}]
- Each question has a prompt and the expected typed answer.`,
  complete_sentence: `"questions": [{"id": 1, "text": "I {{1}} to the store and {{2}} some milk.", "blanks": {"1": "went", "2": "bought"}, "wordBank": ["went", "bought", "gone", "buyed"]}]
- text has {{n}} placeholders, blanks maps numbers to correct words, wordBank has all options including distractors.`,
  group_sort: `Use "groupData" instead of "questions": {"groups": [{"name": "Category A", "items": ["item1", "item2"]}, {"name": "Category B", "items": ["item3", "item4"]}]}
- Set questions to an empty array []. Group related items from the original exercise into meaningful categories.`,
  dictation: `"questions": [{"id": 1, "text": "She went to school yesterday.", "audio_url": "", "speed": "normal"}]
- Each question has the correct text the student must type after listening. audio_url is optional (TTS is auto-generated if empty).`,
  error_correction: `"questions": [{"id": 1, "incorrect": "She go to school yesterday.", "correct": "She went to school yesterday.", "hints": "Check the verb tense."}]
- Each question has an incorrect sentence, the correct version, and an optional hint.`,
  rank_order: `"questions": [{"id": 1, "criterion": "Rank from smallest to largest", "items": ["ant", "cat", "elephant", "whale"]}]
- Each question has a criterion describing the ranking rule and items in the CORRECT order. The app shuffles them for the student.`,
  text_sequencing: `"questions": [{"id": 1, "segments": ["First, preheat the oven.", "Then, mix the ingredients.", "Next, pour into the pan.", "Finally, bake for 30 minutes."], "level": "sentence"}]
- Each question has segments in the CORRECT order. level is "sentence" or "paragraph". The app shuffles them for the student.`,
  anagram: `"questions": [{"id": 1, "word": "language", "clue": "A system of communication"}]
- Each question has a word (the correct answer) and an optional clue. The app scrambles the letters for the student.`,
  cloze_listening: `"questions": [{"id": 1, "text": "The {{1}} sat on the {{2}}.", "blanks": {"1": "cat", "2": "mat"}, "audio_url": ""}]
- text has {{n}} placeholders for blanks. blanks maps numbers to correct words. audio_url is optional (TTS auto-generated if empty). No word bank.`,
} as Record<string, string>)[newType] || 'Use the standard questions format.'}

RULES:
- Keep the same educational content and learning objective
- Adapt the questions naturally to the new format
- For multiple_choice/fill_blank: generate plausible wrong options (distractors)
- For type_answer: extract the key answer from existing options
- For true_or_false: convert questions into true/false statements
- For hangman: pick key vocabulary words from the exercise
- For group_sort: find natural categories to group the content
- Update title and instructions to match the new exercise type
- Keep the same number of questions if possible (adjust if the format requires it)

Return ONLY a valid JSON object (no markdown):
{
  "title": "Updated title",
  "subtitle": "Updated subtitle",
  "icon": "relevant emoji",
  "instructions": "Updated instructions for the new type",
  "exercise_type": "${newType}",
  "questions": [...],
  "groupData": null
}

For group_sort, set questions to [] and populate groupData.
For all other types, set groupData to null.`
        }]
      })

      const textContent = message.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }

      try {
        const result = JSON.parse(textContent.text)
        return NextResponse.json({ exercise: result })
      } catch {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          return NextResponse.json({ exercise: result })
        }
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
    }

    // Generate multiple exercises from a Google Doc containing exercises/worksheets
    if (action === 'generate-exercises-from-doc') {
      const { url } = body
      if (!url) {
        return NextResponse.json({ error: 'Google Doc URL required' }, { status: 400 })
      }

      const docIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
      if (!docIdMatch) {
        return NextResponse.json({ error: 'Could not extract document ID from URL. Please provide a valid Google Docs link.' }, { status: 400 })
      }
      const docId = docIdMatch[1]

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

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: EXERCISE_GEN_PROMPT + docText }]
      })

      const textContent = message.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }

      const parsed = parseExercisesResponse(textContent.text)
      if (!parsed) {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
      return NextResponse.json(parsed)
    }

    // Generate exercises from uploaded files (PDF, DOCX, JPEG, PNG)
    if (action === 'generate-exercises-from-upload') {
      // Support both legacy single-file format and new multi-file format
      const files: { data: string; type: string }[] = body.files || (body.fileData ? [{ data: body.fileData, type: body.fileType }] : [])
      if (files.length === 0) {
        return NextResponse.json({ error: 'File data required' }, { status: 400 })
      }

      // Validate total size
      const totalBytes = files.reduce((sum: number, f: { data: string }) => sum + Math.ceil((f.data.length * 3) / 4), 0)
      if (totalBytes > MAX_UPLOAD_SIZE_BYTES) {
        return NextResponse.json({ error: 'Files too large. Maximum total size is 10 MB.' }, { status: 400 })
      }

      const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']
      const hasImages = files.some((f: { type: string }) => IMAGE_TYPES.includes(f.type))
      const hasDocuments = files.some((f: { type: string }) => !IMAGE_TYPES.includes(f.type))

      // Extract text from document files (PDF/DOCX)
      let docText = ''
      const imageBlocks: { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }[] = []

      for (const file of files) {
        if (IMAGE_TYPES.includes(file.type)) {
          imageBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.type === 'image/jpg' ? 'image/jpeg' : file.type,
              data: file.data,
            },
          })
        } else {
          const buffer = Buffer.from(file.data, 'base64')
          try {
            if (file.type === 'application/pdf' || file.type === 'pdf') {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const pdfParse = require('pdf-parse')
              const pdfResult = await pdfParse(buffer)
              docText += (docText ? '\n\n' : '') + pdfResult.text
            } else if (
              file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
              file.type === 'docx'
            ) {
              const mammoth = await import('mammoth')
              const result = await mammoth.extractRawText({ buffer })
              docText += (docText ? '\n\n' : '') + result.value
            } else {
              return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, DOCX, JPEG, or PNG files.' }, { status: 400 })
            }
          } catch (parseErr) {
            console.error('File parse error:', parseErr)
            return NextResponse.json({ error: 'Failed to read an uploaded file. Make sure it is a valid PDF, DOCX, JPEG, or PNG.' }, { status: 400 })
          }
        }
      }

      if (!hasImages && !docText.trim()) {
        return NextResponse.json({ error: 'The document appears to be empty or could not be read.' }, { status: 400 })
      }

      // Build message content: images use vision, documents use text
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageContent: any[] = []

      if (imageBlocks.length > 0) {
        messageContent.push(...imageBlocks)
        messageContent.push({ type: 'text', text: EXERCISE_GEN_PROMPT + (hasDocuments && docText ? '\n\nAdditionally, here is text extracted from uploaded documents:\n\n' + docText : '\n\nAnalyze the uploaded image(s) and generate exercises based on the content you see.') })
      } else {
        messageContent.push({ type: 'text', text: EXERCISE_GEN_PROMPT + docText })
      }

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: messageContent }]
      })

      const textContent = message.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }

      const parsed = parseExercisesResponse(textContent.text)
      if (!parsed) {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
      return NextResponse.json(parsed)
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
