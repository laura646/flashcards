'use client'

// ─────────────────────────────────────────────────────────────────
// Course Detail page (10B, course-native).
//
// Owns ALL fetching, mutations and navigation; the View + rail + modals
// stay presentational. Course meta/lessons/students come from
// /api/admin?action=course-detail; attendance comes from the new
// /api/course-sessions endpoints (overview / session / create-session /
// save-attendance). Lesson links point at the /admin/lessons editor.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import CourseDetailView, {
  CourseDetailData,
  CourseStudentRow,
  CourseLessonRow,
  CourseInfoForm,
} from '@/components/admin-v2/CourseDetailView'
import { AttendanceOverview, AllSessionsPanel } from '@/components/admin-v2/AttendanceRail'
import MarkAttendanceModal, {
  RosterStudent,
  ExistingMark,
  MarkSavePayload,
} from '@/components/admin-v2/MarkAttendanceModal'
import ContentBankImportModal from '@/components/ContentBankImportModal'
import AssignFromLibraryModal from '@/components/admin-v2/AssignFromLibraryModal'

// Local today as YYYY-MM-DD.
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// State for the mark modal: either an existing session or a fresh one.
interface MarkModalState {
  sessionId: string | null // null = new class (create on save)
  date: string
  time: string | null
  duration: number
  topic: string | null
  cancelled: boolean
  roster: RosterStudent[]
  existingMarks: ExistingMark[]
  loading: boolean
}

