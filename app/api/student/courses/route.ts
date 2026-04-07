import { NextResponse } from 'next/server'
import { getAuthUser, getStudentCourseIds } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const courseIds = await getStudentCourseIds(user.email)

    if (courseIds.length === 0) {
      return NextResponse.json({ courses: [] })
    }

    // Fetch course details and lesson counts in parallel
    const [{ data: courses, error: coursesError }, { data: lessonData }] = await Promise.all([
      supabase
        .from('courses')
        .select('id, name, description, level, telegram_link, lesson_link, schedule')
        .in('id', courseIds)
        .order('name'),
      supabase
        .from('lessons')
        .select('course_id')
        .in('course_id', courseIds)
        .eq('status', 'published'),
    ])

    if (coursesError) throw coursesError

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
