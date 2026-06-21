// ─────────────────────────────────────────────────────────────────────────────
// Lesson-editor shared types + helpers (10B redesign)
//
// These declarations are COPIED VERBATIM from the legacy editor
// app/admin/lessons/page.tsx so the new /admin-beta editor shares the exact
// same data contract. Do NOT edit the legacy file. If the legacy shapes change,
// re-sync this file by hand. Line references below point at the legacy source
// as of the port (page.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import type { AttachedExercise } from '@/lib/attached-exercise'
import type { ReadingExercise } from '@/lib/ielts/types'

// validateMcqQuestion lives in the shared McqOptionsList component and is already
// an exported function used by the legacy saveLesson sweep. Re-export it here so
// the new editor imports it from a single non-legacy module.
export { validateMcqQuestion } from '@/components/McqOptionsList'

export type { AttachedExercise }

// ── Types (legacy page.tsx 32-49) ──

export interface Lesson {
  id: string
  title: string
  lesson_date: string
  summary: string | null
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
  flashcard_count?: number
  exercise_count?: number
  block_counts?: Record<string, number>
  lesson_type?: string
  is_template?: boolean
  // True when this content has been shared to the School Library (Phase 2).
  // Present on the content-bank list payload so the UI can show a "Shared"
  // badge and gate the unshare action. Absent on older rows → treat as false.
  is_shared?: boolean
  template_category?: string | null
  template_level?: string | null
  course_id?: string | null
  // Email of the teacher who created the lesson. Present on the GET list
  // payload (the query uses .select('*')); used by My Library to filter
  // "mine". May be missing on older rows — treat absent as not-mine.
  created_by?: string | null
  // IDs of the personal folders this lesson is filed under (many-to-many via
  // lesson_folders). Added by GET /api/lessons so My Library can place each
  // lesson under its folder(s) client-side without an N+1 lookup. Empty array
  // when the lesson is in no folder.
  folder_ids?: string[]
}

// (legacy page.tsx 50-61)
export interface Flashcard {
  id?: string
  lesson_id?: string
  word: string
  phonetic: string
  meaning: string
  example: string
  notes: string
  image_url?: string
  order_index: number
}

// (legacy page.tsx 62-73)
export interface ExerciseQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  // Optional: when present, the question is in "select all that apply" mode.
  // Student sees checkboxes; all-or-nothing scoring against this set.
  correctIndices?: number[]
  hint: string
  explanation?: string
}

// (legacy page.tsx 74-94)
export interface Exercise {
  id?: string
  lesson_id?: string
  title: string
  subtitle: string
  icon: string
  instructions: string
  exercise_type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions: any  // Shape varies by exercise_type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupData?: any  // For group_sort type
  order_index: number
  points_per_answer?: number
  completion_bonus?: number
  is_mandatory?: boolean
  skills?: string[]             // Phase C: multi-select skill tags
  cefr_level?: string | null    // Phase C: A1 / A2 / B1 / B2 / C1 / C2
  test_type?: string | null     // null = regular practice; or review / mid_course / end_of_course
  published?: boolean           // Issue #6: per-block publish toggle
}

// ── Content Block Types (legacy page.tsx 189-273) ──

export interface MistakePractice {
  prompt: string
  options: string[]
  correctIndex: number
}

export interface Mistake {
  original: string
  correction: string
  explanation: string
  practice: MistakePractice[]
}

// (legacy page.tsx 204-206)
export interface MistakesContent {
  mistakes: Mistake[]
}

export interface MCQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
}

export interface VideoContent {
  youtube_url: string
  questions: MCQuestion[]
  // Phase C will populate this for new content; legacy `questions` stays
  // for backward compatibility.
  exercises?: import('@/lib/attached-exercise').AttachedExercise[]
}

export interface AudioContent {
  audio_url: string
  exercises: import('@/lib/attached-exercise').AttachedExercise[]
}

export interface ArticleContent {
  text: string
  source: string
  questions: MCQuestion[]
  // Phase C addition: same shape as Video / Audio. Legacy `questions`
  // is migrated on first save by the editor.
  exercises?: import('@/lib/attached-exercise').AttachedExercise[]
}

export interface DialogueContent {
  scenario: string
  target_words: string[]
  starter_message: string
}

export interface GrammarPitfall {
  mistake: string
  correct: string
  tip: string
}

// (legacy page.tsx 248-257)
export interface GrammarContent {
  explanation: string
  examples: string[]
  exercises: MCQuestion[]                              // legacy MCQ-only
  // Phase R-3 additions — all optional for backward compat.
  target_structure?: string                            // phrase to highlight in examples
  example_highlights?: string[]                        // parallel to examples
  practice_exercises?: import('@/lib/attached-exercise').AttachedExercise[]
  pitfalls?: GrammarPitfall[]
}

export interface WritingContent {
  prompt: string
  guidelines: string
  word_limit: number
}

export interface PronunciationWord {
  word: string
  phonetic: string
  tips: string
}

export interface PronunciationContent {
  words: PronunciationWord[]
}

