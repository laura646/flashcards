'use client'

// Wave 0 verification harness — the redesigned Courses screen with sample
// data (so it's viewable without a login). Not linked; delete on sign-off.

import { useState } from 'react'
import CoursesView, { CourseSummary } from '@/components/admin-v2/CoursesView'

const MOCK: CourseSummary[] = [
  { id: '1', name: 'Business English', description: 'B2 professionals — negotiations, meetings, email writing.', invite_code: 'BIZ-2026', course_type: 'Group', level: 'B2', archived_at: null, created_at: '2026-03-01T09:00:00Z', student_count: 8, lesson_count: 12, trainers: [{ email: 'laura@englishwithlaura.com', name: 'Laura' }], student_emails: ['mei@example.com', 'tom@example.com'] },
  { id: '2', name: 'Conversation Club', description: 'Relaxed weekly speaking practice for B1 learners.', invite_code: 'CHAT-B1', course_type: 'Group', level: 'B1', archived_at: null, created_at: '2026-05-12T09:00:00Z', student_count: 5, lesson_count: 7, trainers: [{ email: 'laura@englishwithlaura.com', name: 'Laura' }, { email: 'sam@englishwithlaura.com', name: 'Sam' }], student_emails: ['aiko@example.com'] },
  { id: '3', name: 'IELTS Prep — Aiko', description: '1-to-1 intensive, target band 7.', invite_code: 'IELTS-AIKO', course_type: '1:1', level: 'C1', archived_at: null, created_at: '2026-01-20T09:00:00Z', student_count: 1, lesson_count: 20, trainers: [{ email: 'sam@englishwithlaura.com', name: 'Sam' }], student_emails: ['aiko@example.com'] },
  { id: '4', name: 'Beginners A1 (2025)', description: 'Last year’s starter cohort — wrapped up.', invite_code: 'A1-2025', course_type: 'Group', level: 'A1', archived_at: '2025-12-15T09:00:00Z', created_at: '2025-09-01T09:00:00Z', student_count: 0, lesson_count: 10, trainers: [{ email: 'laura@englishwithlaura.com', name: 'Laura' }], student_emails: [] },
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
