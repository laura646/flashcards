import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { requireRole, hasAccessToCourse, getTeacherCourseIds } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════
// /api/test-attempt
//
// Manages the one-shot lifecycle of test-tagged exercises:
//
//   POST   — student opens the test. Inserts a "started" row if
//            none exists. If a row already exists, returns 409
//            with the existing state so the client can decide
//            (already_submitted vs already_started/incomplete).
//
//   PATCH  — student submits. Updates the existing started row
//            with score, total, completed_at, and the per-question
//            right/wrong results.
//
//   DELETE — teacher (with course access) or superadmin resets a
//            student's attempt so they can retake.
//
// Lock semantics: STRICT SINGLE-START. The moment a row exists
// for (user_email, activity_id) where activity_type='exercise',
// the test is locked. Re-opening fails with 409.
// ═══════════════════════════════════════════════════════════════

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// Helper: load an exercise + verify it's tagged as a test.
// Returns null if not a test (or doesn't exist).
async function loadTestExercise(activityId: string) {
  const { data } = await supabase
    .from('lesson_exercises')
    .select('id, lesson_id, title, test_type')
    .eq('id', activityId)
    .single()
  if (!data) return null
  if (!data.test_type) return null
  return data as { id: string; lesson_id: string; title: string; test_type: string }
}

// Helper: load the lesson's course_id (for access checks)
async function lessonCourseId(lessonId: string): Promise<string | null> {
  const { data } = await supabase
    .from('lessons')
    .select('course_id')
    .eq('id', lessonId)
    .single()
  return (data?.course_id as string | null) ?? null
}

// ─── POST: start (or detect already-started) ───

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return err('Unauthorized', 401)

  let body: { activity_id?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }
  const activityId = body.activity_id
  if (!activityId) return err('activity_id required', 400)

  // Only the logged-in student can start their own attempt
  const userEmail = session.user.email

  // Confirm this exercise is actually a test
  const test = await loadTestExercise(activityId)
  if (!test) return err('Exercise is not tagged as a test', 400)

  // Already attempted?
  const { data: existing } = await supabase
    .from('progress')
    .select('id, user_email, activity_id, activity_type, score, total, started_at, completed_at, per_question_results')
    .eq('user_email', userEmail)
    .eq('activity_id', activityId)
    .eq('activity_type', 'exercise')
    .maybeSingle()

  if (existing) {
    const submitted = !!existing.completed_at
    return NextResponse.json(
      {
        status: submitted ? 'already_submitted' : 'already_started',
        attempt: existing,
      },
      { status: 409 }
    )
  }

  // Fresh start: insert a started row
  const { data: inserted, error: insErr } = await supabase
    .from('progress')
    .insert({
      user_email: userEmail,
      activity_type: 'exercise',
      activity_id: activityId,
      score: null,
      total: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      per_question_results: null,
    })
    .select('id, user_email, activity_id, activity_type, score, total, started_at, completed_at, per_question_results')
    .single()

  if (insErr) {
    console.error('test-attempt POST insert error:', insErr)
    return err('Failed to start attempt', 500)
  }

  return NextResponse.json({ status: 'started', attempt: inserted }, { status: 201 })
}

// ─── PATCH: submit the started attempt ───

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return err('Unauthorized', 401)

  let body: { activity_id?: string; score?: number; total?: number; per_question_results?: boolean[] }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }

  const { activity_id, score, total, per_question_results } = body
  if (!activity_id) return err('activity_id required', 400)
  if (typeof score !== 'number' || typeof total !== 'number') return err('score and total required', 400)

  const userEmail = session.user.email

  // Find the existing started row
  const { data: existing } = await supabase
    .from('progress')
    .select('id, completed_at')
    .eq('user_email', userEmail)
    .eq('activity_id', activity_id)
    .eq('activity_type', 'exercise')
    .maybeSingle()

  if (!existing) return err('No started attempt to submit. Please reopen the test.', 404)
  if (existing.completed_at) return err('Test already submitted. Cannot submit again.', 409)

  const { data: updated, error: updErr } = await supabase
    .from('progress')
    .update({
      score,
      total,
      completed_at: new Date().toISOString(),
      per_question_results: Array.isArray(per_question_results) ? per_question_results : null,
    })
    .eq('id', existing.id)
    .select('id, user_email, activity_id, activity_type, score, total, started_at, completed_at, per_question_results')
    .single()

  if (updErr) {
    console.error('test-attempt PATCH error:', updErr)
    return err('Failed to submit attempt', 500)
  }

  return NextResponse.json({ status: 'submitted', attempt: updated })
}

// ─── DELETE: teacher reset ───

export async function DELETE(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (e) {
    const ee = e as { status?: number; message?: string }
    return err(ee.message || 'Unauthorized', ee.status || 401)
  }

  const activityId = req.nextUrl.searchParams.get('activity_id')
  const studentEmail = req.nextUrl.searchParams.get('student_email')
  if (!activityId || !studentEmail) return err('activity_id and student_email required', 400)

  // Confirm exercise is a test (we don't want a teacher accidentally deleting
  // regular practice progress through this endpoint)
  const test = await loadTestExercise(activityId)
  if (!test) return err('Exercise is not tagged as a test', 400)

  // Course access check
  const courseId = await lessonCourseId(test.lesson_id)
  if (!courseId) return err('Lesson has no course', 400)
  const allowed = await hasAccessToCourse(auth.email, auth.role, courseId)
  if (!allowed) {
    // Don't reveal whether the exercise exists; just say not found
    return err('Test not found', 404)
  }

  // Confirm student is in the teacher's reach (extra safety)
  if (auth.role !== 'superadmin') {
    const teacherCourses = await getTeacherCourseIds(auth.email, 'teacher')
    const { data: enrolled } = await supabase
      .from('course_students')
      .select('course_id')
      .eq('student_email', studentEmail)
      .in('course_id', teacherCourses)
      .is('removed_at', null)
      .limit(1)
    if (!enrolled || enrolled.length === 0) {
      return err('Student not in your courses', 403)
    }
  }

  const { error: delErr } = await supabase
    .from('progress')
    .delete()
    .eq('user_email', studentEmail)
    .eq('activity_id', activityId)
    .eq('activity_type', 'exercise')

  if (delErr) {
    console.error('test-attempt DELETE error:', delErr)
    return err('Failed to reset attempt', 500)
  }

  return NextResponse.json({ ok: true })
}
