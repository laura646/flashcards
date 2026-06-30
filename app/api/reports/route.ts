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
  current_level?: string | null
  goal_level?: string | null
  group_progress_pct?: number | null
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
  points_earned: number | null
}

interface WritingBlock {
  id: string
  lesson_id: string
  title: string | null
}

interface CourseSession {
  id: string
  session_date: string | null
  topic: string | null
  status: string
}

interface AttendanceRow {
  session_id: string
  student_email: string
  status: string
}

export async function GET(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin', 'hr')
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
      sessions: [],
      writingBlocks: [],
      vocabStruggles: {},
      lessonFlashcards: [],
      vocabSrs: [],
      notes: [],
      courseProgress: {},
      attendanceSummary: {},
      archivedEmails: [],
      assessments: [],
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

    // 1b. Course CEFR endpoints (best-effort — columns may not exist before the
    //     P4 migration runs; never let a missing column 500 the whole report).
    let currentLevel: string | null = null
    let goalLevel: string | null = null
    {
      const { data: lv, error: lvErr } = await supabase
        .from('courses')
        .select('current_level, goal_level')
        .eq('id', courseId)
        .maybeSingle()
      if (!lvErr && lv) {
        currentLevel = (lv as { current_level: string | null }).current_level ?? null
        goalLevel = (lv as { goal_level: string | null }).goal_level ?? null
      }
    }

    // 1c. Group-level manual progress % (best-effort, separate query so a
    //     missing column never breaks the current/goal fetch above).
    let groupProgressPct: number | null = null
    {
      const { data: gp, error: gpErr } = await supabase
        .from('courses')
        .select('group_progress_pct')
        .eq('id', courseId)
        .maybeSingle()
      if (!gpErr && gp) groupProgressPct = (gp as { group_progress_pct: number | null }).group_progress_pct ?? null
    }

    // 2. Students enrolled in this course (active only)
    const { data: enrollments } = await supabase
      .from('course_students')
      .select('student_email, archived_at')
      .eq('course_id', courseId)
      .is('removed_at', null)
    const enrollRows = (enrollments || []) as { student_email: string; archived_at: string | null }[]
    const studentEmails = enrollRows.map((e) => e.student_email)
    const archivedEmails = enrollRows.filter((e) => !!e.archived_at).map((e) => e.student_email)

    // 2b. Manual course-progress % per student (best-effort — columns may not
    //     exist before the P4 migration). HR sees the value; only teachers edit.
    const courseProgress: Record<string, { pct: number | null; updatedAt: string | null }> = {}
    {
      const { data: progRows, error: progErr } = await supabase
        .from('course_students')
        .select('student_email, course_progress_pct, course_progress_updated_at')
        .eq('course_id', courseId)
        .is('removed_at', null)
      if (!progErr && progRows) {
        for (const r of progRows as {
          student_email: string
          course_progress_pct: number | null
          course_progress_updated_at: string | null
        }[]) {
          courseProgress[r.student_email] = {
            pct: r.course_progress_pct ?? null,
            updatedAt: r.course_progress_updated_at ?? null,
          }
        }
      }
    }

    // Manual attendance summary (bulk backfill). Separate best-effort query so a
    // missing column (pre-migration) can't break course progress or the page.
    const attendanceSummary: Record<string, { present: number; late: number; absent: number; excused: number; total: number }> = {}
    {
      const { data: attRows, error: attErr } = await supabase
        .from('course_students')
        .select('student_email, att_present, att_late, att_absent, att_excused, att_total')
        .eq('course_id', courseId)
        .is('removed_at', null)
      if (!attErr && attRows) {
        for (const r of attRows as {
          student_email: string
          att_present: number | null
          att_late: number | null
          att_absent: number | null
          att_excused: number | null
          att_total: number | null
        }[]) {
          if (r.att_total != null && r.att_total > 0) {
            attendanceSummary[r.student_email] = {
              present: r.att_present ?? 0,
              late: r.att_late ?? 0,
              absent: r.att_absent ?? 0,
              excused: r.att_excused ?? 0,
              total: r.att_total,
            }
          }
        }
      }
    }

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
        .select('user_email, activity_type, activity_id, score, total, completed_at, response_text, points_earned')
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

    // 6. Attendance — course-native session model (course_sessions +
    //    session_attendance). Replaces the dead lesson-keyed `attendance` table,
    //    which no live UI writes to anymore.
    const { data: sessionRows } = await supabase
      .from('course_sessions')
      .select('id, session_date, topic, status')
      .eq('course_id', courseId)
      .order('session_date', { ascending: false })
    const sessions = (sessionRows || []) as CourseSession[]

    let attendance: AttendanceRow[] = []
    const sessionIds = sessions.map((s) => s.id)
    if (sessionIds.length > 0) {
      const { data: attRows } = await supabase
        .from('session_attendance')
        .select('session_id, student_email, status')
        .in('session_id', sessionIds)
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

    // 11. All teacher notes for this course's students — so a multi-student
    //     export can include notes without an N+1 per-student fetch.
    let notes: {
      id: string
      student_email: string
      course_id: string
      author_email: string
      tag: string
      text: string
      created_at: string
    }[] = []
    if (studentEmails.length > 0) {
      const { data: noteRows } = await supabase
        .from('student_notes')
        .select('id, student_email, course_id, author_email, tag, text, created_at')
        .eq('course_id', courseId)
        .in('student_email', studentEmails)
        .order('created_at', { ascending: false })
      notes = (noteRows || []) as typeof notes
    }

    // 12. Manual assessments (offline / written / oral tests). Best-effort —
    //     the table may not exist before the P5 migration; never 500 the report.
    let assessments: {
      id: string
      student_email: string
      name: string
      test_date: string | null
      score: number | null
      max_score: number | null
      source: string | null
    }[] = []
    if (studentEmails.length > 0) {
      const { data: aRows, error: aErr } = await supabase
        .from('assessments')
        .select('id, student_email, name, test_date, score, max_score, source')
        .eq('course_id', courseId)
        .in('student_email', studentEmails)
        .order('test_date', { ascending: false })
      if (!aErr && aRows) assessments = aRows as typeof assessments
    }

    return NextResponse.json({
      courses: (courses || []) as Course[],
      course: { ...(course as Course), current_level: currentLevel, goal_level: goalLevel, group_progress_pct: groupProgressPct },
      students,
      lessons: (lessons || []) as Lesson[],
      exercises,
      progress,
      attendance,
      sessions,
      writingBlocks,
      vocabStruggles,
      lessonFlashcards,
      vocabSrs,
      notes,
      courseProgress,
      attendanceSummary,
      archivedEmails,
      assessments,
    })
  } catch (err) {
    console.error('Reports GET error:', err)
    return NextResponse.json({ error: 'Failed to load report data' }, { status: 500 })
  }
}
