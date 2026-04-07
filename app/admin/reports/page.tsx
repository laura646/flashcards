'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts'

// Role-based admin check

interface Student {
  email: string
  name: string
  created_at: string
  last_activity: string | null
  total_sessions: number
  avg_quiz_score: number | null
  exercises_done: number
  mandatory_done: number
  bonus_done: number
  mandatory_total: number
  bonus_total: number
  flashcard_modes: number
  blocked: boolean
  notes: string
  assigned_sets: string[]
}

interface ProgressRecord {
  id: string
  user_email: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
}

interface WordStruggle {
  id: string
  user_email: string
  word: string
  activity_type: string
  knew: boolean
  created_at: string
}

type ReportView = 'overview' | 'student'

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [allProgress, setAllProgress] = useState<ProgressRecord[]>([])
  const [allWordStruggles, setAllWordStruggles] = useState<WordStruggle[]>([])
  const [loading, setLoading] = useState(true)
  const [reportView, setReportView] = useState<ReportView>('overview')
  const [selectedEmail, setSelectedEmail] = useState<string>('')
  const [studentProgress, setStudentProgress] = useState<ProgressRecord[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsRes, wordStrugglesRes] = await Promise.all([
        fetch('/api/admin?action=students'),
        fetch('/api/word-struggles'),
      ])
      const studentsData = await studentsRes.json()
      const wordStrugglesData = await wordStrugglesRes.json()
      setStudents(studentsData.students || [])
      setAllWordStruggles(wordStrugglesData.struggles || [])

      // Load all progress for all students
      const progressPromises = (studentsData.students || []).map((s: Student) =>
        fetch(`/api/admin?action=student-detail&email=${encodeURIComponent(s.email)}`)
          .then(r => r.json())
          .then(d => (d.progress || []) as ProgressRecord[])
      )
      const allProgressArrays = await Promise.all(progressPromises)
      setAllProgress(allProgressArrays.flat())
    } catch {
      // Non-blocking
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) loadData()
  }, [status, isAdmin, loadData])

  useEffect(() => {
    if (selectedEmail) {
      setStudentProgress(allProgress.filter(p => p.user_email === selectedEmail))
    }
  }, [selectedEmail, allProgress])

  // ── Data Processing ──

  const getQuizTrends = (progress: ProgressRecord[]) => {
    return progress
      .filter(p => p.activity_id === 'quiz' && p.score !== null && p.total)
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
      .map((p, i) => ({
        session: i + 1,
        date: new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        score: Math.round(((p.score ?? 0) / (p.total ?? 1)) * 100),
        student: students.find(s => s.email === p.user_email)?.name || p.user_email,
      }))
  }

  const getSelfAssessTrends = (progress: ProgressRecord[]) => {
    return progress
      .filter(p => p.activity_id === 'self-assess' && p.score !== null && p.total)
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
      .map((p, i) => ({
        session: i + 1,
        date: new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        knewPct: Math.round(((p.score ?? 0) / (p.total ?? 1)) * 100),
        struggledPct: 100 - Math.round(((p.score ?? 0) / (p.total ?? 1)) * 100),
        student: students.find(s => s.email === p.user_email)?.name || p.user_email,
      }))
  }

  const getExerciseScores = (progress: ProgressRecord[]) => {
    const exercises = ['1', '2', '3', '4', '5']
    const exerciseNames = ['Prepositions', 'Correct Mistake', 'Past Simple', 'Past Simple Verbs', 'Complete Story']
    return exercises.map((id, i) => {
      const records = progress.filter(p => p.activity_type === 'exercise' && p.activity_id === id && p.score !== null)
      const avgScore = records.length > 0
        ? Math.round(records.reduce((sum, r) => sum + ((r.score ?? 0) / (r.total ?? 1)) * 100, 0) / records.length)
        : 0
      return {
        name: exerciseNames[i],
        avgScore,
        attempts: records.length,
      }
    })
  }

  const getActivityBreakdown = (progress: ProgressRecord[]) => {
    const flip = progress.filter(p => p.activity_id === 'flip').length
    const selfAssess = progress.filter(p => p.activity_id === 'self-assess').length
    const quiz = progress.filter(p => p.activity_id === 'quiz').length
    const exercises = progress.filter(p => p.activity_type === 'exercise').length
    return [
      { name: 'Flip', value: flip, color: '#416ebe' },
      { name: 'Self-Assess', value: selfAssess, color: '#00aff0' },
      { name: 'Quiz', value: quiz, color: '#34d399' },
      { name: 'Exercises', value: exercises, color: '#f59e0b' },
    ].filter(d => d.value > 0)
  }

  const getStruggleIndicators = (progress: ProgressRecord[]) => {
    // Self-assess sessions with low "knew it" percentage
    const selfAssess = progress
      .filter(p => p.activity_id === 'self-assess' && p.score !== null && p.total)
      .map(p => ({
        student: students.find(s => s.email === p.user_email)?.name || p.user_email,
        email: p.user_email,
        knewPct: Math.round(((p.score ?? 0) / (p.total ?? 1)) * 100),
        struggled: (p.total ?? 0) - (p.score ?? 0),
        total: p.total ?? 0,
        date: new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      }))
      .sort((a, b) => a.knewPct - b.knewPct)

    // Low quiz scores
    const quizzes = progress
      .filter(p => p.activity_id === 'quiz' && p.score !== null && p.total)
      .map(p => ({
        student: students.find(s => s.email === p.user_email)?.name || p.user_email,
        email: p.user_email,
        scorePct: Math.round(((p.score ?? 0) / (p.total ?? 1)) * 100),
        score: p.score ?? 0,
        total: p.total ?? 0,
        date: new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      }))
      .sort((a, b) => a.scorePct - b.scorePct)

    // Low exercise scores
    const exerciseScores = progress
      .filter(p => p.activity_type === 'exercise' && p.score !== null && p.total)
      .map(p => {
        const exerciseNames: Record<string, string> = {
          '1': 'Prepositions', '2': 'Correct the Mistake', '3': 'Past Simple',
          '4': 'Past Simple Verbs', '5': 'Complete the Story',
        }
        return {
          student: students.find(s => s.email === p.user_email)?.name || p.user_email,
          email: p.user_email,
          exercise: exerciseNames[p.activity_id] || `Exercise ${p.activity_id}`,
          scorePct: Math.round(((p.score ?? 0) / (p.total ?? 1)) * 100),
          score: p.score ?? 0,
          total: p.total ?? 0,
          date: new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        }
      })
      .sort((a, b) => a.scorePct - b.scorePct)

    return { selfAssess, quizzes, exerciseScores }
  }

  const getMostStruggledWords = (wordStruggles: WordStruggle[]) => {
    const wordMap = new Map<string, { total: number; wrong: number; students: Set<string> }>()

    wordStruggles.forEach(ws => {
      const existing = wordMap.get(ws.word) || { total: 0, wrong: 0, students: new Set<string>() }
      existing.total++
      if (!ws.knew) existing.wrong++
      existing.students.add(ws.user_email)
      wordMap.set(ws.word, existing)
    })

    return Array.from(wordMap.entries())
      .map(([word, data]) => ({
        word,
        total: data.total,
        wrong: data.wrong,
        correct: data.total - data.wrong,
        errorRate: Math.round((data.wrong / data.total) * 100),
        studentCount: data.students.size,
        students: Array.from(data.students).map(email =>
          students.find(s => s.email === email)?.name || email
        ),
      }))
      .filter(w => w.wrong > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
  }

  // ── Export Functions ──

  const exportCSV = () => {
    const progressData = reportView === 'student' ? studentProgress : allProgress
    const sheets: string[] = []

    // Sheet 1: Session Progress
    const progressRows = [
      ['=== SESSION PROGRESS ==='],
      ['Student Name', 'Email', 'Activity Type', 'Activity', 'Score', 'Total', 'Percentage', 'Date', 'Teacher Notes'],
    ]

    progressData.forEach(p => {
      const student = students.find(s => s.email === p.user_email)
      const activityNames: Record<string, string> = {
        flip: 'Flashcards: Flip',
        'self-assess': 'Flashcards: Self-Assess',
        quiz: 'Flashcards: Quiz',
      }
      const activityName = p.activity_type === 'flashcard'
        ? (activityNames[p.activity_id] || p.activity_id)
        : `Exercise ${p.activity_id}`
      const pct = p.score !== null && p.total ? `${Math.round((p.score / p.total) * 100)}%` : ''
      const notes = (student?.notes || '').replace(/"/g, '""')

      progressRows.push([
        student?.name || '',
        p.user_email,
        p.activity_type,
        activityName,
        p.score !== null ? String(p.score) : '',
        p.total !== null ? String(p.total) : '',
        pct,
        new Date(p.completed_at).toLocaleString('en-GB', { timeZone: 'Asia/Yerevan' }),
        `"${notes}"`,
      ])
    })
    sheets.push(progressRows.map(r => r.join(',')).join('\n'))

    // Sheet 2: Most Struggled Words
    if (mostStruggledWords.length > 0) {
      const wordRows = [
        [''],
        ['=== MOST STRUGGLED WORDS ==='],
        ['Rank', 'Word', 'Error Rate', 'Times Wrong', 'Times Tested', 'Students'],
      ]
      mostStruggledWords.forEach((w, i) => {
        wordRows.push([
          String(i + 1),
          w.word,
          `${w.errorRate}%`,
          String(w.wrong),
          String(w.total),
          `"${w.students.join(', ')}"`,
        ])
      })
      sheets.push(wordRows.map(r => r.join(',')).join('\n'))
    }

    // Sheet 3: Teacher Notes
    const notesStudents = reportView === 'student'
      ? students.filter(s => s.email === selectedEmail && s.notes)
      : students.filter(s => s.notes)
    if (notesStudents.length > 0) {
      const noteRows = [
        [''],
        ['=== TEACHER NOTES ==='],
        ['Student Name', 'Email', 'Notes'],
      ]
      notesStudents.forEach(s => {
        noteRows.push([s.name || '', s.email, `"${(s.notes || '').replace(/"/g, '""')}"`])
      })
      sheets.push(noteRows.map(r => r.join(',')).join('\n'))
    }

    const csv = sheets.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const studentName = reportView === 'student'
      ? students.find(s => s.email === selectedEmail)?.name || 'student'
      : 'all-students'
    a.download = `report-${studentName}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    window.print()
  }

  // ── Rendering ──

  const selectedStudent = students.find(s => s.email === selectedEmail)
  const currentProgress = reportView === 'student' ? studentProgress : allProgress
  const currentWordStruggles = reportView === 'student'
    ? allWordStruggles.filter(ws => ws.user_email === selectedEmail)
    : allWordStruggles
  const quizTrends = getQuizTrends(currentProgress)
  const selfAssessTrends = getSelfAssessTrends(currentProgress)
  const exerciseScores = getExerciseScores(currentProgress)
  const activityBreakdown = getActivityBreakdown(currentProgress)
  const struggles = getStruggleIndicators(currentProgress)
  const mostStruggledWords = getMostStruggledWords(currentWordStruggles)

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading reports...</div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-[#46464b] mb-2">Access Denied</h1>
          <button onClick={() => router.push('/home')} className="mt-4 text-sm text-[#416ebe] hover:underline">&larr; Go home</button>
        </div>
      </main>
    )
  }

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <main className="min-h-screen bg-[#f7fafd] px-4 py-6">
        <div className="max-w-5xl mx-auto print-area" ref={printRef}>

          {/* Header */}
          <div className="flex items-center justify-between mb-6 no-print">
            <div>
              <button onClick={() => router.push('/admin')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1">
                &larr; Admin Console
              </button>
              <h1 className="text-2xl font-bold text-[#416ebe]">Progress & Reports</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="px-4 py-2 bg-white border border-[#cddcf0] text-[#416ebe] text-xs font-bold rounded-lg hover:border-[#416ebe] transition-colors"
              >
                📊 Export CSV
              </button>
              <button
                onClick={exportPDF}
                className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
              >
                📄 Print / PDF
              </button>
            </div>
          </div>

          {/* Print header */}
          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold text-[#416ebe]">English with Laura — Progress Report</h1>
            <p className="text-xs text-gray-400">
              Generated on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {selectedStudent && ` — ${selectedStudent.name}`}
            </p>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-6 no-print">
            <button
              onClick={() => { setReportView('overview'); setSelectedEmail('') }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                reportView === 'overview'
                  ? 'bg-[#416ebe] text-white'
                  : 'bg-white border border-[#cddcf0] text-[#46464b] hover:border-[#416ebe]'
              }`}
            >
              All Students
            </button>
            <select
              value={selectedEmail}
              onChange={(e) => {
                setSelectedEmail(e.target.value)
                setReportView(e.target.value ? 'student' : 'overview')
              }}
              className="px-4 py-2 bg-white border border-[#cddcf0] rounded-lg text-xs text-[#46464b] focus:outline-none focus:border-[#416ebe]"
            >
              <option value="">Select a student...</option>
              {students.map(s => (
                <option key={s.email} value={s.email}>{s.name || s.email}</option>
              ))}
            </select>
          </div>

          {/* Student info card (when viewing individual) */}
          {reportView === 'student' && selectedStudent && (
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#46464b]">{selectedStudent.name}</h2>
                  <p className="text-xs text-gray-400">{selectedStudent.email}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Joined {new Date(selectedStudent.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[#416ebe]">{selectedStudent.total_sessions}</p>
                    <p className="text-[10px] text-gray-400">sessions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#416ebe]">{selectedStudent.avg_quiz_score ?? '—'}%</p>
                    <p className="text-[10px] text-gray-400">avg quiz</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#416ebe]">{selectedStudent.mandatory_done}/{selectedStudent.mandatory_total}</p>
                    <p className="text-[10px] text-gray-400">required</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{selectedStudent.bonus_done}/{selectedStudent.bonus_total}</p>
                    <p className="text-[10px] text-gray-400">bonus</p>
                  </div>
                </div>
              </div>
              {/* Teacher notes in report */}
              {selectedStudent.notes && (
                <div className="mt-4 pt-4 border-t border-[#e6f0fa]">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Teacher Notes</p>
                  <p className="text-sm text-[#46464b] whitespace-pre-line">{selectedStudent.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════ QUIZ SCORE TRENDS ══════════ */}
          <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
            <h3 className="font-bold text-[#46464b] mb-4">Quiz Score Trends</h3>
            {quizTrends.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No quiz data yet</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={quizTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6f0fa" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`${value}%`, 'Score']}
                      labelFormatter={(label) => {
                        const item = quizTrends.find(q => q.date === label)
                        return reportView === 'overview' && item ? `${item.student} — ${label}` : label
                      }}
                      contentStyle={{ borderRadius: 8, border: '1px solid #cddcf0', fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#416ebe"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#416ebe' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ══════════ SELF-ASSESS TRENDS ══════════ */}
          <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
            <h3 className="font-bold text-[#46464b] mb-1">Self-Assessment Trends</h3>
            <p className="text-xs text-gray-400 mb-4">Shows what percentage of words were known vs. still learning</p>
            {selfAssessTrends.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No self-assessment data yet</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selfAssessTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6f0fa" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [
                        `${value}%`,
                        name === 'knewPct' ? 'Knew it' : 'Still learning',
                      ]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #cddcf0', fontSize: 12 }}
                    />
                    <Legend
                      formatter={(value) => (value === 'knewPct' ? 'Knew it' : 'Still learning')}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="knewPct" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="struggledPct" stackId="a" fill="#fca5a5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* ══════════ EXERCISE SCORES ══════════ */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5">
              <h3 className="font-bold text-[#46464b] mb-4">Exercise Performance</h3>
              {exerciseScores.every(e => e.attempts === 0) ? (
                <p className="text-sm text-gray-400 text-center py-8">No exercise data yet</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={exerciseScores.filter(e => e.attempts > 0)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6f0fa" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#888' }} width={110} />
                      <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`${value}%`, 'Avg Score']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #cddcf0', fontSize: 12 }}
                      />
                      <Bar dataKey="avgScore" fill="#416ebe" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ══════════ ACTIVITY BREAKDOWN ══════════ */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5">
              <h3 className="font-bold text-[#46464b] mb-4">Activity Breakdown</h3>
              {activityBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No activity data yet</p>
              ) : (
                <div className="h-56 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activityBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {activityBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [`${value} sessions`, name]}
                        contentStyle={{ borderRadius: 8, border: '1px solid #cddcf0', fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ══════════ MOST STRUGGLED WORDS ══════════ */}
          <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
            <h3 className="font-bold text-[#46464b] mb-1">Most Struggled Words</h3>
            <p className="text-xs text-gray-400 mb-4">Words with the highest error rate across quiz and self-assess activities</p>
            {mostStruggledWords.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📝</div>
                <p className="text-sm text-gray-400">No word-level data yet. Students need to complete quiz or self-assess sessions.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mostStruggledWords.slice(0, 15).map((w, i) => (
                  <div key={w.word} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-6 text-center ${
                      i < 3 ? 'text-red-500' : i < 6 ? 'text-orange-400' : 'text-gray-400'
                    }`}>
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-[#46464b]">{w.word}</span>
                        <span className={`text-xs font-bold ${
                          w.errorRate >= 60 ? 'text-red-500' : w.errorRate >= 40 ? 'text-orange-400' : 'text-yellow-500'
                        }`}>
                          {w.errorRate}% error rate
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#e6f0fa] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              w.errorRate >= 60 ? 'bg-red-400' : w.errorRate >= 40 ? 'bg-orange-300' : 'bg-yellow-300'
                            }`}
                            style={{ width: `${w.errorRate}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {w.wrong}/{w.total} wrong
                          {reportView === 'overview' && w.studentCount > 1 && ` (${w.studentCount} students)`}
                        </span>
                      </div>
                      {reportView === 'overview' && w.studentCount <= 3 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {w.students.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══════════ STRUGGLE AREAS ══════════ */}
          <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4 print-break">
            <h3 className="font-bold text-[#46464b] mb-1">Areas Needing Attention</h3>
            <p className="text-xs text-gray-400 mb-4">Sessions with scores below 70% — sorted from lowest</p>

            {/* Low quiz scores */}
            {struggles.quizzes.filter(q => q.scorePct < 70).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#416ebe] uppercase tracking-wider mb-2">Quiz Scores Below 70%</p>
                <div className="space-y-1">
                  {struggles.quizzes.filter(q => q.scorePct < 70).map((q, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-red-50">
                      <div>
                        {reportView === 'overview' && (
                          <span className="font-bold text-[#46464b] mr-2">{q.student}</span>
                        )}
                        <span className="text-gray-400">{q.date}</span>
                      </div>
                      <span className="font-bold text-red-500">{q.score}/{q.total} ({q.scorePct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low self-assess scores */}
            {struggles.selfAssess.filter(s => s.knewPct < 70).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#416ebe] uppercase tracking-wider mb-2">Self-Assess: Knew Less Than 70%</p>
                <div className="space-y-1">
                  {struggles.selfAssess.filter(s => s.knewPct < 70).map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-orange-50">
                      <div>
                        {reportView === 'overview' && (
                          <span className="font-bold text-[#46464b] mr-2">{s.student}</span>
                        )}
                        <span className="text-gray-400">{s.date}</span>
                      </div>
                      <span className="font-bold text-orange-500">
                        Knew {s.knewPct}% — struggled with {s.struggled}/{s.total} words
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low exercise scores */}
            {struggles.exerciseScores.filter(e => e.scorePct < 70).length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#416ebe] uppercase tracking-wider mb-2">Exercise Scores Below 70%</p>
                <div className="space-y-1">
                  {struggles.exerciseScores.filter(e => e.scorePct < 70).map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-red-50">
                      <div>
                        {reportView === 'overview' && (
                          <span className="font-bold text-[#46464b] mr-2">{e.student}</span>
                        )}
                        <span className="text-gray-500 mr-2">{e.exercise}</span>
                        <span className="text-gray-400">{e.date}</span>
                      </div>
                      <span className="font-bold text-red-500">{e.score}/{e.total} ({e.scorePct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {struggles.quizzes.filter(q => q.scorePct < 70).length === 0 &&
             struggles.selfAssess.filter(s => s.knewPct < 70).length === 0 &&
             struggles.exerciseScores.filter(e => e.scorePct < 70).length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🌟</div>
                <p className="text-sm text-gray-400">No areas of concern — all scores are above 70%!</p>
              </div>
            )}
          </div>

          {/* ══════════ TEACHER NOTES (in print/report) ══════════ */}
          {reportView === 'overview' && students.some(s => s.notes) && (
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
              <h3 className="font-bold text-[#46464b] mb-4">Teacher Notes — All Students</h3>
              <div className="divide-y divide-[#e6f0fa]">
                {students.filter(s => s.notes).map(s => (
                  <div key={s.email} className="py-3">
                    <p className="text-sm font-bold text-[#46464b]">{s.name}</p>
                    <p className="text-xs text-gray-400 mb-1">{s.email}</p>
                    <p className="text-sm text-[#46464b] whitespace-pre-line">{s.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
