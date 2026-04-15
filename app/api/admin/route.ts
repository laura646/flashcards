import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { getTeacherCourseIds } from '@/lib/roles'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (!role || role === 'student') return null
  return session // superadmin or teacher
}

/** Get student emails that belong to the teacher's courses */
async function getTeacherStudentEmails(email: string, role: string): Promise<string[] | null> {
  if (role === 'superadmin') return null // null means "all students"

  const courseIds = await getTeacherCourseIds(email, role as 'teacher')
  if (courseIds.length === 0) return []

  const { data } = await supabase
    .from('course_students')
    .select('student_email')
    .in('course_id', courseIds)
    .is('removed_at', null)

  const emails = (data || []).map((s: { student_email: string }) => s.student_email)
  return Array.from(new Set(emails))
}

export async function GET(req: NextRequest) {
  const adminSession = await checkAdmin()
  if (!adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const action = req.nextUrl.searchParams.get('action')

  const role = adminSession?.user?.role || 'teacher'
  const email = adminSession?.user?.email || ''

  try {
    // ── My Courses: list teacher's courses with counts ──
    if (action === 'my-courses') {
      const courseIds = await getTeacherCourseIds(email, role as 'teacher')
      if (courseIds.length === 0) return NextResponse.json({ courses: [] })

      const { data: courses, error } = await supabase
        .from('courses')
        .select('id, name, description, invite_code, created_at, course_type, archived_at, level')
        .in('id', courseIds)
        .is('archived_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const [studentRes, lessonRes] = await Promise.all([
        supabase.from('course_students').select('course_id').in('course_id', courseIds).is('removed_at', null),
        supabase.from('lessons').select('course_id').in('course_id', courseIds),
      ])

      const studentCounts: Record<string, number> = {}
      const lessonCounts: Record<string, number> = {}
      ;(studentRes.data || []).forEach((s: { course_id: string }) => {
        studentCounts[s.course_id] = (studentCounts[s.course_id] || 0) + 1
      })
      ;(lessonRes.data || []).forEach((l: { course_id: string }) => {
        lessonCounts[l.course_id] = (lessonCounts[l.course_id] || 0) + 1
      })

      const coursesWithCounts = (courses || []).map((c: { id: string }) => ({
        ...c,
        student_count: studentCounts[c.id] || 0,
        lesson_count: lessonCounts[c.id] || 0,
      }))

      return NextResponse.json({ courses: coursesWithCounts })
    }

    // ── Course detail: students + lessons for a specific course ──
    if (action === 'course-detail') {
      const courseId = req.nextUrl.searchParams.get('course_id')
      if (!courseId) return NextResponse.json({ error: 'course_id required' }, { status: 400 })

      // Verify teacher has access to this course
      const courseIds = await getTeacherCourseIds(email, role as 'teacher')
      if (!courseIds.includes(courseId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const [courseRes, studentsRes, lessonsRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('course_students').select('student_email').eq('course_id', courseId).is('removed_at', null),
        supabase.from('lessons').select('id, title, created_at, status, template_category, template_level, is_template, lesson_date').eq('course_id', courseId).order('lesson_date', { ascending: false }),
      ])

      if (courseRes.error) throw courseRes.error

      // Get student user details + profile data
      const studentEmails = (studentsRes.data || []).map((s: { student_email: string }) => s.student_email)
      let students: Record<string, unknown>[] = []
      if (studentEmails.length > 0) {
        const { data: userData } = await supabase
          .from('users')
          .select('email, name, created_at, level, learning_goals, company, common_issues_tags, common_issues_comments, blocked, notes')
          .in('email', studentEmails)

        // Get progress stats per student
        const { data: progressData } = await supabase
          .from('progress')
          .select('user_email, activity_type, activity_id, score, total, completed_at')
          .in('user_email', studentEmails)
          .order('completed_at', { ascending: false })

        const progressByEmail = new Map<string, typeof progressData>()
        for (const p of (progressData || [])) {
          const list = progressByEmail.get(p.user_email) || []
          list.push(p)
          progressByEmail.set(p.user_email, list)
        }

        students = (userData || []).map((user) => {
          const userProgress = progressByEmail.get(user.email) || []
          const lastActivity = userProgress.length > 0 ? userProgress[0].completed_at : null
          const totalSessions = userProgress.length
          return {
            ...user,
            last_activity: lastActivity,
            total_sessions: totalSessions,
          }
        })
      }

      return NextResponse.json({
        course: courseRes.data,
        students,
        lessons: lessonsRes.data || [],
      })
    }

    // ── My Students: flat deduplicated list across all teacher's courses ──
    if (action === 'my-students') {
      const allowedEmails = await getTeacherStudentEmails(email, role)

      if (allowedEmails !== null && allowedEmails.length === 0) {
        return NextResponse.json({ students: [] })
      }

      // Get student user data with profile fields
      let usersQuery = supabase
        .from('users')
        .select('email, name, created_at, level, learning_goals, company, common_issues_tags, common_issues_comments, blocked, notes')
        .order('created_at', { ascending: false })
      if (allowedEmails !== null) {
        usersQuery = usersQuery.in('email', allowedEmails)
      }
      const { data: users, error: usersError } = await usersQuery
      if (usersError) throw usersError

      // Get course enrollments for each student
      const userEmails = (users || []).map((u: { email: string }) => u.email)
      if (userEmails.length === 0) return NextResponse.json({ students: [] })

      const courseIds = await getTeacherCourseIds(email, role as 'teacher')

      const { data: enrollments } = await supabase
        .from('course_students')
        .select('student_email, course_id')
        .in('student_email', userEmails)
        .in('course_id', courseIds)
        .is('removed_at', null)

      // Get course names
      const enrolledCourseIds = Array.from(new Set((enrollments || []).map((e: { course_id: string }) => e.course_id)))
      let courseMap: Record<string, string> = {}
      if (enrolledCourseIds.length > 0) {
        const { data: courseData } = await supabase
          .from('courses')
          .select('id, name')
          .in('id', enrolledCourseIds)
        courseMap = Object.fromEntries((courseData || []).map((c: { id: string; name: string }) => [c.id, c.name]))
      }

      // Build enrollment map: email -> [{ course_id, course_name }]
      const enrollmentsByEmail = new Map<string, { course_id: string; course_name: string }[]>()
      for (const e of (enrollments || []) as { student_email: string; course_id: string }[]) {
        const list = enrollmentsByEmail.get(e.student_email) || []
        list.push({ course_id: e.course_id, course_name: courseMap[e.course_id] || 'Unknown' })
        enrollmentsByEmail.set(e.student_email, list)
      }

      const students = (users || []).map((user) => ({
        ...user,
        courses: enrollmentsByEmail.get(user.email) || [],
      }))

      return NextResponse.json({ students })
    }

    // ── Students list (legacy - kept for backward compatibility) ──
    if (action === 'students') {
      const allowedEmails = await getTeacherStudentEmails(email, role)

      // SECURITY: Never select password_hash, reset_token, or reset_token_expires_at
      let usersQuery = supabase
        .from('users')
        .select('email, name, role, created_at, level, learning_goals, company, country, specialization, common_issues_tags, common_issues_comments, blocked, notes')
        .order('created_at', { ascending: false })
      if (allowedEmails !== null) {
        if (allowedEmails.length === 0) return NextResponse.json({ students: [] })
        usersQuery = usersQuery.in('email', allowedEmails)
      }

      const { data: users, error: usersError } = await usersQuery
      if (usersError) throw usersError

      const userEmails = (users || []).map((u: { email: string }) => u.email)

      let progressQuery = supabase
        .from('progress')
        .select('user_email, activity_type, activity_id, score, total, points_earned, completed_at')
        .order('completed_at', { ascending: false })
      if (allowedEmails !== null) {
        progressQuery = progressQuery.in('user_email', userEmails)
      }
      const { data: progress, error: progressError } = await progressQuery
      if (progressError) throw progressError

      let assignmentsQuery = supabase
        .from('student_assignments')
        .select('id, user_email, set_name, assigned_at')
      if (allowedEmails !== null) {
        assignmentsQuery = assignmentsQuery.in('user_email', userEmails)
      }
      const { data: assignments } = await assignmentsQuery

      // Fetch all exercises to know which are mandatory vs bonus
      const { data: allExercises } = await supabase.from('lesson_exercises').select('id, is_mandatory')
      const mandatoryExerciseIds = new Set<string>()
      const bonusExerciseIds = new Set<string>()
      const allExerciseIdSet = new Set<string>()
      ;(allExercises || []).forEach((ex: { id: string; is_mandatory?: boolean }) => {
        allExerciseIdSet.add(ex.id)
        if (ex.is_mandatory === false) {
          bonusExerciseIds.add(ex.id)
        } else {
          mandatoryExerciseIds.add(ex.id)
        }
      })

      const progressByEmail = new Map<string, typeof progress>()
      for (const p of (progress || [])) {
        const list = progressByEmail.get(p.user_email) || []
        list.push(p)
        progressByEmail.set(p.user_email, list)
      }

      const assignmentsByEmail = new Map<string, string[]>()
      for (const a of (assignments || []) as { user_email: string; set_name: string }[]) {
        const list = assignmentsByEmail.get(a.user_email) || []
        list.push(a.set_name)
        assignmentsByEmail.set(a.user_email, list)
      }

      const students = (users || []).map((user) => {
        const userProgress = progressByEmail.get(user.email) || []
        const lastActivity = userProgress.length > 0 ? userProgress[0].completed_at : null
        const totalSessions = userProgress.length
        const quizScores = userProgress
          .filter((p: { activity_id: string; score: number | null }) => p.activity_id === 'quiz' && p.score !== null)
          .map((p: { score: number; total: number }) => Math.round((p.score / p.total) * 100))
        const avgQuizScore = quizScores.length > 0
          ? Math.round(quizScores.reduce((a: number, b: number) => a + b, 0) / quizScores.length)
          : null

        const exerciseIds = new Set<string>()
        const flashcardIds = new Set<string>()
        let mandatoryDone = 0
        let bonusDone = 0
        for (const p of userProgress as { activity_type: string; activity_id: string }[]) {
          if (p.activity_type === 'exercise') {
            exerciseIds.add(p.activity_id)
            if (mandatoryExerciseIds.has(p.activity_id)) mandatoryDone++
            if (bonusExerciseIds.has(p.activity_id)) bonusDone++
          }
          else if (p.activity_type === 'flashcard') flashcardIds.add(p.activity_id)
        }

        return {
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          last_activity: lastActivity,
          total_sessions: totalSessions,
          avg_quiz_score: avgQuizScore,
          exercises_done: exerciseIds.size,
          mandatory_done: mandatoryDone,
          bonus_done: bonusDone,
          mandatory_total: mandatoryExerciseIds.size,
          bonus_total: bonusExerciseIds.size,
          flashcard_modes: flashcardIds.size,
          blocked: user.blocked || false,
          notes: user.notes || '',
          assigned_sets: assignmentsByEmail.get(user.email) || [],
        }
      })

      return NextResponse.json({ students })
    }

    if (action === 'student-detail') {
      const studentEmail = req.nextUrl.searchParams.get('email')
      if (!studentEmail) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 })
      }

      const allowedEmails = await getTeacherStudentEmails(email, role)
      if (allowedEmails !== null && !allowedEmails.includes(studentEmail)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      // SECURITY: Never select password_hash, reset_token, or reset_token_expires_at
      const [progressRes, userRes, assignmentsRes] = await Promise.all([
        supabase
          .from('progress')
          .select('user_email, activity_type, activity_id, score, total, points_earned, completed_at')
          .eq('user_email', studentEmail)
          .order('completed_at', { ascending: false }),
        supabase
          .from('users')
          .select('email, name, role, created_at, level, learning_goals, company, country, specialization, common_issues_tags, common_issues_comments, blocked, notes')
          .eq('email', studentEmail)
          .maybeSingle(),
        supabase
          .from('student_assignments')
          .select('id, user_email, set_name, assigned_at')
          .eq('user_email', studentEmail),
      ])

      if (progressRes.error) throw progressRes.error

      // Get which of the teacher's courses this student is in
      const courseIds = await getTeacherCourseIds(email, role as 'teacher')
      const { data: enrollments } = await supabase
        .from('course_students')
        .select('course_id')
        .eq('student_email', studentEmail)
        .in('course_id', courseIds)
        .is('removed_at', null)

      const studentCourseIds = (enrollments || []).map((e: { course_id: string }) => e.course_id)
      let studentCourses: { id: string; name: string }[] = []
      if (studentCourseIds.length > 0) {
        const { data: courseData } = await supabase
          .from('courses')
          .select('id, name')
          .in('id', studentCourseIds)
        studentCourses = (courseData || []) as { id: string; name: string }[]
      }

      return NextResponse.json({
        progress: progressRes.data || [],
        user: userRes.data || null,
        assignments: (assignmentsRes.data || []).map((a: { set_name: string }) => a.set_name),
        courses: studentCourses,
      })
    }

    if (action === 'overview') {
      const allowedEmails = await getTeacherStudentEmails(email, role)

      let usersQuery = supabase.from('users').select('*')
      if (allowedEmails !== null) {
        if (allowedEmails.length === 0) {
          return NextResponse.json({ overview: { total_students: 0, total_sessions: 0, recent_sessions: 0, active_this_week: 0, recent_activity: [] } })
        }
        usersQuery = usersQuery.in('email', allowedEmails)
      }
      const { data: users, error: usersError } = await usersQuery
      if (usersError) throw usersError

      const userEmails = (users || []).map((u: { email: string }) => u.email)
      let progressQuery = supabase.from('progress').select('*').order('completed_at', { ascending: false })
      if (allowedEmails !== null) {
        progressQuery = progressQuery.in('user_email', userEmails)
      }
      const { data: progress, error: progressError } = await progressQuery
      if (progressError) throw progressError

      const totalStudents = (users || []).length
      const totalSessions = (progress || []).length

      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const recentSessions = (progress || []).filter(
        (p: { completed_at: string }) => new Date(p.completed_at) > weekAgo
      ).length

      const activeThisWeek = new Set(
        (progress || [])
          .filter((p: { completed_at: string }) => new Date(p.completed_at) > weekAgo)
          .map((p: { user_email: string }) => p.user_email)
      ).size

      const usersByEmail = new Map((users || []).map((u: { email: string; name: string }) => [u.email, u]))

      const recentActivity = (progress || []).slice(0, 10).map((p: {
        user_email: string
        activity_type: string
        activity_id: string
        score: number | null
        total: number | null
        completed_at: string
      }) => {
        const user = usersByEmail.get(p.user_email)
        return {
          student_name: user?.name || p.user_email,
          student_email: p.user_email,
          activity_type: p.activity_type,
          activity_id: p.activity_id,
          score: p.score,
          total: p.total,
          completed_at: p.completed_at,
        }
      })

      return NextResponse.json({
        overview: {
          total_students: totalStudents,
          total_sessions: totalSessions,
          recent_sessions: recentSessions,
          active_this_week: activeThisWeek,
          recent_activity: recentActivity,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Admin API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const adminSession = await checkAdmin()
  if (!adminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body
  const role = adminSession?.user?.role || 'teacher'
  const email = adminSession?.user?.email || ''

  try {
    // ── Update student profile (teachers can edit) ──
    if (action === 'update-student-profile') {
      const { studentEmail, level, learning_goals, company, common_issues_tags, common_issues_comments } = body
      if (!studentEmail) return NextResponse.json({ error: 'studentEmail required' }, { status: 400 })

      // Verify teacher has access to this student
      const allowedEmails = await getTeacherStudentEmails(email, role)
      if (allowedEmails !== null && !allowedEmails.includes(studentEmail)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const updateData: Record<string, unknown> = {}
      if (level !== undefined) updateData.level = level
      if (learning_goals !== undefined) updateData.learning_goals = learning_goals
      if (company !== undefined) updateData.company = company
      if (common_issues_tags !== undefined) updateData.common_issues_tags = common_issues_tags
      if (common_issues_comments !== undefined) updateData.common_issues_comments = common_issues_comments

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('email', studentEmail)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Update course info (teachers can edit) ──
    if (action === 'update-course') {
      const { course_id, name, description, level, course_type } = body
      if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 })

      // Verify teacher has access to this course
      const courseIds = await getTeacherCourseIds(email, role as 'teacher')
      if (!courseIds.includes(course_id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (level !== undefined) updateData.level = level
      if (course_type !== undefined) updateData.course_type = course_type

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
      }

      const { error } = await supabase
        .from('courses')
        .update(updateData)
        .eq('id', course_id)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Block / Unblock student (superadmin only) ──
    if (action === 'toggle-block') {
      if (adminSession?.user?.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmin can block students' }, { status: 403 })
      }
      const { email: studentEmail, blocked } = body
      if (!studentEmail) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      const { error } = await supabase
        .from('users')
        .update({ blocked: !!blocked })
        .eq('email', studentEmail)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Reset student progress ──
    if (action === 'reset-progress') {
      const { email: studentEmail } = body
      if (!studentEmail) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      // Verify teacher has access to this student
      const allowedEmails = await getTeacherStudentEmails(email, role)
      if (allowedEmails !== null && !allowedEmails.includes(studentEmail)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('progress')
        .delete()
        .eq('user_email', studentEmail)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Update teacher notes ──
    if (action === 'update-notes') {
      const { email: studentEmail, notes } = body
      if (!studentEmail) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      // Verify teacher has access to this student
      const allowedEmails = await getTeacherStudentEmails(email, role)
      if (allowedEmails !== null && !allowedEmails.includes(studentEmail)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('users')
        .update({ notes: notes || '' })
        .eq('email', studentEmail)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Send reminder email ──
    if (action === 'send-reminder') {
      const { email: studentEmail, studentName, message } = body
      if (!studentEmail || !message) {
        return NextResponse.json({ error: 'Email and message required' }, { status: 400 })
      }

      // Verify teacher has access to this student
      const allowedEmails = await getTeacherStudentEmails(email, role)
      if (allowedEmails !== null && !allowedEmails.includes(studentEmail)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
      }

      const esc = (await import('@/lib/html')).escHtml
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from: 'English with Laura <noreply@learn.englishwithlaura.com>',
        to: studentEmail,
        subject: `A message from Laura — English with Laura`,
        html: `
          <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
            <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura</h1>
            </div>
            <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 15px; margin-top: 0;">Hi ${esc(studentName) || 'there'},</p>
              <p style="font-size: 15px; line-height: 1.6; white-space: pre-line;">${esc(message)}</p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e6f0fa;">
                <a href="https://flashcards-app-navy.vercel.app"
                   style="display: inline-block; background: #416ebe; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                  Open Flashcards App
                </a>
              </div>
              <p style="font-size: 13px; color: #888; margin-top: 24px;">— Laura</p>
            </div>
          </div>
        `,
      })

      return NextResponse.json({ ok: true })
    }

    // ── Assign content set ──
    if (action === 'assign-set') {
      const { email: studentEmail, set_name } = body
      if (!studentEmail || !set_name) {
        return NextResponse.json({ error: 'Email and set name required' }, { status: 400 })
      }

      // Verify teacher has access to this student
      const allowedForAssign = await getTeacherStudentEmails(email, role)
      if (allowedForAssign !== null && !allowedForAssign.includes(studentEmail)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('student_assignments')
        .upsert(
          { user_email: studentEmail, set_name },
          { onConflict: 'user_email,set_name' }
        )

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Remove content set ──
    if (action === 'remove-set') {
      const { email: studentEmail, set_name } = body
      if (!studentEmail || !set_name) {
        return NextResponse.json({ error: 'Email and set name required' }, { status: 400 })
      }

      // Verify teacher has access to this student
      const allowedForRemove = await getTeacherStudentEmails(email, role)
      if (allowedForRemove !== null && !allowedForRemove.includes(studentEmail)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('student_assignments')
        .delete()
        .eq('user_email', studentEmail)
        .eq('set_name', set_name)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Admin POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
