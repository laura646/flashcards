'use client'

// ─────────────────────────────────────────────────────────────────────────────
// useLessonAi — the AI-orchestration "brain" for the 10B redesign editor
// (/admin/lessons). Each function POSTs /api/generate-content (the FROZEN
// server, unchanged) and applies the result via the insert actions returned by
// useLessonEditor.
//
// Request/response shapes are ported EXACTLY from the legacy editor
// app/admin/lessons/page.tsx (left 100% untouched):
//   generate-flashcards          L1719-1745
//   generate-exercises (image)   L1782-1801 / L1898-1934
//   generate-exercises-from-upload (docs/multi)  L1937-1972
//   generate-exercises (text)    L1804-1830 / L1974-2005
//   generate-block               L1635-1668
//   generate-grammar             L1562-1605
//   generate-reading             L1442-1511
//
// Each function sets a generating flag, returns { ok, error? }, and surfaces the
// server's error message (or a generic fallback) instead of the legacy toast.
// fileToBase64 is used for every file/image field.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react'
import type { Flashcard, Exercise, BlockType, Mistake } from './types'
import type { AttachedExercise } from '@/lib/attached-exercise'
import { fileToBase64, mimeFromFilename, isImageFile } from './fileToBase64'

// ── Public form shapes ──

// Grammar AI form (legacy grammar* state -> generate-grammar payload L1574-1584).
// vocabulary is already split into a string[] by the caller (pass-2 picker;
// for now a plain comma textarea split on the form side).
export interface GrammarForm {
  topic: string
  level?: string
  known_grammar?: string
  num_exercises: number
  exercise_types: string[]
  vocabulary?: string[]
  explanation_length: string
  include_pitfalls: boolean
}

// Reading AI form (legacy reading* state -> generate-reading payload L1456-1481).
// mode === 'source' uses source_* fields (text / url / a single optional image
// file); mode === 'scratch' uses the creative-brief fields. vocabulary is a
// pre-split string[].
export interface ReadingForm {
  mode: 'source' | 'scratch'
  level?: string
  length_words?: number
  style?: string
  // source mode
  source_text?: string
  source_url?: string
  source_image?: File
  // scratch mode
  reading_type?: string
  plot?: string
  vocabulary?: string[]
  narrator_pov?: string
  characters?: string
  grammar_focus?: string
}

// Exercise-generation input. A single image file -> single-exercise image path;
// a non-image file or >1 files -> bulk upload path; text only -> single-exercise
// text path. (legacy aiExGenerateFromFiles branching L1869-2006)
export interface GenerateExercisesInput {
  text?: string
  file?: File
  files?: File[]
  preferredType?: string
}

// Block-generation input for mistakes / dialogue / writing / pronunciation.
// The server skips non-image files for these, so pasted text is the reliable
// path; files are still forwarded verbatim. (legacy generateBlockWithAI L1635-1648)
export interface GenerateBlockInput {
  subtype?: string
  text?: string
  files?: File[]
}

export type AiResult = { ok: boolean; error?: string }

// Parsed result of an import-google-doc call (server route.ts L1162-1264).
// Surfaced as `data` on the AiResult so the ImportDocModal can preview the
// suggested title / summary / vocabulary / mistakes BEFORE the teacher applies
// any of them to the lesson.
export interface ImportDocResult {
  suggestedTitle?: string
  flashcards: Flashcard[]
  summary: string
  mistakes: Mistake[]
  docText: string
}

export type ImportDocAiResult = { ok: boolean; error?: string; data?: ImportDocResult }

// One lesson's worth of saved flashcard words, grouped under its title/date.
// Returned by fetchCourseVocabulary (server action 'course-vocabulary',
// route.ts L718-755) and consumed by the VocabPickerModal (task C).
export interface CourseVocabLesson {
  lesson_id: string
  lesson_title: string
  lesson_date: string
  words: string[]
}

