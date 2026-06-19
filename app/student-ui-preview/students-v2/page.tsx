'use client'

// Wave 0 verification harness — redesigned Students with sample data.
// Not linked; delete on sign-off.

import { useState } from 'react'
import StudentsView, { StudentSummary } from '@/components/admin-v2/StudentsView'

const MOCK: StudentSummary[] = [
  { email: 'marek@acme.com', name: 'Marek Novak', level: 'B2', company: 'Acme', blocked: false, courses: [{ course_id: '1', course_name: 'Business English' }] },
  { email: 'sofia@acme.com', name: 'Sofia Ruiz', level: 'B1', company: 'Acme', blocked: false, courses: [{ course_id: '1', course_name: 'Business English' }, { course_id: '2', course_name: 'Conversation Club' }] },
  { email: 'tom.k@globex.com', name: 'Tom Keller', level: 'C1', company: 'Globex', blocked: false, courses: [{ course_id: '3', course_name: 'IELTS Prep' }] },
  { email: 'aiko@nori.jp', name: 'Aiko Mori', level: 'B2', company: null, blocked: true, courses: [{ course_id: '2', course_name: 'Conversation Club' }] },
]

export default function StudentsV2Preview() {
  const [opened, setOpened] = useState('')
  return (
    <>
      <StudentsView students={MOCK} loading={false} onOpenStudent={setOpened} />
      {opened && <p className="font-rubik text-center text-xs text-ink-muted pb-4">opened: {opened}</p>}
    </>
  )
}
