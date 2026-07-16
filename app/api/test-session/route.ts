import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { requireRole, getTeacherCourseIds } from '@/lib/roles'
import { authoritativeExerciseTotal, type ExerciseMarkRow } from '@/lib/exercise-marks'
import { isTestLessonType } from '@/lib/test-mode'
import {
  settingsFromLesson,
  loadTestExercises,
  loadTestBlocks,
  blockAuthoritativeTotal,
  loadAnswers,
  finalizeTestSession,
  type TestSessionRow,
} from '@/lib/test-session'

// ═══════════════════════════════════════════════════════════════════
// /api/test-session — lesson-level timed test attempts (exam mode).
//
//   GET    ?lesson_id=            → student state (none / in_progress /
//            submitted / legacy_completed). Lazily finalizes an expired
//            open session before answering.
//   GET    ?lesson_id=&view=teacher → per-student results table for the
//            lesson (teacher/superadmin with course access).
//   POST   {action:'start' | 'save-exercise' | 'submit', ...}
//   DELETE {lesson_id, student_email} → reset a student's attempt.
//
// The deadline is server-authoritative: save-exercise rejects after it
// (small grace for network latency), so client clocks can't cheat.
// ═══════════════════════════════════════════════════════════════════

const SAVE_GRACE_MS = 10_000

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function loadTestLesson(lessonId: string) {
  const { data } = await supabase.from('lessons').select('*').eq('id', lessonId).single()
  if (!data || !isTestLessonType(data.lesson_type as string | null)) return null
  return data as Record<string, unknown> & { id: string; course_id: string | null }
}

// Student must be enrolled; teachers need course access; superadmin passes.
async function canTakeOrView(
  email: string,
  role: string,
  courseId: string | null
): Promise<boolean> {
  if (role === 'superadmin') return true
  if (!courseId) return false
  if (role === 'teacher') {
    const ids = await getTeacherCourseIds(email, 'teacher')
    return ids.includes(courseId)
  }
  const { data } = await supabase
    .from('course_students')
    .select('course_id')
    .eq('student_email', email)
    .eq('course_id', courseId)
    .is('removed_at', null)
    .maybeSingle()
  return !!data
}

async function loadSession(lessonId: string, email: string): Promise<TestSessionRow | null> {
  const { data } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('user_email', email)
    .maybeSingle()
  return (data as TestSessionRow) || null
}

function answersPayload(map: Map<string, { exercise_id: string; score: number; total: number; per_question_results: boolean[] | null }>) {
  const out: Record<string, { exercise_id: string; score: number; total: number; per_question_results: boolean[] | null }> = {}
  map.forEach((v, k) => { out[k] = { exercise_id: v.exercise_id, score: v.score, total: v.total, per_question_results: v.per_question_results } })
  return out
}