export type CourseVocabResult = {
  ok: boolean
  error?: string
  data?: { lessons: CourseVocabLesson[] }
}

// Result of suggestExercisesFromReading (server action
// 'suggest-exercises-from-reading', route.ts L761-839). The server already
// stamps ids + per-question ids and returns the exact AttachedExercise shape,
// so the mapping is a near-passthrough. (task D)
export type SuggestExResult = { ok: boolean; error?: string; exercises?: AttachedExercise[] }

// The slice of useLessonEditor this hook needs to apply generated content.
export interface LessonAiActions {
  appendGeneratedFlashcards: (cards: Flashcard[], suggestedTitle?: string) => void
  appendGeneratedExercises: (exercises: Exercise[]) => void
  appendGeneratedBlock: (blockType: BlockType, title: string, content: unknown) => void
  courseId: string | null
  courseLevel?: string
}

const GENERATE_URL = '/api/generate-content'

// Centralised POST so request/error handling is identical across actions.
async function postGenerate(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      return { ok: false, data, error: (data.error as string) || 'Generation failed' }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, data: {}, error: 'Generation failed' }
  }
}

// Map a raw exercise object from the server to our Exercise shape. Field
// defaults mirror the legacy applyGeneratedExercise / aiExGenerateFromFiles
// inserts (L1918-1925 / L1949-1956). order_index/published are stamped by the
// insert action, so they're left at 0/undefined here.
function mapExercise(ex: Record<string, unknown>): Exercise {
  return {
    title: (ex.title as string) || 'Exercise',
    subtitle: (ex.subtitle as string) || '',
    icon: (ex.icon as string) || '📝',
    instructions: (ex.instructions as string) || '',
    exercise_type: (ex.exercise_type as string) || 'multiple_choice',
    questions: ex.questions || [],
    groupData: ex.groupData || undefined,
    order_index: 0,
  }
}

