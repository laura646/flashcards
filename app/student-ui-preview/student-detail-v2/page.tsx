'use client'

// Wave 0 verification harness — redesigned Student DETAIL with sample data.
// Not linked; delete on sign-off. All callbacks resolve {ok:true} so the
// edit/save/notes/reminder flows are exercisable against mock data.

import StudentDetailView, { StudentDetailData, ProgressRow } from '@/components/admin-v2/StudentDetailView'

const MOCK_STUDENT: StudentDetailData = {
  email: 'marek@acme.com',
  name: 'Marek Novak',
  created_at: '2025-09-12T09:00:00.000Z',
  level: 'Intermediate Low',
  learning_goals: 'Sound confident in client calls and write clearer status emails.',
  company: 'Acme',
  common_issues_tags: ['Reported speech backshift errors', 'Overuses "get" as general verb'],
  common_issues_comments: 'Strong vocab, but tense control slips under time pressure.',
  blocked: false,
  notes: 'Prefers evening sessions. Misses Mondays — confirm the day before.',
  courses: [
    { id: '1', name: 'Business English' },
    { id: '2', name: 'Conversation Club' },
  ],
}

const MOCK_PROGRESS: ProgressRow[] = [
  { id: 'p1', activity_type: 'flashcard', activity_id: 'Phrasal Verbs A', score: null, total: null, completed_at: '2026-06-18T18:20:00.000Z' },
  { id: 'p2', activity_type: 'exercise', activity_id: '42', score: 8, total: 10, completed_at: '2026-06-16T17:05:00.000Z' },
  { id: 'p3', activity_type: 'flashcard', activity_id: 'Business Idioms', score: 12, total: 15, completed_at: '2026-06-14T20:40:00.000Z' },
  { id: 'p4', activity_type: 'exercise', activity_id: '37', score: 5, total: 5, completed_at: '2026-06-11T16:00:00.000Z' },
  { id: 'p5', activity_type: 'exercise', activity_id: '31', score: null, total: null, completed_at: '2026-06-08T19:15:00.000Z' },
]

export default function StudentDetailV2Preview() {
  return (
    <StudentDetailView
      student={MOCK_STUDENT}
      progress={MOCK_PROGRESS}
      loading={false}
      onBack={() => {}}
      onSaveProfile={async () => ({ ok: true })}
      onSaveNotes={async () => ({ ok: true })}
      onSendReminder={async () => ({ ok: true })}
    />
  )
}
