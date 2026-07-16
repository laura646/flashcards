// Server-side helpers for exam mode (lesson-level timed test attempts).
//
// The DEADLINE is authoritative here, never in the browser: `saveExercise`
// rejects writes after it, and `finalizeTestSession` can run from three
// places with the same outcome — the student's explicit submit, a lazy
// finalize when anyone loads an expired session, or the cron sweeper for
// students who never came back.
//
// Finalize writes one `progress` row per published exercise in the lesson
// (unanswered ⇒ 0 / authoritative total), which is exactly the shape the
// accuracy + reports pipelines already consume — so test scores appear in
// student progress and course reports with no changes there.

import { supabase } from '@/lib/supabase'
import { authoritativeExerciseTotal, type ExerciseMarkRow } from '@/lib/exercise-marks'
import { migrateBlockExercises } from '@/lib/block-exercise-migrate'
import { isCompletableBlock } from '@/lib/block-completion'
import {
  DEFAULT_TEST_TIME_LIMIT_MIN,
  isScorableTestBlock,
  type TestSettings,
  type TestLang,
} from '@/lib/test-mode'

export interface TestSessionRow {
  id: string
  lesson_id: string
  user_email: string
  started_at: string
  deadline: string
  submitted_at: string | null
  auto_submitted: boolean
  score: number | null
  total: number | null
}

export interface SessionAnswerRow {
  session_id: string
  exercise_id: string
  score: number
  total: number
  per_question_results: boolean[] | null
}

type LessonExerciseRow = ExerciseMarkRow & { id: string; published?: boolean | null }

// Read the lesson's per-test settings with drift-tolerant defaults (the
// row is select('*'), so a not-yet-migrated DB simply yields undefined).
export function settingsFromLesson(lesson: Record<string, unknown>): TestSettings {
  const rawLimit = lesson.time_limit_minutes
  const limit =
    typeof rawLimit === 'number' && rawLimit >= 1 ? Math.round(rawLimit) : DEFAULT_TEST_TIME_LIMIT_MIN
  return {
    time_limit_minutes: limit,
    test_reveal_answers: lesson.test_reveal_answers !== false,
    test_rules_lang: (lesson.test_rules_lang === 'en' ? 'en' : 'hy') as TestLang,
  }
}

// All published exercises of a test lesson (null `published` = published).
export async function loadTestExercises(lessonId: string): Promise<LessonExerciseRow[]> {
  const { data } = await supabase
    .from('lesson_exercises')
    .select('id, exercise_type, questions, points_per_answer, completion_bonus, published')
    .eq('lesson_id', lessonId)
  return ((data || []) as LessonExerciseRow[]).filter((e) => e.published !== false)
}

export interface TestBlockRow {
  id: string
  block_type: string
  title: string | null
  content: unknown
  published?: boolean | null
}

// Scorable content blocks of a test lesson: audio/video/article/grammar
// blocks that actually carry auto-graded follow-up exercises. Their marks
// count toward the test total exactly like regular exercises.
export async function loadTestBlocks(lessonId: string): Promise<TestBlockRow[]> {
  const { data } = await supabase
    .from('lesson_blocks')
    .select('id, block_type, title, content, published')
    .eq('lesson_id', lessonId)
  return ((data || []) as TestBlockRow[])
    .filter((b) => b.published !== false)
    .filter((b) => isScorableTestBlock(b.block_type) && isCompletableBlock(b.block_type, b.content))
}

// Authoritative mark total of a block = the summed totals of its attached
// exercises (same anti-forgery cap as lesson exercises).
export function blockAuthoritativeTotal(block: TestBlockRow): number {
  const c = (block.content ?? {}) as Record<string, unknown>
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const attached: any[] =
    block.block_type === 'grammar'
      ? ((c.practice_exercises as any[]) || (c.exercises as any[]) || [])
      : migrateBlockExercises(
          c.exercises as any,
          block.block_type === 'audio' ? undefined : (c.questions as any)
        )
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return attached.reduce((sum, ex) => {
    if (!ex || typeof ex !== 'object' || !ex.exercise_type) return sum
    return sum + authoritativeExerciseTotal(ex as ExerciseMarkRow)
  }, 0)
}

export async function loadAnswers(sessionId: string): Promise<Map<string, SessionAnswerRow>> {
  const { data } = await supabase
    .from('test_session_answers')
    .select('session_id, exercise_id, score, total, per_question_results')
    .eq('session_id', sessionId)
  const map = new Map<string, SessionAnswerRow>()
  ;((data || []) as SessionAnswerRow[]).forEach((a) => map.set(a.exercise_id, a))
  return map
}

// Finalize an attempt: aggregate saved per-exercise results into progress
// rows + stamp the session. Idempotent — a session that is already
// submitted returns as-is (so student submit, lazy finalize and the cron
// sweeper can race safely).
export async function finalizeTestSession(
  session: TestSessionRow,
  opts: { auto: boolean }
): Promise<TestSessionRow> {
  if (session.submitted_at) return session

  const exercises = await loadTestExercises(session.lesson_id)
  const blocks = await loadTestBlocks(session.lesson_id)
  const answers = await loadAnswers(session.id)
  const now = new Date().toISOString()

  let totalScore = 0
  let totalMax = 0

  // Score every test item — regular exercises AND scorable content blocks
  // (audio/video/article/grammar follow-ups). One progress row per item, in
  // the same shape normal lessons write ('exercise' / 'block'), so accuracy,
  // items-completion and reports consume test results with no changes.
  const items: { id: string; activityType: 'exercise' | 'block'; cap: number }[] = [
    ...exercises.map((ex) => ({ id: ex.id, activityType: 'exercise' as const, cap: authoritativeExerciseTotal(ex) })),
    ...blocks.map((b) => ({ id: b.id, activityType: 'block' as const, cap: blockAuthoritativeTotal(b) })),
  ]

  for (const item of items) {
    const saved = answers.get(item.id)
    const safeScore = saved ? Math.max(0, Math.min(Math.round(saved.score), item.cap)) : 0
    const per = saved && Array.isArray(saved.per_question_results) ? saved.per_question_results : null
    totalScore += safeScore
    totalMax += item.cap

    const { data: existing } = await supabase
      .from('progress')
      .select('id')
      .eq('user_email', session.user_email)
      .eq('activity_id', item.id)
      .eq('activity_type', item.activityType)
      .maybeSingle()

    const rowPatch = {
      score: safeScore,
      total: item.cap,
      completed_at: now,
      per_question_results: per,
    }
    if (existing) {
      await supabase.from('progress').update(rowPatch).eq('id', existing.id)
    } else {
      await supabase.from('progress').insert({
        user_email: session.user_email,
        activity_id: item.id,
        activity_type: item.activityType,
        started_at: session.started_at,
        ...rowPatch,
      })
    }
  }

  const { data: updated, error } = await supabase
    .from('test_sessions')
    .update({
      submitted_at: now,
      auto_submitted: opts.auto,
      score: totalScore,
      total: totalMax,
    })
    .eq('id', session.id)
    .is('submitted_at', null) // lose gracefully if another finalizer won the race
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!updated) {
    // Someone else finalized first — return the winning row.
    const { data: fresh } = await supabase
      .from('test_sessions')
      .select('*')
      .eq('id', session.id)
      .single()
    return (fresh as TestSessionRow) || { ...session, submitted_at: now }
  }
  return updated as TestSessionRow
}