export function useLessonAi(actions: LessonAiActions) {
  const { appendGeneratedFlashcards, appendGeneratedExercises, appendGeneratedBlock, courseLevel } = actions

  const [generatingFlashcards, setGeneratingFlashcards] = useState(false)
  const [generatingExercises, setGeneratingExercises] = useState(false)
  const [generatingBlock, setGeneratingBlock] = useState(false)
  const [generatingGrammar, setGeneratingGrammar] = useState(false)
  const [generatingReading, setGeneratingReading] = useState(false)
  const [generatingImport, setGeneratingImport] = useState(false)
  const [generatingVocab, setGeneratingVocab] = useState(false)
  const [generatingSuggestEx, setGeneratingSuggestEx] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const { courseId } = actions

  const level = courseLevel || undefined

  // ── Flashcards (legacy generateFlashcards L1719-1745) ──
  // POST { action: 'generate-flashcards', summary, level } ->
  //   { flashcards: [{ word, phonetic, meaning, example, notes }], suggestedTitle? }
  const generateFlashcards = useCallback(async (text: string): Promise<AiResult> => {
    setAiError(null)
    setGeneratingFlashcards(true)
    try {
      const { ok, data, error } = await postGenerate({
        action: 'generate-flashcards',
        summary: text.trim(),
        level,
      })
      if (!ok) {
        setAiError(error || null)
        return { ok: false, error }
      }
      const raw = (data.flashcards as Array<Record<string, unknown>>) || []
      // order_index is re-indexed by appendGeneratedFlashcards.
      const mapped: Flashcard[] = raw.map((fc) => ({
        word: (fc.word as string) || '',
        phonetic: (fc.phonetic as string) || '',
        meaning: (fc.meaning as string) || '',
        example: (fc.example as string) || '',
        notes: (fc.notes as string) || '',
        order_index: 0,
      }))
      appendGeneratedFlashcards(mapped, (data.suggestedTitle as string) || undefined)
      return { ok: true }
    } finally {
      setGeneratingFlashcards(false)
    }
  }, [level, appendGeneratedFlashcards])

  // ── Exercises (legacy aiExGenerateFromFiles L1869-2013) ──
  // Single image file -> generate-exercises { image, imageType } -> { exercise }.
  // Non-image file or multiple files -> generate-exercises-from-upload
  //   { files: [{ data, type }] } -> { exercises: [] }.
  // Text only -> generate-exercises { text } -> { exercise }.
  // opts (optional, from the Article editor's type-picker): `types` constrains
  // generation to exactly those exercise types; `countPerType` sets how many of
  // EACH type. They are forwarded as exercise_types + count_per_type on the
  // upload/image POST bodies (the server steers the prompt the same way
  // generate-exercises-from-text does). The text path keeps preferredType. Omit
  // opts to keep the free-mixing default behaviour.
  const generateExercises = useCallback(async (
    input: GenerateExercisesInput,
    opts?: { types?: string[]; countPerType?: number },
  ): Promise<AiResult> => {
    setAiError(null)
    setGeneratingExercises(true)
    try {
      const { text, preferredType } = input
      const exercise_types = opts?.types && opts.types.length > 0 ? opts.types : undefined
      const count_per_type = opts?.countPerType
      // Normalise file inputs to a single list.
      const fileList: File[] = input.files && input.files.length > 0
        ? input.files
        : input.file
          ? [input.file]
          : []

      // Single image file -> single-exercise image path.
      if (fileList.length === 1 && isImageFile(fileList[0])) {
        const f = fileList[0]
        const base64 = await fileToBase64(f)
        const { ok, data, error } = await postGenerate({
          action: 'generate-exercises',
          image: base64,
          imageType: f.type || mimeFromFilename(f.name) || 'image/png',
          preferredType: preferredType || undefined,
          exercise_types,
          count_per_type,
          level,
        })
        if (!ok) {
          setAiError(error || null)
          return { ok: false, error }
        }
        // When types were picked the server returns { exercises: [...] }
        // (count_per_type of each); otherwise the legacy single { exercise }.
        const imgArray = (data.exercises as Array<Record<string, unknown>>) || []
        if (imgArray.length > 0) {
          appendGeneratedExercises(imgArray.map(mapExercise))
        } else if (data.exercise) {
          appendGeneratedExercises([mapExercise(data.exercise as Record<string, unknown>)])
        }
        return { ok: true }
      }

      // Non-image file, or multiple files -> bulk upload path.
      if (fileList.length > 0) {
        const files = await Promise.all(
          fileList.map(async (f) => ({
            data: await fileToBase64(f),
            type: f.type || mimeFromFilename(f.name) || 'application/pdf',
          })),
        )
        const { ok, data, error } = await postGenerate({
          action: 'generate-exercises-from-upload',
          files,
          exercise_types,
          count_per_type,
          level,
        })
        if (!ok) {
          setAiError(error || null)
          return { ok: false, error }
        }
        const raw = (data.exercises as Array<Record<string, unknown>>) || []
        if (raw.length === 0) {
          const msg = 'No exercises could be generated from the files'
          setAiError(msg)
          return { ok: false, error: msg }
        }
        appendGeneratedExercises(raw.map(mapExercise))
        return { ok: true }
      }

      // Text only -> single-exercise text path.
      if (text && text.trim()) {
        const { ok, data, error } = await postGenerate({
          action: 'generate-exercises',
          text: text.trim(),
          preferredType: preferredType || undefined,
          level,
        })
        if (!ok) {
          setAiError(error || null)
          return { ok: false, error }
        }
        if (data.exercise) appendGeneratedExercises([mapExercise(data.exercise as Record<string, unknown>)])
        return { ok: true }
      }

      const msg = 'Please upload files or paste text content'
      setAiError(msg)
      return { ok: false, error: msg }
    } finally {
      setGeneratingExercises(false)
    }
  }, [level, appendGeneratedExercises])

  // ── Exercises from text -> FULL Exercise[] (any of the 13 types) ──
  // POST { action: 'generate-exercises-from-text', text, level?, exercise_types?,
  //   count_per_type? } -> { exercises: [...] }. Unlike generateExercises (single
  //   exercise from a short snippet), this runs the bulk EXERCISE_GEN_PROMPT over
  //   a larger body of text and returns an ARRAY of full standalone exercises,
  //   mapped via the shared mapExercise. Does NOT apply anything itself — the
  //   caller decides what to do with the returned exercises (e.g. attach to a
  //   media block).
  //
  //   opts (optional, from the Article editor's type-picker): `types` constrains
  //   generation to exactly those exercise types; `countPerType` sets how many of
  //   EACH type. Omit opts to keep the free-mixing default behaviour.
  const generateExercisesFromText = useCallback(
    async (
      text: string,
      opts?: { types?: string[]; countPerType?: number },
    ): Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }> => {
      setAiError(null)
      if (!text || !text.trim()) {
        const msg = 'Add some text first'
        setAiError(msg)
        return { ok: false, error: msg }
      }
      setGeneratingExercises(true)
      try {
        const { ok, data, error } = await postGenerate({
          action: 'generate-exercises-from-text',
          text: text.trim(),
          level,
          exercise_types: opts?.types && opts.types.length > 0 ? opts.types : undefined,
          count_per_type: opts?.countPerType,
        })
        if (!ok) {
          setAiError(error || null)
          return { ok: false, error }
        }
        const raw = (data.exercises as Array<Record<string, unknown>>) || []
        if (raw.length === 0) {
          const msg = 'No exercises could be generated from the text'
          setAiError(msg)
          return { ok: false, error: msg }
        }
        return { ok: true, exercises: raw.map(mapExercise) }
      } finally {
        setGeneratingExercises(false)
      }
    },
    [level],
  )

  // ── Exercises from an UPLOAD -> FULL Exercise[] (any of the 13 types) ──
  // The returning sibling of generateExercises for the Article editor's
  // "Generate with AI" panel. Unlike generateExercises (which auto-applies the
  // result as standalone lesson items via appendGeneratedExercises), this RETURNS
  // the mapped Exercise[] so the caller can merge them into a specific block's
  // follow-up list (content.exercises).
  //
  // Routing mirrors generateExercises: a single image file -> generate-exercises
  // (image, steered) -> { exercises }; a non-image file or multiple files ->
  // generate-exercises-from-upload -> { exercises }. opts.types / opts.countPerType
  // are forwarded as exercise_types + count_per_type so the chosen 13-type subset
  // is honoured (count_per_type of EACH). Applies nothing itself.
  const generateExercisesFromFiles = useCallback(
    async (
      inputFiles: File[],
      opts?: { types?: string[]; countPerType?: number },
    ): Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }> => {
      setAiError(null)
      const fileList = inputFiles.filter(Boolean)
      if (fileList.length === 0) {
        const msg = 'Choose a file to generate from'
        setAiError(msg)
        return { ok: false, error: msg }
      }
      const exercise_types =
        opts?.types && opts.types.length > 0 ? opts.types : undefined
      const count_per_type = opts?.countPerType
      setGeneratingExercises(true)
      try {
        // Single image -> steered image path; everything else -> bulk upload path.
        if (fileList.length === 1 && isImageFile(fileList[0])) {
          const f = fileList[0]
          const base64 = await fileToBase64(f)
          const { ok, data, error } = await postGenerate({
            action: 'generate-exercises',
            image: base64,
            imageType: f.type || mimeFromFilename(f.name) || 'image/png',
            exercise_types,
            count_per_type,
            level,
          })
          if (!ok) {
            setAiError(error || null)
            return { ok: false, error }
          }
          // Steered image path returns { exercises }; legacy returns { exercise }.
          const arr = (data.exercises as Array<Record<string, unknown>>) || []
          const mapped =
            arr.length > 0
              ? arr.map(mapExercise)
              : data.exercise
                ? [mapExercise(data.exercise as Record<string, unknown>)]
                : []
          if (mapped.length === 0) {
            const msg = 'No exercises could be generated from the image'
            setAiError(msg)
            return { ok: false, error: msg }
          }
          return { ok: true, exercises: mapped }
        }

        const files = await Promise.all(
          fileList.map(async (f) => ({
            data: await fileToBase64(f),
            type: f.type || mimeFromFilename(f.name) || 'application/pdf',
          })),
        )
        const { ok, data, error } = await postGenerate({
          action: 'generate-exercises-from-upload',
          files,
          exercise_types,
          count_per_type,
          level,
        })
        if (!ok) {
          setAiError(error || null)
          return { ok: false, error }
        }
        const raw = (data.exercises as Array<Record<string, unknown>>) || []
        if (raw.length === 0) {
          const msg = 'No exercises could be generated from the files'
          setAiError(msg)
          return { ok: false, error: msg }
        }
        return { ok: true, exercises: raw.map(mapExercise) }
      } finally {
        setGeneratingExercises(false)
      }
    },
    [level],
  )

  // ── Block (mistakes / dialogue / writing / pronunciation) ──
  // (legacy generateBlockWithAI L1635-1668)
  // POST { action: 'generate-block', block_type, subtype?, text?, files?, level? }
  //   -> { block_type, title, content } -> appendGeneratedBlock.
  const generateBlock = useCallback(async (blockType: BlockType, input: GenerateBlockInput): Promise<AiResult> => {
    setAiError(null)
    setGeneratingBlock(true)
    try {
      const { subtype, text } = input
      const files = input.files && input.files.length > 0
        ? await Promise.all(
            input.files.map(async (f) => ({
              data: await fileToBase64(f),
              type: f.type || mimeFromFilename(f.name) || 'application/pdf',
            })),
          )
        : undefined
      const { ok, data, error } = await postGenerate({
        action: 'generate-block',
        block_type: blockType,
        subtype: subtype || undefined,
        text: text?.trim() || undefined,
        files,
        level,
      })
      if (!ok) {
        setAiError(error || null)
        return { ok: false, error }
      }
      appendGeneratedBlock(blockType, (data.title as string) || '', data.content)
      return { ok: true }
    } finally {
      setGeneratingBlock(false)
    }
  }, [level, appendGeneratedBlock])

  // ── Grammar (legacy generateGrammarWithAI L1562-1605) ──
  // POST { action: 'generate-grammar', topic, level?, known_grammar?,
  //   num_exercises, exercise_types[], vocabulary?[], explanation_length,
  //   include_pitfalls } -> { title, content } -> appendGeneratedBlock('grammar').
  const generateGrammar = useCallback(async (form: GrammarForm): Promise<AiResult> => {
    setAiError(null)
    if (!form.topic.trim()) {
      const msg = 'Grammar topic is required'
      setAiError(msg)
      return { ok: false, error: msg }
    }
    setGeneratingGrammar(true)
    try {
      const { ok, data, error } = await postGenerate({
        action: 'generate-grammar',
        topic: form.topic.trim(),
        level: form.level || level,
        known_grammar: form.known_grammar?.trim() || undefined,
        num_exercises: form.num_exercises,
        exercise_types: form.exercise_types,
        vocabulary: form.vocabulary && form.vocabulary.length > 0 ? form.vocabulary : undefined,
        explanation_length: form.explanation_length,
        include_pitfalls: form.include_pitfalls,
      })
      if (!ok) {
        setAiError(error || null)
        return { ok: false, error }
      }
      appendGeneratedBlock('grammar', (data.title as string) || 'Grammar', data.content)
      return { ok: true }
    } finally {
      setGeneratingGrammar(false)
    }
  }, [level, appendGeneratedBlock])

  // ── Reading (legacy generateReadingWithAI L1442-1511) ──
  // POST { action: 'generate-reading', mode, level?, length_words?, style?,
  //   ...(source: source_text/source_url/source_image/source_image_type)
  //    or (scratch: reading_type/plot/vocabulary[]/narrator_pov/characters/
  //        grammar_focus) } -> { title, content } -> appendGeneratedBlock('article').
  const generateReading = useCallback(async (form: ReadingForm): Promise<AiResult> => {
    setAiError(null)
    setGeneratingReading(true)
    try {
      const payload: Record<string, unknown> = {
        action: 'generate-reading',
        mode: form.mode,
        level: form.level || level,
        length_words: form.length_words || undefined,
        style: form.style?.trim() || undefined,
      }
      if (form.mode === 'source') {
        let source_image: string | undefined
        let source_image_type: string | undefined
        if (form.source_image) {
          source_image = await fileToBase64(form.source_image)
          source_image_type = form.source_image.type || mimeFromFilename(form.source_image.name) || 'image/png'
        }
        payload.source_text = form.source_text?.trim() || undefined
        payload.source_url = form.source_url?.trim() || undefined
        payload.source_image = source_image
        payload.source_image_type = source_image_type
        if (!payload.source_text && !payload.source_url && !payload.source_image) {
          const msg = 'Provide source text, URL, or an image'
          setAiError(msg)
          return { ok: false, error: msg }
        }
      } else {
        payload.reading_type = form.reading_type || undefined
        payload.plot = form.plot?.trim() || undefined
        payload.vocabulary = form.vocabulary && form.vocabulary.length > 0 ? form.vocabulary : undefined
        payload.narrator_pov = form.narrator_pov || undefined
        payload.characters = form.characters?.trim() || undefined
        payload.grammar_focus = form.grammar_focus?.trim() || undefined
      }
      const { ok, data, error } = await postGenerate(payload)
      if (!ok) {
        setAiError(error || null)
        return { ok: false, error }
      }
      appendGeneratedBlock('article', (data.title as string) || 'Reading', data.content)
      return { ok: true }
    } finally {
      setGeneratingReading(false)
    }
  }, [level, appendGeneratedBlock])

  // ── Google-Doc import (legacy importFromGoogleDoc, page.tsx L2017-2070) ──
  // POST { action: 'import-google-doc', url, level? } -> the server fetches the
  // publicly-shared doc and returns { suggestedTitle, flashcards, summary,
  // mistakes, docText }. Unlike the other actions this does NOT apply anything
  // itself — it parses + returns the result as `data` so the ImportDocModal can
  // preview it, and the caller applies the chosen parts via the editor hook.
  const importGoogleDoc = useCallback(async (url: string): Promise<ImportDocAiResult> => {
    setAiError(null)
    if (!url.trim()) {
      const msg = 'Please paste a Google Docs link'
      setAiError(msg)
      return { ok: false, error: msg }
    }
    setGeneratingImport(true)
    try {
      const { ok, data, error } = await postGenerate({
        action: 'import-google-doc',
        url: url.trim(),
        level,
      })
      if (!ok) {
        setAiError(error || null)
        return { ok: false, error }
      }
      const rawCards = (data.flashcards as Array<Record<string, unknown>>) || []
      const flashcards: Flashcard[] = rawCards.map((fc, i) => ({
        word: (fc.word as string) || '',
        phonetic: (fc.phonetic as string) || '',
        meaning: (fc.meaning as string) || '',
        example: (fc.example as string) || '',
        notes: (fc.notes as string) || '',
        order_index: i,
      }))
      const rawMistakes = (data.mistakes as Array<Record<string, unknown>>) || []
      const mistakes: Mistake[] = rawMistakes.map((m) => ({
        original: (m.original as string) || '',
        correction: (m.correction as string) || '',
        explanation: (m.explanation as string) || '',
        practice: (m.practice as Mistake['practice']) || [],
      }))
      const result: ImportDocResult = {
        suggestedTitle: (data.suggestedTitle as string) || undefined,
        flashcards,
        summary: (data.summary as string) || '',
        mistakes,
        docText: (data.docText as string) || '',
      }
      return { ok: true, data: result }
    } finally {
      setGeneratingImport(false)
    }
  }, [level])

  // ── Course vocabulary (task C; legacy openVocabPicker, page.tsx L1388-1420) ──
  // POST { action: 'course-vocabulary', course_id } -> { lessons: [{ lesson_id,
  // lesson_title, lesson_date, words: string[] }] }. Needs a saved course; the
  // editor only has a courseId once the lesson is attached to a course.
  const fetchCourseVocabulary = useCallback(async (): Promise<CourseVocabResult> => {
    setAiError(null)
    if (!courseId) {
      return { ok: false, error: 'Save the lesson to a course first' }
    }
    setGeneratingVocab(true)
    try {
      const { ok, data, error } = await postGenerate({
        action: 'course-vocabulary',
        course_id: courseId,
      })
      if (!ok) {
        setAiError(error || null)
        return { ok: false, error }
      }
      const rawLessons = (data.lessons as Array<Record<string, unknown>>) || []
      const lessons: CourseVocabLesson[] = rawLessons.map((l) => ({
        lesson_id: (l.lesson_id as string) || '',
        lesson_title: (l.lesson_title as string) || 'Untitled lesson',
        lesson_date: (l.lesson_date as string) || '',
        words: Array.isArray(l.words) ? (l.words as string[]).filter(Boolean) : [],
      }))
      return { ok: true, data: { lessons } }
    } finally {
      setGeneratingVocab(false)
    }
  }, [courseId])

  // ── Suggest exercises from a reading body (task D; legacy
  // suggestExercisesForBlock, page.tsx L1513-1559) ──
  // POST { action: 'suggest-exercises-from-reading', article_text,
  //   exercise_types[], count_per_type } -> { exercises: AttachedExercise[] }.
  // The server stamps ids + per-question ids, so we pass the shape through.
  const suggestExercisesFromReading = useCallback(
    async (articleText: string, types: string[], count: number): Promise<SuggestExResult> => {
      setAiError(null)
      if (!articleText.trim()) {
        const msg = 'Add reading text first'
        setAiError(msg)
        return { ok: false, error: msg }
      }
      if (types.length === 0) {
        const msg = 'Pick at least one exercise type'
        setAiError(msg)
        return { ok: false, error: msg }
      }
      setGeneratingSuggestEx(true)
      try {
        const { ok, data, error } = await postGenerate({
          action: 'suggest-exercises-from-reading',
          article_text: articleText,
          exercise_types: types,
          count_per_type: count,
        })
        if (!ok) {
          setAiError(error || null)
          return { ok: false, error }
        }
        const exercises = (data.exercises as AttachedExercise[]) || []
        if (exercises.length === 0) {
          const msg = 'No exercises could be generated from the reading'
          setAiError(msg)
          return { ok: false, error: msg }
        }
        return { ok: true, exercises }
      } finally {
        setGeneratingSuggestEx(false)
      }
    },
    [],
  )

  const generating =
    generatingFlashcards || generatingExercises || generatingBlock || generatingGrammar || generatingReading

  return {
    // per-action generating flags + a combined one + last error
    generating,
    generatingFlashcards,
    generatingExercises,
    generatingBlock,
    generatingGrammar,
    generatingReading,
    generatingImport,
    generatingVocab,
    generatingSuggestEx,
    aiError,
    setAiError,

    // actions
    generateFlashcards,
    generateExercises,
    generateExercisesFromText,
    generateExercisesFromFiles,
    generateBlock,
    generateGrammar,
    generateReading,
    importGoogleDoc,
    fetchCourseVocabulary,
    suggestExercisesFromReading,
  }
}

export type UseLessonAi = ReturnType<typeof useLessonAi>
