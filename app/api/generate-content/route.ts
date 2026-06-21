import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from '@/lib/rate-limit'
import { SONNET_MODEL, HAIKU_MODEL } from '@/lib/ai-models'
import { levelInstruction } from '@/lib/level-mapping'

// Allow large request bodies (base64 images can be several MB)
export const maxDuration = 60 // seconds (for Vercel serverless timeout)

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB max file upload

const EXERCISE_GEN_PROMPT = `You are an expert ESL teaching assistant. Analyze this exercise document and convert EACH exercise into a structured digital exercise format.

The document contains one or more exercises. For EACH exercise found, pick the best matching digital format from these types:

EXERCISE TYPES AND THEIR JSON FORMATS:

1. "multiple_choice" — choose the correct answer from options. Also use this for any sentence with a blank that has a fixed set of options.
   {"id": 1, "prompt": "Question text", "options": ["a", "b", "c", "d"], "correctIndex": 0, "hint": "", "explanation": "Why the correct answer is correct (1 short sentence)."}

2. "match_halves" — match keywords/beginnings with definitions/endings (drag-and-drop matching)
   {"id": 1, "left": "to create", "right": "chairs"}

3. "anagram" — unscramble letters to form a word, or rearrange words to form a sentence
   For single words: {"id": 1, "word": "SCHOOL", "clue": "A place where children learn"}
   For sentences: {"id": 1, "word": "She is going to the market", "clue": "Rearrange the words"}

4. "true_or_false" — decide if a statement is true or false
   {"id": 1, "statement": "The past tense of go is goed.", "isTrue": false, "explanation": "The correct past tense is 'went'."}

7. "hangman" — guess letters to reveal a word given a clue
   {"id": 1, "word": "VOCABULARY", "clue": "A collection of words known to a person"}

8. "type_answer" — type the correct answer freely
   {"id": 1, "prompt": "What is the past tense of 'go'?", "answer": "went", "hint": ""}

9. "group_sort" — sort items into correct category groups
    (uses groupData instead of questions)
    "groupData": {"groups": [{"name": "Category A", "items": ["item1", "item2"]}, {"name": "Category B", "items": ["item3", "item4"]}]}

10. "dictation" — listen and type what you hear
   {"id": 1, "text": "She went to school yesterday.", "audio_url": "", "speed": "normal"}

11. "error_correction" — find and correct errors in sentences
   {"id": 1, "incorrect": "She go to school yesterday.", "correct": "She went to school yesterday.", "hints": "Check the verb tense."}

12. "rank_order" — rank items according to a criterion (e.g. smallest to largest, earliest to latest)
   {"id": 1, "criterion": "Rank from smallest to largest", "items": ["ant", "cat", "elephant", "whale"]}
   Items must be in the CORRECT order. The app shuffles them.

13. "text_sequencing" — arrange sentences or paragraphs in the correct order
   {"id": 1, "segments": ["First, preheat the oven.", "Then, mix the ingredients.", "Next, pour into the pan.", "Finally, bake for 30 minutes."], "level": "sentence"}
   Segments must be in the CORRECT order. level is "sentence" or "paragraph". The app shuffles them.

14. "cloze_listening" — listen to audio and fill in missing words
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
- "write the nationality/word" → multiple_choice (provide options) or type_answer (only if very short 1-word answers)
- "make positive/negative" → multiple_choice (offer the transformed sentences as options)
- "fill in the gaps/blanks" → multiple_choice (with options)
- "match the beginnings with endings" → match_halves
- "put the words in order" → anagram
- Conversations with blanks → multiple_choice
- Categorization/sorting → group_sort
- True/false statements → true_or_false
- Vocabulary guessing with clues → hangman
- "put in order/sequence" (sentences or paragraphs) → text_sequencing
- "rank/order by" (criteria-based ordering) → rank_order
- Vocabulary unscramble / word puzzles → anagram
- "listen and fill in the gaps/blanks" → cloze_listening

AVOID type_answer unless the exercise genuinely requires free-text typing with no options. Prefer multiple_choice when the original exercise has clear correct answers that can be presented as options. Students learn better with interactive formats than open-text typing.

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
      const { summary, level } = body
      if (!summary) {
        return NextResponse.json({ error: 'Summary text required' }, { status: 400 })
      }
      const levelLine = levelInstruction(level)

      const message = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `You are an English language teaching assistant. Analyze this class summary and:

