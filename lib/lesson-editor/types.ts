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
  template_category?: string | null
  template_level?: string | null
  course_id?: string | null
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
export type BlockContent = MistakesContent | VideoContent | AudioContent | ArticleContent | DialogueContent | GrammarContent | WritingContent | PronunciationContent

// (legacy page.tsx 277)
export type BlockType = 'mistakes' | 'video' | 'audio' | 'article' | 'dialogue' | 'grammar' | 'writing' | 'pronunciation'

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
