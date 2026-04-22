import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, hasAccessToCourse } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════
// /api/student-notes
//
// Teachers (on that course) + superadmin can read and create.
// Only the author can delete their own note. Superadmin can
// delete any. Students never see.
// ═══════════════════════════════════════════════════════════════

const VALID_TAGS = [
  'general',
  'homework',
  'behaviour',
  'parent_contact',
  'academic_concern',
] as const

function errorResponse(err: unknown): NextResponse {
  const e = err as { status?: number; message?: string }
  return NextResponse.json({ error: e.message || 'Error' }, { status: e.status || 500 })
}

// ─── GET: list notes for a student in a course ───

export async function GET(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return errorResponse(err)
  }

  const studentEmail = req.nextUrl.searchParams.get('studentEmail')
  const courseId = req.nextUrl.searchParams.get('courseId')

  if (!studentEmail || !courseId) {
    return NextResponse.json({ error: 'studentEmail and courseId required' }, { status: 400 })
  }

  const hasAccess = await hasAccessToCourse(auth.email, auth.role, courseId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  try {
    const { data, error } = await supabase
      .from('student_notes')
      .select('id, student_email, course_id, author_email, tag, text, created_at')
      .eq('student_email', studentEmail)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ notes: data || [] })
  } catch (err) {
    console.error('student-notes GET error:', err)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }
}

// ─── POST: create a new note ───

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return errorResponse(err)
  }

  try {
    const body = await req.json()
    const { studentEmail, courseId, tag, text } = body

    if (!studentEmail || !courseId || !text?.trim()) {
      return NextResponse.json({ error: 'studentEmail, courseId, text required' }, { status: 400 })
    }

    const finalTag = VALID_TAGS.includes(tag) ? tag : 'general'

    const hasAccess = await hasAccessToCourse(auth.email, auth.role, courseId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('student_notes')
      .insert({
        student_email: studentEmail,
        course_id: courseId,
        author_email: auth.email,
        tag: finalTag,
        text: text.trim(),
      })
      .select('id, student_email, course_id, author_email, tag, text, created_at')
      .single()

    if (error) throw error
    return NextResponse.json({ note: data })
  } catch (err) {
    console.error('student-notes POST error:', err)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

// ─── DELETE: remove a note (author or superadmin only) ───

export async function DELETE(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return errorResponse(err)
  }

  const noteId = req.nextUrl.searchParams.get('noteId')
  if (!noteId) {
    return NextResponse.json({ error: 'noteId required' }, { status: 400 })
  }

  try {
    const { data: existing } = await supabase
      .from('student_notes')
      .select('author_email')
      .eq('id', noteId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Only author or superadmin can delete
    if (auth.role !== 'superadmin' && existing.author_email !== auth.email) {
      return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 })
    }

    const { error } = await supabase
      .from('student_notes')
      .delete()
      .eq('id', noteId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('student-notes DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