// (legacy page.tsx 275)
export type BlockContent = MistakesContent | VideoContent | AudioContent | ArticleContent | DialogueContent | GrammarContent | WritingContent | PronunciationContent | ReadingExercise

// (legacy page.tsx 277)
export type BlockType = 'mistakes' | 'video' | 'audio' | 'article' | 'dialogue' | 'grammar' | 'writing' | 'pronunciation' | 'ielts_reading'

// (legacy page.tsx 279-288)
export interface ContentBlock {
  id?: string
  lesson_id?: string
  block_type: BlockType
  title: string
  content: BlockContent
  order_index: number
  collapsed?: boolean
  published?: boolean           // Issue #6: per-block publish toggle
}

// Unified content item: can be flashcards, exercise, or a content block
// (legacy page.tsx 291-300)
export type ContentItemType = 'flashcards' | 'exercise' | BlockType
export interface ContentItem {
  type: ContentItemType
  // For flashcards: stores the flashcards array
  // For exercise: stores the Exercise object
  // For blocks: stores the ContentBlock
  data: Flashcard[] | Exercise | ContentBlock
  collapsed: boolean
  order_index: number
}

export type View = 'list' | 'editor'

// ── Block Config (legacy page.tsx 306-317) ──

export const BLOCK_CONFIG: Record<ContentItemType, { label: string; icon: string; color: string }> = {
  flashcards: { label: 'Vocabulary / Flashcards', icon: '📚', color: '#416ebe' },
  exercise: { label: 'Exercise', icon: '🎯', color: '#8b5cf6' },
  mistakes: { label: 'Error Corrections', icon: '❗', color: '#ef4444' },
  video: { label: 'Video', icon: '🎬', color: '#f59e0b' },
  audio: { label: 'Audio', icon: '🎧', color: '#0ea5e9' },
  article: { label: 'Reading / Article', icon: '📰', color: '#10b981' },
  dialogue: { label: 'AI Dialogue Practice', icon: '💬', color: '#06b6d4' },
  grammar: { label: 'Grammar', icon: '📖', color: '#8b5cf6' },
  writing: { label: 'Writing Task', icon: '✏️', color: '#f97316' },
  pronunciation: { label: 'Pronunciation', icon: '🔊', color: '#ec4899' },
  ielts_reading: { label: 'IELTS Reading', icon: '📖', color: '#0d9488' },
}

// ── Helpers ──

// (legacy page.tsx 380-399) — copied verbatim
// Returns the canonical default content for a newly-created block of each type.
export function createDefaultContent(type: BlockType): BlockContent {
  switch (type) {
    case 'mistakes':
      return { mistakes: [{ original: '', correction: '', explanation: '', practice: [] }] }
    case 'video':
      return { youtube_url: '', questions: [] }
    case 'audio':
      return { audio_url: '', exercises: [] }
    case 'article':
      return { text: '', source: '', questions: [] }
    case 'dialogue':
      return { scenario: '', target_words: [], starter_message: '' }
    case 'grammar':
      return { explanation: '', examples: [''], exercises: [] }
    case 'writing':
      return { prompt: '', guidelines: '', word_limit: 150 }
    case 'pronunciation':
      return { words: [{ word: '', phonetic: '', tips: '' }] }
    case 'ielts_reading':
      return { passage: { paragraphs: [] }, instructions: '', questionGroups: [] }
  }
}

// (legacy page.tsx 3677-3692) — copied verbatim
// Short one-line summary shown on a collapsed content item.
export function getBlockSummary(item: ContentItem): string {
  switch (item.type) {
    case 'flashcards': {
      const fc = item.data as Flashcard[]
      return `${fc.length} flashcard${fc.length !== 1 ? 's' : ''}`
    }
    case 'exercise': {
      const ex = item.data as Exercise
      return ex.title || `${ex.questions.length} question${ex.questions.length !== 1 ? 's' : ''}`
    }
    default: {
      const block = item.data as ContentBlock
      return block.title || 'Untitled'
    }
  }
}

// (legacy page.tsx 417-420) — copied verbatim
export function normalizeExerciseType(t: string | null | undefined): string {
  if (t === 'multiple-choice') return 'multiple_choice'
  return t || ''
}

// ── Exercise constants (legacy page.tsx) — copied verbatim ──

// Optional test-type tag for the reports "Tests" section
// (legacy page.tsx 97-102)
export const TEST_TYPE_OPTIONS = [
  { value: '', label: 'Practice (default)' },
  { value: 'review', label: 'Review test' },
  { value: 'mid_course', label: 'Mid-course test' },
  { value: 'end_of_course', label: 'End-of-course test' },
] as const

// Phase C: valid skill tags (displayed in editor + used by reports)
// (legacy page.tsx 105-113)
export const SKILL_OPTIONS = [
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'listening', label: 'Listening' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'pronunciation', label: 'Pronunciation' },
] as const

// (legacy page.tsx 115)
export const CEFR_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

