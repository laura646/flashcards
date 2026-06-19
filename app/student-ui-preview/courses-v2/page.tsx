'use client'

// Wave 0 verification harness — the redesigned Courses screen with sample
// data (so it's viewable without a login). Not linked; delete on sign-off.

import { useState } from 'react'
import CoursesView, { CourseSummary } from '@/components/admin-v2/CoursesView'

const MOCK: CourseSummary[] = [
  { id: '1', name: 'Business English', description: 'B2 professionals — negotiations, meetings, email writing.', course_type: 'Group', level: 'B2', student_count: 8, lesson_count: 12 },
  { id: '2', name: 'Conversation Club', description: 'Relaxed weekly speaking practice for B1 learners.', course_type: 'Group', level: 'B1', student_count: 5, lesson_count: 7 },
  { id: '3', name: 'IELTS Prep — Aiko', description: '1-to-1 intensive, target band 7.', course_type: '1:1', level: 'C1', student_count: 1, lesson_count: 20 },
]

export default function CoursesV2Preview() {
  const [opened, setOpened] = useState('')
  return (
    <>
      <CoursesView courses={MOCK} loading={false} onOpenCourse={setOpened} onNewCourse={() => setOpened('new course')} />
      {opened && <p className="font-rubik text-center text-xs text-ink-muted pb-4">clicked: {opened}</p>}
    </>
  )
}
