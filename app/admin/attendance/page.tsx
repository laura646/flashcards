'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─────────── Types ───────────

interface Course {
  id: string
  name: string
}

interface Lesson {
  id: string
  title: string
  lesson_date: string | null
  course_id: string | null
}

interface Student {
  email: string
  name: string | null
}

interface AttendanceRecord {
  student_email: string
  status: Status
  notes: string | null
  marked_by: string | null
  marked_at: string | null
}

type Status = 'present' | 'absent' | 'late' | 'excused'

const STATUS_OPTIONS: { value: Status; label: string; color: string; icon: string }[] = [
  { value: 'present', label: 'Present', color: 'bg-green-50 text-green-600 border-green-200', icon: '✓' },
  { value: 'absent', label: 'Absent', color: 'bg-red-50 text-red-500 border-red-200', icon: '✕' },
  { value: 'late', label: 'Late', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: '🕐' },
  { value: 'excused', label: 'Excused', color: 'bg-blue-50 text-blue-500 border-blue-200', icon: '📝' },
]

// ─────────── Page ───────────

export default function AttendancePage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState<string>('')

  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<Record<string, { status: Status; notes: string }>>({})
  const [originalMarkedAt, setOriginalMarkedAt] = useState<string | null>(null)
  const [originalMarkedBy, setOriginalMarkedBy] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/')
  }, [authStatus, router])

  // 1. Load course list on mount (reuses /api/reports which returns courses)
  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports')
      const d = await res.json()
      setCourses(d.courses || [])
      if ((d.courses || []).length > 0 && !selectedCourseId) {
        setSelectedCourseId(d.courses[0].id)
      }
    } catch {
      setError('Failed to load courses')
    }
    setLoading(false)
  }, [selectedCourseId])

  useEffect(() => {
    if (authStatus === 'authenticated' && isAdmin) loadCourses()
  }, [authStatus, isAdmin, loadCourses])

  // 2. Load lessons whenever the selected course changes
  useEffect(() => {
    if (!selectedCourseId) return
    setLessons([])
    setSelectedLessonId('')
    fetch(`/api/lessons?course_id=${encodeURIComponent(selectedCourseId)}`)
      .then((r) => r.json())
      .then((d) => {
        const ls = (d.lessons || []) as Lesson[]
        setLessons(
          ls.sort((a, b) => {
            const da = a.lesson_date ? new Date(a.lesson_date).getTime() : 0
            const db = b.lesson_date ? new Date(b.lesson_date).getTime() : 0
            return db - da // newest first
          })
        )
      })
      .catch(() => setError('Failed to load lessons'))
  }, [selectedCourseId])

  // 3. Load roster + existing marks when a lesson is selected
  useEffect(() => {
    if (!selectedLessonId) {
      setStudents([])
      setMarks({})
      return
    }
    setLoading(true)
    setSavedAt(null)
    fetch(`/api/attendance?lessonId=${encodeURIComponent(selectedLessonId)}`)
      .then((r) => r.json())
      .then((d) => {
        setStudents(d.students || [])
        // Build marks map. Default missing students to 'absent' so the teacher
        // only has to click the ones who were there. (They can flip defaults later.)
        const existing: Record<string, AttendanceRecord> = {}
        for (const r of (d.records || []) as AttendanceRecord[]) {
          existing[r.student_email] = r
        }
        const next: Record<string, { status: Status; notes: string }> = {}
        for (const s of (d.students || []) as Student[]) {
          const r = existing[s.email]
          next[s.email] = {
            status: (r?.status as Status) || 'absent',
            notes: r?.notes || '',
          }
        }
        setMarks(next)
        // Capture who last marked, for the "Last marked by" line
        const firstMark = (d.records || [])[0] as AttendanceRecord | undefined
        setOriginalMarkedAt(firstMark?.marked_at || null)
        setOriginalMarkedBy(firstMark?.marked_by || null)
      })
      .catch(() => setError('Failed to load roster'))
      .finally(() => setLoading(false))
  }, [selectedLessonId])

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  )

  const setStatus = (email: string, status: Status) => {
    setMarks((prev) => ({ ...prev, [email]: { ...prev[email], status } }))
    setSavedAt(null)
  }

  const setNotes = (email: string, notes: string) => {
    setMarks((prev) => ({ ...prev, [email]: { ...prev[email], notes } }))
    setSavedAt(null)
  }

  const markAllPresent = () => {
    setMarks((prev) => {
      const next = { ...prev }
      for (const s of students) next[s.email] = { ...next[s.email], status: 'present' }
      return next
    })
    setSavedAt(null)
  }

  const save = async () => {
    if (!selectedLessonId) return
    setSaving(true)
    setError('')
    try {
      const records = students.map((s) => ({
        student_email: s.email,
        status: marks[s.email]?.status || 'absent',
        notes: marks[s.email]?.notes?.trim() || null,
      }))
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: selectedLessonId, records }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Save failed')
      setSavedAt(body.marked_at)
      setOriginalMarkedAt(body.marked_at)
      setOriginalMarkedBy(session?.user?.email || null)
    } catch (e) {
      setError((e as Error).message || 'Save failed')
    }
    setSaving(false)
  }

  // ─────────── States ───────────

  if (authStatus === 'loading') return <div className="p-8 text-sm text-gray-400">Checking session…</div>
  if (!isAdmin) return <div className="p-8 text-sm text-red-500">Access denied — admin or teacher only.</div>
  if (loading && courses.length === 0) return <div className="p-8 text-sm text-gray-400">Loading…</div>
  if (courses.length === 0) {
    return <div className="p-8 text-sm text-gray-500">No courses assigned to you.</div>
  }

  // ─────────── Render ───────────

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-[#416ebe] mr-auto">Attendance</h1>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="px-3 py-2 border border-[#cddcf0] rounded-lg text-sm text-[#46464b] bg-white focus:outline-none focus:border-[#416ebe]"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Lesson picker */}
      <div className="mb-5">
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Lesson</label>
        {lessons.length === 0 ? (
          <p className="text-sm text-gray-500">No lessons in this course yet.</p>
        ) : (
          <select
            value={selectedLessonId}
            onChange={(e) => setSelectedLessonId(e.target.value)}
            className="w-full px-3 py-2 border border-[#cddcf0] rounded-lg text-sm text-[#46464b] bg-white focus:outline-none focus:border-[#416ebe]"
          >
            <option value="">— Select a lesson —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lesson_date ? new Date(l.lesson_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' — ' : ''}
                {l.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Roster */}
      {selectedLessonId && (
        <>
          {loading ? (
            <div className="text-sm text-gray-400">Loading roster…</div>
          ) : students.length === 0 ? (
            <div className="text-sm text-gray-500">No students enrolled in this course.</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-500">
                  {selectedLesson?.lesson_date && (
                    <span>
                      {new Date(selectedLesson.lesson_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      {' • '}
                    </span>
                  )}
                  {students.length} student{students.length === 1 ? '' : 's'}
                </div>
                <button
                  onClick={markAllPresent}
                  className="text-xs text-[#416ebe] font-bold hover:underline"
                >
                  Mark all present
                </button>
              </div>

              {/* Last-audited hint */}
              {originalMarkedAt && originalMarkedAt !== '1970-01-01T00:00:00+00:00' && (
                <p className="text-[11px] text-gray-400 mb-2">
                  Last marked by {originalMarkedBy || 'unknown'} on {new Date(originalMarkedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}

              <div className="space-y-2 mb-5">
                {students.map((s) => {
                  const cur = marks[s.email]?.status || 'absent'
                  return (
                    <div key={s.email} className="bg-white border border-[#e6f0fa] rounded-xl p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#46464b] truncate">{s.name || s.email}</p>
                          <p className="text-[10px] text-gray-400 truncate">{s.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {STATUS_OPTIONS.map((opt) => {
                            const active = cur === opt.value
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setStatus(s.email, opt.value)}
                                className={`px-2 py-1 text-[11px] font-bold rounded border transition-all ${
                                  active ? opt.color + ' scale-105' : 'bg-white text-gray-400 border-[#e6f0fa] hover:border-[#cddcf0]'
                                }`}
                              >
                                <span className="mr-0.5">{opt.icon}</span>
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={marks[s.email]?.notes || ''}
                        onChange={(e) => setNotes(s.email, e.target.value)}
                        placeholder="Optional note (e.g. joined 10 min late)"
                        className="w-full px-2 py-1.5 text-xs text-[#46464b] border border-[#e6f0fa] rounded bg-[#f7fafd] focus:outline-none focus:border-[#cddcf0]"
                      />
                    </div>
                  )
                })}
              </div>

              {/* Save controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save attendance'}
                </button>
                {savedAt && <span className="text-xs text-green-600">✓ Saved</span>}
                {error && <span className="text-xs text-red-500">{error}</span>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
