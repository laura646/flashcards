import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getTeacherCourseIds } from '@/lib/roles'

/** Check if a teacher has access to a specific student */
async function teacherCanAccessStudent(teacherEmail: string, studentEmail: string): Promise<boolean> {
  const courseIds = await getTeacherCourseIds(teacherEmail, 'teacher')
  if (courseIds.length === 0) return false
  const { data } = await supabase
    .from('course_students')
    .select('student_email')
    .in('course_id', courseIds)
    .eq('student_email', studentEmail)
    .is('removed_at', null)
    .limit(1)
  return (data && data.length > 0) || false
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requested = req.nextUrl.searchParams.get('email')
  // Default to the caller's OWN data. Never run an unscoped query — omitting the
  // param previously skipped every guard and dumped all users' rows.
  const target = requested || session.user.email

  // Cross-user reads are allowed only for a superadmin, or a teacher who
  // actually teaches this student. Everyone else (student, hr, …) is denied.
  if (target !== session.user.email) {
    const role = session.user.role
    if (role === 'teacher') {
      const canAccess = await teacherCanAccessStudent(session.user.email, target)
      if (!canAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const { data, error } = await supabase
      .from('word_struggles')
      .select('*')
      .eq('user_email', target)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Word struggles GET error:', error)
      return NextResponse.json({ error: 'Failed to load word struggles' }, { status: 500 })
    }

    return NextResponse.json({ struggles: data })
  } catch (err) {
    console.error('Word struggles error:', err)
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
    const { user_email, word, activity_type, knew } = body

    if (!user_email || !word || !activity_type || knew === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (user_email !== postSession.user.email && postSession.user.role === 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (user_email !== postSession.user.email && postSession.user.role === 'teacher') {
      const canAccess = await teacherCanAccessStudent(postSession.user.email, user_email)
      if (!canAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Deny-by-default: only self, the student's teacher, or a superadmin may write.
    if (user_email !== postSession.user.email && postSession.user.role !== 'superadmin' && postSession.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('word_struggles')
      .insert({
        user_email,
        word,
        activity_type,
        knew: !!knew,
      })

    if (error) {
      console.error('Word struggles POST error:', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Word struggles error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
