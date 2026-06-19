'use client'

// Wave 0 verification harness — redesigned Attendance with sample data + live
// status toggling. Not linked; delete on sign-off.

import { useState } from 'react'
import AttendanceView, { AttStatus, AttMarks } from '@/components/admin-v2/AttendanceView'

const STUDENTS = [
  { email: 'marek@acme.com', name: 'Marek Novak' },
  { email: 'sofia@acme.com', name: 'Sofia Ruiz' },
  { email: 'tom.k@globex.com', name: 'Tom Keller' },
  { email: 'aiko@nori.jp', name: 'Aiko Mori' },
]

export default function AttendanceV2Preview() {
  const [marks, setMarks] = useState<AttMarks>({
    'marek@acme.com': { status: 'present', notes: '' },
    'sofia@acme.com': { status: 'late', notes: 'joined 10 min late' },
    'tom.k@globex.com': { status: 'absent', notes: '' },
    'aiko@nori.jp': { status: 'excused', notes: 'sick' },
  })
  return (
    <AttendanceView
      courses={[{ id: '1', name: 'Business English' }]}
      selectedCourseId="1"
      onSelectCourse={() => {}}
      lessons={[{ id: 'l1', title: 'Lesson 4 — Negotiations', lesson_date: '2026-06-12' }]}
      selectedLessonId="l1"
      onSelectLesson={() => {}}
      students={STUDENTS}
      marks={marks}
      loading={false}
      saving={false}
      savedAt={null}
      error=""
      onSetStatus={(email, s: AttStatus) => setMarks((m) => ({ ...m, [email]: { ...m[email], status: s } }))}
      onSetNotes={(email, n) => setMarks((m) => ({ ...m, [email]: { ...m[email], notes: n } }))}
      onMarkAllPresent={() => setMarks((m) => { const x = { ...m }; STUDENTS.forEach((s) => (x[s.email] = { ...x[s.email], status: 'present' })); return x })}
      onSave={() => {}}
    />
  )
}
