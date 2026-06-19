'use client'

// Wave 0 — REAL redesigned Attendance, new beside old. Same fetch/save flow
// and APIs as the live /admin/attendance (left untouched); new unlinked route.

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AttendanceView, { AttStatus, AttCourse, AttLesson, AttStudent, AttMarks } from '@/components/admin-v2/AttendanceView'

interface AttendanceRecord { student_email: string; status: AttStatus; notes: string | null }

export default function AttendanceBetaPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [courses, setCourses] = useState<AttCourse[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [lessons, setLessons] = useState<AttLesson[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [students, setStudents] = useState<AttStudent[]>([])
  const [marks, setMarks] = useState<AttMarks>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => { if (authStatus === 'unauthenticated') router.replace('/') }, [authStatus, router])

  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports')
      const d = await res.json()
      setCourses(d.courses || [])
      if ((d.courses || []).length > 0) setSelectedCourseId((prev) => prev || d.courses[0].id)
    } catch { setError('Failed to load courses') }
    setLoading(false)
  }, [])

  useEffect(() => { if (authStatus === 'authenticated' && isAdmin) loadCourses() }, [authStatus, isAdmin, loadCourses])

  useEffect(() => {
    if (!selectedCourseId) return
    setLessons([]); setSelectedLessonId('')
    fetch(`/api/lessons?course_id=${encodeURIComponent(selectedCourseId)}`)
      .then((r) => r.json())
      .then((d) => {
        const ls = (d.lessons || []) as AttLesson[]
        setLessons(ls.sort((a, b) => (b.lesson_date ? new Date(b.lesson_date).getTime() : 0) - (a.lesson_date ? new Date(a.lesson_date).getTime() : 0)))
      })
      .catch(() => setError('Failed to load lessons'))
  }, [selectedCourseId])

  useEffect(() => {
    if (!selectedLessonId) { setStudents([]); setMarks({}); return }
    setLoading(true); setSavedAt(null)
    fetch(`/api/attendance?lessonId=${encodeURIComponent(selectedLessonId)}`)
      .then((r) => r.json())
      .then((d) => {
        setStudents(d.students || [])
        const existing: Record<string, AttendanceRecord> = {}
        for (const r of (d.records || []) as AttendanceRecord[]) existing[r.student_email] = r
        const next: AttMarks = {}
        for (const s of (d.students || []) as AttStudent[]) {
          const r = existing[s.email]
          next[s.email] = { status: (r?.status as AttStatus) || 'absent', notes: r?.notes || '' }
        }
        setMarks(next)
      })
      .catch(() => setError('Failed to load roster'))
      .finally(() => setLoading(false))
  }, [selectedLessonId])

  const onSetStatus = (email: string, s: AttStatus) => { setMarks((prev) => ({ ...prev, [email]: { ...prev[email], status: s } })); setSavedAt(null) }
  const onSetNotes = (email: string, n: string) => { setMarks((prev) => ({ ...prev, [email]: { ...prev[email], notes: n } })); setSavedAt(null) }
  const onMarkAllPresent = () => {
    setMarks((prev) => { const next = { ...prev }; for (const s of students) next[s.email] = { ...next[s.email], status: 'present' }; return next })
    setSavedAt(null)
  }
  const onSave = async () => {
    if (!selectedLessonId) return
    setSaving(true); setError('')
    try {
      const records = students.map((s) => ({ student_email: s.email, status: marks[s.email]?.status || 'absent', notes: marks[s.email]?.notes?.trim() || null }))
      const res = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: selectedLessonId, records }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Save failed')
      setSavedAt(body.marked_at)
    } catch (e) { setError((e as Error).message || 'Save failed') }
    setSaving(false)
  }

  if (authStatus === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  return (
    <AttendanceView
      courses={courses} selectedCourseId={selectedCourseId} onSelectCourse={setSelectedCourseId}
      lessons={lessons} selectedLessonId={selectedLessonId} onSelectLesson={setSelectedLessonId}
      students={students} marks={marks}
      loading={authStatus === 'loading' || (loading && courses.length === 0) || (!!selectedLessonId && loading)}
      saving={saving} savedAt={savedAt} error={error}
      onSetStatus={onSetStatus} onSetNotes={onSetNotes} onMarkAllPresent={onMarkAllPresent} onSave={onSave}
    />
  )
}
