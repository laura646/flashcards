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
    if (action === 'students') {
      // Scope students to teacher's courses (superadmin sees all)
      const allowedEmails = await getTeacherStudentEmails(email, role)

      let usersQuery = supabase.from('users').select('*').order('created_at', { ascending: false })
      if (allowedEmails !== null) {
        if (allowedEmails.length === 0) return NextResponse.json({ students: [] })
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

      // Get assignments
      let assignmentsQuery = supabase.from('student_assignments').select('*')
      if (allowedEmails !== null) {
        assignmentsQuery = assignmentsQuery.in('user_email', userEmails)
      }
      const { data: assignments } = await assignmentsQuery

      // Group progress by email for O(1) lookup instead of O(n*m) filtering
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
        for (const p of userProgress as { activity_type: string; activity_id: string }[]) {
          if (p.activity_type === 'exercise') exerciseIds.add(p.activity_id)
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

      // Check the teacher has access to this student
      const allowedEmails = await getTeacherStudentEmails(email, role)
      if (allowedEmails !== null && !allowedEmails.includes(studentEmail)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const [progressRes, userRes, assignmentsRes] = await Promise.all([
        supabase.from('progress').select('*').eq('user_email', studentEmail).order('completed_at', { ascending: false }),
        supabase.from('users').select('*').eq('email', studentEmail).single(),
        supabase.from('student_assignments').select('*').eq('user_email', studentEmail),
      ])

      if (progressRes.error) throw progressRes.error

      return NextResponse.json({
        progress: progressRes.data || [],
        user: userRes.data || null,
        assignments: (assignmentsRes.data || []).map((a: { set_name: string }) => a.set_name),
      })
    }

    if (action === 'overview') {
      // Scope to teacher's students
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

  try {
    // ── Block / Unblock student (superadmin only) ──
    if (action === 'toggle-block') {
      if (adminSession?.user?.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmin can block students' }, { status: 403 })
      }
      const { email, blocked } = body
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      const { error } = await supabase
        .from('users')
        .update({ blocked: !!blocked })
        .eq('email', email)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Reset student progress ──
    if (action === 'reset-progress') {
      const { email } = body
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      const { error } = await supabase
        .from('progress')
        .delete()
        .eq('user_email', email)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Update teacher notes ──
    if (action === 'update-notes') {
      const { email, notes } = body
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      const { error } = await supabase
        .from('users')
        .update({ notes: notes || '' })
        .eq('email', email)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Send reminder email ──
    if (action === 'send-reminder') {
      const { email, studentName, message } = body
      if (!email || !message) {
        return NextResponse.json({ error: 'Email and message required' }, { status: 400 })
      }

      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
      }

      const esc = (await import('@/lib/html')).escHtml
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from: 'English with Laura <onboarding@resend.dev>',
        to: email,
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
      const { email, set_name } = body
      if (!email || !set_name) {
        return NextResponse.json({ error: 'Email and set name required' }, { status: 400 })
      }

      const { error } = await supabase
        .from('student_assignments')
        .upsert(
          { user_email: email, set_name },
          { onConflict: 'user_email,set_name' }
        )

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Remove content set ──
    if (action === 'remove-set') {
      const { email, set_name } = body
      if (!email || !set_name) {
        return NextResponse.json({ error: 'Email and set name required' }, { status: 400 })
      }

      const { error } = await supabase
        .from('student_assignments')
        .delete()
        .eq('user_email', email)
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
