import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, getAccessibleCourseIds, type UserRole } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════════
// /api/course-sessions
//
// Course-native attendance: date-based CLASS SESSIONS (course_sessions)
// and per-student marks (session_attendance). Replaces the old
// lesson-keyed `attendance` model.
//
// Auth: superadmin | teacher. Superadmin bypasses; teachers must have
// access to the target course via getAccessibleCourseIds. Audit fields
// (created_by / marked_by / marked_at) are set server-side.
// ═══════════════════════════════════════════════════════════════════

const VALID_STATUSES = ['present', 'late', 'absent', 'excused'] as const
type AttendanceStatus = (typeof VALID_STATUSES)[number]

// Weekday tokens used by courses.schedule_days, e.g. "Mon,Wed".
const WEEKDAY_TOKENS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

interface CourseSessionRow {
  id: string
  course_id: string
  session_date: string
  start_time: string | null
  duration_min: number
  topic: string | null
  status: string
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

function errorResponse(err: unknown): NextResponse {
  if (err && typeof err === 'object' && 'status' in err) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Error' }, { status: e.status || 500 })
  }
  console.error('course-sessions API error:', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

// True if the caller may act on this course.
async function canAccessCourse(
  email: string,
  role: UserRole,
  courseId: string
): Promise<boolean> {
  if (role === 'superadmin') return true
  const ids = await getAccessibleCourseIds(email, role)
  return ids.includes(courseId)
}

// "Today" as YYYY-MM-DD plus its weekday token, in the server's local time.
function todayInfo(): { iso: string; token: string } {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return { iso: `${yyyy}-${mm}-${dd}`, token: WEEKDAY_TOKENS[now.getDay()] }
}

// Parse a "Mon,Wed" style schedule into a Set of weekday tokens.
function parseScheduleDays(raw: string | null | undefined): Set<string> {
  const set = new Set<string>()
  if (!raw) return set
  for (const part of raw.split(',')) {
    const t = part.trim().toLowerCase()
    if (!t) continue
    const match = WEEKDAY_TOKENS.find((w) => w.toLowerCase() === t || w.toLowerCase().startsWith(t.slice(0, 3)))
    if (match) set.add(match)
  }
  return set
}

// ─────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('superadmin', 'teacher', 'hr')
  } catch (err) {
    return errorResponse(err)
  }

  const action = req.nextUrl.searchParams.get('action')

