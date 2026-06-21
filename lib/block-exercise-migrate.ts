// Migration helpers for unifying media-block follow-up exercises onto the
// REAL standalone Exercise model (lib/lesson-editor/types.ts).
//
// A media content block (Reading first; Video / Audio later) historically
// stored its follow-ups either as a legacy `questions` MCQ array or as a list
// of bare AttachedExercise objects. Both carry per-QUESTION shapes that are
// already identical to the standalone Exercise — only the WRAPPER differs. These
// pure helpers fill in that wrapper so a block's follow-ups become full
// Exercise[] consumable by ExerciseEditor / ExercisePreview and the standalone
// 14-type runner.
//
// Pure functions, no React. No DB migration — block content is opaque JSON, so
// the conversion happens in-memory on load and on save.

import type { Exercise } from '@/lib/lesson-editor/types'
import { EXERCISE_TYPES, EXERCISE_TYPE_LABELS } from '@/lib/lesson-editor/types'
import type { AttachedExercise } from '@/lib/attached-exercise'

// AttachedExercise types are a strict subset of the standalone exercise types
// and share the same `value` strings, so normalization is mostly identity. We
// still route through a lookup so any legacy aliases collapse to a known value
// and unknown types fall back to multiple_choice (what the default runner
// handles).
function normalizeExerciseType(type: string | undefined): string {
  if (!type) return 'multiple_choice'
  if (type === 'unjumble') return 'anagram'
  return type
}

function iconForType(type: string): string {
  return EXERCISE_TYPES.find((t) => t.value === type)?.icon || '📝'
}

// Fill the standalone-Exercise wrapper around a bare AttachedExercise. The
// per-question payload (questions / groupData) is carried verbatim.
export function attachedToExercise(att: AttachedExercise, orderIndex: number): Exercise {
  const exercise_type = normalizeExerciseType(att.type)
  return {
    id: att.id || crypto.randomUUID(),
    title: EXERCISE_TYPE_LABELS[exercise_type] || EXERCISE_TYPE_LABELS[att.type] || 'Exercise',
    subtitle: '',
    icon: iconForType(exercise_type),
    instructions: '',
    exercise_type,
    questions: att.questions || [],
    groupData: att.groupData || undefined,
    order_index: orderIndex,
    points_per_answer: 10,
    completion_bonus: 0,
    is_mandatory: true,
  }
}

// Turn a legacy content.questions MCQ array (the shape Reading/Video used before
// this refactor) into a single full MCQ Exercise so existing blocks render in
// the unified editor + runner.
export function legacyMcqToExercise(questions: unknown[] | undefined): Exercise[] {
  if (!questions || !Array.isArray(questions) || questions.length === 0) return []
  return [
    {
      id: 'legacy-mcq',
      title: EXERCISE_TYPE_LABELS.multiple_choice,
      subtitle: '',
      icon: iconForType('multiple_choice'),
      instructions: '',
      exercise_type: 'multiple_choice',
      questions: questions as unknown[],
      order_index: 0,
      points_per_answer: 10,
      completion_bonus: 0,
      is_mandatory: true,
    },
  ]
}

// Migrate a media block's follow-ups to full Exercise[]. If the block already
// carries an `exercises` array, map each entry: pass it through if it is already
// a full Exercise (has exercise_type), else fill the AttachedExercise wrapper.
// Otherwise fall back to the legacy `questions` MCQ array.
export function migrateBlockExercises(
  exercises: Array<AttachedExercise | Exercise> | undefined,
  legacyQuestions: unknown[] | undefined,
): Exercise[] {
  if (exercises && Array.isArray(exercises) && exercises.length > 0) {
    return exercises.map((ex, i) => {
      if (ex && typeof ex === 'object' && 'exercise_type' in ex && (ex as Exercise).exercise_type) {
        const full = ex as Exercise
        // Stamp order_index by position so blocks stay ordered after migration.
        return { ...full, id: full.id || crypto.randomUUID(), order_index: i }
      }
      return attachedToExercise(ex as AttachedExercise, i)
    })
  }
  return legacyMcqToExercise(legacyQuestions)
}