// fill_blank and transform were removed from the picker — fill_blank was
// effectively MCQ-with-a-blank (use multiple_choice instead) and transform
// was MCQ-with-a-transformation-prompt (use multiple_choice). Existing
// exercises of those types continue to render via the default runner.
// (legacy page.tsx 121-138)
export const EXERCISE_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: '🎯' },
  { value: 'match_halves', label: 'Match Halves', icon: '🧩' },
  { value: 'true_or_false', label: 'True or False', icon: '✅' },
  { value: 'hangman', label: 'Hangman', icon: '🎮' },
  { value: 'type_answer', label: 'Type the Answer', icon: '⌨️' },
  // complete_sentence was removed from the picker — existing exercises
  // keep rendering via the gap-fill builder + CompleteSentenceRunner.
  // Use multiple_choice for blanks-with-options going forward.
  { value: 'group_sort', label: 'Group Sort', icon: '🗂️' },
  { value: 'dictation', label: 'Dictation', icon: '🎧' },
  { value: 'error_correction', label: 'Error Correction', icon: '🔍' },
  { value: 'rank_order', label: 'Rank Order', icon: '🔢' },
  { value: 'text_sequencing', label: 'Text Sequencing', icon: '📄' },
  { value: 'anagram', label: 'Unjumble', icon: '🔀' },
  { value: 'cloze_listening', label: 'Cloze Listening', icon: '🎧' },
  { value: 'odd_one_out', label: 'Odd One Out', icon: '🚫' },
]

// (legacy page.tsx 158-176)
export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  fill_blank: 'Fill in the Blank',
  match_halves: 'Match Halves',
  transform: 'Transform',
  true_or_false: 'True or False',
  hangman: 'Hangman',
  type_answer: 'Type the Answer',
  complete_sentence: 'Complete the Sentence',
  group_sort: 'Group Sort',
  dictation: 'Dictation',
  error_correction: 'Error Correction',
  rank_order: 'Rank Order',
  text_sequencing: 'Text Sequencing',
  anagram: 'Unjumble',
  unjumble: 'Unjumble',
  cloze_listening: 'Cloze Listening',
  odd_one_out: 'Odd One Out',
}

// ── Exercise helpers (legacy page.tsx) — copied verbatim ──

// (legacy page.tsx 401-411)
export function createDefaultExercise(orderIndex: number): Exercise {
  return {
    title: '',
    subtitle: '',
    icon: '',
    instructions: '',
    exercise_type: 'multiple_choice',
    questions: [{ id: crypto.randomUUID(), prompt: '', options: ['', ''], correctIndex: -1, hint: '' }],
    order_index: orderIndex,
  }
}

// Empty question seed for each exercise type, so changing the type in
// the picker resets the JSON editor to the right schema (matching what
// the runner expects). Without this, a new exercise defaulted to MCQ
// keeps its MCQ-shaped questions even after the teacher picks Hangman /
// Dictation / etc., and the runner can't render it.
// (legacy page.tsx 427-461)
export function defaultDataForType(type: string): { questions: unknown[]; groupData?: unknown } {
  const newId = () => crypto.randomUUID()
  switch (type) {
    case 'multiple_choice':
    case 'multiple-choice':
      return { questions: [{ id: newId(), prompt: '', options: ['', ''], correctIndex: -1, hint: '' }] }
    case 'match_halves':
      return { questions: [{ id: newId(), left: '', right: '' }] }
    case 'true_or_false':
      return { questions: [{ id: newId(), statement: '', isTrue: true, explanation: '' }] }
    case 'hangman':
    case 'anagram':
      return { questions: [{ id: newId(), word: '', clue: '' }] }
    case 'type_answer':
      return { questions: [{ id: newId(), prompt: '', answer: '', hint: '' }] }
    case 'complete_sentence':
      return { questions: [{ id: newId(), text: '', blanks: {}, wordBank: [] }] }
    case 'group_sort':
      return { questions: [], groupData: { groups: [{ name: '', items: [] }] } }
    case 'dictation':
      return { questions: [{ id: newId(), text: '', audio_url: '', speed: 'normal' }] }
    case 'error_correction':
      return { questions: [{ id: newId(), incorrect: '', correct: '', hints: '' }] }
    case 'rank_order':
      return { questions: [{ id: newId(), criterion: '', items: ['', '', ''] }] }
    case 'text_sequencing':
      return { questions: [{ id: newId(), segments: ['', '', ''], level: 'sentence' }] }
    case 'cloze_listening':
      return { questions: [{ id: newId(), text: '', blanks: {}, audio_url: '' }] }
    case 'odd_one_out':
      return { questions: [{ id: newId(), items: ['', '', '', ''], oddIndex: 0, explanation: '' }] }
    default:
      return { questions: [{ id: newId(), prompt: '', options: ['', ''], correctIndex: -1, hint: '' }] }
  }
}

// (legacy page.tsx 463-465)
export function createMCQuestion(): MCQuestion {
  return { id: crypto.randomUUID(), prompt: '', options: ['', ''], correctIndex: -1 }
}