${levelLine}

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
      const { image, imageType, text: inputText, preferredType, level } = body
      if (!image && !inputText) {
        return NextResponse.json({ error: 'Image or text content required' }, { status: 400 })
      }
      const levelLine = levelInstruction(level)

      const exerciseTypeGuide = `
${levelLine}

Choose the BEST exercise type for the content. Available types:

CLASSIC TYPES (use standard questions array):
- "multiple_choice" — choose the correct answer from options. Also use this for sentences with a blank that have a fixed set of options, and for transformation exercises where you offer the transformed sentences as options.

NEW INTERACTIVE TYPES (each has its own data format):
- "anagram" — unscramble letters (single word) or rearrange words (sentence)
- "match_halves" — drag-and-drop matching of keywords to definitions
- "true_or_false" — student decides if a statement is true or false
- "hangman" — student guesses letters to reveal a word, given a clue
- "type_answer" — student types the correct answer (no options given)
- "group_sort" — drag-and-drop items into correct category groups

${preferredType ? `IMPORTANT: The teacher wants exercise type "${preferredType}". Generate content for that type specifically.` : 'Choose the type that best matches the content.'}

Return ONLY a valid JSON object. The format depends on the exercise type:

FOR "multiple_choice":
{
  "title": "Exercise title",
  "subtitle": "Brief description",
  "icon": "relevant emoji",
  "instructions": "Clear instructions",
  "exercise_type": "the_type",
  "questions": [{"id": 1, "prompt": "Question text", "options": ["a", "b", "c"], "correctIndex": 0, "hint": "optional", "explanation": "Why the correct answer is correct (1 short sentence — optional but strongly preferred)."}]
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
        model: HAIKU_MODEL,
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

      // Prevent hallucination: reject conversion if exercise has no real content
      const questions = exercise.questions || []
      const hasRealContent = exercise.groupData ||
        (Array.isArray(questions) && questions.some((q: Record<string, unknown>) => {
          const text = (q.prompt || q.statement || q.text || q.word || q.left || q.incorrect || '') as string
          return text.trim().length > 0
        }))
      if (!hasRealContent) {
        return NextResponse.json({ error: 'Exercise has no content to convert. Add questions first, then change the type.' }, { status: 400 })
      }

      const message = await client.messages.create({
        model: HAIKU_MODEL,
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
  multiple_choice: `"questions": [{"id": 1, "prompt": "Question text", "options": ["a", "b", "c", "d"], "correctIndex": 0, "hint": "", "explanation": "Why the correct answer is correct (1 short sentence)."}]
- Each question needs a prompt, 3-4 options with one correct answer, and the correctIndex pointing to the right one. Include an optional "explanation" field that briefly justifies the correct answer — shown to the student after they check. Use this type also for sentences with a blank (prompt contains ___ and options are the candidate fills), and for transformation drills (prompt is the instruction, options are the candidate transformed sentences).`,
  match_halves: `"questions": [{"id": 1, "left": "to create", "right": "chairs"}, {"id": 2, "left": "it looks", "right": "colorful"}]
- Each pair has a "left" (keyword/beginning) and "right" (definition/ending). Students drag left tiles to match right definitions.`,
  anagram: `"questions": [{"id": 1, "word": "She is going to the market", "clue": "Rearrange the words"}]
- For single words, use just the word (letters get scrambled). For sentences, use the full sentence (words get scrambled). Clue is optional.`,
  true_or_false: `"questions": [{"id": 1, "statement": "The past tense of go is goed.", "isTrue": false, "explanation": "The correct past tense is 'went'."}]
- Each question has a statement, isTrue boolean, and explanation.`,
  hangman: `"questions": [{"id": 1, "word": "VOCABULARY", "clue": "A collection of words known to a person"}]
- Each question has a word (UPPERCASE) and a clue.`,
  type_answer: `"questions": [{"id": 1, "prompt": "What is the past tense of 'go'?", "answer": "went", "hint": ""}]
- Each question has a prompt and the expected typed answer.`,
  group_sort:`Use "groupData" instead of "questions": {"groups": [{"name": "Category A", "items": ["item1", "item2"]}, {"name": "Category B", "items": ["item3", "item4"]}]}
- Set questions to an empty array []. Group related items from the original exercise into meaningful categories.`,
  dictation: `"questions": [{"id": 1, "text": "She went to school yesterday.", "audio_url": "", "speed": "normal"}]
- Each question has the correct text the student must type after listening. audio_url is optional (TTS is auto-generated if empty).`,
  error_correction: `"questions": [{"id": 1, "incorrect": "She go to school yesterday.", "correct": "She went to school yesterday.", "hints": "Check the verb tense."}]
