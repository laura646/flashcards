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

function answersPayload(map: Map<string, { exercise_id: string; score: number; total: number; per_question_results: boolean[] | null; student_answers?: unknown }>) {
  const out: Record<string, { exercise_id: string; score: number; total: number; per_question_results: boolean[] | null; student_answers?: unknown }> = {}
  // student_answers rides along so a reload (or reopening an exercise)
  // restores what the student typed instead of presenting a blank form.
  map.forEach((v, k) => { out[k] = { exercise_id: v.exercise_id, score: v.score, total: v.total, per_question_results: v.per_question_results, student_answers: v.student_answers ?? null } })
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
    if (req.nextUrl.searchParams.get('view') === 'teacher-review') {
      if (role !== 'teacher' && role !== 'superadmin') return err('Forbidden', 403)
      const studentEmail = req.nextUrl.searchParams.get('student_email') || ''
      if (!studentEmail) return err('student_email required', 400)
      const attempt = await loadSession(lessonId, studentEmail)
      if (!attempt || !attempt.submitted_at) return err('No submitted attempt for this student', 404)
      const exercises = await loadTestExercises(lessonId)
      const blocks = await loadTestBlocks(lessonId)
      const { data: ansRows } = await supabase
        .from('test_session_answers')
        .select('*')
        .eq('session_id', attempt.id)
      return NextResponse.json({
        session: {
          score: attempt.score, total: attempt.total,
          started_at: attempt.started_at, submitted_at: attempt.submitted_at,
          auto_submitted: !!attempt.auto_submitted,
          adjustment: (attempt as { adjustment?: unknown }).adjustment ?? null,
        },
        exercises, blocks,
        answers: ansRows || [],
      })
    }

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
          adjustment: (s as { adjustment?: unknown } | undefined)?.adjustment ?? null,
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
      // A test taken under the old per-exercise flow stays locked, but the
      // student still gets the FULL results review — rebuilt from the old
      // per-exercise attempt rows (score/total/per-question booleans).
      const exercises = await loadTestExercises(lessonId)
      if (exercises.length > 0) {
        const { data: legacyRows } = await supabase
          .from('progress')
          .select('activity_id, score, total, per_question_results, completed_at')
          .eq('user_email', email)
          .eq('activity_type', 'exercise')
          .in('activity_id', exercises.map((e) => e.id))
          .not('completed_at', 'is', null)
        if (legacyRows && legacyRows.length > 0) {
          const answers: Record<string, { exercise_id: string; score: number; total: number; per_question_results: boolean[] | null }> = {}
          let score = 0
          let total = 0
          let last: string | null = null
          for (const r of legacyRows as { activity_id: string; score: number | null; total: number | null; per_question_results: boolean[] | null; completed_at: string }[]) {
            answers[r.activity_id] = {
              exercise_id: r.activity_id,
              score: r.score ?? 0,
              total: r.total ?? 0,
              per_question_results: Array.isArray(r.per_question_results) ? r.per_question_results : null,
            }
            score += r.score ?? 0
            total += r.total ?? 0
            if (!last || r.completed_at > last) last = r.completed_at
          }
          return NextResponse.json({
            status: 'submitted',
            legacy: true,
            settings,
            submitted_at: last,
            auto_submitted: false,
            score,
            total,
            answers,
          })
        }
      }
      return NextResponse.json({ status: 'none', settings })
    }

    const answers = answersPayload(await loadAnswers(attempt.id))
    if (attempt.submitted_at) {
      return NextResponse.json({
        status: 'submitted',
        settings,
        adjustment: (attempt as { adjustment?: unknown }).adjustment ?? null,
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
    per_question_results?: boolean[]; student_answers?: unknown
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
    // ── teacher-remark: flip one question's mark on a submitted attempt.
    // Mutates the canonical per-question data (student + teacher views update
    // everywhere) and logs the change in teacher_overrides for audit/undo.
    if (action === 'teacher-remark') {
      const auth2 = await requireRole('teacher', 'superadmin')
      const { student_email, item_id, attached_id, question_index, mark, add_to_key } = body as {
        student_email?: string; item_id?: string; attached_id?: string | null
        question_index?: number; mark?: boolean | null; add_to_key?: boolean
      }
      if (!student_email || !item_id || typeof question_index !== 'number') {
        return err('student_email, item_id and question_index required', 400)
      }
      if (auth2.role === 'teacher') {
        const ids = await getTeacherCourseIds(auth2.email, 'teacher')
        const { data: lsn } = await supabase.from('lessons').select('course_id').eq('id', lesson_id).maybeSingle()
        if (!lsn || !lsn.course_id || !ids.includes(lsn.course_id)) return err('Forbidden', 403)
      }
      const attempt = await loadSession(lesson_id, student_email)
      if (!attempt || !attempt.submitted_at) return err('No submitted attempt', 404)
      const { data: rowData, error: rowErr } = await supabase
        .from('test_session_answers')
        .select('*')
        .eq('session_id', attempt.id)
        .eq('exercise_id', item_id)
        .maybeSingle()
      if (rowErr && String(rowErr.message || '').includes('teacher_overrides')) {
        return err('Score editing needs a database migration — ask your admin to run it.', 500)
      }
      if (!rowData) return err('Answer row not found', 404)
      const row = rowData as {
        per_question_results: boolean[] | null
        student_answers: Record<string, { per?: boolean[] | null }> | unknown[] | null
        teacher_overrides: Record<string, { from: boolean; to: boolean }> | null
      }
      const overrides = (row.teacher_overrides || {}) as Record<string, { from: boolean; to: boolean }>
      const key = attached_id ? `${attached_id}:${question_index}` : String(question_index)
      let per: boolean[] | null = null
      let saveTarget: 'per' | 'detail' = 'per'
      let detail: Record<string, { per?: boolean[] | null }> | null = null
      if (attached_id) {
        detail = (row.student_answers && typeof row.student_answers === 'object' && !Array.isArray(row.student_answers))
          ? { ...(row.student_answers as Record<string, { per?: boolean[] | null }>) } : null
        per = detail?.[attached_id]?.per ?? null
        saveTarget = 'detail'
      } else {
        per = Array.isArray(row.per_question_results) ? [...row.per_question_results] : null
      }
      if (!per || question_index < 0 || question_index >= per.length) {
        return err('This attempt has no per-question data for that item', 400)
      }
      if (mark === null) {
        const o = overrides[key]
        if (!o) return err('Nothing to undo', 400)
        per[question_index] = o.from
        delete overrides[key]
      } else {
        if (typeof mark !== 'boolean') return err('mark must be true, false or null', 400)
        if (per[question_index] === mark) return err('Already marked that way', 400)
        if (!overrides[key]) overrides[key] = { from: per[question_index], to: mark }
        else overrides[key].to = mark
        per[question_index] = mark
      }
      const patch: Record<string, unknown> = { teacher_overrides: overrides, updated_at: new Date().toISOString() }
      if (saveTarget === 'per') patch.per_question_results = per
      else if (detail && attached_id) {
        detail[attached_id] = { ...(detail[attached_id] || {}), per }
        patch.student_answers = detail
      }
      // Recompute this row's score from effective marks (all attached parts for blocks).
      let rowScore = 0
      if (saveTarget === 'per') rowScore = per.filter(Boolean).length
      else if (detail) for (const v of Object.values(detail)) rowScore += (v?.per || []).filter(Boolean).length
      patch.score = rowScore
      const { error: upErr } = await supabase.from('test_session_answers').update(patch).eq('session_id', attempt.id).eq('exercise_id', item_id)
      if (upErr) {
        if (String(upErr.message || '').includes('teacher_overrides')) {
          return err('Score editing needs a database migration — ask your admin to run it.', 500)
        }
        throw upErr
      }
      // Recompute the session total score from all rows.
      const { data: allRows } = await supabase.from('test_session_answers').select('score').eq('session_id', attempt.id)
      const newScore = ((allRows || []) as { score: number }[]).reduce((a, r) => a + (r.score || 0), 0)
      await supabase.from('test_sessions').update({ score: newScore }).eq('id', attempt.id)
      // Optional: extend the answer key (standalone typed exercises only).
      if (add_to_key && !attached_id && mark === true) {
        const { data: ex } = await supabase.from('lesson_exercises').select('exercise_type, questions').eq('id', item_id).maybeSingle()
        const sa = Array.isArray(row.student_answers) ? (row.student_answers as unknown[]) : null
        const given = sa ? String(sa[question_index] ?? '') : ''
        if (ex && given && given !== '(no answer)') {
          const qs = (ex.questions || []) as Record<string, unknown>[]
          if (ex.exercise_type === 'type_answer' && qs[question_index]) {
            const alts = Array.isArray(qs[question_index].alternatives) ? (qs[question_index].alternatives as string[]) : []
            if (!alts.includes(given)) qs[question_index].alternatives = [...alts, given]
            await supabase.from('lesson_exercises').update({ questions: qs }).eq('id', item_id)
          } else if (ex.exercise_type === 'gap_fill' && qs[0] && Array.isArray((qs[0] as { gaps?: unknown[] }).gaps)) {
            const gaps = (qs[0] as { gaps: { answers: string[] }[] }).gaps
            const g = gaps[question_index]
            if (g && Array.isArray(g.answers) && !g.answers.includes(given)) g.answers.push(given)
            await supabase.from('lesson_exercises').update({ questions: qs }).eq('id', item_id)
          }
        }
      }
      return NextResponse.json({ ok: true, score: newScore })
    }

    // ── teacher-adjust: whole-test +/- points with a note (off-platform marks).
    if (action === 'teacher-adjust') {
      const auth2 = await requireRole('teacher', 'superadmin')
      const { student_email, points, out_of, note } = body as {
        student_email?: string; points?: number | null; out_of?: number | null; note?: string
      }
      if (!student_email) return err('student_email required', 400)
      if (auth2.role === 'teacher') {
        const ids = await getTeacherCourseIds(auth2.email, 'teacher')
        const { data: lsn } = await supabase.from('lessons').select('course_id').eq('id', lesson_id).maybeSingle()
        if (!lsn || !lsn.course_id || !ids.includes(lsn.course_id)) return err('Forbidden', 403)
      }
      const attempt = await loadSession(lesson_id, student_email)
      if (!attempt || !attempt.submitted_at) return err('No submitted attempt', 404)
      const adjustment = (points == null || points === 0)
        ? null
        : {
            points: Math.round(points),
            // out_of 0 = "these marks already exist in the test total" — used
            // when crediting work the runner failed to record. Otherwise the
            // adjustment adds to both score and total (e.g. off-platform writing).
            out_of: Math.max(0, Math.round(out_of ?? points)),
            note: String(note || '').slice(0, 200),
            by: auth2.email,
            at: new Date().toISOString(),
          }
      const { error: adjErr } = await supabase.from('test_sessions').update({ adjustment }).eq('id', attempt.id)
      if (adjErr) {
        if (String(adjErr.message || '').includes('adjustment')) {
          return err('Score editing needs a database migration — ask your admin to run it.', 500)
        }
        throw adjErr
      }
      return NextResponse.json({ ok: true, adjustment })
    }

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

      // Student answer content (what they chose/typed) — capped so a
      // hostile client can't stuff megabytes into the row.
      let studentAnswers: unknown = null
      if (body.student_answers != null) {
        try {
          const encoded = JSON.stringify(body.student_answers)
          if (encoded.length <= 20000) studentAnswers = body.student_answers
        } catch { studentAnswers = null }
      }
      const answerRow: Record<string, unknown> = {
          session_id: attempt.id,
          exercise_id,
          score: safeScore,
          total: safeTotal,
          per_question_results: Array.isArray(per_question_results) ? per_question_results : null,
          student_answers: studentAnswers,
          updated_at: new Date().toISOString(),
      }
      let { error } = await supabase.from('test_session_answers').upsert(answerRow, { onConflict: 'session_id,exercise_id' })
      if (error && String(error.message || '').includes('student_answers')) {
        // Live DB predates the student_answers column — degrade gracefully
        // (scores still save) until the migration is run.
        delete answerRow.student_answers
        ;({ error } = await supabase.from('test_session_answers').upsert(answerRow, { onConflict: 'session_id,exercise_id' }))
      }
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