// ─── GET: state (student) or results (teacher) ───
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return err('Unauthorized', 401)
  const email = session.user.email
  const role = (session.user as { role?: string }).role || 'student'

  // All of MY submitted test scores in one call — powers the % badge on
  // test cards in the student lesson list. Fail-open: [] if table absent.
  if (req.nextUrl.searchParams.get('view') === 'mine') {
    const { data } = await supabase
      .from('test_sessions')
      .select('lesson_id, score, total')
      .eq('user_email', email)
      .not('submitted_at', 'is', null)
    return NextResponse.json({ sessions: data || [] })
  }

  const lessonId = req.nextUrl.searchParams.get('lesson_id')
  if (!lessonId) return err('lesson_id required', 400)

  try {
    const lesson = await loadTestLesson(lessonId)
    if (!lesson) return err('Not a test lesson', 404)
    if (!(await canTakeOrView(email, role, lesson.course_id))) return err('Forbidden', 403)

    // ── teacher results table ──
    if (req.nextUrl.searchParams.get('view') === 'teacher') {
      if (role !== 'teacher' && role !== 'superadmin') return err('Forbidden', 403)
      // Roster: course_students has NO name column — names live on users
      // (same pattern as course-sessions / admin roster lookups).
      const { data: roster } = await supabase
        .from('course_students')
        .select('student_email')
        .eq('course_id', lesson.course_id as string)
        .is('removed_at', null)
      const rosterEmails = ((roster || []) as { student_email: string }[]).map((r) => r.student_email)
      const nameByEmail = new Map<string, string>()
      if (rosterEmails.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('email, name')
          .in('email', rosterEmails)
        ;((users || []) as { email: string; name: string | null }[]).forEach((u) => {
          if (u.name) nameByEmail.set(u.email, u.name)
        })
      }
      const { data: sessions } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('lesson_id', lessonId)
      const now = Date.now()
      // Sweep any expired-but-open sessions so the table is truthful.
      for (const s of (sessions || []) as TestSessionRow[]) {
        if (!s.submitted_at && new Date(s.deadline).getTime() < now) {
          await finalizeTestSession(s, { auto: true })
        }
      }
      const { data: fresh } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('lesson_id', lessonId)
      const byEmail = new Map<string, TestSessionRow>()
      ;((fresh || []) as TestSessionRow[]).forEach((s) => byEmail.set(s.user_email, s))
      const rows = rosterEmails.map((email) => {
        const s = byEmail.get(email)
        return {
          student_email: email,
          student_name: nameByEmail.get(email) || email,
          status: !s ? 'not_started' : s.submitted_at ? (s.auto_submitted ? 'auto_submitted' : 'submitted') : 'in_progress',
          score: s?.score ?? null,
          total: s?.total ?? null,
          started_at: s?.started_at ?? null,
          submitted_at: s?.submitted_at ?? null,
          deadline: s?.deadline ?? null,
        }
      })
      return NextResponse.json({ settings: settingsFromLesson(lesson), rows, server_now: new Date().toISOString() })
    }

    // ── student state ──
    const settings = settingsFromLesson(lesson)
    let attempt = await loadSession(lessonId, email)

    if (attempt && !attempt.submitted_at && new Date(attempt.deadline).getTime() < Date.now()) {
      attempt = await finalizeTestSession(attempt, { auto: true })
    }

    if (!attempt) {
      // A test taken under the old per-exercise flow must stay locked.
      const exercises = await loadTestExercises(lessonId)
      if (exercises.length > 0) {
        const { data: legacy } = await supabase
          .from('progress')
          .select('id')
          .eq('user_email', email)
          .eq('activity_type', 'exercise')
          .in('activity_id', exercises.map((e) => e.id))
          .not('completed_at', 'is', null)
          .limit(1)
        if (legacy && legacy.length > 0) {
          return NextResponse.json({ status: 'legacy_completed' })
        }
      }
      return NextResponse.json({ status: 'none', settings })
    }

    const answers = answersPayload(await loadAnswers(attempt.id))
    if (attempt.submitted_at) {
      return NextResponse.json({
        status: 'submitted',
        settings,
        submitted_at: attempt.submitted_at,
        auto_submitted: attempt.auto_submitted,
        started_at: attempt.started_at,
        deadline: attempt.deadline,
        score: attempt.score ?? 0,
        total: attempt.total ?? 0,
        answers,
      })
    }
    return NextResponse.json({
      status: 'in_progress',
      settings,
      deadline: attempt.deadline,
      server_now: new Date().toISOString(),
      answers,
    })
  } catch (e) {
    console.error('test-session GET error:', e)
    return err('Internal server error', 500)
  }
}

