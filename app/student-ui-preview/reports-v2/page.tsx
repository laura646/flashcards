'use client'

// Wave 0 verification harness — redesigned Reports with sample data.
// Not linked; delete on sign-off.

import ReportsView, { StudentReport } from '@/components/admin-v2/ReportsView'

const STUDENTS: StudentReport[] = [
  {
    email: 'marek@acme.com', name: 'Marek Novak', cefr: 'B2',
    completionPct: 90, attendancePct: 95, avgLatestPct: 82, streak: 12, vocabFocus: 3,
    aiSummary: 'Marek is progressing steadily at B2. Vocabulary is a real strength (88%), but listening lags (64%) — a little more dictation would help. Excellent attendance and a 12-day streak show strong, consistent practice.',
    skills: [{ label: 'Vocabulary', pct: 88 }, { label: 'Grammar', pct: 80 }, { label: 'Reading', pct: 83 }, { label: 'Listening', pct: 64 }],
    trend: [60, 72, 68, 80, 84, 90],
    vocab: [3, 5, 6, 8, 12],
    attendance: [{ lesson: 'L4', status: 'present' }, { lesson: 'L3', status: 'present' }, { lesson: 'L2', status: 'late' }, { lesson: 'L1', status: 'present' }],
    tests: [{ title: 'Mid-course test', type: 'mid_course', score: 78 }, { title: 'Review test', type: 'review', score: 85 }],
    notes: [{ tag: 'Vocabulary', author: 'Laura', text: 'Great progress on business idioms — keep nudging listening.' }],
  },
  {
    email: 'sofia@acme.com', name: 'Sofia Ruiz', cefr: 'B1',
    completionPct: 60, attendancePct: 80, avgLatestPct: 74, streak: 4, vocabFocus: 6,
    aiSummary: 'Sofia is solid at B1 with good grammar gains. Scores dipped on the last two exercises — a quick review of past tenses would help. Encourage more regular practice to rebuild her streak.',
    skills: [{ label: 'Grammar', pct: 82 }, { label: 'Vocabulary', pct: 75 }, { label: 'Reading', pct: 70 }, { label: 'Listening', pct: 68 }],
    trend: [70, 76, 74, 72, 68, 71],
    vocab: [6, 7, 4, 3, 2],
    attendance: [{ lesson: 'L4', status: 'present' }, { lesson: 'L3', status: 'absent' }, { lesson: 'L2', status: 'present' }, { lesson: 'L1', status: 'late' }],
    tests: [{ title: 'Mid-course test', type: 'mid_course', score: 70 }],
    notes: [{ tag: 'Grammar', author: 'Laura', text: 'Confident speaker; needs reps on tense accuracy.' }],
  },
]

export default function ReportsV2Preview() {
  return <ReportsView courseName="Business English" students={STUDENTS} onRegenerate={() => {}} />
}
