import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Teacher notification helpers (Approach B — `notifications` table in Supabase).
//
// These are BEST-EFFORT: every helper is wrapped so it NEVER throws. A failure
// to write a notification must never break the user-facing flow that triggered
// it (student join, course create, teacher/student assignment). On failure we
// log via console.error and return quietly.
//
// Badge semantics (read side, in /api/admin):
//   "My Courses"  badge = unread notifications of type `course_new`  for the user
//   "My Students" badge = unread notifications of type `student_new` for the user
// The role logic lives ONLY here at INSERT time, via the recipient computation.
//
// Self-suppression: the actor who performed the action is never a recipient.
// ─────────────────────────────────────────────────────────────────────────────

type NotificationType = 'course_new' | 'student_new'

interface NotificationRow {
  recipient_email: string
  type: NotificationType
  course_id: string
  student_email?: string | null
  title: string
}

/** Resolve a course name for use in notification titles. Returns null if missing. */
async function getCourseName(courseId: string): Promise<string | null> {
  const { data } = await supabase
    .from('courses')
    .select('name')
    .eq('id', courseId)
    .maybeSingle()
  return data?.name ?? null
}

/** Fetch all superadmin emails. */
async function getSuperadminEmails(): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('role', 'superadmin')
  return (data || []).map((u: { email: string }) => u.email)
}

/** Fetch the teacher emails assigned to a course. */
async function getCourseTeacherEmails(courseId: string): Promise<string[]> {
  const { data } = await supabase
    .from('course_teachers')
    .select('teacher_email')
    .eq('course_id', courseId)
  return (data || []).map((t: { teacher_email: string }) => t.teacher_email)
}

/** Bulk-insert notification rows. Best-effort: logs on error, never throws. */
async function insertNotifications(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('[notifications] insert failed:', error.message)
  }
}

/**
 * A student joined a course (self-join, manual enroll, or reactivation).
 * Recipients = {course teachers} ∪ {all superadmins} − actor − the student.
 * One `student_new` row per distinct recipient.
 */
export async function notifyStudentJoined(params: {
  courseId: string
  studentEmail: string
  actorEmail: string
}): Promise<void> {
  try {
    const { courseId, studentEmail, actorEmail } = params
    const actor = (actorEmail || '').toLowerCase()
    const student = (studentEmail || '').toLowerCase()

    const [courseName, teacherEmails, superadminEmails] = await Promise.all([
      getCourseName(courseId),
      getCourseTeacherEmails(courseId),
      getSuperadminEmails(),
    ])

    const recipients = new Set<string>()
    for (const e of [...teacherEmails, ...superadminEmails]) {
      const norm = (e || '').toLowerCase()
      if (!norm) continue
      if (norm === actor) continue // self-suppression
      if (norm === student) continue // never notify the student themselves
      recipients.add(norm)
    }

    const title = `New student joined ${courseName ?? 'a course'}`
    const rows: NotificationRow[] = Array.from(recipients).map((recipient_email) => ({
      recipient_email,
      type: 'student_new',
      course_id: courseId,
      student_email: student,
      title,
    }))

    await insertNotifications(rows)
  } catch (err) {
    console.error('[notifications] notifyStudentJoined failed:', err)
  }
}

/**
 * A course was created.
 * Recipients = {all superadmins} − creator. One `course_new` row per recipient.
 */
export async function notifyCourseCreated(params: {
  courseId: string
  courseName: string
  creatorEmail: string
}): Promise<void> {
  try {
    const { courseId, courseName, creatorEmail } = params
    const creator = (creatorEmail || '').toLowerCase()

    const superadminEmails = await getSuperadminEmails()
    const recipients = new Set<string>()
    for (const e of superadminEmails) {
      const norm = (e || '').toLowerCase()
      if (!norm || norm === creator) continue
      recipients.add(norm)
    }

    // Prefer the passed-in name; fall back to a lookup if it was empty.
    const name = courseName?.trim() || (await getCourseName(courseId)) || 'a course'
    const title = `New course: ${name}`
    const rows: NotificationRow[] = Array.from(recipients).map((recipient_email) => ({
      recipient_email,
      type: 'course_new',
      course_id: courseId,
      title,
    }))

    await insertNotifications(rows)
  } catch (err) {
    console.error('[notifications] notifyCourseCreated failed:', err)
  }
}

/**
 * A teacher was assigned to a course (by a superadmin).
 * Recipient = that teacher (unless they are the actor). One `course_new` row.
 */
export async function notifyTeacherAssigned(params: {
  courseId: string
  teacherEmail: string
  actorEmail: string
}): Promise<void> {
  try {
    const { courseId, teacherEmail, actorEmail } = params
    const teacher = (teacherEmail || '').toLowerCase()
    const actor = (actorEmail || '').toLowerCase()

    if (!teacher || teacher === actor) return // self-suppression

    const courseName = await getCourseName(courseId)
    const title = `You were assigned to ${courseName ?? 'a course'}`

    await insertNotifications([
      {
        recipient_email: teacher,
        type: 'course_new',
        course_id: courseId,
        title,
      },
    ])
  } catch (err) {
    console.error('[notifications] notifyTeacherAssigned failed:', err)
  }
}
