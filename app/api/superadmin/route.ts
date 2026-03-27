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
      const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false })

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

      const [courseRes, teachersRes, studentsRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('course_teachers').select('*').eq('course_id', courseId),
        supabase.from('course_students').select('*').eq('course_id', courseId).is('removed_at', null),
      ])

      if (courseRes.error) throw courseRes.error

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

    // ── List all teachers ──
    if (action === 'teachers') {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'teacher')
        .order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json({ teachers: data || [] })
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

      // Generate a unique invite code (6 chars, uppercase)
      const inviteCode = name.trim().replace(/\s+/g, '').substring(0, 4).toUpperCase() +
        Math.random().toString(36).substring(2, 6).toUpperCase()

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

    // ── Update a course ──
    if (action === 'update-course') {
      const { course_id, name, description } = body
      if (!course_id || !name?.trim()) {
        return NextResponse.json({ error: 'course_id and name required' }, { status: 400 })
      }

      const { error } = await supabase
        .from('courses')
        .update({
          name: name.trim(),
          description: description?.trim() || null,
        })
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

      // Also update role if user already existed as student
      await supabase
        .from('users')
        .update({ role: 'teacher' })
        .eq('email', cleanEmail)

      // Send invite email
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        const esc = (await import('@/lib/html')).escHtml
        const resend = new Resend(apiKey)
        try {
          await resend.emails.send({
            from: 'English with Laura <onboarding@resend.dev>',
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return handleError(err)
  }
}
