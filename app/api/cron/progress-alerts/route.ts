import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeCourseAttention, type ProgressRow } from '@/lib/progress-insights'

// ─────────────────────────────────────────────────────────────────
// Daily "student needs attention" alerter (P3).
//
// For each active course, computes which students currently meet the
// (conservative) attention rule and notifies the course's teachers +
// superadmins — so the teacher's "My Students" badge lights up and draws
// them to the course's Progress tab.
//
// SAFETY:
//  • Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` — verified
//    when CRON_SECRET is set (skipped locally, matching publish-scheduled).
//  • Writes are GATED behind PROGRESS_ALERTS_ENABLED=1. Until that env flag is
//    set, every run is a DRY RUN (computes + returns a preview, writes nothing)
//    — so alerts can't fire on an untuned rule. Add `?dryRun=1` to force preview.
//  • Debounced: a student already alerted (any student_new row for this
//    course+student in the last 14 days) is skipped — never daily spam.
//  • Reuses the existing `student_new` notification type (no migration, no new
//    enum value, lights up the existing My Students badge).
// ─────────────────────────────────────────────────────────────────

const DAY = 86400000
const DEBOUNCE_DAYS = 14

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1' || process.env.PROGRESS_ALERTS_ENABLED !== '1'
  const now = Date.now()

  try {
    const { data: sa } = await supabase.from('users').select('email').eq('role', 'superadmin')
    const superadmins = (sa || []).map((u: { email: string }) => (u.email || '').toLowerCase()).filter(Boolean)

    const { data: courses } = await supabase.from('courses').select('id, name').is('archived_at', null)

    let created = 0
    const preview: { course: string; student: string; reasons: string[] }[] = []

    for (const course of courses || []) {
      const { data: cs } = await supabase.from('course_students').select('student_email').eq('course_id', course.id).is('removed_at', null)
      const emails = (cs || []).map((r: { student_email: string }) => r.student_email).filter(Boolean)
      if (emails.length === 0) continue

      const { data: lessons } = await supabase.from('lessons').select('id').eq('course_id', course.id).eq('status', 'published')
      const lessonIds = (lessons || []).map((l: { id: string }) => l.id)
      if (lessonIds.length === 0) continue

      const { data: exs } = await supabase.from('lesson_exercises').select('id').in('lesson_id', lessonIds)
      const exIds = new Set((exs || []).map((e: { id: string }) => e.id))
      if (exIds.size === 0) continue

      const { data: prog } = await supabase
        .from('progress')
        .select('user_email, activity_type, activity_id, score, total, completed_at')
        .in('user_email', emails)
        .eq('activity_type', 'exercise')

      const flagged = computeCourseAttention(emails, exIds, (prog || []) as ProgressRow[], now)
      if (flagged.length === 0) continue

      // Debounce against recently-sent alerts for these students in this course.
      const cutoff = new Date(now - DEBOUNCE_DAYS * DAY).toISOString()
      const { data: recent } = await supabase
        .from('notifications')
        .select('student_email')
        .eq('course_id', course.id)
        .eq('type', 'student_new')
        .gte('created_at', cutoff)
        .in('student_email', flagged.map((f) => f.email.toLowerCase()))
      const alreadyAlerted = new Set((recent || []).map((r: { student_email: string | null }) => (r.student_email || '').toLowerCase()))

      const { data: ct } = await supabase.from('course_teachers').select('teacher_email').eq('course_id', course.id)
      const teachers = (ct || []).map((r: { teacher_email: string }) => (r.teacher_email || '').toLowerCase()).filter(Boolean)
      const recipients = Array.from(new Set([...teachers, ...superadmins]))

      for (const f of flagged) {
        const student = f.email.toLowerCase()
        if (alreadyAlerted.has(student)) continue
        preview.push({ course: course.name, student, reasons: f.reasons })
        if (dryRun) continue

        const rows = recipients
          .filter((r) => r !== student)
          .map((recipient_email) => ({
            recipient_email,
            type: 'student_new',
            course_id: course.id,
            student_email: student,
            title: `${student} may need attention — ${f.reasons.join(', ')}`,
          }))
        if (rows.length) {
          const { error } = await supabase.from('notifications').insert(rows)
          if (!error) created += rows.length
          else console.error('[progress-alerts] insert failed:', error.message)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      students_flagged: preview.length,
      notifications_created: created,
      preview: preview.slice(0, 100),
    })
  } catch (err) {
    console.error('progress-alerts cron error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
