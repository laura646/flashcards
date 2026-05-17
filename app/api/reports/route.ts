import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, hasAccessToCourse, getTeacherCourseIds } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════
// GET /api/reports
//
// Query params:
//   courseId  (required) — the course to report on
//   days      (optional) — '7' | '30' | '90' | 'all' (default '30')
//
// Returns raw data for client-side aggregation:
//   - course info
//   - students in the course
//   - exercises in the course's published lessons
//   - progress records (filtered by date + scoped to those students)
//
// The list of courses available to pick from is also returned
// (for the course dropdown). If no courseId is given, returns the
// course list only.
// ═══════════════════════════════════════════════════════════════

interface Course {
  id: string
  name: string
  description: string | null
}

interface Student {
  email: string
  name: string | null
}

interface Lesson {
  id: string
  title: string
  lesson_date: string | null
}

interface Exercise {
  id: string
  lesson_id: string
  title: string
  exercise_type: string
  is_mandatory: boolean | null
  skills: string[] | null
  cefr_level: string | null
  test_type: string | null
}

interface ProgressRecord {
  user_email: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
  response_text: string | null
}

interface WritingBlock {
  id: string
  lesson_id: string
  title: string | null
}

interface AttendanceRow {
  lesson_id: string
  student_email: string
  status: string
  notes: string | null
  marked_by: string | null
  marked_at: string | null
}

export async function GET(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const courseId = req.nextUrl.searchParams.get('courseId')
  const daysParam = req.nextUrl.searchParams.get('days') || '30'

  // ── Always: return list of courses the user can pick ──
  const accessibleCourseIds = await getTeacherCourseIds(auth.email, auth.role)
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, description')
    .in('id', accessibleCourseIds.length > 0 ? accessibleCourseIds : ['__none__'])
    .is('archived_at', null)
    .order('name')

  // If no specific course requested, just return the course list
  if (!courseId) {
    return NextResponse.json({
      courses: (courses || []) as Course[],
      course: null,
      students: [],
      lessons: [],
      exercises: [],
      progress: [],
      attendance: [],
      writingBlocks: [],
      vocabStruggles: {},
      lessonFlashcards: [],
      vocabSrs: [],
    })
  }

  // ── Access check: user must have access to this specific course ──
  const allowed = await hasAccessToCourse(auth.email, auth.role, courseId)
  if (!allowed) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  try {
    // 1. Course row
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, name, description')
      .eq('id', courseId)
      .single()
    if (courseErr) throw courseErr

    // 2. Students enrolled in this course (active only)
    const { data: enrollments } = await supabase
      .from('course_students')
      .select('student_email')
      .eq('course_id', courseId)
      .is('removed_at', null)
    const studentEmails = (enrollments || []).map((e: { student_email: string }) => e.student_email)

    // Get student name/email details
    let students: Student[] = []
    if (studentEmails.length > 0) {
      const { data: userRows } = await supabase
        .from('users')
        .select('email, name')
        .in('email', studentEmails)
      students = (userRows || []).map((u: { email: string; name: string | null }) => ({
        email: u.email,
        name: u.name,
      }))
    }

    // 3. Published lessons in this course
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, title, lesson_date')
      .eq('course_id', courseId)
      .eq('status', 'published')
      .order('lesson_date', { ascending: true })
    const lessonIds = (lessons || []).map((l: { id: string }) => l.id)

    // 4. Exercises in those lessons
    let exercises: Exercise[] = []
    if (lessonIds.length > 0) {
      const { data: exRows } = await supabase
        .from('lesson_exercises')
        .select('id, lesson_id, title, exercise_type, is_mandatory, skills, cefr_level, test_type')
        .in('lesson_id', lessonIds)
        .order('order_index', { ascending: true })
      exercises = (exRows || []) as Exercise[]
    }

    // 5. Progress records for these students, optionally filtered by date
    let progress: ProgressRecord[] = []
    if (studentEmails.length > 0) {
      let query = supabase
        .from('progress')
        .select('user_email, activity_type, activity_id, score, total, completed_at, response_text')
        .in('user_email', studentEmails)
        .order('completed_at', { ascending: false })

      if (daysParam !== 'all') {
        const days = parseInt(daysParam, 10)
        if (!isNaN(days) && days > 0) {
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - days)
          query = query.gte('completed_at', cutoff.toISOString())
        }
      }

      const { data: progressRows } = await query
      progress = (progressRows || []) as ProgressRecord[]
    }

    // 6. Attendance records for these lessons
    let attendance: AttendanceRow[] = []
    if (lessonIds.length > 0) {
      const { data: attRows } = await supabase
        .from('attendance')
        .select('lesson_id, student_email, status, notes, marked_by, marked_at')
        .in('lesson_id', lessonIds)
      attendance = (attRows || []) as AttendanceRow[]
    }

    // 7. Writing blocks (lesson_blocks where block_type = 'writing') — used to
    // resolve the title/lesson of each writing submission in the timeline.
    let writingBlocks: WritingBlock[] = []
    if (lessonIds.length > 0) {
      const { data: blockRows } = await supabase
        .from('lesson_blocks')
        .select('id, lesson_id, title')
        .in('lesson_id', lessonIds)
        .eq('block_type', 'writing')
      writingBlocks = (blockRows || []) as WritingBlock[]
    }

    // 8. Vocabulary "leeches" — words a student keeps failing. SM-2
    //    drives ease_factor toward 1.3 for repeatedly-missed words, so
    //    ease <= 1.8 (and seen at least once) is a solid struggling proxy.
    //    Returned as a per-student count for the teacher report.
    const vocabStruggles: Record<string, number> = {}
    if (studentEmails.length > 0) {
      const { data: leechRows } = await supabase
        .from('vocab_srs')
        .select('user_email')
        .in('user_email', studentEmails)
        .lte('ease_factor', 1.8)
        .gt('repetitions', 0)
      ;(leechRows || []).forEach((r: { user_email: string }) => {
        vocabStruggles[r.user_email] = (vocabStruggles[r.user_email] || 0) + 1
      })
    }

    // 9. Lesson flashcards (the vocab words assigned per lesson) — used to
    //    map a student's SRS words back to the lessons they came from for
    //    the per-lesson vocabulary breakdown.
    let lessonFlashcards: { lesson_id: string; word: string }[] = []
    if (lessonIds.length > 0) {
      const { data: fcRows } = await supabase
        .from('lesson_flashcards')
        .select('lesson_id, word')
        .in('lesson_id', lessonIds)
      lessonFlashcards = (fcRows || []) as { lesson_id: string; word: string }[]
    }

    // 10. Full SRS state per student (mastery stage + reps) for the
    //     vocabulary report section.
    let vocabSrs: { user_email: string; word: string; box_level: number; repetitions: number }[] = []
    if (studentEmails.length > 0) {
      const { data: srsRows } = await supabase
        .from('vocab_srs')
        .select('user_email, word, box_level, repetitions')
        .in('user_email', studentEmails)
      vocabSrs = (srsRows || []) as { user_email: string; word: string; box_level: number; repetitions: number }[]
    }

    return NextResponse.json({
      courses: (courses || []) as Course[],
      course: course as Course,
      students,
      lessons: (lessons || []) as Lesson[],
      exercises,
      progress,
      attendance,
      writingBlocks,
      vocabStruggles,
      lessonFlashcards,
      vocabSrs,
    })
  } catch (err) {
    console.error('Reports GET error:', err)
    return NextResponse.json({ error: 'Failed to load report data' }, { status: 500 })
  }
}
