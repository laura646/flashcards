'use client'

// Wave 0 verification harness — the redesigned Course Detail screen with
// sample data (viewable without a login). Not linked; delete on sign-off.
// All callbacks are async no-ops returning {ok:true} so the tabs, edit
// form, save flow and telegram test can be exercised by hand.

import CourseDetailView, {
  CourseDetailData,
  CourseStudentRow,
  CourseLessonRow,
} from '@/components/admin-v2/CourseDetailView'

const MOCK_COURSE: CourseDetailData = {
  id: 'course-1',
  name: 'Business English',
  description: 'B2 professionals — negotiations, meetings, email writing.',
  invite_code: 'BIZB2',
  created_at: '2026-01-12T09:00:00.000Z',
  course_type: 'Group',
  level: 'B2',
  telegram_chat_id: '-1001234567890',
  archived_at: null,
}

const MOCK_STUDENTS: CourseStudentRow[] = [
  { email: 'aiko@example.com', name: 'Aiko Tanaka', level: 'B2', blocked: false, total_sessions: 42, last_activity: '2026-06-19T20:15:00.000Z' },
  { email: 'marco@example.com', name: 'Marco Rossi', level: 'B1', blocked: false, total_sessions: 17, last_activity: '2026-06-15T08:00:00.000Z' },
  { email: 'lena@example.com', name: 'Lena Vogt', level: 'B2', blocked: true, total_sessions: 3, last_activity: null },
]

const MOCK_LESSONS: CourseLessonRow[] = [
  { id: 'l1', title: 'Negotiation phrases', status: 'published', template_category: 'Speaking', template_level: 'B2', is_template: false, created_at: '2026-06-10T09:00:00.000Z' },
  { id: 'l2', title: 'Email tone & register', status: 'draft', template_category: 'Writing', template_level: 'B2', is_template: true, created_at: '2026-06-05T09:00:00.000Z' },
  { id: 'l3', title: 'Meeting small talk', status: 'published', template_category: null, template_level: null, is_template: false, created_at: '2026-05-28T09:00:00.000Z' },
]

export default function CourseDetailV2Preview() {
  return (
    <CourseDetailView
      course={MOCK_COURSE}
      students={MOCK_STUDENTS}
      lessons={MOCK_LESSONS}
      loading={false}
      onBack={() => console.log('back')}
      onOpenLesson={(id) => console.log('open lesson', id)}
      onOpenStudent={(email) => console.log('open student', email)}
      onCreateLesson={() => console.log('create lesson')}
      onSaveCourse={async (form) => { console.log('save course', form); return { ok: true } }}
      onSendTelegramTest={async () => { console.log('telegram test'); return { ok: true } }}
      onArchive={async () => { console.log('archive'); return { ok: true } }}
      onRestore={async () => { console.log('restore'); return { ok: true } }}
    />
  )
}