- Each question has an incorrect sentence, the correct version, and an optional hint.`,
  rank_order: `"questions": [{"id": 1, "criterion": "Rank from smallest to largest", "items": ["ant", "cat", "elephant", "whale"]}]
- Each question has a criterion describing the ranking rule and items in the CORRECT order. The app shuffles them for the student.`,
  text_sequencing: `"questions": [{"id": 1, "segments": ["First, preheat the oven.", "Then, mix the ingredients.", "Next, pour into the pan.", "Finally, bake for 30 minutes."], "level": "sentence"}]
- Each question has segments in the CORRECT order. level is "sentence" or "paragraph". The app shuffles them for the student.`,
  cloze_listening: `"questions": [{"id": 1, "text": "The {{1}} sat on the {{2}}.", "blanks": {"1": "cat", "2": "mat"}, "audio_url": ""}]
- text has {{n}} placeholders for blanks. blanks maps numbers to correct words. audio_url is optional (TTS auto-generated if empty). No word bank.`,
} as Record<string, string>)[newType] || 'Use the standard questions format.'}

RULES:
- Keep the same educational content and learning objective
- Adapt the questions naturally to the new format
- For multiple_choice: generate plausible wrong options (distractors)
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

    // ── Generate a Reading (Article) block with AI — rich form path.
    // Supports two modes:
    //   "source": teacher provided text / image / URL; AI rewrites/adapts
    //   "scratch": teacher provided structured form inputs; AI creates from scratch
    // Returns { title, content: { text, source } } for direct insertion
    // into a new Article ContentBlock.
    if (action === 'generate-reading') {
      const {
        mode,                       // 'source' | 'scratch'
        // common
        level,                      // CEFR (A1..C2) — defaults to course level
        length_words,               // number — target word count
        style,                      // free-text or dropdown value
        // source mode
        source_text,                // pasted raw text
        source_url,                 // URL to fetch
        source_image,               // base64 image
        source_image_type,          // 'image/png' etc.
        // scratch mode
        reading_type,               // 'story' | 'article' | 'news' etc.
        plot,                       // free-text
        vocabulary,                 // string[] — must-use words
        narrator_pov,               // '1st' | '3rd' | 'mixed'
        characters,                 // free-text — character names, setting
        grammar_focus,              // free-text
      } = body as Record<string, unknown>

      const m = (mode as string) || 'scratch'
      if (m !== 'source' && m !== 'scratch') {
        return NextResponse.json({ error: 'mode must be "source" or "scratch"' }, { status: 400 })
      }

      // If source mode and source_url provided, fetch the URL server-side
      // (best effort — strip HTML tags). Fall back with a clear error.
      let fetchedSourceText = ''
      if (m === 'source' && source_url && typeof source_url === 'string' && source_url.trim()) {
        try {
          const res = await fetch(source_url.trim(), { headers: { 'User-Agent': 'Mozilla/5.0 EwL-FlashcardsBot' } })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const html = await res.text()
          // Strip <script> and <style> blocks, then strip all tags
          const stripped = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          fetchedSourceText = stripped.slice(0, 12000) // cap at ~3k tokens
        } catch (err) {
          return NextResponse.json({ error: `Could not fetch URL — ${err instanceof Error ? err.message : 'unknown error'}. Paste the text instead.` }, { status: 400 })
        }
      }

      const effectiveSource = [source_text, fetchedSourceText].filter(Boolean).join('\n\n').trim()

      const levelLine = levelInstruction(level)
      const lengthLine = length_words ? `Target length: about ${length_words} words.` : 'Target length: about 400 words.'
      const styleLine = style ? `Style / tone: ${style}.` : ''

      let prompt = ''
      if (m === 'source') {
        prompt = `You are an expert ESL teaching assistant. Rewrite or adapt the source material below into a single piece of reading content for a lesson.

${levelLine}
${lengthLine}
${styleLine}

Rules:
- Keep the topic and key facts faithful to the source.
- Adapt vocabulary and grammar complexity to the CEFR level above.
- Plain prose only — no markdown headers, no bullet lists in the body.
- Output a short, descriptive title.

Return ONLY valid JSON (no markdown, no explanation):
{"title": "Short descriptive title", "content": {"text": "The adapted reading body…", "source": "Made-up or paraphrased source name, or 'Adapted'"}}

