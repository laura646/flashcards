import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, hasAccessToCourse } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════
// POST /api/course-progress
//
// Teacher/admin only (HR excluded by requireRole) — HR sees the values
// in reports but gets no edit control.
//
// Two update modes (by body shape):
//   { courseId, studentEmail, pct }      → set one learner's manual
//                                           course-progress % (0–100)
//   { courseId, currentLevel, goalLevel }→ set the course CEFR endpoints
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  let body: {
    courseId?: string
    studentEmail?: string
    pct?: number
    currentLevel?: string
    goalLevel?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { courseId } = body
  if (!courseId) {
    return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  }
  if (!(await hasAccessToCourse(auth.email, auth.role, courseId))) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // ── Per-student manual course progress % ──
  if (body.studentEmail && typeof body.pct === 'number') {
    const pct = Math.max(0, Math.min(100, Math.round(body.pct)))
    const { error } = await supabase
      .from('course_students')
      .update({ course_progress_pct: pct, course_progress_updated_at: new Date().toISOString() })
      .eq('course_id', courseId)
      .eq('student_email', body.studentEmail)
    if (error) {
      console.error('course-progress (student) update failed:', error)
      return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, pct })
  }

  // ── Course CEFR endpoints (current → goal) ──
  if (body.currentLevel !== undefined || body.goalLevel !== undefined) {
    const patch: Record<string, unknown> = {}
    if (body.currentLevel !== undefined) patch.current_level = body.currentLevel || null
    if (body.goalLevel !== undefined) patch.goal_level = body.goalLevel || null
    const { error } = await supabase.from('courses').update(patch).eq('id', courseId)
    if (error) {
      console.error('course-progress (levels) update failed:', error)
      return NextResponse.json({ error: 'Failed to save levels' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}
