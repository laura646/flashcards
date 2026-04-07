import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getTeacherCourseIds } from '@/lib/roles'

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
    const { user_email, activity_type, activity_id, score, total, points_earned } = body

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

    const { error } = await supabase
      .from('progress')
      .insert({
        user_email,
        activity_type,
        activity_id: String(activity_id),
        score: score ?? null,
        total: total ?? null,
        points_earned: points_earned ?? null,
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
