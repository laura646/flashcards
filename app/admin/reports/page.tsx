'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─────────── Types ───────────

interface Course {
  id: string
  name: string
  description: string | null
}

interface Student {
  email: string
  name: string | null
}

interface Lesson {
  id: string
  title: string
  lesson_date: string | null
}

interface Exercise {
  id: string
  lesson_id: string
  title: string
  exercise_type: string
  is_mandatory: boolean | null
  skills: string[] | null
  cefr_level: string | null
  test_type: string | null
}

// Display label for test_type values
const TEST_TYPE_LABELS: Record<string, string> = {
  review: 'Review test',
  mid_course: 'Mid-course test',
  end_of_course: 'End-of-course test',
}

interface ProgressRecord {
  user_email: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
  response_text: string | null
}

interface WritingBlock {
  id: string
  lesson_id: string
  title: string | null
}

interface AttendanceRow {
  lesson_id: string
  student_email: string
  status: string
  notes: string | null
  marked_by: string | null
  marked_at: string | null
}

interface NoteRow {
  id: string
  student_email: string
  course_id: string
  author_email: string
  tag: string
  text: string
  created_at: string
}

interface ReportData {
  courses: Course[]
  course: Course | null
  students: Student[]
  lessons: Lesson[]
  exercises: Exercise[]
  progress: ProgressRecord[]
  attendance: AttendanceRow[]
  writingBlocks: WritingBlock[]
}

const NOTE_TAGS = [
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-600' },
  { value: 'homework', label: 'Homework', color: 'bg-blue-100 text-blue-600' },
  { value: 'behaviour', label: 'Behaviour', color: 'bg-purple-100 text-purple-600' },
  { value: 'parent_contact', label: 'Parent contact', color: 'bg-green-100 text-green-600' },
  { value: 'academic_concern', label: 'Academic concern', color: 'bg-amber-100 text-amber-600' },
]

const getTagLabel = (tag: string) => NOTE_TAGS.find((t) => t.value === tag)?.label || tag
const getTagColor = (tag: string) => NOTE_TAGS.find((t) => t.value === tag)?.color || 'bg-gray-100 text-gray-600'

// Attendance is considered "counted as present" for % calc if status is present or late.
const ATTENDANCE_PRESENT_STATUSES = new Set(['present', 'late'])

// Phase C: pretty labels for skill tags (match SKILL_OPTIONS in admin/lessons)
const SKILL_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  pronunciation: 'Pronunciation',
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// Payload sent to /api/student-summary. Must match DigestPayload there.
interface SummaryDigest {
  studentName: string
  studentEmail: string
  courseId: string
  courseName: string
  timeRangeLabel: string
  completionPct: number
  attempted: number
  assigned: number
  avgLatestPct: number | null
  avgBestPct: number | null
  attendancePct: number | null
  attendanceMarked: number
  streak: number
  totalAttempts: number
  trendDirection: 'up' | 'down' | 'flat' | 'none'
  topStrengths: { title: string; pct: number }[]
  topWeaknesses: { title: string; pct: number }[]
  skillBreakdown: { label: string; avgPct: number; attempted: number }[]
  cefrBreakdown: { level: string; avgPct: number; attempted: number }[]
}

