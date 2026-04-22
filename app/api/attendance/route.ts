import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, hasAccessToCourse } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════
// /api/attendance
//
// Teacher + superadmin endpoint for marking and reading class
// attendance. Teachers can only access lessons in courses they
// teach. Audit fields (marked_by, marked_at) are set server-side.
// ═══════════════════════════════════════════════════════════════

const VALID_STATUSES = ['present', 'absent', 'late', 'excused'] as const
type Status = (typeof VALID_STATUSES)[number]

interface AttendanceRecord {
  student_email: string
  status: Status
  notes: string | null
  marked_by: string | null
  marked_at: string | null
}

function errorResponse(err: unknown): NextResponse {
  const e = err as { status?: number; message?: string }
  return NextResponse.json({ error: e.message || 'Error' }, { status: e.status || 500 })
}

// Helper: load a lesson and verify the current user has access to its course
async function loadLessonAndCheckAccess(
  lessonId: string,
  userEmail: string,
  userRole: 'teacher' | 'superadmin'
): Promise<
  | { ok: true; lesson: { id: string; title: string; course_id: string | null; lesson_date: string | null } }
  | { ok: false; response: NextResponse }
> {
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('id, title, course_id, lesson_date')
    .eq('id', lessonId)
    .single()
  if (error || !lesson) {
    return { ok: false, response: NextResponse.json({ error: 'Lesson not found' }, { status: 404 }) }
  }
  if (!lesson.course_id) {
    return { ok: false, response: NextResponse.json({ error: 'Lesson has no course — attendance not applicable' }, { status: 400 }) }
  }
  const hasAccess = await hasAccessToCourse(userEmail, userRole, lesson.course_id)
  if (!hasAccess) {
    return { ok: false, response: NextResponse.json({ error: 'Lesson not found' }, { status: 404 }) }
  }
  return { ok: true, lesson }
}

// ─── GET: roster + current attendance for a lesson ───

export async function GET(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return errorResponse(err)
  }

  const lessonId = req.nextUrl.searchParams.get('lessonId')
  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId required' }, { status: 400 })
  }

  const accessCheck = await loadLessonAndCheckAccess(lessonId, auth.email, auth.role)
  if (!accessCheck.ok) return accessCheck.response
  const lesson = accessCheck.lesson

  try {
    // Enrolled students in the lesson's course
    const { data: enrollments } = await supabase
      .from('course_students')
      .select('student_email')
      .eq('course_id', lesson.course_id)
      .is('removed_at', null)
    const emails = (enrollments || []).map((e: { student_email: string }) => e.student_email)

    let students: { email: string; name: string | null }[] = []
    if (emails.length > 0) {
      const { data: userRows } = await supabase
        .from('users')
        .select('email, name')
        .in('email', emails)
      students = (userRows || []) as { email: string; name: string | null }[]
    }

    // Existing attendance marks
    const { data: attendance } = await supabase
      .from('attendance')
      .select('student_email, status, notes, marked_by, marked_at')
      .eq('lesson_id', lessonId)
    const records = (attendance || []) as AttendanceRecord[]

    return NextResponse.json({ lesson, students, records })
  } catch (err) {
    console.error('attendance GET error:', err)
    return NextResponse.json({ error: 'Failed to load attendance' }, { status: 500 })
  }
}

// ─── POST: save (replace) attendance for a lesson ───

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return errorResponse(err)
  }

  try {
    const body = await req.json()
    const { lessonId, records } = body as {
      lessonId: string
      records: { student_email: string; status: Status; notes?: string | null }[]
    }

    if (!lessonId || !Array.isArray(records)) {
      return NextResponse.json({ error: 'lessonId + records[] required' }, { status: 400 })
    }

    const accessCheck = await loadLessonAndCheckAccess(lessonId, auth.email, auth.role)
    if (!accessCheck.ok) return accessCheck.response

    const now = new Date().toISOString()
    const validRecords = records.filter(
      (r) => r.student_email && VALID_STATUSES.includes(r.status)
    )

    // Replace-all strategy: delete existing rows for the lesson, insert new ones.
    // Simpler than upsert and matches the existing superadmin pattern.
    await supabase.from('attendance').delete().eq('lesson_id', lessonId)

    if (validRecords.length > 0) {
      const rows = validRecords.map((r) => ({
        lesson_id: lessonId,
        student_email: r.student_email,
        status: r.status,
        notes: r.notes || null,
        marked_by: auth.email,
        marked_at: now,
      }))
      const { error } = await supabase.from('attendance').insert(rows)
      if (error) throw error
    }

    return NextResponse.json({ ok: true, marked_at: now })
  } catch (err) {
    console.error('attendance POST error:', err)
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 })
  }
}
