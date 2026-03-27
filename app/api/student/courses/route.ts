import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get course IDs the student is enrolled in
    const { data: enrollments, error: enrollError } = await supabase
      .from('course_students')
      .select('course_id')
      .eq('student_email', session.user.email)
      .is('removed_at', null)

    if (enrollError) throw enrollError

    const courseIds = (enrollments || []).map((e: { course_id: string }) => e.course_id)

    if (courseIds.length === 0) {
      return NextResponse.json({ courses: [] })
    }

    // Get course details
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, name, description')
      .in('id', courseIds)
      .order('name')

    if (coursesError) throw coursesError

    // Get lesson counts per course
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('course_id')
      .in('course_id', courseIds)
      .eq('status', 'published')

    const lessonCounts: Record<string, number> = {}
    ;(lessonData || []).forEach((l: { course_id: string }) => {
      lessonCounts[l.course_id] = (lessonCounts[l.course_id] || 0) + 1
    })

    const coursesWithCounts = (courses || []).map((c: { id: string }) => ({
      ...c,
      lesson_count: lessonCounts[c.id] || 0,
    }))

    return NextResponse.json({ courses: coursesWithCounts })
  } catch (err) {
    console.error('Student courses error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
