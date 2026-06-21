// ── Shared block content types ──
// Lifted verbatim from app/lessons/[id]/page.tsx so the extracted student-view
// components are typed identically to the original inline JSX. The page keeps
// its own copies; these are the same shapes (no redesign).
import type { ReadingExercise } from '@/lib/ielts/types'
import type { Exercise } from '@/lib/lesson-editor/types'

export interface MistakeItem {
  original: string
  correction: string
  explanation: string
  practice?: { prompt: string; options: string[]; correctIndex: number }[]
}

export interface MistakesContent {
  mistakes: MistakeItem[]
}

export interface VideoContent {
  youtube_url: string
  questions: { id: number; prompt: string; options: string[]; correctIndex: number }[]
  exercises?: Exercise[]
}

export interface AudioContent {
  audio_url: string
  exercises?: Exercise[]
}

export interface ArticleContent {
  text: string
  source?: string
  questions: { id: number; prompt: string; options: string[]; correctIndex: number }[]
  exercises?: Exercise[]
}

export interface DialogueContent {
  scenario: string
  target_words: string[]
  starter_message: string
}

export interface GrammarPitfall { mistake: string; correct: string; tip: string }
export interface GrammarContent {
  explanation: string
  examples: string[]
  exercises: { id: number; prompt: string; options: string[]; correctIndex: number }[]
  target_structure?: string
  example_highlights?: string[]
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

export interface ContentBlock {
  id: string
  block_type:
    | 'mistakes'
    | 'video'
    | 'audio'
    | 'article'
    | 'dialogue'
    | 'grammar'
    | 'writing'
    | 'pronunciation'
    | 'ielts_reading'
  title: string
  content:
    | MistakesContent
    | VideoContent
    | AudioContent
    | ArticleContent
    | DialogueContent
    | GrammarContent
    | WritingContent
    | PronunciationContent
    | ReadingExercise
  order_index: number
}