Source material:
${effectiveSource || '(see attached image)'}`
      } else {
        const vocabLine = Array.isArray(vocabulary) && vocabulary.length > 0
          ? `Must include these vocabulary words naturally (do not force any that don't fit): ${(vocabulary as string[]).slice(0, 30).join(', ')}.`
          : ''
        const typeLine = reading_type ? `Format: ${reading_type}.` : 'Format: pick whatever fits best.'
        const plotLine = plot ? `Topic / plot: ${plot}.` : ''
        const povLine = narrator_pov ? `Point of view: ${narrator_pov === '1st' ? 'first person' : narrator_pov === '3rd' ? 'third person' : 'mixed'}.` : ''
        const charLine = characters ? `Characters / setting details: ${characters}.` : ''
        const grammarLine = grammar_focus ? `Grammar focus: ${grammar_focus}.` : ''

        prompt = `You are an expert ESL teaching assistant. Write a single piece of reading content for a lesson, from scratch.

${typeLine}
${levelLine}
${lengthLine}
${styleLine}
${plotLine}
${vocabLine}
${povLine}
${charLine}
${grammarLine}

Rules:
- Plain prose only — no markdown headers, no bullet lists in the body.
- Stay strictly within the CEFR level for vocabulary and structure.
- If vocabulary words were provided, use as many as fit naturally — do not force ones that don't fit.
- Output a short, descriptive title.

Return ONLY valid JSON (no markdown, no explanation):
{"title": "Short descriptive title", "content": {"text": "The reading body…", "source": "Original"}}`
      }

      const contentParts: Anthropic.Messages.ContentBlockParam[] = []
      if (m === 'source' && source_image && typeof source_image === 'string') {
        contentParts.push({
          type: 'image',
          source: { type: 'base64', media_type: (source_image_type as 'image/png' | 'image/jpeg') || 'image/png', data: source_image },
        })
      }
      contentParts.push({ type: 'text', text: prompt })

      const message = await client.messages.create({
        model: SONNET_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: contentParts }],
      })
      const textContent = message.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }
      let parsed: { title?: string; content?: { text?: string; source?: string } } | null = null
      try { parsed = JSON.parse(textContent.text) } catch {
        const m2 = textContent.text.match(/\{[\s\S]*\}/)
        if (m2) { try { parsed = JSON.parse(m2[0]) } catch { parsed = null } }
      }
      if (!parsed || !parsed.content) {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
      return NextResponse.json({
        title: parsed.title || 'Reading',
        content: { text: parsed.content.text || '', source: parsed.content.source || '', questions: [], exercises: [] },
      })
    }

    // ── Generate a Grammar block with AI — rich form path.
    // Returns { title, content: { explanation, examples, example_highlights,
    // target_structure, practice_exercises (AttachedExercise[]), pitfalls } }
    // ready to drop into a Grammar ContentBlock.
    if (action === 'generate-grammar') {
      const {
        topic,                  // required: the grammar point
        level,                  // CEFR
        known_grammar,          // free-text — what students already know
        num_exercises,          // 3 | 5 | 8 | 10
        exercise_types,         // string[] subset of MCQ/TF/Type/Error
        vocabulary,             // string[]
        explanation_length,     // 'Short' | 'Medium' | 'Long'
        include_pitfalls,       // boolean
      } = body as Record<string, unknown>

      if (!topic || typeof topic !== 'string' || !topic.trim()) {
        return NextResponse.json({ error: 'Grammar topic is required' }, { status: 400 })
      }
      const levelLine = levelInstruction(level)
      const knownLine = known_grammar && typeof known_grammar === 'string' && known_grammar.trim()
        ? `Students already know: ${(known_grammar as string).trim()}. Don't re-explain it; build on it.`
        : ''
      const vocabList = Array.isArray(vocabulary) ? (vocabulary as string[]).filter((v) => v && v.trim()) : []
      const vocabLine = vocabList.length > 0
        ? `Use these vocabulary words naturally in the example sentences where they fit — do not force any: ${vocabList.slice(0, 30).join(', ')}.`
        : ''
      const nEx = [3, 5, 8, 10].includes(Number(num_exercises)) ? Number(num_exercises) : 5
      const ALLOWED_EX = ['multiple_choice', 'true_or_false', 'type_answer', 'error_correction']
      const reqTypes = Array.isArray(exercise_types)
        ? (exercise_types as string[]).filter((t) => ALLOWED_EX.includes(t))
        : ['multiple_choice']
      const types = reqTypes.length > 0 ? reqTypes : ['multiple_choice']
      const expLen = explanation_length === 'Short' ? '60-100 words' : explanation_length === 'Long' ? '200-300 words' : '100-200 words'
      const pitfallsLine = include_pitfalls
        ? 'Include a "pitfalls" array of 3-5 common mistakes a learner at this level makes with this structure. Each entry: { "mistake": "what they say wrong", "correct": "the fix", "tip": "1-sentence why" }.'
        : 'Set "pitfalls" to an empty array.'

      const EX_SHAPES: Record<string, string> = {
        multiple_choice: `{"id":"e1","type":"multiple_choice","questions":[{"id":"q1","prompt":"…use ___ here","options":["a","b","c","d"],"correctIndex":0,"hint":"","explanation":"Why a is correct (1 sentence)."}]}`,
        true_or_false: `{"id":"e1","type":"true_or_false","questions":[{"id":"q1","statement":"…","isTrue":true,"explanation":"…"}]}`,
        type_answer: `{"id":"e1","type":"type_answer","questions":[{"id":"q1","prompt":"…","answer":"…","hint":""}]}`,
        error_correction: `{"id":"e1","type":"error_correction","questions":[{"id":"q1","incorrect":"He go to school.","correct":"He goes to school.","hints":"Third-person -s"}]}`,
      }
      const shapesList = types.map((t) => `- ${t}: ${EX_SHAPES[t]}`).join('\n')

      const prompt = `You are an expert ESL teaching assistant. Generate a complete Grammar lesson block.

Topic: ${topic}
${levelLine}
${knownLine}
Explanation length: ${expLen}.
${vocabLine}
${pitfallsLine}

Practice exercises:
- Generate ${types.length} exercise${types.length === 1 ? '' : 's'} — one of each requested type below.
- Each exercise should contain ${nEx} questions.
- Drill the target grammar topic specifically.

Requested exercise types (one of each, per the shapes below):
${shapesList}

Also:
- "target_structure" = the specific phrase / word(s) being taught (e.g., "these / those", "third-person -s"). The student runner will highlight this in examples.
- "example_highlights" = parallel to "examples"; for each example, the substring to highlight (a substring of that example). If no clean highlight, use "".
- Provide 4-6 short example sentences. Each example should be self-contained and clearly demonstrate the target structure.

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Short title naming the grammar point",
  "content": {
    "explanation": "Plain-text explanation in the target length.",
    "examples": ["…", "…", "…", "…"],
    "example_highlights": ["…", "…", "…", "…"],
    "target_structure": "the phrase to highlight",
    "practice_exercises": [ /* one per requested type, see shapes */ ],
    "pitfalls": [ /* per the rule above */ ]
  }
}`

      const message = await client.messages.create({
        model: SONNET_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const textContent = message.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }
      let parsed: { title?: string; content?: Record<string, unknown> } | null = null
      try { parsed = JSON.parse(textContent.text) } catch {
        const m = textContent.text.match(/\{[\s\S]*\}/)
        if (m) { try { parsed = JSON.parse(m[0]) } catch { parsed = null } }
      }
      if (!parsed || !parsed.content) {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
      // Stamp ids on practice exercises + their questions so runners that
      // key on id don't collide.
      const c = parsed.content
      const pe = Array.isArray(c.practice_exercises) ? c.practice_exercises : []
      const stamped = pe.map((ex) => {
        const e = ex as { type?: string; questions?: unknown[]; groupData?: unknown }
        const id = `ai-${Math.random().toString(36).slice(2, 9)}`
        const questions = Array.isArray(e.questions)
          ? e.questions.map((q, i) => ({ ...(q as object), id: (q as { id?: string }).id || `q-${id}-${i + 1}` }))
          : undefined
        return { id, type: e.type, questions, groupData: e.groupData }
      })
      return NextResponse.json({
        title: parsed.title || 'Grammar',
        content: {
          explanation: String(c.explanation || ''),
          examples: Array.isArray(c.examples) ? c.examples : [],
          example_highlights: Array.isArray(c.example_highlights) ? c.example_highlights : [],
          target_structure: String(c.target_structure || ''),
          practice_exercises: stamped,
          pitfalls: Array.isArray(c.pitfalls) ? c.pitfalls : [],
          exercises: [], // legacy MCQ field — empty for new generations
        },
      })
    }

    // ── List vocabulary words across all lessons in a course, for the
    // "Pick from course vocabulary" picker modal in the Reading AI form.
    if (action === 'course-vocabulary') {
      const { course_id } = body as { course_id?: string }
      if (!course_id) {
        return NextResponse.json({ error: 'course_id required' }, { status: 400 })
      }
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, title, lesson_date')
        .eq('course_id', course_id)
        .order('lesson_date', { ascending: false })
      if (!lessons || lessons.length === 0) {
        return NextResponse.json({ lessons: [] })
      }
      const lessonIds = lessons.map((l: { id: string }) => l.id)
      const { data: cards } = await supabase
        .from('flashcards')
        .select('lesson_id, word')
        .in('lesson_id', lessonIds)
        .order('order_index', { ascending: true })
      const byLesson: Record<string, string[]> = {}
      ;(cards || []).forEach((c: { lesson_id: string; word: string }) => {
        if (!byLesson[c.lesson_id]) byLesson[c.lesson_id] = []
        if (c.word && c.word.trim()) byLesson[c.lesson_id].push(c.word.trim())
      })
      const result = lessons
        .map((l: { id: string; title: string; lesson_date: string }) => ({
          lesson_id: l.id,
          lesson_title: l.title,
          lesson_date: l.lesson_date,
          words: byLesson[l.id] || [],
        }))
        .filter((l) => l.words.length > 0)
      return NextResponse.json({ lessons: result })
    }

    // ── Suggest follow-up exercises (AttachedExercise[]) from an existing
    // article body. Used by the "Suggest exercises with AI" button on
    // the Reading block editor.
    if (action === 'suggest-exercises-from-reading') {
      const { article_text, exercise_types, count_per_type } = body as {
        article_text?: string
        exercise_types?: string[]
        count_per_type?: number
      }
      if (!article_text || !article_text.trim()) {
        return NextResponse.json({ error: 'article_text required' }, { status: 400 })
      }
      const types = (exercise_types && exercise_types.length > 0
        ? exercise_types
        : ['multiple_choice']
      ).filter((t) =>
        ['multiple_choice', 'true_or_false', 'type_answer', 'group_sort', 'rank_order', 'anagram'].includes(t),
      )
      const N = Math.max(3, Math.min(10, Number(count_per_type) || 5))

      const SHAPES: Record<string, string> = {
        multiple_choice: `{"type":"multiple_choice","questions":[{"id":"u1","prompt":"…","options":["a","b","c","d"],"correctIndex":0,"hint":"","explanation":"Short reason."}]}`,
        true_or_false: `{"type":"true_or_false","questions":[{"id":"u1","statement":"…","isTrue":true,"explanation":"Short reason."}]}`,
        type_answer: `{"type":"type_answer","questions":[{"id":"u1","prompt":"…","answer":"…","hint":""}]}`,
        group_sort: `{"type":"group_sort","groupData":{"groups":[{"name":"Category A","items":["…","…"]},{"name":"Category B","items":["…","…"]}]}}`,
        rank_order: `{"type":"rank_order","questions":[{"id":"u1","criterion":"…","items":["first","second","third","fourth"]}]}`,
        anagram: `{"type":"anagram","questions":[{"id":"u1","word":"…","clue":"…"}]}`,
      }
      const shapesList = types.map((t) => `- ${t}: ${SHAPES[t]}`).join('\n')

      const prompt = `You are an expert ESL teaching assistant. Read the article below and produce comprehension / vocabulary follow-up exercises tied to its content.

Generate ${types.length === 1 ? '1 exercise' : `${types.length} exercises (one of each requested type)`}. Each exercise should have ${N} questions (or items, in the case of group_sort / rank_order).

Requested exercise types (one of each):
${types.join(', ')}

Per-type JSON shape (each exercise object will be added to a top-level "exercises" array):
${shapesList}

Rules:
- All questions must be directly answerable from the article — no outside knowledge.
- For multiple_choice: 3-4 options, ONE correctIndex, options should be plausible distractors based on the article.
- For true_or_false: mix true and false statements roughly evenly.
- For type_answer: keep answers short (1-3 words), case-insensitive.
- For group_sort: 2-3 groups with 3-4 items each, all drawn from the article.
- For rank_order: items must be in the CORRECT order (the runner shuffles).
- For anagram: pick salient single words from the article.

Article:
${article_text}

Return ONLY valid JSON (no markdown, no explanation):
{"exercises": [...]}`

      const message = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const textContent = message.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }
      let parsed: { exercises?: unknown[] } | null = null
      try { parsed = JSON.parse(textContent.text) } catch {
        const m2 = textContent.text.match(/\{[\s\S]*\}/)
        if (m2) { try { parsed = JSON.parse(m2[0]) } catch { parsed = null } }
      }
      if (!parsed || !Array.isArray(parsed.exercises)) {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: textContent.text }, { status: 500 })
      }
      // Stamp ids the runner expects + an id per question.
      const exercises = parsed.exercises.map((ex) => {
        const e = ex as { type?: string; questions?: unknown[]; groupData?: unknown }
        const id = `ai-${Math.random().toString(36).slice(2, 9)}`
        const questions = Array.isArray(e.questions)
          ? e.questions.map((q, i) => ({ ...(q as object), id: (q as { id?: string }).id || `q-${id}-${i + 1}` }))
          : undefined
        return { id, type: e.type, questions, groupData: e.groupData }
      })
      return NextResponse.json({ exercises })
    }

    // ── Generate a content block (Mistakes / Article / Grammar / Dialogue /
    // Writing / Pronunciation) with AI. Returns a `content` object whose
    // shape matches the corresponding BlockContent interface in the
    // lesson editor, so the caller can drop it straight into a new block.
    if (action === 'generate-block') {
      const { block_type, subtype, text: inputText, files, level } = body as {
        block_type: string
        subtype?: string
        text?: string
        files?: { data: string; type: string }[]
        level?: string
      }
      const ALLOWED = ['mistakes', 'article', 'grammar', 'dialogue', 'writing', 'pronunciation']
      if (!block_type || !ALLOWED.includes(block_type)) {
        return NextResponse.json({ error: 'Unsupported block type for AI generation' }, { status: 400 })
      }
      const hasFiles = Array.isArray(files) && files.length > 0
      if (!hasFiles && !(inputText && inputText.trim())) {
        return NextResponse.json({ error: 'Provide text or upload at least one file' }, { status: 400 })
      }

      // Per-block JSON shape + per-block instructions. The shapes mirror
      // the BlockContent interfaces in app/admin/lessons/page.tsx.
      const BLOCK_SPECS: Record<string, { shape: string; rules: string }> = {
        mistakes: {
          shape: `{
  "title": "Block title (short)",
  "mistakes": [
    {
      "original": "The incorrect sentence the student would say or write.",
      "correction": "The corrected version.",
      "explanation": "Short explanation — 1-2 sentences.",
      "practice": [
        {"prompt": "Practice prompt with ___ for the blank.", "options": ["a", "b", "c"], "correctIndex": 0}
      ]
    }
  ]
}`,
          rules: `Generate 4–6 mistake entries. Each one MUST include 1 practice question (MCQ with 2-4 options, correctIndex pointing to the right one). Keep options short and realistic ESL-learner distractors.`,
        },
        article: {
          shape: `{
  "title": "Block title (short, descriptive)",
  "content": {
    "text": "The full article body. 200-400 words. Plain prose. No markdown.",
    "source": "Made up source name or 'Original' if none",
    "questions": [],
    "exercises": []
  }
}`,
          rules: `Generate the article text only. Leave questions and exercises as empty arrays — the teacher adds comprehension exercises afterwards. Make the text engaging and self-contained.`,
        },
        grammar: {
          shape: `{
  "title": "Block title (short, names the grammar point)",
  "content": {
    "explanation": "Clear explanation of the grammar point. 100-200 words. Use plain text — no markdown headers.",
    "examples": ["Example sentence 1.", "Example sentence 2.", "Example sentence 3.", "Example sentence 4."],
    "exercises": [
      {"id": "g1", "prompt": "Practice prompt (use ___ for blanks).", "options": ["a", "b", "c", "d"], "correctIndex": 0}
    ]
  }
}`,
          rules: `Generate explanation + 3-5 example sentences + 4-6 practice MCQ exercises. Practice options should be plausible distractors a learner might pick.`,
        },
        dialogue: {
          shape: `{
  "title": "Block title (short, names the scenario)",
  "content": {
    "scenario": "Describe the situation the AI should role-play with the student. 2-4 sentences. Include who they are, the setting, and the goal.",
    "target_words": ["word1", "word2", "word3", "word4", "word5"],
    "starter_message": "The opening line the AI says to start the conversation."
  }
}`,
          rules: `Generate scenario + 5-10 target vocabulary words for the student to use + a natural opening line.`,
        },
        writing: {
          shape: `{
  "title": "Block title (short, names the writing task)",
  "content": {
    "prompt": "The writing prompt the student responds to. 1-2 sentences.",
    "guidelines": "Specific guidelines: tone, structure, what to include. 2-4 sentences.",
    "word_limit": 150
  }
}`,
          rules: `Generate a realistic writing task. Word limit: 100-300 depending on complexity. Guidelines should be actionable.`,
        },
        pronunciation: {
          shape: `{
  "title": "Block title (short, names the sound or pattern)",
  "content": {
    "words": [
      {"word": "example", "phonetic": "ig-ZAM-pul", "tips": "Tip for pronouncing this word — what to watch out for. 1 sentence."}
    ]
  }
}`,
          rules: `Generate 6-10 target words. Phonetic uses simple syllable-stress notation (CAPS for stressed syllable), NOT IPA. Tips should be student-friendly and concrete.`,
        },
      }

      const spec = BLOCK_SPECS[block_type]
      const subtypeLine = subtype
        ? `The teacher wants this block focused on: "${subtype}". Generate content specifically for that topic.`
        : 'The teacher hasn\'t specified a focus — pick the best angle from the source material.'
      const levelLine = levelInstruction(level)

      const prompt = `You are an expert ESL teaching assistant. Generate a single "${block_type}" content block for a lesson.

${subtypeLine}
${levelLine}

${hasFiles ? '' : `Source material from the teacher:\n${inputText}\n\n`}Block-specific rules:
${spec.rules}

Return ONLY a valid JSON object (no markdown, no explanation), in this exact shape:
${spec.shape}`

      const contentParts: Anthropic.Messages.ContentBlockParam[] = []
      if (hasFiles) {
        for (const f of files!) {
          if (f.type.startsWith('image/')) {
            contentParts.push({
              type: 'image',
              source: { type: 'base64', media_type: f.type as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: f.data },
            })
          } else {
            // For non-image files (pdf, docx) we'd need server-side parsing;
            // for now the teacher can paste content as text. Skip silently.
          }
        }
      }
      contentParts.push({ type: 'text', text: prompt })

      const message = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: contentParts }],
      })
      const textContent = message.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
      }

      const rawText = textContent.text
      let parsed: { title?: string; content?: unknown; mistakes?: unknown } | null = null
      try {
        parsed = JSON.parse(rawText)
      } catch {
        const m = rawText.match(/\{[\s\S]*\}/)
        if (m) {
          try { parsed = JSON.parse(m[0]) } catch { parsed = null }
        }
      }
      if (!parsed) {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: rawText }, { status: 500 })
      }

      // Mistakes uses a flat shape (top-level "mistakes" array); the
      // others wrap the block content in "content". Normalize both into
      // { title, content } where content matches BlockContent shape.
      let title = parsed.title || ''
      let content: unknown
      if (block_type === 'mistakes') {
        content = { mistakes: parsed.mistakes || [] }
      } else {
        content = parsed.content || {}
      }
      if (!title) title = block_type.charAt(0).toUpperCase() + block_type.slice(1)

      return NextResponse.json({ block_type, title, content })
    }

    // Generate multiple FULL exercises (all 14 types) directly from pasted text.
    // Same model path as generate-exercises-from-doc, minus the Google Doc fetch.
    if (action === 'generate-exercises-from-text') {
      const { text, level } = body
      if (!text || typeof text !== 'string' || !text.trim()) {
        return NextResponse.json({ error: 'Text content required' }, { status: 400 })
      }
      const levelLine = levelInstruction(level) ? levelInstruction(level) + '\n\n' : ''

      const message = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: levelLine + EXERCISE_GEN_PROMPT + text }]
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

    // Generate multiple exercises from a Google Doc containing exercises/worksheets
    if (action === 'generate-exercises-from-doc') {
      const { url, level } = body
      if (!url) {
        return NextResponse.json({ error: 'Google Doc URL required' }, { status: 400 })
      }
      const levelLine = levelInstruction(level) ? levelInstruction(level) + '\n\n' : ''

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
        model: HAIKU_MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: levelLine + EXERCISE_GEN_PROMPT + docText }]
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
      const level = body.level as string | undefined
      const levelLine = levelInstruction(level) ? levelInstruction(level) + '\n\n' : ''
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
        messageContent.push({ type: 'text', text: levelLine + EXERCISE_GEN_PROMPT + (hasDocuments && docText ? '\n\nAdditionally, here is text extracted from uploaded documents:\n\n' + docText : '\n\nAnalyze the uploaded image(s) and generate exercises based on the content you see.') })
      } else {
        messageContent.push({ type: 'text', text: levelLine + EXERCISE_GEN_PROMPT + docText })
      }

      const message = await client.messages.create({
        model: HAIKU_MODEL,
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
      const { url, level } = body
      if (!url) {
        return NextResponse.json({ error: 'Google Doc URL required' }, { status: 400 })
      }
      const levelLine = levelInstruction(level) ? levelInstruction(level) + '\n\n' : ''

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
        model: HAIKU_MODEL,
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `${levelLine}You are an expert English language teaching assistant. Analyze this class document and generate four things:

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
