'use client'

// Wave 0 — REAL redesigned Reports page, "new beside old".
//
// Renders components/admin-v2/ReportsView on LIVE data: one GET /api/reports
// pulls the whole course payload, lib/reports-compute turns it into the
// per-student reports (same math as the legacy page), and cached AI summaries
// are merged in token-free via GET /api/student-summary. The AI summary is
// generated ON DEMAND (button) and cached (POST upserts) — no auto-running.
// Live /admin/reports is left 100% untouched; this is an unlinked new route.

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ReportsView, { StudentReport } from '@/components/admin-v2/ReportsView'
import { buildStudentReports, buildDigestPayload, buildCourseDigest, buildCourseRollup, ReportsData, ReportsDays, CourseRollup } from '@/lib/reports-compute'
import ReportsCoursePicker from '@/components/admin-v2/ReportsCoursePicker'
import type { CourseSummary } from '@/components/admin-v2/CoursesView'
import { Skeleton } from '@/components/student-ui'

const DAY_OPTIONS: { value: ReportsDays; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const selectCls =
  'text-sm text-ink-body bg-white border border-hairline rounded-tile px-3 py-2 focus:outline-none focus:border-sky transition-colors'

export default function ReportsBetaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [courses, setCourses] = useState<{ id: string; name: string }[]>([])
  const [richCourses, setRichCourses] = useState<CourseSummary[]>([])
  const [courseId, setCourseId] = useState('')
  const [days, setDays] = useState<ReportsDays>('30')
  const [data, setData] = useState<ReportsData | null>(null)
  const [students, setStudents] = useState<StudentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingEmail, setGeneratingEmail] = useState<string | null>(null)
  const [courseOverview, setCourseOverview] = useState<{ summary: string; needs: string; ready: string; generatedAt: string | null } | null>(null)
  const [generatingOverview, setGeneratingOverview] = useState(false)
  const [rollup, setRollup] = useState<CourseRollup | null>(null)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher' || session?.user?.role === 'hr'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  // Bootstrap the course list (once) and select the first course.
  const loadCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/reports')
      const d = await res.json()
      const list: { id: string; name: string }[] = d.courses || []
      setCourses(list)
      // Rich course list (same source as the Courses area) for the search/filter
      // picker. Best-effort: if it fails, the picker falls back to a dropdown.
      try {
        const rc = await fetch('/api/admin?action=my-courses&include_archived=true')
        const rj = await rc.json()
        setRichCourses(rj.courses || [])
      } catch {
        /* fall back to the simple course dropdown */
      }
      const urlCourseId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('courseId') : null
      const preferred = urlCourseId && list.some((c) => c.id === urlCourseId) ? urlCourseId : (list[0]?.id ?? '')
      setCourseId((prev) => prev || preferred)
      if (!list.length) setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) loadCourses()
  }, [status, isAdmin, loadCourses])

  // Load the report payload + cached summaries whenever course/days change.
  const loadReport = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?courseId=${courseId}&days=${days}`)
      const d: ReportsData = await res.json()
      setData(d)
      let built = buildStudentReports(d, days)
      // Merge cached AI summaries (cheap DB read, zero tokens).
      try {
        const cres = await fetch(`/api/student-summary?courseId=${courseId}`)
        const cj = await cres.json()
        const byEmail: Record<string, { summary: string; generated_at: string }> = {}
        for (const s of cj.summaries || []) byEmail[s.student_email] = s
        built = built.map((s) =>
          byEmail[s.email]
            ? { ...s, aiSummary: byEmail[s.email].summary, aiGeneratedAt: byEmail[s.email].generated_at }
            : s
        )
      } catch {
        /* cache is optional — summaries just show the Generate button */
      }
      setStudents(built)
      setRollup(buildCourseRollup(d, days))

      // Course-level AI overview (cached → token-free).
      try {
        const ores = await fetch(`/api/course-summary?courseId=${courseId}`)
        const oj = await ores.json()
        setCourseOverview(
          oj.overview
            ? {
                summary: oj.overview.summary,
                needs: oj.overview.needs,
                ready: oj.overview.ready,
                generatedAt: oj.overview.generated_at,
              }
            : null
        )
      } catch {
        setCourseOverview(null)
      }
    } catch {
      setStudents([])
      setCourseOverview(null)
      setRollup(null)
    }
    setLoading(false)
  }, [courseId, days])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin && courseId) loadReport()
  }, [status, isAdmin, courseId, days, loadReport])

  // Generate (or regenerate) one student's AI summary on demand, then cache it.
  const handleGenerate = useCallback(
    async (email: string) => {
      if (!data) return
      const courseName = courses.find((c) => c.id === courseId)?.name || ''
      const payload = buildDigestPayload(email, data, courseName, days)
      if (!payload) return
      setGeneratingEmail(email)
      try {
        const res = await fetch('/api/student-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const body = await res.json()
        if (body.summary) {
          const at = body.generatedAt || new Date().toISOString()
          setStudents((prev) =>
            prev.map((s) => (s.email === email ? { ...s, aiSummary: body.summary, aiGeneratedAt: at } : s))
          )
        }
      } catch {
        /* swallow — teacher can retry */
      }
      setGeneratingEmail(null)
    },
    [data, courses, courseId, days]
  )

  // Generate (or regenerate) the course-level AI overview on demand, then cache it.
  const handleGenerateOverview = useCallback(async (emails?: string[]) => {
    if (!data) return
    const cName = courses.find((c) => c.id === courseId)?.name || ''
    const payload = buildCourseDigest(data, cName, days, emails)
    if (!payload) return
    setGeneratingOverview(true)
    try {
      const res = await fetch('/api/course-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (body.summary) {
        setCourseOverview({
          summary: body.summary,
          needs: body.needs || '',
          ready: body.ready || '',
          generatedAt: body.generatedAt || new Date().toISOString(),
        })
      }
    } catch {
      /* swallow — teacher can retry */
    }
    setGeneratingOverview(false)
  }, [data, courses, courseId, days])

  // Set one learner's manual course-progress % (teacher/admin only).
  const handleSetProgress = useCallback(
    async (email: string, pct: number) => {
      if (!courseId) return
      try {
        const res = await fetch('/api/course-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, studentEmail: email, pct }),
        })
        if (res.ok) {
          setStudents((prev) => prev.map((s) => (s.email === email ? { ...s, courseProgressPct: pct } : s)))
        }
      } catch {
        /* swallow — teacher can retry */
      }
    },
    [courseId]
  )

  // Set the course CEFR endpoints (current → goal) — teacher/admin only.
  const handleSetLevels = useCallback(
    async (current: string, goal: string) => {
      if (!courseId) return
      try {
        const res = await fetch('/api/course-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, currentLevel: current, goalLevel: goal }),
        })
        if (res.ok) {
          setData((prev) =>
            prev && prev.course
              ? { ...prev, course: { ...prev.course, current_level: current || null, goal_level: goal || null } }
              : prev
          )
        }
      } catch {
        /* swallow — teacher can retry */
      }
    },
    [courseId]
  )

  // Add / delete a manual test result (teacher/admin only).
  const handleAddTest = useCallback(
    async (email: string, t: { name: string; date: string; score: number; max: number; source: string }) => {
      if (!courseId) return
      try {
        const res = await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, studentEmail: email, ...t }),
        })
        const body = await res.json()
        if (body.assessment) {
          const a = body.assessment
          const mt = {
            id: a.id,
            name: a.name,
            date: a.test_date ? new Date(a.test_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null,
            scorePct: a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 100) : null,
            source: a.source || 'Written',
          }
          setStudents((prev) => prev.map((s) => (s.email === email ? { ...s, manualTests: [mt, ...s.manualTests] } : s)))
        }
      } catch {
        /* swallow — teacher can retry */
      }
    },
    [courseId]
  )

  const handleDeleteTest = useCallback(
    async (id: string, email: string) => {
      if (!courseId) return
      try {
        const res = await fetch('/api/assessments', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, courseId }),
        })
        if (res.ok) {
          setStudents((prev) =>
            prev.map((s) => (s.email === email ? { ...s, manualTests: s.manualTests.filter((m) => m.id !== id) } : s))
          )
        }
      } catch {
        /* swallow — teacher can retry */
      }
    },
    [courseId]
  )

  const handleSetGroupProgress = useCallback(
    async (pct: number) => {
      if (!courseId) return
      try {
        const res = await fetch('/api/course-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, groupProgress: pct }),
        })
        if (res.ok) {
          setData((prev) => (prev && prev.course ? { ...prev, course: { ...prev.course, group_progress_pct: pct } } : prev))
        }
      } catch {
        /* swallow — teacher can retry */
      }
    },
    [courseId]
  )

  if (status === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  const courseName = courses.find((c) => c.id === courseId)?.name || richCourses.find((c) => c.id === courseId)?.name || ''
  const periodLabel = DAY_OPTIONS.find((o) => o.value === days)?.label || ''

  return (
    <div className="font-rubik min-h-screen bg-surface">
      {/* Course + time-range pickers (ReportsView has no picker of its own) */}
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-3">
        {/* Period (report time-range) on its own row */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs font-extrabold uppercase tracking-eyebrow text-ink-muted">Period</span>
          <select value={days} onChange={(e) => setDays(e.target.value as ReportsDays)} className={selectCls} aria-label="Time range">
            {DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {/* Course picker — same search + filters as the Courses area */}
        {richCourses.length > 0 ? (
          <ReportsCoursePicker courses={richCourses} selectedId={courseId} onSelect={setCourseId} />
        ) : (
          <label className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-eyebrow text-ink-muted">Course</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectCls} aria-label="Course">
              {courses.length === 0 && <option value="">No courses</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {status === 'loading' || loading ? (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-card border border-hairline p-5">
              <Skeleton className="h-5 w-48 mb-3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <ReportsView
          courseName={courseName}
          students={students}
          onGenerate={session?.user?.role === 'hr' ? undefined : handleGenerate}
          onRegenerate={session?.user?.role === 'hr' ? undefined : handleGenerate}
          generatingEmail={generatingEmail}
          courseOverview={courseOverview}
          onGenerateOverview={session?.user?.role === 'hr' ? undefined : handleGenerateOverview}
          generatingOverview={generatingOverview}
          cohort={rollup}
          periodLabel={periodLabel}
          courseCurrentLevel={data?.course?.current_level ?? null}
          courseGoalLevel={data?.course?.goal_level ?? null}
          onSetProgress={session?.user?.role === 'hr' ? undefined : handleSetProgress}
          onSetLevels={session?.user?.role === 'hr' ? undefined : handleSetLevels}
          onAddTest={session?.user?.role === 'hr' ? undefined : handleAddTest}
          onDeleteTest={session?.user?.role === 'hr' ? undefined : handleDeleteTest}
          courseGroupProgress={data?.course?.group_progress_pct ?? null}
          onSetGroupProgress={session?.user?.role === 'hr' ? undefined : handleSetGroupProgress}
        />
      )}
    </div>
  )
}