  try {
    // ── action=overview&course_id= : everything the rail needs ──
    if (action === 'overview') {
      const courseId = req.nextUrl.searchParams.get('course_id')
      if (!courseId) {
        return NextResponse.json({ error: 'course_id required' }, { status: 400 })
      }
      if (!(await canAccessCourse(auth.email, auth.role, courseId))) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }

      // Course schedule fields (for the today block).
      const { data: course } = await supabase
        .from('courses')
        .select('schedule_days')
        .eq('id', courseId)
        .single()

      // All sessions for the course (date desc).
      const { data: sessionRows, error: sErr } = await supabase
        .from('course_sessions')
        .select('id, session_date, start_time, duration_min, status, topic')
        .eq('course_id', courseId)
        .order('session_date', { ascending: false })
      if (sErr) throw sErr
      const sessions = (sessionRows || []) as Pick<
        CourseSessionRow,
        'id' | 'session_date' | 'start_time' | 'duration_min' | 'status' | 'topic'
      >[]

      // Marks across all those sessions, grouped by session.
      const sessionIds = sessions.map((s) => s.id)
      const countsBySession: Record<
        string,
        { present: number; late: number; absent: number; excused: number; total: number }
      > = {}
      for (const id of sessionIds) {
        countsBySession[id] = { present: 0, late: 0, absent: 0, excused: 0, total: 0 }
      }
      if (sessionIds.length > 0) {
        const { data: marks, error: mErr } = await supabase
          .from('session_attendance')
          .select('session_id, status')
          .in('session_id', sessionIds)
        if (mErr) throw mErr
        for (const m of (marks || []) as { session_id: string; status: AttendanceStatus | null }[]) {
          const c = countsBySession[m.session_id]
          if (!c || !m.status) continue
          if (m.status === 'present') c.present++
          else if (m.status === 'late') c.late++
          else if (m.status === 'absent') c.absent++
          else if (m.status === 'excused') c.excused++
          c.total++
        }
      }

      const sessionsOut = sessions.map((s) => ({
        id: s.id,
        session_date: s.session_date,
        start_time: s.start_time,
        duration_min: s.duration_min,
        status: s.status,
        topic: s.topic,
        counts: countsBySession[s.id],
      }))

      // ── Rollups (held sessions only) ──
      const { iso: todayIso, token: todayToken } = todayInfo()
      const monthPrefix = todayIso.slice(0, 7) // YYYY-MM

      let classesThisMonth = 0
      let minutesThisMonth = 0
      let attendedSum = 0
      let markedSum = 0
      for (const s of sessionsOut) {
        if (s.status !== 'held') continue
        if (s.session_date.slice(0, 7) === monthPrefix) {
          classesThisMonth++
          minutesThisMonth += s.duration_min || 0
        }
        attendedSum += s.counts.present + s.counts.late
        markedSum += s.counts.total
      }
      const rollups = {
        classes_this_month: classesThisMonth,
        hours_this_month: Math.round((minutesThisMonth / 60) * 10) / 10,
        avg_pct: markedSum > 0 ? Math.round((attendedSum / markedSum) * 100) : 0,
      }

      // ── Today block ──
      const scheduleDays = parseScheduleDays(course?.schedule_days)
      const isClassDay = scheduleDays.has(todayToken)
      const todaySession = sessionsOut.find((s) => s.session_date === todayIso) || null
      const today = {
        is_class_day: isClassDay,
        session_id: todaySession ? todaySession.id : null,
        marked: todaySession ? todaySession.counts.total > 0 : false,
      }

      return NextResponse.json({ sessions: sessionsOut, rollups, today })
    }

    // ── action=session&session_id= : roster + marks for one session ──
    if (action === 'session') {
      const sessionId = req.nextUrl.searchParams.get('session_id')
      if (!sessionId) {
        return NextResponse.json({ error: 'session_id required' }, { status: 400 })
      }

      const { data: session, error: sErr } = await supabase
        .from('course_sessions')
        .select('id, course_id, session_date, start_time, duration_min, topic, status, created_by, created_at, updated_at')
        .eq('id', sessionId)
        .single()
      if (sErr || !session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (!(await canAccessCourse(auth.email, auth.role, session.course_id))) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      // Active roster: course_students (removed_at null) + users.name.
      const { data: enrollments } = await supabase
        .from('course_students')
        .select('student_email')
        .eq('course_id', session.course_id)
        .is('removed_at', null)
      const emails = (enrollments || []).map((e: { student_email: string }) => e.student_email)

      let nameByEmail: Record<string, string> = {}
      if (emails.length > 0) {
        const { data: userRows } = await supabase
          .from('users')
          .select('email, name')
          .in('email', emails)
        for (const u of (userRows || []) as { email: string; name: string | null }[]) {
          nameByEmail[u.email] = u.name || u.email
        }
      }
      const roster = emails
        .map((email) => ({ student_email: email, name: nameByEmail[email] || email }))
        .sort((a, b) => a.name.localeCompare(b.name))

      // Existing marks for this session.
      const { data: marks } = await supabase
        .from('session_attendance')
        .select('student_email, status, minutes_late, note')
        .eq('session_id', sessionId)
      const attendance = (marks || []) as {
        student_email: string
        status: AttendanceStatus
        minutes_late: number | null
        note: string | null
      }[]

      return NextResponse.json({ session, roster, attendance })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err)
  }
}

