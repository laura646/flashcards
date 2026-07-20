// Shared types + helpers for follow-up exercises that hang off a media
// content block (Audio / Video / Reading). The data shapes mirror the
// standalone exercise types so the same visual editors and per-type
// runners can be reused.

export type AttachedExerciseType =
  | 'multiple_choice'
  | 'true_or_false'
  | 'type_answer'
  | 'group_sort'
  | 'rank_order'
  | 'anagram'
  | 'error_correction'

export interface AttachedExercise {
  id: string
  type: AttachedExerciseType
  // For all types except group_sort: an array of per-type questions.
  questions?: unknown[]
  // For group_sort: the categories + items shape.
  groupData?: unknown
}

export const ATTACHED_TYPE_LABELS: Record<AttachedExerciseType, string> = {
  multiple_choice: 'Multiple Choice',
  true_or_false: 'True or False',
  type_answer: 'Type the Answer',
  group_sort: 'Group Sort',
  rank_order: 'Rank Order',
  anagram: 'Unjumble',
  error_correction: 'Error Correction',
}

export const ATTACHED_TYPE_ICONS: Record<AttachedExerciseType, string> = {
  multiple_choice: '🎯',
  true_or_false: '✅',
  type_answer: '⌨️',
  group_sort: '🗂️',
  rank_order: '🔢',
  anagram: '🔀',
  error_correction: '🔍',
}

// Empty seed for a new attached exercise of the given type, mirroring
// defaultDataForType in the lesson admin page.
export function newAttachedExercise(type: AttachedExerciseType): AttachedExercise {
  const id = crypto.randomUUID()
  switch (type) {
    case 'multiple_choice':
      return {
        id,
        type,
        questions: [{ id: crypto.randomUUID(), prompt: '', options: ['', ''], correctIndex: -1, hint: '', explanation: '' }],
      }
    case 'true_or_false':
      return {
        id,
        type,
        questions: [{ id: crypto.randomUUID(), statement: '', isTrue: true, explanation: '' }],
      }
    case 'type_answer':
      return {
        id,
        type,
        questions: [{ id: crypto.randomUUID(), prompt: '', answer: '', hint: '' }],
      }
    case 'group_sort':
      return { id, type, questions: [], groupData: { groups: [{ name: '', items: [] }] } }
    case 'rank_order':
      return { id, type, questions: [{ id: crypto.randomUUID(), criterion: '', items: ['', '', ''] }] }
    case 'anagram':
      return { id, type, questions: [{ id: crypto.randomUUID(), word: '', clue: '' }] }
    case 'error_correction':
      return { id, type, questions: [{ id: crypto.randomUUID(), incorrect: '', correct: '', hints: '' }] }
  }
}

// Backward-compat: turn a legacy content.questions MCQ array (the shape
// video and article used before this refactor) into a single attached
// MCQ exercise, so existing blocks render seamlessly in the new runner.
export function legacyMcqToAttached(questions: unknown[] | undefined): AttachedExercise[] {
  if (!questions || !Array.isArray(questions) || questions.length === 0) return []
  return [
    {
      id: 'legacy-mcq',
      type: 'multiple_choice',
      questions: questions as unknown[],
    },
  ]
}
