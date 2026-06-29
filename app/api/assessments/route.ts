import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, hasAccessToCourse } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════
// /api/assessments — manual test results (offline / written / oral).
//
// Teacher/admin only (HR excluded by requireRole) — HR sees results in
// reports but gets no add/delete controls.
//   POST   { courseId, studentEmail, name, date?, score?, max?, source? }
//   DELETE { id, courseId }
// ═══════════════════════════════════════════════════════════════

function unauthorized(err: unknown): NextResponse {
  const e = err as { status?: number; message?: string }
  return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
}

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return unauthorized(err)
  }

  let body: {
    courseId?: string
    studentEmail?: string
    name?: string
    date?: string
    score?: number
    max?: number
    source?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { courseId, studentEmail, name } = body
  if (!courseId || !studentEmail || !name?.trim()) {
    return NextResponse.json({ error: 'courseId, studentEmail and name are required' }, { status: 400 })
  }
  if (!(await hasAccessToCourse(auth.email, auth.role, courseId))) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const row = {
    course_id: courseId,
    student_email: studentEmail,
    name: name.trim(),
    test_date: body.date || null,
    score: typeof body.score === 'number' ? body.score : null,
    max_score: typeof body.max === 'number' && body.max > 0 ? body.max : 100,
    source: body.source || 'Written',
    created_by: auth.email,
  }

  const { data, error } = await supabase
    .from('assessments')
    .insert(row)
    .select('id, student_email, name, test_date, score, max_score, source')
    .single()
  if (error) {
    console.error('assessments insert failed:', error)
    return NextResponse.json({ error: 'Failed to save test result' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, assessment: data })
}

export async function DELETE(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return unauthorized(err)
  }

  let body: { id?: string; courseId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, courseId } = body
  if (!id || !courseId) {
    return NextResponse.json({ error: 'id and courseId required' }, { status: 400 })
  }
  if (!(await hasAccessToCourse(auth.email, auth.role, courseId))) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const { error } = await supabase.from('assessments').delete().eq('id', id).eq('course_id', courseId)
  if (error) {
    console.error('assessments delete failed:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