// ─────────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('superadmin', 'teacher')
  } catch (err) {
    return errorResponse(err)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const action = body.action as string | undefined

  try {
    // ── create-session ──
    if (action === 'create-session') {
      const courseId = body.course_id as string | undefined
      const sessionDate = body.session_date as string | undefined
      if (!courseId || !sessionDate) {
        return NextResponse.json({ error: 'course_id and session_date required' }, { status: 400 })
      }
      if (!(await canAccessCourse(auth.email, auth.role, courseId))) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }

      const startTime = body.start_time as string | undefined
      const durationMin = body.duration_min as number | undefined
      const topic = body.topic as string | undefined

      const { data, error } = await supabase
        .from('course_sessions')
        .insert({
          course_id: courseId,
          session_date: sessionDate,
          start_time: startTime?.trim() || null,
          duration_min: typeof durationMin === 'number' ? durationMin : 60,
          topic: topic?.trim() || null,
          status: 'held',
          created_by: auth.email,
        })
        .select('id')
        .single()
      if (error) throw error

      return NextResponse.json({ session_id: data.id })
    }

    // ── bulk-summary (manual attendance backfill: per-student totals) ──
    // Writes a course-to-date attendance summary onto course_students; reports
    // prefer it over session marks. Setting total=0 for a student clears it.
    if (action === 'bulk-summary') {
      const courseId = body.course_id as string | undefined
      const records = body.records as
        | { student_email: string; present?: number; late?: number; absent?: number; excused?: number; total?: number }[]
        | undefined
      if (!courseId || !Array.isArray(records)) {
        return NextResponse.json({ error: 'course_id and records[] required' }, { status: 400 })
      }
      if (!(await canAccessCourse(auth.email, auth.role, courseId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const int = (v: unknown) => {
        const n = Math.round(Number(v))
        return Number.isFinite(n) && n >= 0 ? Math.min(n, 100000) : 0
      }
      // Normalize + validate ALL rows before writing any (no partial writes).
      // present is derived server-side so stored counts always sum to total —
      // keeps the headline % and the per-row breakdown in lockstep.
      const clean = records
        .filter((r) => r.student_email)
        .map((r) => {
          const total = int(r.total)
          const late = int(r.late)
          const absent = int(r.absent)
          const excused = int(r.excused)
          return { email: r.student_email, total, late, absent, excused, present: Math.max(0, total - late - absent - excused) }
        })
      const over = clean.find((r) => r.late + r.absent + r.excused > r.total)
      if (over) {
        return NextResponse.json({ error: `Late + absent + excused exceed the total for ${over.email}.` }, { status: 400 })
      }
      const nowIso = new Date().toISOString()
      let updated = 0
      for (const r of clean) {
        const { error } = await supabase
          .from('course_students')
          .update({
            att_present: r.present,
            att_late: r.late,
            att_absent: r.absent,
            att_excused: r.excused,
            att_total: r.total,
            att_updated_at: nowIso,
            att_updated_by: auth.email,
          })
          .eq('course_id', courseId)
          .eq('student_email', r.email)
          .is('removed_at', null)
        if (error) {
          // Surface the real DB reason (e.g. missing column / stale PostgREST
          // schema cache) instead of a generic 500, so backfill is debuggable.
          return NextResponse.json(
            { error: `Attendance save failed: ${error.message || 'database error'}`, code: (error as { code?: string }).code || null },
            { status: 500 }
          )
        }
        updated++
      }
      return NextResponse.json({ ok: true, updated })
    }

    // ── save-attendance (replace-all for the session) ──
    if (action === 'save-attendance') {
      const sessionId = body.session_id as string | undefined
      const records = body.records as
        | { student_email: string; status: AttendanceStatus; minutes_late?: number; note?: string }[]
        | undefined
      if (!sessionId || !Array.isArray(records)) {
        return NextResponse.json({ error: 'session_id and records[] required' }, { status: 400 })
      }

      // Load the session and access-gate via its course.
      const { data: session, error: sErr } = await supabase
        .from('course_sessions')
        .select('id, course_id')
        .eq('id', sessionId)
        .single()
      if (sErr || !session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (!(await canAccessCourse(auth.email, auth.role, session.course_id))) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      const now = new Date().toISOString()

      // Optional session meta update (topic / duration).
      const sessionUpdate: Record<string, unknown> = { updated_at: now }
      if (body.topic !== undefined) sessionUpdate.topic = (body.topic as string)?.trim() || null
      if (typeof body.duration_min === 'number') sessionUpdate.duration_min = body.duration_min
      await supabase.from('course_sessions').update(sessionUpdate).eq('id', sessionId)

      // Replace-all marks for the session.
      await supabase.from('session_attendance').delete().eq('session_id', sessionId)

      const validRecords = records.filter(
        (r) => r.student_email && VALID_STATUSES.includes(r.status)
      )
      if (validRecords.length > 0) {
        const rows = validRecords.map((r) => ({
          session_id: sessionId,
          student_email: r.student_email,
          status: r.status,
          minutes_late:
            r.status === 'late' && typeof r.minutes_late === 'number' ? r.minutes_late : null,
          note: r.note?.trim() || null,
          marked_by: auth.email,
          marked_at: now,
        }))
        const { error } = await supabase.from('session_attendance').insert(rows)
        if (error) throw error
      }

      return NextResponse.json({ ok: true })
    }

    // ── cancel-session / uncancel-session ──
    if (action === 'cancel-session' || action === 'uncancel-session') {
      const sessionId = body.session_id as string | undefined
      if (!sessionId) {
        return NextResponse.json({ error: 'session_id required' }, { status: 400 })
      }

      const { data: session, error: sErr } = await supabase
        .from('course_sessions')
        .select('id, course_id')
        .eq('id', sessionId)
        .single()
      if (sErr || !session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (!(await canAccessCourse(auth.email, auth.role, session.course_id))) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      const status = action === 'cancel-session' ? 'cancelled' : 'held'
      const { error } = await supabase
        .from('course_sessions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
      if (error) throw error

      return NextResponse.json({ ok: true })
    }

    // ── update-schedule (Course-Info fields) ──
    if (action === 'update-schedule') {
      const courseId = body.course_id as string | undefined
      if (!courseId) {
        return NextResponse.json({ error: 'course_id required' }, { status: 400 })
      }
      if (!(await canAccessCourse(auth.email, auth.role, courseId))) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }

      const updateData: Record<string, unknown> = {}
      if (body.schedule_days !== undefined)
        updateData.schedule_days = (body.schedule_days as string)?.trim() || null
      if (body.schedule_time !== undefined)
        updateData.schedule_time = (body.schedule_time as string)?.trim() || null
      if (body.schedule_duration_min !== undefined)
        updateData.schedule_duration_min =
          typeof body.schedule_duration_min === 'number' ? body.schedule_duration_min : null
      if (body.start_date !== undefined)
        updateData.start_date = (body.start_date as string)?.trim() || null
      if (body.self_study !== undefined) updateData.self_study = !!body.self_study
      if (body.description !== undefined)
        updateData.description = (body.description as string)?.trim() || null
      if (body.level !== undefined) updateData.level = (body.level as string) || null
      if (body.current_level !== undefined) updateData.current_level = (body.current_level as string) || null
      if (body.goal_level !== undefined) updateData.goal_level = (body.goal_level as string) || null
      if (body.group_progress_pct !== undefined)
        updateData.group_progress_pct =
          typeof body.group_progress_pct === 'number' ? Math.max(0, Math.min(100, Math.round(body.group_progress_pct))) : null
      if (body.telegram_link !== undefined)
        updateData.telegram_link = (body.telegram_link as string)?.trim() || null
      if (body.lesson_link !== undefined)
        updateData.lesson_link = (body.lesson_link as string)?.trim() || null

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
      }
      // NB: courses has no updated_at column in the live DB — writing it 500s.
      // The other course-update paths (admin/superadmin) don't set it either.

      const { error } = await supabase.from('courses').update(updateData).eq('id', courseId)
      if (error) throw error

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return errorResponse(err)
  }
}
