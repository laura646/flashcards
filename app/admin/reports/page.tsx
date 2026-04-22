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
}

interface ProgressRecord {
  user_email: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
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
  const [loading, setLoading] = useState(true)

  // Notes loaded on-demand per selected student (not in the main /api/reports payload)
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteTag, setNewNoteTag] = useState('general')
  const [notesError, setNotesError] = useState('')

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

      {/* Overview or detail */}
      {!selectedStudentEmail ? (
        <OverviewTable
          rows={studentAggregates}
          onClickStudent={(email) => setSelectedStudentEmail(email)}
        />
      ) : studentDetail ? (
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
        />
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
