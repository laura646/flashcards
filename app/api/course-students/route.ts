import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, hasAccessToCourse } from '@/lib/roles'
import { Resend } from 'resend'
import { escHtml } from '@/lib/esc'

// ═══════════════════════════════════════════════════════════════
// POST /api/course-students  (teacher of the course | superadmin; HR excluded)
//
//   { action: 'add',       courseId, email }  → enrol (pre-enrol ok) + email join link
//   { action: 'remove',    courseId, email }  → delete enrolment + this course's practice data
//   { action: 'archive',   courseId, email }  → set archived_at = now (hide newer lessons)
//   { action: 'unarchive', courseId, email }  → clear archived_at
// ═══════════════════════════════════════════════════════════════

function unauthorized(err: unknown): NextResponse {
  const e = err as { status?: number; message?: string }
  return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
}

// Delete a student's practice data scoped to ONE course: progress rows on the
// course's exercises, blocks, and per-lesson flashcard activities. Chunked to
// stay under PostgREST URL limits. Other courses are untouched.
async function deleteCourseProgress(courseId: string, email: string): Promise<void> {
  const { data: lessons } = await supabase.from('lessons').select('id').eq('course_id', courseId)
  const lessonIds = (lessons || []).map((l: { id: string }) => l.id)
  if (lessonIds.length === 0) return

  const [exRes, blkRes] = await Promise.all([
    supabase.from('lesson_exercises').select('id').in('lesson_id', lessonIds),
    supabase.from('lesson_blocks').select('id').in('lesson_id', lessonIds),
  ])
  const ids: string[] = []
  for (const e of (exRes.data || []) as { id: string }[]) ids.push(e.id)
  for (const b of (blkRes.data || []) as { id: string }[]) ids.push(b.id)
  for (const lid of lessonIds) ids.push(`${lid}:flip`, `${lid}:self-assess`, `${lid}:quiz`)

  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    await supabase.from('progress').delete().eq('user_email', email).in('activity_id', chunk)
  }
}

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return unauthorized(err)
  }

  let body: { action?: string; courseId?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action
  const courseId = body.courseId
  const email = (body.email || '').toLowerCase().trim()
  if (!courseId || !action) {
    return NextResponse.json({ error: 'courseId and action required' }, { status: 400 })
  }
  if (!(await hasAccessToCourse(auth.email, auth.role, courseId))) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // ── Add (pre-enrol) + email the join link ──
  if (action === 'add') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
    }
    const { data: existing } = await supabase
      .from('course_students')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_email', email)
      .maybeSingle()
    if (existing) {
      await supabase.from('course_students').update({ removed_at: null, archived_at: null }).eq('id', (existing as { id: string }).id)
    } else {
      const { error } = await supabase.from('course_students').insert({ course_id: courseId, student_email: email })
      if (error) {
        console.error('course-students add failed:', error)
        return NextResponse.json({ error: 'Failed to add student' }, { status: 500 })
      }
    }

    // Email the join link (best-effort — never fail the add if email is down).
    try {
      const { data: course } = await supabase.from('courses').select('name, invite_code').eq('id', courseId).single()
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey && course) {
        const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.englishwithlaura.com'
        const link = `${base}/join/${(course as { invite_code: string }).invite_code}`
        const courseName = (course as { name: string }).name
        const resend = new Resend(apiKey)
        await resend.emails.send({
          from: 'English with Laura <noreply@learn.englishwithlaura.com>',
          to: email,
          subject: `You've been added to ${courseName}`,
          html: `
            <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
              <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura</h1>
              </div>
              <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 15px; margin-top: 0;">Hi,</p>
                <p style="font-size: 15px; line-height: 1.6;">You've been added to <strong>${escHtml(courseName)}</strong>. Click below to open your course.</p>
                <div style="margin: 24px 0;">
                  <a href="${link}" style="display: inline-block; background: #416ebe; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">Join the course</a>
                </div>
                <p style="font-size: 13px; color: #888;">Or paste this link into your browser:<br>${escHtml(link)}</p>
              </div>
            </div>
          `,
        })
      }
    } catch (emailErr) {
      console.error('course-students add email failed (ignored):', emailErr)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Archive / Unarchive ──
  if (action === 'archive' || action === 'unarchive') {
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
    const { error } = await supabase
      .from('course_students')
      .update({ archived_at: action === 'archive' ? new Date().toISOString() : null })
      .eq('course_id', courseId)
      .eq('student_email', email)
    if (error) {
      console.error('course-students archive failed:', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Remove from course + delete this course's practice data ──
  if (action === 'remove') {
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
    await deleteCourseProgress(courseId, email)
    const { error } = await supabase
      .from('course_students')
      .delete()
      .eq('course_id', courseId)
      .eq('student_email', email)
    if (error) {
      console.error('course-students remove failed:', error)
      return NextResponse.json({ error: 'Failed to remove' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