// Pure helper — builds the digest for one student from the report payload.
// Duplicates some of studentDetail's computation, intentionally, so it can
// run from fetchSummary without depending on the React-scoped useMemo.
function computeStudentDigest(
  data: {
    course: { id: string; name: string } | null
    students: { email: string; name: string | null }[]
    lessons: { id: string; lesson_date: string | null }[]
    exercises: { id: string; lesson_id: string; title: string; skills: string[] | null; cefr_level: string | null }[]
    progress: { user_email: string; activity_type: string; activity_id: string; score: number | null; total: number | null; completed_at: string }[]
    attendance: { lesson_id: string; student_email: string; status: string }[]
  },
  studentEmail: string,
  days: string
): SummaryDigest | null {
  if (!data.course) return null
  const student = data.students.find((s) => s.email === studentEmail)
  if (!student) return null

  const courseExerciseIds = new Set(data.exercises.map((e) => e.id))
  const exById = new Map(data.exercises.map((e) => [e.id, e]))
  const studentExProgress = data.progress.filter(
    (p) => p.user_email === studentEmail && p.activity_type === 'exercise' && courseExerciseIds.has(p.activity_id)
  )

  // Per-exercise latest + best
  type PerEx = { id: string; title: string; attempts: number; latest: number | null; best: number | null }
  const perEx: PerEx[] = data.exercises.map((ex) => {
    const attempts = studentExProgress.filter((p) => p.activity_id === ex.id)
    if (attempts.length === 0) return { id: ex.id, title: ex.title, attempts: 0, latest: null, best: null }
    const latest = attempts[0]
    const latestPct = latest.score != null && latest.total ? Math.round((latest.score / latest.total) * 100) : null
    let best = 0
    for (const a of attempts) {
      if (a.score != null && a.total) {
        const pct = Math.round((a.score / a.total) * 100)
        if (pct > best) best = pct
      }
    }
    return { id: ex.id, title: ex.title, attempts: attempts.length, latest: latestPct, best }
  })

  const attempted = perEx.filter((p) => p.attempts > 0).length
  const assigned = data.exercises.length
  const completionPct = assigned > 0 ? Math.round((attempted / assigned) * 100) : 0
  const totalAttempts = perEx.reduce((s, p) => s + p.attempts, 0)

  const latestPcts = perEx.map((p) => p.latest).filter((x): x is number => x != null)
  const bestPcts = perEx.map((p) => p.best).filter((x): x is number => x != null)
  const avgLatestPct = latestPcts.length > 0 ? Math.round(latestPcts.reduce((a, b) => a + b, 0) / latestPcts.length) : null
  const avgBestPct = bestPcts.length > 0 ? Math.round(bestPcts.reduce((a, b) => a + b, 0) / bestPcts.length) : null

  // Attendance %, filtered to lessons in the selected time range
  const cutoffMs = (() => {
    if (days === 'all') return 0
    const n = parseInt(days, 10)
    if (isNaN(n) || n <= 0) return 0
    return Date.now() - n * 24 * 60 * 60 * 1000
  })()
  const lessonsInRangeIds = new Set(
    data.lessons.filter((l) => !l.lesson_date || new Date(l.lesson_date).getTime() >= cutoffMs).map((l) => l.id)
  )
  const studentAttendance = data.attendance.filter(
    (a) => a.student_email === studentEmail && lessonsInRangeIds.has(a.lesson_id)
  )
  const attendanceMarked = studentAttendance.length
  const presentOrLate = studentAttendance.filter((a) => a.status === 'present' || a.status === 'late').length
  const attendancePct = attendanceMarked > 0 ? Math.round((presentOrLate / attendanceMarked) * 100) : null

  // Streak (uses full progress history, not time-range filtered)
  const allStudentProgress = data.progress.filter((p) => p.user_email === studentEmail)
  const streak = computeStreak(allStudentProgress.map((p) => p.completed_at))

  // Score trend direction: compare first-half vs second-half avg of attempt scores
  const scoredProgress = studentExProgress.filter((p) => p.score != null && p.total)
  let trendDirection: 'up' | 'down' | 'flat' | 'none' = 'none'
  if (scoredProgress.length >= 4) {
    // progress is sorted desc by completed_at, so reverse for chronological
    const chrono = scoredProgress.slice().reverse()
    const half = Math.floor(chrono.length / 2)
    const firstHalf = chrono.slice(0, half)
    const secondHalf = chrono.slice(-half)
    const avg = (arr: typeof chrono) =>
      arr.reduce((s, p) => s + ((p.score as number) / (p.total as number)) * 100, 0) / arr.length
    const diff = avg(secondHalf) - avg(firstHalf)
    if (diff > 5) trendDirection = 'up'
    else if (diff < -5) trendDirection = 'down'
    else trendDirection = 'flat'
  }

  // Top strengths (best score) and weaknesses (latest score), excluding untaken
  const topStrengths = perEx
    .filter((p) => p.best != null)
    .sort((a, b) => (b.best as number) - (a.best as number))
    .slice(0, 3)
    .map((p) => ({ title: p.title || '(untitled)', pct: p.best as number }))

  const topWeaknesses = perEx
    .filter((p) => p.latest != null)
    .sort((a, b) => (a.latest as number) - (b.latest as number))
    .slice(0, 3)
    .map((p) => ({ title: p.title || '(untitled)', pct: p.latest as number }))

  // Skill + CEFR breakdown (best score per exercise)
  const bestByEx: Record<string, number> = {}
  for (const p of perEx) if (p.best != null) bestByEx[p.id] = p.best
  const skillSums: Record<string, { sum: number; count: number }> = {}
  for (const [exId, pct] of Object.entries(bestByEx)) {
    const ex = exById.get(exId)
    if (!ex || !ex.skills) continue
    for (const s of ex.skills) {
      if (!skillSums[s]) skillSums[s] = { sum: 0, count: 0 }
      skillSums[s].sum += pct
      skillSums[s].count += 1
    }
  }
  const skillBreakdown = Object.entries(skillSums)
    .map(([s, v]) => ({ label: SKILL_LABELS[s] || s, avgPct: Math.round(v.sum / v.count), attempted: v.count }))
    .sort((a, b) => b.avgPct - a.avgPct)

  const cefrSums: Record<string, { sum: number; count: number }> = {}
  for (const [exId, pct] of Object.entries(bestByEx)) {
    const ex = exById.get(exId)
    if (!ex || !ex.cefr_level) continue
    if (!cefrSums[ex.cefr_level]) cefrSums[ex.cefr_level] = { sum: 0, count: 0 }
    cefrSums[ex.cefr_level].sum += pct
    cefrSums[ex.cefr_level].count += 1
  }
  const cefrBreakdown = CEFR_ORDER
    .filter((l) => cefrSums[l])
    .map((l) => ({ level: l, avgPct: Math.round(cefrSums[l].sum / cefrSums[l].count), attempted: cefrSums[l].count }))

  return {
    studentName: student.name || student.email,
    studentEmail,
    courseId: data.course.id,
    courseName: data.course.name,
    timeRangeLabel: days === 'all' ? 'All time' : `Last ${days} days`,
    completionPct,
    attempted,
    assigned,
    avgLatestPct,
    avgBestPct,
    attendancePct,
    attendanceMarked,
    streak,
    totalAttempts,
    trendDirection,
    topStrengths,
    topWeaknesses,
    skillBreakdown,
    cefrBreakdown,
  }
}