export default function CourseDetailBetaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [course, setCourse] = useState<CourseDetailData | null>(null)
  const [students, setStudents] = useState<CourseStudentRow[]>([])
  const [lessons, setLessons] = useState<CourseLessonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showLessonChooser, setShowLessonChooser] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Attendance
  const [overview, setOverview] = useState<AttendanceOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [mark, setMark] = useState<MarkModalState | null>(null)
  const [markSaving, setMarkSaving] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)

  const [allHr, setAllHr] = useState<{ email: string; name: string }[]>([])
  const [assignedHr, setAssignedHr] = useState<{ email: string; name: string }[]>([])

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher' || session?.user?.role === 'hr'
  const isSuperadmin = session?.user?.role === 'superadmin'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin?action=course-detail&course_id=${encodeURIComponent(id)}`)
      const data = await res.json()
      setCourse(data.course || null)
      setStudents(data.students || [])
      setLessons(data.lessons || [])
    } catch { /* swallow */ }
    setLoading(false)
  }, [id])

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    try {
      const res = await fetch(`/api/course-sessions?action=overview&course_id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (res.ok) setOverview(data as AttendanceOverview)
    } catch { /* swallow */ }
    setOverviewLoading(false)
  }, [id])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) { load(); loadOverview() }
  }, [status, isAdmin, load, loadOverview])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Course-info save (update-schedule) ──
  const onSaveCourseInfo = useCallback(async (form: CourseInfoForm): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/course-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-schedule',
          course_id: id,
          description: form.description,
          level: form.level || null,
          schedule_days: form.schedule_days || null,
          schedule_time: form.schedule_time || null,
          schedule_duration_min: form.schedule_duration_min,
          start_date: form.start_date || null,
          self_study: form.self_study,
          telegram_link: form.telegram_link || null,
          lesson_link: form.lesson_link || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: data.error || 'Failed to update course' }
      await load()
      await loadOverview()
      return { ok: true }
    } catch {
      return { ok: false, error: 'Failed to update course' }
    }
  }, [id, load, loadOverview])

  // ── Invite-code change (kept on update-course; update-schedule has no invite) ──
  const onSaveInviteCode = useCallback(async (code: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-course', course_id: id, invite_code: code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: data.error || 'Failed to update invite code' }
      await load()
      return { ok: true }
    } catch {
      return { ok: false, error: 'Failed to update invite code' }
    }
  }, [id, load])

  const onSendTelegramTest = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'telegram-test', course_id: id }),
      })
      const data = await res.json().catch(() => ({}))
      return { ok: !!data.ok, error: data.ok ? undefined : (data.error || 'Failed to send') }
    } catch {
      return { ok: false, error: 'Failed to send test message' }
    }
  }, [id])

  // ── Open the mark modal for a fresh class (or today's, if no session yet) ──
  const openNewClass = useCallback((dateOverride?: string) => {
    setMarkError(null)
    const roster: RosterStudent[] = students.map((s) => ({ student_email: s.email, name: s.name || s.email }))
    setMark({
      sessionId: null,
      date: dateOverride || todayIso(),
      time: course?.schedule_time || null,
      duration: course?.schedule_duration_min || 60,
      topic: null,
      cancelled: false,
      roster,
      existingMarks: [],
      loading: false,
    })
  }, [students, course])

  // ── Open an existing session (fetch roster + marks) ──
  const openSession = useCallback(async (sessionId: string) => {
    setMarkError(null)
    setMark({
      sessionId,
      date: todayIso(),
      time: null,
      duration: 60,
      topic: null,
      cancelled: false,
      roster: [],
      existingMarks: [],
      loading: true,
    })
    try {
      const res = await fetch(`/api/course-sessions?action=session&session_id=${encodeURIComponent(sessionId)}`)
      const data = await res.json()
      if (!res.ok) { setMarkError(data.error || 'Failed to load session'); setMark((m) => m ? { ...m, loading: false } : m); return }
      const roster: RosterStudent[] = (data.roster || []).map((r: { student_email: string; name: string }) => ({
        student_email: r.student_email, name: r.name,
      }))
      const existingMarks: ExistingMark[] = (data.attendance || []).map((a: ExistingMark) => a)
      setMark({
        sessionId,
        date: data.session.session_date,
        time: data.session.start_time,
        duration: data.session.duration_min || 60,
        topic: data.session.topic,
        cancelled: data.session.status === 'cancelled',
        roster,
        existingMarks,
        loading: false,
      })
    } catch {
      setMarkError('Failed to load session')
      setMark((m) => m ? { ...m, loading: false } : m)
    }
  }, [])

  // ── Open the mark modal for today's class (existing session or a fresh one) ──
  const openMarkToday = useCallback(() => {
    if (overview?.today.session_id) openSession(overview.today.session_id)
    else openNewClass(todayIso())
  }, [overview, openNewClass, openSession])

  // ── Save the mark modal ──
  const onSaveMark = useCallback(async (payload: MarkSavePayload) => {
    if (!mark) return
    setMarkSaving(true)
    setMarkError(null)
    try {
      let sessionId = mark.sessionId
      // Create the session first if this is a new class.
      if (!sessionId) {
        const createRes = await fetch('/api/course-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-session',
            course_id: id,
            session_date: payload.session_date,
            start_time: payload.start_time,
            duration_min: payload.duration_min,
            topic: payload.topic,
          }),
        })
        const createData = await createRes.json().catch(() => ({}))
        if (!createRes.ok) { setMarkError(createData.error || 'Failed to create class'); setMarkSaving(false); return }
        sessionId = createData.session_id
      }

      // Cancel / un-cancel the session to match the modal state.
      await fetch('/api/course-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: payload.cancelled ? 'cancel-session' : 'uncancel-session',
          session_id: sessionId,
        }),
      })

      // Save marks (replace-all) + session meta. For a cancelled class we
      // clear the marks (empty records array).
      const saveRes = await fetch('/api/course-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-attendance',
          session_id: sessionId,
          topic: payload.topic,
          duration_min: payload.duration_min,
          records: payload.cancelled ? [] : payload.records,
        }),
      })
      const saveData = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) { setMarkError(saveData.error || 'Failed to save class'); setMarkSaving(false); return }

      setMarkSaving(false)
      setMark(null)
      setToast(payload.cancelled ? 'Class marked cancelled.' : 'Attendance saved.')
      await loadOverview()
    } catch {
      setMarkError('Failed to save class')
      setMarkSaving(false)
    }
  }, [mark, id, loadOverview])

  // HR observers (superadmin only) — course-first HR assignment.
  const loadHrForCourse = useCallback(async () => {
    if (!isSuperadmin || !id) return
    try {
      const [allRes, assignedRes] = await Promise.all([
        fetch('/api/superadmin?action=hr'),
        fetch(`/api/superadmin?action=course-hr&course_id=${encodeURIComponent(id)}`),
      ])
      const allData = await allRes.json().catch(() => ({}))
      const assignedData = await assignedRes.json().catch(() => ({}))
      setAllHr(allData.hr || [])
      setAssignedHr(assignedData.hr || [])
    } catch { /* swallow */ }
  }, [isSuperadmin, id])

  useEffect(() => {
    if (status === 'authenticated' && isSuperadmin && id) loadHrForCourse()
  }, [status, isSuperadmin, id, loadHrForCourse])

  const onAddHrCourse = async (hrEmail: string) => {
    const res = await fetch('/api/superadmin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-hr-course', hr_email: hrEmail, course_id: id }),
    })
    if (res.ok) loadHrForCourse()
  }

  const onRemoveHrCourse = async (hrEmail: string) => {
    const res = await fetch('/api/superadmin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove-hr-course', hr_email: hrEmail, course_id: id }),
    })
    if (res.ok) loadHrForCourse()
  }

  if (status === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  return (
    <>
      <CourseDetailView
        course={course}
        students={students}
        lessons={lessons}
        loading={status === 'loading' || loading}
        overview={overview}
        overviewLoading={overviewLoading}
        onMarkToday={openMarkToday}
        onNewClass={() => openNewClass()}
        onOpenSession={openSession}
        onViewAllSessions={() => setShowAllSessions(true)}
        onBack={() => router.push('/admin/courses')}
        onOpenLesson={(lid) =>
          router.push(`/admin/lessons?id=${lid}&course_id=${id}&course_name=${encodeURIComponent(course?.name || '')}`)
        }
        onOpenStudent={(email) => router.push(`/admin/students/${encodeURIComponent(email)}`)}
        onCreateLesson={() => setShowLessonChooser(true)}
        onAssignFromLibrary={() => setShowAssignModal(true)}
        onSaveCourseInfo={onSaveCourseInfo}
        onSaveInviteCode={onSaveInviteCode}
        onSendTelegramTest={onSendTelegramTest}
        canEdit={session?.user?.role !== 'hr'}
        manageHr={isSuperadmin ? { all: allHr, assigned: assignedHr, onAdd: onAddHrCourse, onRemove: onRemoveHrCourse } : undefined}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] font-rubik bg-ink-black text-white text-sm font-bold px-4 py-2.5 rounded-tile shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {showAllSessions && overview && (
        <AllSessionsPanel
          courseName={course?.name || ''}
          sessions={overview.sessions}
          onOpenSession={(sid) => { setShowAllSessions(false); openSession(sid) }}
          onNewClass={() => { setShowAllSessions(false); openNewClass() }}
          onClose={() => setShowAllSessions(false)}
          canEdit={session?.user?.role !== 'hr'}
        />
      )}

      {mark && (
        <MarkAttendanceModal
          courseName={course?.name || ''}
          roster={mark.roster}
          defaultDate={mark.date}
          defaultTime={mark.time}
          defaultDuration={mark.duration}
          defaultTopic={mark.topic}
          defaultCancelled={mark.cancelled}
          existingMarks={mark.existingMarks}
          loading={mark.loading}
          saving={markSaving}
          saveError={markError}
          onClose={() => setMark(null)}
          onSave={onSaveMark}
          canEdit={session?.user?.role !== 'hr'}
        />
      )}

      {showLessonChooser && (
        <ContentBankImportModal
          courseId={id}
          existingTitles={lessons.map((l) => l.title)}
          onClose={() => setShowLessonChooser(false)}
          onCreateOwn={() =>
            router.push(`/admin/lessons?course_id=${id}&course_name=${encodeURIComponent(course?.name || '')}`)
          }
          onImported={() => { setShowLessonChooser(false); load() }}
        />
      )}

      {showAssignModal && (
        <AssignFromLibraryModal
          courseId={id}
          courseName={course?.name || ''}
          currentUserEmail={session?.user?.email || ''}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { setShowAssignModal(false); load() }}
        />
      )}
    </>
  )
}
