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
}

interface ProgressRecord {
  user_email: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
}

interface ReportData {
  courses: Course[]
  course: Course | null
  students: Student[]
  lessons: Lesson[]
  exercises: Exercise[]
  progress: ProgressRecord[]
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

  // ─────────── Aggregations ───────────

  // One row per student for the overview table
  const studentAggregates = useMemo(() => {
    if (!data) return []
    const courseExerciseIds = new Set(data.exercises.map((e) => e.id))

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

        return {
          email: s.email,
          name: s.name || s.email,
          completionPct,
          assigned,
          completed,
          avgLatest,
          avgBest,
          totalAttempts,
        }
      })
      .sort((a, b) => b.completionPct - a.completionPct || a.name.localeCompare(b.name))
  }, [data])

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

    return { student, perExercise, trend, attempted, assigned, completionPct }
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
        <StudentDetail detail={studentDetail} />
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
}

function StudentDetail({ detail }: { detail: StudentDetailData }) {
  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          label="Total Attempts"
          value={String(detail.perExercise.reduce((sum, e) => sum + e.attempts, 0))}
          sub="all exercises"
        />
      </div>

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
