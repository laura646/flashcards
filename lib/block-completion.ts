// Which lesson blocks can a student actually FINISH? Completion progress is
// only written when a block has a completion wire on the lesson page:
//   - dialogue      → onAllWordsUsed
//   - writing       → submission (activity_type 'writing')
//   - ielts_reading → onComplete
//   - mistakes      → per-mistake practice quizzes (content.mistakes[].practice)
//   - grammar       → practice_exercises / legacy exercises
//   - video/audio/article → attached comprehension exercises
//                     (content.exercises, or legacy content.questions)
//   - pronunciation → view-only, never completable
// A bare media/grammar/mistakes block with no practice items has NO completion
// path, so counting it in a progress denominator would cap every student
// below 100% forever. Used by /api/reports and /api/lessons.

const ALWAYS_COMPLETABLE = new Set(['dialogue', 'writing'])

// Types whose completability depends on their content carrying practice items.
export const CONDITIONAL_BLOCK_TYPES = ['mistakes', 'grammar', 'video', 'audio', 'article', 'ielts_reading']

export function isCompletableBlock(blockType: string, content: unknown): boolean {
  if (blockType === 'pronunciation') return false
  if (ALWAYS_COMPLETABLE.has(blockType)) return true
  const c = (content ?? {}) as Record<string, unknown>
  const filled = (v: unknown) => Array.isArray(v) && v.length > 0
  if (blockType === 'grammar') return filled(c.practice_exercises) || filled(c.exercises)
  if (blockType === 'mistakes') {
    return (
      Array.isArray(c.mistakes) &&
      (c.mistakes as { practice?: unknown[] }[]).some((m) => filled(m?.practice))
    )
  }
  // ielts_reading only fires onComplete when it HAS question groups — the
  // editor scaffold seeds questionGroups: [], and the runner dead-ends at 0.
  if (blockType === 'ielts_reading') return filled(c.questionGroups)
  // audio never renders legacy questions (its migration wire passes
  // undefined), so only the exercises key counts for it.
  if (blockType === 'audio') return filled(c.exercises)
  // video / article — completable via attached comprehension exercises (new
  // key) or legacy MCQ questions (migrated at render time). Unknown future
  // types fall through to the same conservative rule.
  return filled(c.exercises) || filled(c.questions)
}