// Compute consecutive-day streak counting back from today. A "study day"
// is any day with at least one completed progress row.
function computeStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0
  // Collect YYYY-MM-DD strings in local time, de-duped
  const daysSet = new Set(
    completedDates.map((iso) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )
  let streak = 0
  const cursor = new Date()
  // Allow today OR yesterday to start the streak (so evening-cutoff quirks are tolerated)
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
  const yestCursor = new Date()
  yestCursor.setDate(yestCursor.getDate() - 1)
  const yesterdayKey = `${yestCursor.getFullYear()}-${yestCursor.getMonth()}-${yestCursor.getDate()}`
  if (!daysSet.has(todayKey) && !daysSet.has(yesterdayKey)) return 0
  if (!daysSet.has(todayKey)) cursor.setDate(cursor.getDate() - 1) // start from yesterday
  while (true) {
    const k = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
    if (daysSet.has(k)) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// ─────────── Component ───────────

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<ReportData | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [days, setDays] = useState<string>('30')
  const [selectedStudentEmail, setSelectedStudentEmail] = useState<string>('')
  const [overviewMode, setOverviewMode] = useState<'table' | 'heatmap'>('table')
  const [loading, setLoading] = useState(true)

  // Notes loaded on-demand per selected student (not in the main /api/reports payload)
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteTag, setNewNoteTag] = useState('general')
  const [notesError, setNotesError] = useState('')

  // AI narrative summary state — also per-student, lazy-loaded
  const [summary, setSummary] = useState<string>('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  // Load list of courses on mount, and auto-pick the first one
  const loadBootstrap = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports')
      const d: ReportData = await res.json()
      setData(d)
      if (d.courses?.length > 0) {
        setSelectedCourseId((prev) => prev || d.courses[0].id)
      }
    } catch {
      // handled via empty state
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) loadBootstrap()
  }, [status, isAdmin, loadBootstrap])

  // Load report data when course or time range changes
  useEffect(() => {
    if (!selectedCourseId) return
    setLoading(true)
    fetch(`/api/reports?courseId=${encodeURIComponent(selectedCourseId)}&days=${days}`)
      .then((r) => r.json())
      .then((d: ReportData) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedCourseId, days])

  // Generate the AI narrative summary for the currently selected student.
  // Called from the useEffect on student change AND from a manual "Regenerate"
  // button.
  const fetchSummary = async (d: ReportData | null) => {
    if (!d || !selectedStudentEmail) return
    const digest = computeStudentDigest(d, selectedStudentEmail, days)
    if (!digest) return
    setSummaryLoading(true)
    setSummaryError('')
    setSummary('')
    try {
      const res = await fetch('/api/student-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(digest),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to generate summary')
      setSummary(body.summary)
    } catch (e) {
      setSummaryError((e as Error).message)
    }
    setSummaryLoading(false)
  }

  // Trigger summary fetch when the selected student changes (not on every
  // data refresh — teachers can hit Regenerate if data has materially shifted)
  useEffect(() => {
    if (!selectedStudentEmail) {
      setSummary('')
      setSummaryError('')
      return
    }
    fetchSummary(data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentEmail])

  // Load notes for a student when one is selected (separate endpoint)
  useEffect(() => {
    if (!selectedStudentEmail || !selectedCourseId) {
      setNotes([])
      return
    }
    setNotesLoading(true)
    setNotesError('')
    fetch(
      `/api/student-notes?studentEmail=${encodeURIComponent(selectedStudentEmail)}&courseId=${encodeURIComponent(selectedCourseId)}`
    )
      .then((r) => r.json())
      .then((d) => {
        setNotes(d.notes || [])
      })
      .catch(() => setNotesError('Failed to load notes'))
      .finally(() => setNotesLoading(false))
  }, [selectedStudentEmail, selectedCourseId])

  const addNote = async () => {
    if (!selectedStudentEmail || !selectedCourseId || !newNoteText.trim()) return
    setNotesError('')
    try {
      const res = await fetch('/api/student-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail: selectedStudentEmail,
          courseId: selectedCourseId,
          tag: newNoteTag,
          text: newNoteText.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to add note')
      setNotes((prev) => [body.note as NoteRow, ...prev])
      setNewNoteText('')
      setNewNoteTag('general')
    } catch (e) {
      setNotesError((e as Error).message)
    }
  }

  // Teacher action: reset a student's attempt on a specific test.
  // Deletes the progress row so the student can take it again.
  const resetTestAttempt = async (activityId: string) => {
    if (!selectedStudentEmail) return
    const ok = confirm(
      'Reset this test attempt? The student will be able to take it again. This cannot be undone.'
    )
    if (!ok) return
    try {
      const res = await fetch(
        `/api/test-attempt?activity_id=${encodeURIComponent(activityId)}&student_email=${encodeURIComponent(selectedStudentEmail)}`,
        { method: 'DELETE' }
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to reset')
      // Re-fetch report data so the Tests row updates
      if (selectedCourseId) {
        const r = await fetch(`/api/reports?courseId=${encodeURIComponent(selectedCourseId)}&days=${days}`)
        const d = await r.json()
        setData(d)
      }
    } catch (e) {
      alert((e as Error).message || 'Failed to reset attempt')
    }
  }

  const deleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return
    setNotesError('')
    try {
      const res = await fetch(`/api/student-notes?noteId=${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to delete note')
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (e) {
      setNotesError((e as Error).message)
    }
  }

  // ─────────── Aggregations ───────────

  // Lessons filtered to the selected time range (for attendance %)
  const lessonsInRange = useMemo(() => {
    if (!data) return [] as Lesson[]
    if (days === 'all') return data.lessons
    const n = parseInt(days, 10)
    if (isNaN(n) || n <= 0) return data.lessons
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - n)
    return data.lessons.filter((l) => {
      if (!l.lesson_date) return false
      return new Date(l.lesson_date) >= cutoff
    })
  }, [data, days])

  // One row per student for the overview table
  const studentAggregates = useMemo(() => {
    if (!data) return []
    const courseExerciseIds = new Set(data.exercises.map((e) => e.id))
    const lessonsInRangeIds = new Set(lessonsInRange.map((l) => l.id))

    return data.students
      .map((s) => {
        const studentExerciseProgress = data.progress.filter(
          (p) =>
            p.user_email === s.email &&
            p.activity_type === 'exercise' &&
            courseExerciseIds.has(p.activity_id)
        )

        // Unique exercises attempted
        const attemptedIds = new Set(studentExerciseProgress.map((p) => p.activity_id))
        const assigned = data.exercises.length
        const completed = attemptedIds.size
        const completionPct = assigned > 0 ? Math.round((completed / assigned) * 100) : 0

        // For each unique exercise, find latest and best percentages
        const latestPcts: number[] = []
        const bestPcts: number[] = []
        let totalAttempts = 0

        attemptedIds.forEach((exId) => {
          const attempts = studentExerciseProgress.filter((p) => p.activity_id === exId)
          totalAttempts += attempts.length
          // progress is sorted desc by completed_at from the API
          const latest = attempts[0]
          if (latest?.score != null && latest?.total) {
            latestPcts.push(Math.round((latest.score / latest.total) * 100))
          }
          // Best score
          let best = 0
          for (const a of attempts) {
            if (a.score != null && a.total) {
              const pct = Math.round((a.score / a.total) * 100)
              if (pct > best) best = pct
            }
          }
          bestPcts.push(best)
        })

        const avgLatest = latestPcts.length > 0 ? Math.round(latestPcts.reduce((a, b) => a + b, 0) / latestPcts.length) : null
        const avgBest = bestPcts.length > 0 ? Math.round(bestPcts.reduce((a, b) => a + b, 0) / bestPcts.length) : null

        // Attendance: count marked lessons in range where student was present-or-late
        const studentAttendance = data.attendance.filter(
          (a) => a.student_email === s.email && lessonsInRangeIds.has(a.lesson_id)
        )
        const marked = studentAttendance.length
        const presentOrLate = studentAttendance.filter((a) => ATTENDANCE_PRESENT_STATUSES.has(a.status)).length
        const attendancePct = marked > 0 ? Math.round((presentOrLate / marked) * 100) : null

        return {
          email: s.email,
          name: s.name || s.email,
          completionPct,
          assigned,
          completed,
          avgLatest,
          avgBest,
          totalAttempts,
          attendancePct,
          attendanceMarked: marked,
        }
      })
      .sort((a, b) => b.completionPct - a.completionPct || a.name.localeCompare(b.name))
  }, [data, lessonsInRange])

  // Per-exercise breakdown for the currently selected student
  const studentDetail = useMemo(() => {
    if (!data || !selectedStudentEmail) return null
    const student = data.students.find((s) => s.email === selectedStudentEmail)
    if (!student) return null

    const studentExerciseProgress = data.progress.filter(
      (p) => p.user_email === selectedStudentEmail && p.activity_type === 'exercise'
    )

    const perExercise = data.exercises.map((ex) => {
      const attempts = studentExerciseProgress.filter((p) => p.activity_id === ex.id)
      if (attempts.length === 0) {
        return { id: ex.id, title: ex.title, attempts: 0, latest: null as number | null, best: null as number | null, lastAt: null as string | null }
      }
      const latest = attempts[0]
      const latestPct = latest.score != null && latest.total ? Math.round((latest.score / latest.total) * 100) : null
      let best = 0
      for (const a of attempts) {
        if (a.score != null && a.total) {
          const pct = Math.round((a.score / a.total) * 100)
          if (pct > best) best = pct
        }
      }
      return { id: ex.id, title: ex.title, attempts: attempts.length, latest: latestPct, best, lastAt: latest.completed_at }
    })

    // Score trend (chronological, one point per attempt)
    const trend = studentExerciseProgress
      .filter((p) => p.score != null && p.total)
      .slice()
      .reverse() // chronological
      .map((p, i) => ({
        attempt: i + 1,
        date: new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        score: Math.round(((p.score as number) / (p.total as number)) * 100),
      }))

    const attempted = perExercise.filter((e) => e.attempts > 0).length
    const assigned = data.exercises.length
    const completionPct = assigned > 0 ? Math.round((attempted / assigned) * 100) : 0

    // Attendance: filter attendance rows for this student, join with lessons for date/title
    const lessonById = new Map(data.lessons.map((l) => [l.id, l]))
    const studentAttendanceRows = data.attendance
      .filter((a) => a.student_email === selectedStudentEmail)
      .map((a) => ({
        ...a,
        lesson_title: lessonById.get(a.lesson_id)?.title || '(unknown lesson)',
        lesson_date: lessonById.get(a.lesson_id)?.lesson_date || null,
      }))
      .sort((x, y) => {
        const dx = x.lesson_date ? new Date(x.lesson_date).getTime() : 0
        const dy = y.lesson_date ? new Date(y.lesson_date).getTime() : 0
        return dy - dx // newest first
      })

    const marked = studentAttendanceRows.length
    const presentOrLate = studentAttendanceRows.filter((a) => ATTENDANCE_PRESENT_STATUSES.has(a.status)).length
    const attendancePct = marked > 0 ? Math.round((presentOrLate / marked) * 100) : null

    // ─── Phase C: streak, skill breakdown, CEFR performance ───

    // Streak: distinct days with any completed activity for this student
    // (note: uses full progress history, not the time-range filter)
    const allStudentProgress = data.progress.filter((p) => p.user_email === selectedStudentEmail)
    const streak = computeStreak(allStudentProgress.map((p) => p.completed_at))

    // Index: exercise id -> Exercise row (for skills + cefr_level lookup)
    const exerciseById = new Map(data.exercises.map((e) => [e.id, e]))

    // Best-score per attempted exercise (so we have one number per exercise)
    // Using the "best" score for skill/CEFR aggregation matches the spec's
    // "celebrate peaks" framing for tagged dimensions. (Latest is shown
    // elsewhere via the Avg Latest card.)
    const bestByExerciseId: Record<string, number> = {}
    for (const ex of perExercise) {
      if (ex.best != null) bestByExerciseId[ex.id] = ex.best
    }

    // Skill breakdown: for each skill, average the best scores across
    // exercises tagged with that skill (only exercises the student attempted)
    const skillSums: Record<string, { sum: number; count: number }> = {}
    for (const [exId, pct] of Object.entries(bestByExerciseId)) {
      const ex = exerciseById.get(exId)
      if (!ex || !ex.skills) continue
      for (const skill of ex.skills) {
        if (!skillSums[skill]) skillSums[skill] = { sum: 0, count: 0 }
        skillSums[skill].sum += pct
        skillSums[skill].count += 1
      }
    }
    const skillBreakdown = Object.entries(skillSums)
      .map(([skill, { sum, count }]) => ({
        skill,
        label: SKILL_LABELS[skill] || skill,
        avgPct: Math.round(sum / count),
        attempted: count,
      }))
      .sort((a, b) => b.avgPct - a.avgPct)

    // CEFR performance: same idea but grouped by level
    const cefrSums: Record<string, { sum: number; count: number }> = {}
    for (const [exId, pct] of Object.entries(bestByExerciseId)) {
      const ex = exerciseById.get(exId)
      if (!ex || !ex.cefr_level) continue
      if (!cefrSums[ex.cefr_level]) cefrSums[ex.cefr_level] = { sum: 0, count: 0 }
      cefrSums[ex.cefr_level].sum += pct
      cefrSums[ex.cefr_level].count += 1
    }
    const cefrBreakdown = CEFR_ORDER
      .filter((level) => cefrSums[level])
      .map((level) => ({
        level,
        avgPct: Math.round(cefrSums[level].sum / cefrSums[level].count),
        attempted: cefrSums[level].count,
      }))

    // Writing submissions for this student (chronological, newest first).
    // Each entry pairs a progress row (activity_type='writing') with its
    // lesson_block title via the writingBlocks payload.
    const writingBlocksById = new Map((data.writingBlocks || []).map((b) => [b.id, b]))
    const lessonTitleById = new Map(data.lessons.map((l) => [l.id, l.title]))
    const writingSubmissions = data.progress
      .filter((p) => p.user_email === selectedStudentEmail && p.activity_type === 'writing')
      .map((p) => {
        const block = writingBlocksById.get(p.activity_id)
        const lessonTitle = block ? lessonTitleById.get(block.lesson_id) || '' : ''
        const text = p.response_text || ''
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
        return {
          id: p.activity_id + '_' + p.completed_at,
          title: block?.title || 'Writing exercise',
          lessonTitle,
          completedAt: p.completed_at,
          text,
          wordCount,
        }
      })

    // Tests: exercises tagged with a test_type. Use the FIRST attempt as the
    // real grade (test conditions); show latest too for comparison/retakes.
    const tests = data.exercises
      .filter((ex) => ex.test_type)
      .map((ex) => {
        const attempts = studentExerciseProgress.filter((p) => p.activity_id === ex.id)
        if (attempts.length === 0) {
          return {
            id: ex.id,
            title: ex.title,
            test_type: ex.test_type as string,
            attempts: 0,
            first: null as number | null,
            latest: null as number | null,
            firstAt: null as string | null,
          }
        }
        // progress is sorted DESC by completed_at — first chronological attempt is the LAST element
        const firstAttempt = attempts[attempts.length - 1]
        const latestAttempt = attempts[0]
        const firstPct =
          firstAttempt.score != null && firstAttempt.total
            ? Math.round((firstAttempt.score / firstAttempt.total) * 100)
            : null
        const latestPct =
          latestAttempt.score != null && latestAttempt.total
            ? Math.round((latestAttempt.score / latestAttempt.total) * 100)
            : null
        return {
          id: ex.id,
          title: ex.title,
          test_type: ex.test_type as string,
          attempts: attempts.length,
          first: firstPct,
          latest: latestPct,
          firstAt: firstAttempt.completed_at,
        }
      })

    return {
      student,
      perExercise,
      trend,
      attempted,
      assigned,
      completionPct,
      attendanceRows: studentAttendanceRows,
      attendancePct,
      attendanceMarked: marked,
      streak,
      skillBreakdown,
      cefrBreakdown,
      tests,
      writingSubmissions,
    }
  }, [data, selectedStudentEmail])

  // ─────────── States ───────────

  if (status === 'loading') return <div className="p-8 text-sm text-gray-400">Checking session…</div>
  if (!isAdmin) return <div className="p-8 text-sm text-red-500">Access denied — admin or teacher only.</div>
  if (loading && !data) return <div className="p-8 text-sm text-gray-400">Loading report…</div>
  if (!data) return <div className="p-8 text-sm text-gray-400">No data</div>
  if (data.courses.length === 0) {
    return (
      <div className="p-8 text-sm text-gray-500">
        No courses assigned to you yet. Ask a superadmin to add you as a teacher of a course.
      </div>
    )
  }

  // ─────────── Render ───────────

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Top controls (hidden in print) */}
      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        <h1 className="text-2xl font-bold text-[#416ebe] mr-auto">Reports</h1>

        <select
          value={selectedCourseId}
          onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedStudentEmail('') }}
          className="px-3 py-2 border border-[#cddcf0] rounded-lg text-sm text-[#46464b] bg-white focus:outline-none focus:border-[#416ebe]"
        >
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="px-3 py-2 border border-[#cddcf0] rounded-lg text-sm text-[#46464b] bg-white focus:outline-none focus:border-[#416ebe]"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>

        <a
          href="/admin/attendance"
          className="text-sm text-[#416ebe] hover:underline font-bold"
        >
          Mark attendance →
        </a>

        <button
          onClick={() => window.print()}
          className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
        >
          Export as PDF
        </button>
      </div>

      {/* Header (visible in print) */}
      <div className="mb-4 pb-3 border-b border-[#e6f0fa]">
        <h2 className="text-lg font-bold text-[#416ebe]">
          {data.course?.name || '—'}
          {selectedStudentEmail && studentDetail && (
            <span className="text-[#46464b] font-medium"> — {studentDetail.student.name || studentDetail.student.email}</span>
          )}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {days === 'all' ? 'All time' : `Last ${days} days`}
          {' • '}
          {data.exercises.length} exercise{data.exercises.length === 1 ? '' : 's'} assigned
          {' • '}
          {data.students.length} student{data.students.length === 1 ? '' : 's'} enrolled
        </p>
      </div>

      {loading && <div className="text-xs text-gray-400 mb-2">Refreshing…</div>}

      {selectedStudentEmail && (
        <button
          onClick={() => setSelectedStudentEmail('')}
          className="text-sm text-[#416ebe] hover:underline mb-3 print:hidden"
        >
          ← Back to overview
        </button>
      )}

      {/* View toggle (only shown on overview, hidden in print) */}
      {!selectedStudentEmail && (
        <div className="flex items-center gap-1 mb-3 print:hidden">
          <button
            onClick={() => setOverviewMode('table')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              overviewMode === 'table'
                ? 'bg-[#416ebe] text-white'
                : 'text-[#46464b] hover:text-[#416ebe]'
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setOverviewMode('heatmap')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              overviewMode === 'heatmap'
                ? 'bg-[#416ebe] text-white'
                : 'text-[#46464b] hover:text-[#416ebe]'
            }`}
          >
            Heatmap
          </button>
        </div>
      )}

      {/* Overview or detail */}
      {!selectedStudentEmail ? (
        overviewMode === 'heatmap' ? (
          <HeatmapView
            students={data.students}
            exercises={data.exercises}
            lessons={data.lessons}
            progress={data.progress}
            onClickStudent={(email) => setSelectedStudentEmail(email)}
          />
        ) : (
          <OverviewTable
            rows={studentAggregates}
            onClickStudent={(email) => setSelectedStudentEmail(email)}
          />
        )
      ) : studentDetail ? (
        <div className="space-y-5">
          {/* AI narrative summary card (at the top of student detail) */}
          <div className="bg-gradient-to-br from-[#e6f0fa] to-white border border-[#cddcf0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-[#416ebe] uppercase flex items-center gap-1.5">
                <span>✨</span> AI summary
              </h3>
              <button
                onClick={() => fetchSummary(data)}
                disabled={summaryLoading}
                className="text-[10px] text-[#416ebe] font-bold hover:underline disabled:opacity-50 print:hidden"
                title="Regenerate the summary with the latest data"
              >
                {summaryLoading ? 'Generating…' : '↻ Regenerate'}
              </button>
            </div>
            {summaryError ? (
              <p className="text-xs text-red-500">{summaryError}</p>
            ) : summaryLoading && !summary ? (
              <p className="text-sm text-gray-400 italic">Generating summary…</p>
            ) : summary ? (
              <p className="text-sm text-[#46464b] leading-relaxed">{summary}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Summary will appear here.</p>
            )}
          </div>

          <StudentDetail
            detail={studentDetail}
            notes={notes}
            notesLoading={notesLoading}
            notesError={notesError}
            newNoteText={newNoteText}
            newNoteTag={newNoteTag}
            currentUserEmail={session?.user?.email || ''}
            isSuperadmin={session?.user?.role === 'superadmin'}
            onChangeNewNoteText={setNewNoteText}
            onChangeNewNoteTag={setNewNoteTag}
            onAddNote={addNote}
            onDeleteNote={deleteNote}
            onResetTestAttempt={resetTestAttempt}
          />
        </div>
      ) : (
        <div className="text-sm text-gray-500">Student not found.</div>
      )}
    </div>
  )
}

// ─────────── Sub-components ───────────

type AggregateRow = {
  email: string
  name: string
  completionPct: number
  assigned: number
  completed: number
  avgLatest: number | null
  avgBest: number | null
  totalAttempts: number
  attendancePct: number | null
  attendanceMarked: number
}

function OverviewTable({ rows, onClickStudent }: { rows: AggregateRow[]; onClickStudent: (email: string) => void }) {
  if (rows.length === 0) {
    return <div className="text-sm text-gray-500 py-8 text-center">No students enrolled in this course yet.</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-[#f7fafd] text-[10px] font-bold text-gray-500 uppercase">
          <tr>
            <th className="py-2 px-3 border-b border-[#e6f0fa]">Student</th>
            <th className="py-2 px-3 border-b border-[#e6f0fa]">Completion</th>
            <th className="py-2 px-3 border-b border-[#e6f0fa]">Attendance</th>
            <th className="py-2 px-3 border-b border-[#e6f0fa]">Avg Latest</th>
            <th className="py-2 px-3 border-b border-[#e6f0fa]">Avg Best</th>
            <th className="py-2 px-3 border-b border-[#e6f0fa]">Attempts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.email}
              onClick={() => onClickStudent(r.email)}
              className="border-b border-[#e6f0fa] hover:bg-[#f7fafd] cursor-pointer transition-colors"
            >
              <td className="py-3 px-3">
                <div className="font-medium text-[#46464b]">{r.name}</div>
                <div className="text-[10px] text-gray-400">{r.email}</div>
              </td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#416ebe] rounded-full"
                      style={{ width: `${r.completionPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#46464b] whitespace-nowrap">
                    {r.completed}/{r.assigned} ({r.completionPct}%)
                  </span>
                </div>
              </td>
              <td className="py-3 px-3">
                {r.attendancePct != null ? (
                  <span className="text-xs text-[#46464b] whitespace-nowrap">
                    {r.attendancePct}%
                    <span className="text-gray-400 ml-1">({r.attendanceMarked} marked)</span>
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="py-3 px-3">{r.avgLatest != null ? `${r.avgLatest}%` : <span className="text-gray-300">—</span>}</td>
              <td className="py-3 px-3">{r.avgBest != null ? `${r.avgBest}%` : <span className="text-gray-300">—</span>}</td>
              <td className="py-3 px-3">{r.totalAttempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type StudentDetailData = {
  student: Student
  perExercise: { id: string; title: string; attempts: number; latest: number | null; best: number | null; lastAt: string | null }[]
  trend: { attempt: number; date: string; score: number }[]
  attempted: number
  assigned: number
  completionPct: number
  attendanceRows: (AttendanceRow & { lesson_title: string; lesson_date: string | null })[]
  attendancePct: number | null
  attendanceMarked: number
  streak: number
  skillBreakdown: { skill: string; label: string; avgPct: number; attempted: number }[]
  cefrBreakdown: { level: string; avgPct: number; attempted: number }[]
  tests: {
    id: string
    title: string
    test_type: string
    attempts: number
    first: number | null
    latest: number | null
    firstAt: string | null
  }[]
  writingSubmissions: {
    id: string
    title: string
    lessonTitle: string
    completedAt: string
    text: string
    wordCount: number
  }[]
}

// ─────────── HeatmapView ───────────
// Class-wide grid: rows = students, columns = exercises (ordered by lesson
// date then by order_index). Cell colour = student's latest score on that
// exercise. Hover for full info, click for student detail.

function getHeatmapColor(latest: number | null): string {
  if (latest == null) return 'bg-gray-100 text-gray-300'
  if (latest < 50) return 'bg-red-100 text-red-700'
  if (latest < 70) return 'bg-amber-100 text-amber-700'
  if (latest < 90) return 'bg-lime-100 text-lime-700'
  return 'bg-green-100 text-green-700'
}

function HeatmapView({
  students,
  exercises,
  lessons,
  progress,
  onClickStudent,
}: {
  students: Student[]
  exercises: Exercise[]
  lessons: Lesson[]
  progress: ProgressRecord[]
  onClickStudent: (email: string) => void
}) {
  // Lesson date order — used to sort exercises across lessons
  const lessonOrder = useMemo(() => {
    const m = new Map<string, number>()
    lessons.forEach((l, i) => m.set(l.id, i))
    return m
  }, [lessons])

  // Sort exercises by lesson order, then their own order_index from the API
  // (the API already returned them ordered by order_index ascending within
  // each lesson)
  const sortedExercises = useMemo(() => {
    const byLesson = new Map<string, Exercise[]>()
    for (const ex of exercises) {
      if (!byLesson.has(ex.lesson_id)) byLesson.set(ex.lesson_id, [])
      byLesson.get(ex.lesson_id)!.push(ex)
    }
    const out: Exercise[] = []
    const lessonIdsByDate = Array.from(lessonOrder.keys()).sort(
      (a, b) => (lessonOrder.get(a) ?? 999) - (lessonOrder.get(b) ?? 999)
    )
    for (const lid of lessonIdsByDate) {
      const arr = byLesson.get(lid) || []
      out.push(...arr)
    }
    return out
  }, [exercises, lessonOrder])

  // Map: lesson_id -> lesson title (for tooltip on the column header)
  const lessonTitleById = useMemo(
    () => new Map(lessons.map((l) => [l.id, l.title])),
    [lessons]
  )

  // Grid: studentEmail -> exerciseId -> { latest, attempts }
  const grid = useMemo(() => {
    const g: Record<string, Record<string, { latest: number | null; attempts: number }>> = {}
    for (const s of students) g[s.email] = {}
    const courseExerciseIds = new Set(exercises.map((e) => e.id))

    // Progress is sorted DESC by completed_at from /api/reports — so the
    // first time we see a (student, exercise) pair is the LATEST attempt.
    for (const p of progress) {
      if (p.activity_type !== 'exercise') continue
      if (!courseExerciseIds.has(p.activity_id)) continue
      if (!g[p.user_email]) continue
      if (!g[p.user_email][p.activity_id]) {
        const latestPct = p.score != null && p.total ? Math.round((p.score / p.total) * 100) : null
        g[p.user_email][p.activity_id] = { latest: latestPct, attempts: 1 }
      } else {
        g[p.user_email][p.activity_id].attempts += 1
      }
    }
    return g
  }, [students, exercises, progress])

  // Sort students: highest completion first, ties by name
  const sortedStudents = useMemo(() => {
    return [...students]
      .map((s) => {
        const completed = Object.values(grid[s.email] || {}).filter((c) => c.latest != null).length
        return { ...s, completed }
      })
      .sort((a, b) => b.completed - a.completed || (a.name || a.email).localeCompare(b.name || b.email))
  }, [students, grid])

  if (sortedStudents.length === 0) {
    return <div className="text-sm text-gray-500 py-8 text-center">No students enrolled in this course yet.</div>
  }
  if (sortedExercises.length === 0) {
    return <div className="text-sm text-gray-500 py-8 text-center">No exercises in this course yet.</div>
  }

  return (
    <div className="bg-white border border-[#e6f0fa] rounded-xl">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-[#e6f0fa] text-[10px] text-gray-500">
        <span className="font-bold uppercase">Legend:</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100" /> &lt;50</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-100" /> 50–69</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-lime-100" /> 70–89</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-100" /> 90+</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100" /> not attempted</span>
        <span className="ml-auto text-gray-400">Tip: hover a cell for details. Click for student detail.</span>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="bg-[#f7fafd]">
              <th className="sticky left-0 z-10 bg-[#f7fafd] py-2 px-3 border-b border-[#e6f0fa] text-left text-[10px] font-bold text-gray-500 uppercase min-w-[160px]">
                Student
              </th>
              {sortedExercises.map((ex, i) => {
                const prevEx = sortedExercises[i - 1]
                const newLesson = !prevEx || prevEx.lesson_id !== ex.lesson_id
                const lessonTitle = lessonTitleById.get(ex.lesson_id) || ''
                return (
                  <th
                    key={ex.id}
                    title={`${lessonTitle ? lessonTitle + ' — ' : ''}${ex.title || '(untitled)'}`}
                    className={`py-2 px-1.5 border-b border-[#e6f0fa] text-[10px] font-bold text-gray-500 text-center min-w-[28px] ${
                      newLesson && i > 0 ? 'border-l-2 border-l-[#cddcf0]' : ''
                    }`}
                  >
                    {i + 1}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((s) => (
              <tr key={s.email} className="hover:bg-[#fafcff]">
                <td
                  onClick={() => onClickStudent(s.email)}
                  className="sticky left-0 z-10 bg-white py-2 px-3 border-b border-[#e6f0fa] cursor-pointer hover:bg-[#f7fafd] min-w-[160px]"
                  title="Click to open student detail"
                >
                  <div className="font-medium text-[#46464b] truncate" style={{ maxWidth: 160 }}>
                    {s.name || s.email}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate" style={{ maxWidth: 160 }}>
                    {s.email}
                  </div>
                </td>
                {sortedExercises.map((ex, i) => {
                  const prevEx = sortedExercises[i - 1]
                  const newLesson = !prevEx || prevEx.lesson_id !== ex.lesson_id
                  const cell = grid[s.email]?.[ex.id]
                  const latest = cell?.latest ?? null
                  const attempts = cell?.attempts ?? 0
                  const tooltip = `${s.name || s.email} — ${ex.title || '(untitled)'}\n${latest != null ? `Latest: ${latest}%` : 'Not attempted'}${attempts > 0 ? `\nAttempts: ${attempts}` : ''}`
                  return (
                    <td
                      key={ex.id}
                      title={tooltip}
                      onClick={() => onClickStudent(s.email)}
                      className={`py-2 px-1 border-b border-[#e6f0fa] text-center font-bold cursor-pointer hover:opacity-70 transition-opacity ${getHeatmapColor(latest)} ${
                        newLesson && i > 0 ? 'border-l-2 border-l-[#cddcf0]' : ''
                      }`}
                    >
                      {latest != null ? latest : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface StudentDetailProps {
  detail: StudentDetailData
  notes: NoteRow[]
  notesLoading: boolean
  notesError: string
  newNoteText: string
  newNoteTag: string
  currentUserEmail: string
  isSuperadmin: boolean
  onChangeNewNoteText: (v: string) => void
  onChangeNewNoteTag: (v: string) => void
  onAddNote: () => void
  onDeleteNote: (id: string) => void
  onResetTestAttempt: (activityId: string) => void
}

function StudentDetail({
  detail,
  notes,
  notesLoading,
  notesError,
  newNoteText,
  newNoteTag,
  currentUserEmail,
  isSuperadmin,
  onChangeNewNoteText,
  onChangeNewNoteTag,
  onAddNote,
  onDeleteNote,
  onResetTestAttempt,
}: StudentDetailProps) {
  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <SummaryCard label="Completion" value={`${detail.completionPct}%`} sub={`${detail.attempted}/${detail.assigned}`} />
        <SummaryCard
          label="Avg Latest"
          value={avgOrDash(detail.perExercise.map((e) => e.latest).filter((x): x is number => x != null))}
          sub="across exercises"
        />
        <SummaryCard
          label="Avg Best"
          value={avgOrDash(detail.perExercise.map((e) => e.best).filter((x): x is number => x != null))}
          sub="across exercises"
        />
        <SummaryCard
          label="Attendance"
          value={detail.attendancePct != null ? `${detail.attendancePct}%` : '—'}
          sub={detail.attendanceMarked > 0 ? `${detail.attendanceMarked} marked` : 'nothing marked yet'}
        />
        <SummaryCard
          label="Streak"
          value={detail.streak > 0 ? `${detail.streak}🔥` : '—'}
          sub={detail.streak === 0 ? 'no active streak' : `day${detail.streak === 1 ? '' : 's'}`}
        />
        <SummaryCard
          label="Total Attempts"
          value={String(detail.perExercise.reduce((sum, e) => sum + e.attempts, 0))}
          sub="all exercises"
        />
      </div>

      {/* Skill breakdown + CEFR performance (side-by-side on md+) */}
      {(detail.skillBreakdown.length > 0 || detail.cefrBreakdown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {detail.skillBreakdown.length > 0 && (
            <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
              <h3 className="text-xs font-bold text-[#416ebe] uppercase mb-3">Skill breakdown</h3>
              <div className="space-y-2">
                {detail.skillBreakdown.map((s) => (
                  <div key={s.skill}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-[#46464b]">{s.label}</span>
                      <span className="text-gray-500">
                        {s.avgPct}%
                        <span className="text-gray-300 ml-1">({s.attempted} ex.)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#e6f0fa] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#416ebe] rounded-full"
                        style={{ width: `${s.avgPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.cefrBreakdown.length > 0 && (
            <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
              <h3 className="text-xs font-bold text-[#416ebe] uppercase mb-3">CEFR performance</h3>
              <div className="space-y-2">
                {detail.cefrBreakdown.map((c) => (
                  <div key={c.level}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-[#416ebe]">{c.level}</span>
                      <span className="text-gray-500">
                        {c.avgPct}%
                        <span className="text-gray-300 ml-1">({c.attempted} ex.)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#e6f0fa] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00aff0] rounded-full"
                        style={{ width: `${c.avgPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Score trend */}
      {detail.trend.length > 1 && (
        <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[#416ebe] uppercase mb-3">Score trend</h3>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={detail.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6f0fa" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#416ebe" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Teacher notes */}
      <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
        <h3 className="text-xs font-bold text-[#416ebe] uppercase mb-3">Teacher notes</h3>

        {/* Add note form */}
        <div className="bg-[#f7fafd] rounded-lg p-3 mb-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Tag</label>
            <select
              value={newNoteTag}
              onChange={(e) => onChangeNewNoteTag(e.target.value)}
              className="px-2 py-1 text-xs border border-[#cddcf0] rounded bg-white focus:outline-none focus:border-[#416ebe]"
            >
              {NOTE_TAGS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={newNoteText}
            onChange={(e) => onChangeNewNoteText(e.target.value)}
            placeholder="Add a note about this student…"
            rows={2}
            className="w-full px-2 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded bg-white focus:outline-none focus:border-[#416ebe] resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            {notesError && <span className="text-[10px] text-red-500">{notesError}</span>}
            <button
              onClick={onAddNote}
              disabled={!newNoteText.trim()}
              className="ml-auto bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              Add note
            </button>
          </div>
        </div>

        {/* Existing notes list */}
        {notesLoading ? (
          <div className="text-xs text-gray-400">Loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="text-xs text-gray-400 py-2">No notes yet.</div>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => {
              const canDelete = isSuperadmin || n.author_email === currentUserEmail
              return (
                <div key={n.id} className="border border-[#e6f0fa] rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getTagColor(n.tag)}`}>
                        {getTagLabel(n.tag)}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' • '}
                        {n.author_email}
                      </span>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => onDeleteNote(n.id)}
                        className="text-[10px] text-gray-300 hover:text-red-400 transition-colors print:hidden"
                        title="Delete note"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-[#46464b] whitespace-pre-wrap">{n.text}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent attendance */}
      {detail.attendanceRows.length > 0 && (
        <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[#416ebe] uppercase mb-3">Attendance history</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-[#f7fafd] text-[10px] font-bold text-gray-500 uppercase">
                <tr>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Lesson</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Date</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Status</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Note</th>
                </tr>
              </thead>
              <tbody>
                {detail.attendanceRows.map((a) => (
                  <tr key={a.lesson_id} className="border-b border-[#e6f0fa]">
                    <td className="py-2 px-3 text-[#46464b]">{a.lesson_title}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">
                      {a.lesson_date ? new Date(a.lesson_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-2 px-3">
                      <AttendanceBadge status={a.status} />
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">{a.notes || <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tests (only shown when there's at least one tagged test in the course) */}
      {detail.tests.length > 0 && (
        <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[#416ebe] uppercase mb-3">Tests</h3>
          <p className="text-[10px] text-gray-400 mb-3">
            First-attempt scores represent the &quot;real grade&quot;. Latest is shown for context if the student retook.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-[#f7fafd] text-[10px] font-bold text-gray-500 uppercase">
                <tr>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Test</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Type</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">First attempt</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Latest</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Attempts</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Taken</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa] print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {detail.tests.map((t) => (
                  <tr key={t.id} className="border-b border-[#e6f0fa]">
                    <td className="py-3 px-3 font-medium text-[#46464b]">{t.title || '(untitled)'}</td>
                    <td className="py-3 px-3 text-xs text-gray-500">{TEST_TYPE_LABELS[t.test_type] || t.test_type}</td>
                    <td className="py-3 px-3 font-bold">
                      {t.first != null ? (
                        <span className={t.first >= 70 ? 'text-green-600' : t.first >= 50 ? 'text-amber-600' : 'text-red-500'}>
                          {t.first}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {t.latest != null && t.attempts > 1 ? `${t.latest}%` : t.latest != null ? <span className="text-gray-300">(same)</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-3">{t.attempts}</td>
                    <td className="py-3 px-3 text-xs text-gray-500">
                      {t.firstAt ? new Date(t.firstAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="text-gray-300">not taken</span>}
                    </td>
                    <td className="py-3 px-3 text-right print:hidden">
                      {t.attempts > 0 && (
                        <button
                          onClick={() => onResetTestAttempt(t.id)}
                          title="Delete this attempt so the student can retake the test"
                          className="text-[10px] text-gray-300 hover:text-red-500 font-bold transition-colors"
                        >
                          ↺ Reset
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Writing submissions timeline (only shown if there's at least one) */}
      {detail.writingSubmissions.length > 0 && (
        <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[#416ebe] uppercase mb-3">
            Writing submissions ({detail.writingSubmissions.length})
          </h3>
          <div className="space-y-3">
            {detail.writingSubmissions.map((w) => (
              <WritingEntry key={w.id} entry={w} />
            ))}
          </div>
        </div>
      )}

      {/* Per-exercise table */}
      <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
        <h3 className="text-xs font-bold text-[#416ebe] uppercase mb-3">Per-exercise breakdown</h3>
        {detail.perExercise.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">No exercises assigned in this course.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-[#f7fafd] text-[10px] font-bold text-gray-500 uppercase">
                <tr>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Exercise</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Attempts</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Latest</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Best</th>
                  <th className="py-2 px-3 border-b border-[#e6f0fa]">Last attempt</th>
                </tr>
              </thead>
              <tbody>
                {detail.perExercise.map((e) => (
                  <tr key={e.id} className="border-b border-[#e6f0fa]">
                    <td className="py-3 px-3 font-medium text-[#46464b]">{e.title || '(untitled)'}</td>
                    <td className="py-3 px-3">{e.attempts}</td>
                    <td className="py-3 px-3">{e.latest != null ? `${e.latest}%` : <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 px-3">{e.best != null ? `${e.best}%` : <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 px-3 text-xs text-gray-500">
                      {e.lastAt ? new Date(e.lastAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Expandable writing-submission card. Shows date, prompt title, word count
// and an excerpt by default. Click "Show full text" to expand.
function WritingEntry({
  entry,
}: {
  entry: { title: string; lessonTitle: string; completedAt: string; text: string; wordCount: number }
}) {
  const [expanded, setExpanded] = useState(false)
  const dateLabel = new Date(entry.completedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const hasText = entry.text.trim().length > 0
  const excerpt = entry.text.length > 240 ? entry.text.slice(0, 240).trim() + '…' : entry.text

  return (
    <div className="border border-[#e6f0fa] rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#46464b]">{entry.title}</p>
          <p className="text-[10px] text-gray-400">
            {entry.lessonTitle && <>{entry.lessonTitle}{' • '}</>}
            {dateLabel}
            {' • '}
            {entry.wordCount} word{entry.wordCount === 1 ? '' : 's'}
          </p>
        </div>
        {hasText && entry.text.length > 240 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-[#416ebe] font-bold hover:underline whitespace-nowrap print:hidden"
          >
            {expanded ? 'Collapse' : 'Show full text'}
          </button>
        )}
      </div>
      {hasText ? (
        <p className="text-sm text-[#46464b] whitespace-pre-wrap leading-relaxed mt-2">
          {expanded ? entry.text : excerpt}
        </p>
      ) : (
        <p className="text-xs text-gray-300 italic mt-2">
          No text recorded for this submission. (Likely submitted before the
          response-text fix — only future writings will be saved.)
        </p>
      )}
    </div>
  )
}

function AttendanceBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    present: { label: '✓ Present', cls: 'bg-green-50 text-green-600 border-green-200' },
    absent: { label: '✕ Absent', cls: 'bg-red-50 text-red-500 border-red-200' },
    late: { label: '🕐 Late', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
    excused: { label: '📝 Excused', cls: 'bg-blue-50 text-blue-500 border-blue-200' },
  }
  const c = config[status] || { label: status, cls: 'bg-gray-50 text-gray-500 border-gray-200' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${c.cls}`}>
      {c.label}
    </span>
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-[#e6f0fa] rounded-xl p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
      <p className="text-2xl font-bold text-[#416ebe] mt-1">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function avgOrDash(nums: number[]): string {
  if (nums.length === 0) return '—'
  return `${Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)}%`
}
