import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

function handleError(err: unknown) {
  if (err && typeof err === 'object' && 'status' in err) {
    const e = err as { status: number; message: string }
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error('Superadmin API error:', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

// ── GET: Fetch data ──
export async function GET(req: NextRequest) {
  try {
    await requireRole('superadmin')
  } catch (err) {
    return handleError(err)
  }

  const action = req.nextUrl.searchParams.get('action')

  try {
    // ── List all courses with teacher & student counts ──
    if (action === 'courses') {
      const includeArchived = req.nextUrl.searchParams.get('include_archived') === 'true'

      let query = supabase
        .from('courses')
        .select('id, name, description, invite_code, created_at, course_type, archived_at, level')
        .order('created_at', { ascending: false })

      if (!includeArchived) {
        query = query.is('archived_at', null)
      }

      const { data: courses, error } = await query

      if (error) throw error

      // Get counts
      const courseIds = (courses || []).map((c: { id: string }) => c.id)

      if (courseIds.length === 0) {
        return NextResponse.json({ courses: [] })
      }

      const [teacherRes, studentRes, lessonRes] = await Promise.all([
        supabase.from('course_teachers').select('course_id').in('course_id', courseIds),
        supabase.from('course_students').select('course_id').in('course_id', courseIds).is('removed_at', null),
        supabase.from('lessons').select('course_id').in('course_id', courseIds),
      ])

      const teacherCounts: Record<string, number> = {}
      const studentCounts: Record<string, number> = {}
      const lessonCounts: Record<string, number> = {}

      ;(teacherRes.data || []).forEach((t: { course_id: string }) => {
        teacherCounts[t.course_id] = (teacherCounts[t.course_id] || 0) + 1
      })
      ;(studentRes.data || []).forEach((s: { course_id: string }) => {
        studentCounts[s.course_id] = (studentCounts[s.course_id] || 0) + 1
      })
      ;(lessonRes.data || []).forEach((l: { course_id: string }) => {
        lessonCounts[l.course_id] = (lessonCounts[l.course_id] || 0) + 1
      })

      const coursesWithCounts = (courses || []).map((c: { id: string }) => ({
        ...c,
        teacher_count: teacherCounts[c.id] || 0,
        student_count: studentCounts[c.id] || 0,
        lesson_count: lessonCounts[c.id] || 0,
      }))

      return NextResponse.json({ courses: coursesWithCounts })
    }

    // ── Get details for a specific course ──
    if (action === 'course-detail') {
      const courseId = req.nextUrl.searchParams.get('course_id')
      if (!courseId) {
        return NextResponse.json({ error: 'course_id required' }, { status: 400 })
      }

      // NOTE: Using select('*') here as a stable baseline. These tables are
      // superadmin-only and currently contain no password/token columns. If you
      // add sensitive columns to courses / course_teachers / course_students,
      // come back and switch to an explicit whitelist.
      const [courseRes, teachersRes, studentsRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('course_teachers').select('*').eq('course_id', courseId),
        supabase.from('course_students').select('*').eq('course_id', courseId).is('removed_at', null),
      ])

      if (courseRes.error) throw courseRes.error
      // Surface query errors so silent failures don't go unnoticed
      if (teachersRes.error) console.error('course-detail teachers query error:', teachersRes.error.message)
      if (studentsRes.error) console.error('course-detail students query error:', studentsRes.error.message)

      // Fetch user details separately to avoid FK join issues
      const teacherEmails = (teachersRes.data || []).map((t: { teacher_email: string }) => t.teacher_email)
      const studentEmails = (studentsRes.data || []).map((s: { student_email: string }) => s.student_email)
      const allEmails = Array.from(new Set([...teacherEmails, ...studentEmails]))

      let usersMap: Record<string, { name: string; email: string }> = {}
      if (allEmails.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('email, name')
          .in('email', allEmails)
        ;(usersData || []).forEach((u: { email: string; name: string }) => {
          usersMap[u.email] = u
        })
      }

      const teachers = (teachersRes.data || []).map((t: { teacher_email: string }) => ({
        ...t,
        users: usersMap[t.teacher_email] || { name: t.teacher_email, email: t.teacher_email },
      }))

      const students = (studentsRes.data || []).map((s: { student_email: string }) => ({
        ...s,
        users: usersMap[s.student_email] || { name: s.student_email, email: s.student_email },
      }))

      return NextResponse.json({
        course: courseRes.data,
        teachers,
        students,
      })
    }

    // ── List all teachers (with profile fields) ──
    if (action === 'teachers') {
      const { data, error } = await supabase
        .from('users')
        .select('email, name, country, specialization, created_at')
        .eq('role', 'teacher')
        .order('name')

      if (error) throw error

      // Get course counts per teacher
      const teacherEmails = (data || []).map((t: { email: string }) => t.email)
      let courseCounts: Record<string, number> = {}
      if (teacherEmails.length > 0) {
        const { data: ctData } = await supabase
          .from('course_teachers')
          .select('teacher_email')
          .in('teacher_email', teacherEmails)
        for (const ct of (ctData || []) as { teacher_email: string }[]) {
          courseCounts[ct.teacher_email] = (courseCounts[ct.teacher_email] || 0) + 1
        }
      }

      const teachersWithCounts = (data || []).map((t: { email: string }) => ({
        ...t,
        course_count: courseCounts[t.email] || 0,
      }))

      return NextResponse.json({ teachers: teachersWithCounts })
    }

    // ── List all students (with profile fields and courses) ──
    if (action === 'all-students') {
      const { data, error } = await supabase
        .from('users')
        .select('email, name, country, level, learning_goals, company, common_issues_tags, common_issues_comments, created_at')
        .eq('role', 'student')
        .order('name')

      if (error) throw error

      // Get courses per student
      const studentEmails = (data || []).map((s: { email: string }) => s.email)
      let studentCourses: Record<string, string[]> = {}
      if (studentEmails.length > 0) {
        const { data: csData } = await supabase
          .from('course_students')
          .select('student_email, course_id')
          .in('student_email', studentEmails)
          .is('removed_at', null)

        // Get course names
        const courseIds = Array.from(new Set((csData || []).map((cs: { course_id: string }) => cs.course_id)))
        let courseNames: Record<string, string> = {}
        if (courseIds.length > 0) {
          const { data: courses } = await supabase
            .from('courses')
            .select('id, name')
            .in('id', courseIds)
          for (const c of (courses || []) as { id: string; name: string }[]) {
            courseNames[c.id] = c.name
          }
        }

        for (const cs of (csData || []) as { student_email: string; course_id: string }[]) {
          if (!studentCourses[cs.student_email]) studentCourses[cs.student_email] = []
          const name = courseNames[cs.course_id]
          if (name) studentCourses[cs.student_email].push(name)
        }
      }

      const studentsWithCourses = (data || []).map((s: { email: string }) => ({
        ...s,
        courses: studentCourses[s.email] || [],
      }))

      return NextResponse.json({ students: studentsWithCourses })
    }

    // ── List all users (for assigning) ──
    if (action === 'users') {
      const { data, error } = await supabase
        .from('users')
        .select('email, name, role, created_at')
        .order('name')

      if (error) throw error
      return NextResponse.json({ users: data || [] })
    }

    // ── Get attendance for a lesson ──
    if (action === 'attendance') {
      const lessonId = req.nextUrl.searchParams.get('lesson_id')
      if (!lessonId) {
        return NextResponse.json({ error: 'lesson_id required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('lesson_id', lessonId)

      if (error) throw error
      return NextResponse.json({ attendance: data || [] })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return handleError(err)
  }
}

// ── POST: Mutations ──
export async function POST(req: NextRequest) {
  let user
  try {
    user = await requireRole('superadmin')
  } catch (err) {
    return handleError(err)
  }

  const body = await req.json()
  const { action } = body

  try {
    // ── Create a new course ──
    if (action === 'create-course') {
      const { name, description } = body
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Course name required' }, { status: 400 })
      }

      // Generate a cryptographically strong invite code:
      // 4-char course prefix + 12 hex chars (2^48 = ~281 trillion combinations).
      // Prevents brute-force enumeration of courses via the /api/join endpoint.
      const { randomBytes } = await import('crypto')
      const prefix = name.trim().replace(/\s+/g, '').substring(0, 4).toUpperCase()
      const inviteCode = prefix + '-' + randomBytes(6).toString('hex').toUpperCase()

      const { data, error } = await supabase
        .from('courses')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          invite_code: inviteCode,
          created_by: user.email,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ course: data })
    }

    // ── Update a course (supports all fields) ──
    if (action === 'update-course') {
      const { course_id, name, description, level, telegram_link, lesson_link, schedule, total_planned_sessions, teacher_notes, course_type } = body
      if (!course_id) {
        return NextResponse.json({ error: 'course_id required' }, { status: 400 })
      }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name.trim()
      if (description !== undefined) updateData.description = description?.trim() || null
      if (level !== undefined) updateData.level = level || null
      if (telegram_link !== undefined) updateData.telegram_link = telegram_link?.trim() || null
      if (lesson_link !== undefined) updateData.lesson_link = lesson_link?.trim() || null
      if (schedule !== undefined) updateData.schedule = schedule?.trim() || null
      if (total_planned_sessions !== undefined) updateData.total_planned_sessions = total_planned_sessions || null
      if (teacher_notes !== undefined) updateData.teacher_notes = teacher_notes?.trim() || null
      if (course_type !== undefined) updateData.course_type = course_type || null

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

    // ── Delete a course ──
    if (action === 'delete-course') {
      const { course_id } = body
      if (!course_id) {
        return NextResponse.json({ error: 'course_id required' }, { status: 400 })
      }

      // Cascade deletes teachers & students via FK, but lessons need course_id cleared
      await supabase.from('lessons').update({ course_id: null }).eq('course_id', course_id)
      const { error } = await supabase.from('courses').delete().eq('id', course_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Invite a teacher (create user with teacher role + send email) ──
    if (action === 'invite-teacher') {
      const { email, name: teacherName } = body
      if (!email?.trim()) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 })
      }

      const cleanEmail = email.trim().toLowerCase()

      // Upsert user with teacher role
      const { error: userError } = await supabase
        .from('users')
        .upsert(
          { email: cleanEmail, name: teacherName?.trim() || '', role: 'teacher' },
          { onConflict: 'email' }
        )

      if (userError) throw userError

      // Send invite email
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        const esc = (await import('@/lib/html')).escHtml
        const resend = new Resend(apiKey)
        try {
          await resend.emails.send({
            from: 'English with Laura <noreply@learn.englishwithlaura.com>',
            to: cleanEmail,
            subject: 'You\'ve been invited as a teacher — English with Laura',
            html: `
              <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
                <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura</h1>
                </div>
                <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
                  <p style="font-size: 15px; margin-top: 0;">Hi ${esc(teacherName || 'there')},</p>
                  <p style="font-size: 15px; line-height: 1.6;">You've been invited as a <strong>teacher</strong> on the English with Laura platform. Sign in with your Google account to get started.</p>
                  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e6f0fa;">
                    <a href="https://flashcards-app-navy.vercel.app"
                       style="display: inline-block; background: #416ebe; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                      Sign In to Platform
                    </a>
                  </div>
                  <p style="font-size: 13px; color: #888; margin-top: 24px;">— Laura</p>
                </div>
              </div>
            `,
          })
        } catch (emailErr) {
          console.error('Teacher invite email error:', emailErr)
        }
      }

      return NextResponse.json({ ok: true })
    }

    // ── Assign teacher to a course ──
    if (action === 'assign-teacher') {
      const { course_id, teacher_email } = body
      if (!course_id || !teacher_email) {
        return NextResponse.json({ error: 'course_id and teacher_email required' }, { status: 400 })
      }

      const cleanEmail = teacher_email.toLowerCase()

      // Check if already assigned
      const { data: existing } = await supabase
        .from('course_teachers')
        .select('id')
        .eq('course_id', course_id)
        .eq('teacher_email', cleanEmail)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ ok: true, message: 'Already assigned' })
      }

      // Insert with explicit id
      const { error } = await supabase
        .from('course_teachers')
        .insert({ course_id, teacher_email: cleanEmail })

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Remove teacher from a course ──
    if (action === 'remove-teacher') {
      const { course_id, teacher_email } = body
      if (!course_id || !teacher_email) {
        return NextResponse.json({ error: 'course_id and teacher_email required' }, { status: 400 })
      }

      const { error } = await supabase
        .from('course_teachers')
        .delete()
        .eq('course_id', course_id)
        .eq('teacher_email', teacher_email)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Enroll a student in a course ──
    if (action === 'enroll-student') {
      const { course_id, student_email } = body
      if (!course_id || !student_email) {
        return NextResponse.json({ error: 'course_id and student_email required' }, { status: 400 })
      }

      const cleanEmail = student_email.toLowerCase()

      // Check if student was previously soft-deleted — re-activate them
      const { data: existing } = await supabase
        .from('course_students')
        .select('id, removed_at')
        .eq('course_id', course_id)
        .eq('student_email', cleanEmail)
        .maybeSingle()

      if (existing) {
        if (existing.removed_at) {
          // Re-activate: clear removed_at
          const { error } = await supabase
            .from('course_students')
            .update({ removed_at: null })
            .eq('id', existing.id)
          if (error) throw error
          return NextResponse.json({ ok: true, message: 'Student re-enrolled' })
        }
        return NextResponse.json({ ok: true, message: 'Already enrolled' })
      }

      // New enrollment
      const { error } = await supabase
        .from('course_students')
        .insert({ course_id, student_email: cleanEmail })

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Remove student from a course (soft delete — preserves progress) ──
    if (action === 'remove-student') {
      const { course_id, student_email } = body
      if (!course_id || !student_email) {
        return NextResponse.json({ error: 'course_id and student_email required' }, { status: 400 })
      }

      const { error } = await supabase
        .from('course_students')
        .update({ removed_at: new Date().toISOString() })
        .eq('course_id', course_id)
        .eq('student_email', student_email)
        .is('removed_at', null)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Regenerate invite code for a course ──
    if (action === 'regenerate-invite') {
      const { course_id } = body
      if (!course_id) {
        return NextResponse.json({ error: 'course_id required' }, { status: 400 })
      }

      const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()

      const { error } = await supabase
        .from('courses')
        .update({ invite_code: newCode })
        .eq('id', course_id)

      if (error) throw error
      return NextResponse.json({ invite_code: newCode })
    }

    // ── Save attendance for a lesson ──
    if (action === 'save-attendance') {
      const { lesson_id, records } = body
      if (!lesson_id || !Array.isArray(records)) {
        return NextResponse.json({ error: 'lesson_id and records[] required' }, { status: 400 })
      }

      // Delete existing attendance for this lesson, then insert new
      await supabase.from('attendance').delete().eq('lesson_id', lesson_id)

      if (records.length > 0) {
        const rows = records.map((r: { student_email: string; status: string }) => ({
          lesson_id,
          student_email: r.student_email,
          status: r.status,
        }))
        const { error } = await supabase.from('attendance').insert(rows)
        if (error) throw error
      }

      return NextResponse.json({ ok: true })
    }

    // ── Create student (without course enrollment) ──
    if (action === 'create-student') {
      const { email, name: studentName } = body
      if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      const cleanEmail = email.trim().toLowerCase()

      // Check if user already exists
      const { data: existing } = await supabase
        .from('users')
        .select('email')
        .eq('email', cleanEmail)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
      }

      const { error } = await supabase
        .from('users')
        .insert({ email: cleanEmail, name: studentName?.trim() || '', role: 'student' })

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Update teacher profile ──
    if (action === 'update-teacher-profile') {
      const { email, name, country, specialization } = body
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) {
        const trimmed = typeof name === 'string' ? name.trim() : ''
        if (!trimmed) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
        if (trimmed.length > 100) return NextResponse.json({ error: 'Name too long (max 100 chars)' }, { status: 400 })
        updateData.name = trimmed
      }
      if (country !== undefined) updateData.country = country || null
      if (specialization !== undefined) updateData.specialization = specialization || null

      const { error } = await supabase.from('users').update(updateData).eq('email', email)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Update student profile ──
    if (action === 'update-student-profile') {
      const { email, name, level, learning_goals, company, common_issues_tags, common_issues_comments } = body
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) {
        const trimmed = typeof name === 'string' ? name.trim() : ''
        if (!trimmed) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
        if (trimmed.length > 100) return NextResponse.json({ error: 'Name too long (max 100 chars)' }, { status: 400 })
        updateData.name = trimmed
      }
      if (level !== undefined) updateData.level = level || null
      if (learning_goals !== undefined) updateData.learning_goals = learning_goals || null
      if (company !== undefined) updateData.company = company || null
      if (common_issues_tags !== undefined) updateData.common_issues_tags = common_issues_tags || []
      if (common_issues_comments !== undefined) updateData.common_issues_comments = common_issues_comments || null

      const { error } = await supabase.from('users').update(updateData).eq('email', email)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Archive a course ──
    if (action === 'archive-course') {
      const { course_id } = body
      if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 })

      const { error } = await supabase
        .from('courses')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', course_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Restore (un-archive) a course ──
    if (action === 'restore-course') {
      const { course_id } = body
      if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 })

      const { error } = await supabase
        .from('courses')
        .update({ archived_at: null })
        .eq('id', course_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete-student') {
      const { email } = body
      if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

      // Remove from all courses first
      await supabase.from('course_students').delete().eq('student_email', email)
      // Remove progress
      await supabase.from('progress').delete().eq('user_email', email)
      // Remove assignments
      await supabase.from('student_assignments').delete().eq('user_email', email)
      // Delete user
      const { error } = await supabase.from('users').delete().eq('email', email)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete-teacher') {
      const { email } = body
      if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

      // Remove from all course assignments
      await supabase.from('course_teachers').delete().eq('teacher_email', email)
      // Delete user
      const { error } = await supabase.from('users').delete().eq('email', email)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return handleError(err)
  }
}