// ─── POST: start / save-exercise / submit ───
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return err('Unauthorized', 401)
  const email = session.user.email
  const role = (session.user as { role?: string }).role || 'student'

  let body: {
    action?: string
    lesson_id?: string
    exercise_id?: string
    item_type?: string
    score?: number
    total?: number
    per_question_results?: boolean[]
  }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }
  const { action, lesson_id } = body
  if (!lesson_id) return err('lesson_id required', 400)

  try {
    const lesson = await loadTestLesson(lesson_id)
    if (!lesson) return err('Not a test lesson', 404)
    if (!(await canTakeOrView(email, role, lesson.course_id))) return err('Forbidden', 403)
    const settings = settingsFromLesson(lesson)

    // ── start ──
    if (action === 'start') {
      const existing = await loadSession(lesson_id, email)
      if (existing) {
        if (existing.submitted_at) return err('Test already submitted', 409)
        // Resume with the ORIGINAL deadline — the clock never restarts.
        return NextResponse.json({
          status: 'in_progress',
          deadline: existing.deadline,
          server_now: new Date().toISOString(),
          answers: answersPayload(await loadAnswers(existing.id)),
        })
      }
      const deadline = new Date(Date.now() + settings.time_limit_minutes * 60_000).toISOString()
      const { data: created, error } = await supabase
        .from('test_sessions')
        .insert({ lesson_id, user_email: email, deadline })
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({
        status: 'in_progress',
        deadline: (created as TestSessionRow).deadline,
        server_now: new Date().toISOString(),
        answers: {},
      })
    }

    // ── save-exercise (continuous save; server enforces the deadline).
    // item_type 'block' saves a content block's follow-up aggregate; the
    // answers row is keyed by the block id in the same exercise_id column. ──
    if (action === 'save-exercise') {
      const { exercise_id, score, total, per_question_results } = body
      const itemType = body.item_type === 'block' ? 'block' : 'exercise'
      if (!exercise_id || typeof score !== 'number' || typeof total !== 'number') {
        return err('exercise_id, score and total required', 400)
      }
      const attempt = await loadSession(lesson_id, email)
      if (!attempt) return err('No active attempt. Please start the test first.', 404)
      if (attempt.submitted_at) return err('Test already submitted', 410)
      if (new Date(attempt.deadline).getTime() + SAVE_GRACE_MS < Date.now()) {
        // Too late — finalize with what was saved before the deadline.
        await finalizeTestSession(attempt, { auto: true })
        return err('Time is up', 410)
      }

      // Clamp against the authoritative item total (anti-forgery, same
      // posture as /api/progress and /api/test-attempt).
      let cap = 0
      if (itemType === 'block') {
        const blocks = await loadTestBlocks(lesson_id)
        const block = blocks.find((b) => b.id === exercise_id)
        if (!block) return err('Block not in this test', 400)
        cap = blockAuthoritativeTotal(block)
      } else {
        const { data: ex } = await supabase
          .from('lesson_exercises')
          .select('id, lesson_id, exercise_type, questions, points_per_answer, completion_bonus')
          .eq('id', exercise_id)
          .single()
        if (!ex || ex.lesson_id !== lesson_id) return err('Exercise not in this test', 400)
        cap = authoritativeExerciseTotal(ex as ExerciseMarkRow)
      }
      const safeTotal = cap
      const safeScore = Math.max(0, Math.min(Math.round(score), cap))

      const { error } = await supabase.from('test_session_answers').upsert(
        {
          session_id: attempt.id,
          exercise_id,
          score: safeScore,
          total: safeTotal,
          per_question_results: Array.isArray(per_question_results) ? per_question_results : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,exercise_id' }
      )
      if (error) throw error
      return NextResponse.json({ ok: true, score: safeScore, total: safeTotal })
    }

    // ── submit ──
    if (action === 'submit') {
      const attempt = await loadSession(lesson_id, email)
      if (!attempt) return err('No active attempt', 404)
      const expired = new Date(attempt.deadline).getTime() < Date.now()
      const finalized = attempt.submitted_at
        ? attempt
        : await finalizeTestSession(attempt, { auto: expired })
      return NextResponse.json({
        status: 'submitted',
        submitted_at: finalized.submitted_at,
        auto_submitted: finalized.auto_submitted,
        started_at: finalized.started_at,
        deadline: finalized.deadline,
        score: finalized.score ?? 0,
        total: finalized.total ?? 0,
        answers: answersPayload(await loadAnswers(finalized.id)),
      })
    }

    return err('Invalid action', 400)
  } catch (e) {
    console.error('test-session POST error:', e)
    return err('Internal server error', 500)
  }
}

// ─── DELETE: teacher/superadmin resets a student's attempt ───
export async function DELETE(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch {
    return err('Forbidden', 403)
  }

  let body: { lesson_id?: string; student_email?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }
  const { lesson_id, student_email } = body
  if (!lesson_id || !student_email) return err('lesson_id and student_email required', 400)

  try {
    const lesson = await loadTestLesson(lesson_id)
    if (!lesson) return err('Not a test lesson', 404)
    if (auth.role === 'teacher') {
      const ids = await getTeacherCourseIds(auth.email, 'teacher')
      if (!lesson.course_id || !ids.includes(lesson.course_id)) return err('Forbidden', 403)
    }

    const attempt = await loadSession(lesson_id, student_email)
    if (attempt) {
      await supabase.from('test_session_answers').delete().eq('session_id', attempt.id)
      await supabase.from('test_sessions').delete().eq('id', attempt.id)
    }
    // Clear the progress rows finalize wrote (or the legacy per-exercise
    // attempt rows), so the retake starts clean and reports don't double up.
    const exercises = await loadTestExercises(lesson_id)
    if (exercises.length > 0) {
      await supabase
        .from('progress')
        .delete()
        .eq('user_email', student_email)
        .eq('activity_type', 'exercise')
        .in('activity_id', exercises.map((e) => e.id))
    }
    const blocks = await loadTestBlocks(lesson_id)
    if (blocks.length > 0) {
      await supabase
        .from('progress')
        .delete()
        .eq('user_email', student_email)
        .eq('activity_type', 'block')
        .in('activity_id', blocks.map((b) => b.id))
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('test-session DELETE error:', e)
    return err('Internal server error', 500)
  }
}
