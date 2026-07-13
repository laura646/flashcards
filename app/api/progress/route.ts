import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getTeacherCourseIds } from '@/lib/roles'
import {
  authoritativeExerciseTotal,
  recomputeExercisePoints,
  type ExerciseMarkRow,
} from '@/lib/exercise-marks'

function toFiniteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Students can only view their own progress
  if (email !== session.user.email && session.user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Teachers can only view progress for students in their courses
  if (email !== session.user.email && session.user.role === 'teacher') {
    const courseIds = await getTeacherCourseIds(session.user.email, 'teacher')
    if (courseIds.length > 0) {
      const { data: enrolled } = await supabase
        .from('course_students')
        .select('student_email')
        .in('course_id', courseIds)
        .eq('student_email', email)
        .is('removed_at', null)
        .limit(1)
      if (!enrolled || enrolled.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Deny-by-default: hr (read-only) and any other non-self / non-teacher /
  // non-superadmin role must not read another user's progress.
  if (email !== session.user.email && session.user.role !== 'superadmin' && session.user.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { data, error } = await supabase
      .from('progress')
      .select('*')
      .eq('user_email', email)
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('Supabase GET error:', error)
      return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
    }

    return NextResponse.json({ progress: data })
  } catch (err) {
    console.error('Progress GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const postSession = await getServerSession(authOptions)
  if (!postSession?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    // points_earned is intentionally NOT read from the body — it is recomputed
    // server-side below so a client can't inflate its own leaderboard points.
    const { user_email, activity_type, activity_id, score, total, response_text } = body

    if (!user_email || !activity_type || !activity_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Students can only save their own progress
    if (user_email !== postSession.user.email && postSession.user.role === 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Teachers can only save progress for their own students
    if (user_email !== postSession.user.email && postSession.user.role === 'teacher') {
      const courseIds = await getTeacherCourseIds(postSession.user.email, 'teacher')
      if (courseIds.length > 0) {
        const { data: enrolled } = await supabase
          .from('course_students')
          .select('student_email')
          .in('course_id', courseIds)
          .eq('student_email', user_email)
          .is('removed_at', null)
          .limit(1)
        if (!enrolled || enrolled.length === 0) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Deny-by-default: only the user themselves, their teacher, or a superadmin
    // may write progress (blocks the read-only hr role and any future role).
    if (user_email !== postSession.user.email && postSession.user.role !== 'superadmin' && postSession.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Anti-forgery: never trust client-reported marks for scored exercises ──
    // A student can only write their OWN progress (guards above), but could
    // still inflate their own score/total/points_earned. For lesson exercises
    // we look up the authoritative mark total server-side, clamp the reported
    // score to it, and RECOMPUTE points from the stored points_per_answer +
    // completion_bonus (the client-sent points_earned is ignored entirely).
    //
    // Other activity types (blocks, flashcards, vocab, static /exercises
    // practice) carry no points and have no server-side authoritative total, so
    // we only sanity-bound score/total and force points to null — which already
    // matches what those clients send today. Reads stay fail-safe: a lookup
    // miss or error degrades to the no-points path rather than 500ing the save.
    let scoreToSave = toFiniteNumber(score)
    let totalToSave = toFiniteNumber(total)
    if (scoreToSave != null) scoreToSave = Math.max(0, Math.round(scoreToSave))
    if (totalToSave != null) totalToSave = Math.max(0, Math.round(totalToSave))
    // Clamp a self-reported score to its self-reported total by default; the
    // exercise branch below tightens this against the authoritative ceiling.
    if (scoreToSave != null && totalToSave != null && scoreToSave > totalToSave) {
      scoreToSave = totalToSave
    }
    let pointsToSave: number | null = null

    if (activity_type === 'exercise') {
      let ex: (ExerciseMarkRow & { test_type?: string | null }) | null = null
      try {
        const { data } = await supabase
          .from('lesson_exercises')
          .select('exercise_type, questions, points_per_answer, completion_bonus, test_type')
          .eq('id', String(activity_id))
          .maybeSingle()
        ex = (data as (ExerciseMarkRow & { test_type?: string | null }) | null) ?? null
      } catch {
        // Invalid-UUID id (e.g. a static /exercises row) or a transient DB
        // error → treat as "not a scored lesson exercise": keep sanitized
        // score/total, points stay null. Fail-closed on points so an induced
        // failure can't be used to inject leaderboard points.
        ex = null
      }

      if (ex) {
        // Tests must go through /api/test-attempt (single-attempt lock + no
        // points). Block the bypass where a POST here would skip the lock and
        // inject points onto a test. Legit clients never POST tests here.
        if (ex.test_type) {
          return NextResponse.json(
            { error: 'Tests must be submitted through the test flow' },
            { status: 400 }
          )
        }
        const cap = authoritativeExerciseTotal(ex)
        const safeTotal = totalToSave != null && totalToSave > 0 ? Math.min(totalToSave, cap) : cap
        const safeScore = Math.min(scoreToSave ?? 0, safeTotal)
        scoreToSave = safeScore
        totalToSave = safeTotal
        pointsToSave = recomputeExercisePoints(ex, safeScore)
      }
    }

    const { error } = await supabase
      .from('progress')
      .insert({
        user_email,
        activity_type,
        activity_id: String(activity_id),
        score: scoreToSave,
        total: totalToSave,
        points_earned: pointsToSave,
        // Writing submissions send the actual text here. Other activity
        // types don't, so this is just null for them.
        response_text: typeof response_text === 'string' && response_text.trim() ? response_text : null,
      })

    if (error) {
      console.error('Supabase POST error:', error)
      return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Progress POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
