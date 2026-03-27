'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import SignOutButton from '@/components/SignOutButton'
import { useRouter } from 'next/navigation'

// Role-based admin check (superadmin or teacher)

// Available content sets (will grow when flashcard management is built)
const AVAILABLE_SETS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Business English', 'Phrasal Verbs', 'Travel']

interface Overview {
  total_students: number
  total_sessions: number
  recent_sessions: number
  active_this_week: number
  recent_activity: RecentActivity[]
}

interface RecentActivity {
  student_name: string
  student_email: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
}

interface Student {
  email: string
  name: string
  created_at: string
  last_activity: string | null
  total_sessions: number
  avg_quiz_score: number | null
  exercises_done: number
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

type View = 'dashboard' | 'students' | 'student-detail'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [view, setView] = useState<View>('dashboard')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [studentProgress, setStudentProgress] = useState<ProgressRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Student management state
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderMessage, setReminderMessage] = useState('')
  const [reminderSending, setReminderSending] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
    }
  }, [status, router])

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, studentsRes] = await Promise.all([
        fetch('/api/admin?action=overview'),
        fetch('/api/admin?action=students'),
      ])
      const overviewData = await overviewRes.json()
      const studentsData = await studentsRes.json()
      setOverview(overviewData.overview)
      setStudents(studentsData.students || [])
    } catch {
      // Non-blocking
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      loadDashboard()
    }
  }, [status, isAdmin, loadDashboard])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadStudentDetail = async (student: Student) => {
    setSelectedStudent(student)
    setNotes(student.notes || '')
    setNotesSaved(false)
    setView('student-detail')
    try {
      const res = await fetch(`/api/admin?action=student-detail&email=${encodeURIComponent(student.email)}`)
      const data = await res.json()
      setStudentProgress(data.progress || [])
      if (data.user) {
        setNotes(data.user.notes || '')
      }
    } catch {
      setStudentProgress([])
    }
  }

  // ── Actions ──

  const toggleBlock = async () => {
    if (!selectedStudent) return
    setActionLoading(true)
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-block',
          email: selectedStudent.email,
          blocked: !selectedStudent.blocked,
        }),
      })
      setSelectedStudent({ ...selectedStudent, blocked: !selectedStudent.blocked })
      showToast(selectedStudent.blocked ? 'Student unblocked' : 'Student blocked')
      loadDashboard()
    } catch {
      showToast('Failed to update')
    }
    setActionLoading(false)
  }


  const saveNotes = async () => {
    if (!selectedStudent) return
    setNotesSaving(true)
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-notes', email: selectedStudent.email, notes }),
      })
      setSelectedStudent({ ...selectedStudent, notes })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch {
      showToast('Failed to save notes')
    }
    setNotesSaving(false)
  }

  const sendReminder = async () => {
    if (!selectedStudent || !reminderMessage.trim()) return
    setReminderSending(true)
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-reminder',
          email: selectedStudent.email,
          studentName: selectedStudent.name,
          message: reminderMessage,
        }),
      })
      setReminderSent(true)
      setTimeout(() => {
        setShowReminderModal(false)
        setReminderMessage('')
        setReminderSent(false)
      }, 2000)
    } catch {
      showToast('Failed to send email')
    }
    setReminderSending(false)
  }

  const assignSet = async (setName: string) => {
    if (!selectedStudent) return
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign-set', email: selectedStudent.email, set_name: setName }),
      })
      const newSets = [...(selectedStudent.assigned_sets || []), setName]
      setSelectedStudent({ ...selectedStudent, assigned_sets: newSets })
      showToast(`Assigned "${setName}"`)
    } catch {
      showToast('Failed to assign')
    }
  }

  const removeSet = async (setName: string) => {
    if (!selectedStudent) return
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-set', email: selectedStudent.email, set_name: setName }),
      })
      const newSets = (selectedStudent.assigned_sets || []).filter((s) => s !== setName)
      setSelectedStudent({ ...selectedStudent, assigned_sets: newSets })
      showToast(`Removed "${setName}"`)
    } catch {
      showToast('Failed to remove')
    }
  }

  // ── Helpers ──

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateStr)
  }

  const activityLabel = (type: string, id: string) => {
    if (type === 'flashcard') {
      const labels: Record<string, string> = {
        flip: 'Flashcards: Flip',
        'self-assess': 'Flashcards: Self-Assess',
        quiz: 'Flashcards: Quiz',
      }
      return labels[id] || `Flashcard: ${id}`
    }
    return `Exercise ${id}`
  }

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading admin console...</div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-[#46464b] mb-2">Access Denied</h1>
          <p className="text-sm text-gray-400">This page is only available to administrators.</p>
          <button onClick={() => router.push('/home')} className="mt-6 text-sm text-[#416ebe] hover:underline">
            &larr; Go home
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7fafd] px-4 py-6">
      <div className="max-w-4xl mx-auto">

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 bg-[#416ebe] text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50 animate-fade-in">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => router.push('/home')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors">
                &larr; Home
              </button>
              <span className="text-xs text-gray-300">·</span>
              <SignOutButton />
            </div>
            <h1 className="text-2xl font-bold text-[#416ebe]">Admin Console</h1>
          </div>
          <div className="flex items-center gap-1 bg-white border border-[#cddcf0] rounded-xl p-1">
            <button
              onClick={() => { setView('dashboard'); setSelectedStudent(null) }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                view === 'dashboard' ? 'bg-[#416ebe] text-white' : 'text-[#46464b] hover:text-[#416ebe]'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => { setView('students'); setSelectedStudent(null) }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                view === 'students' || view === 'student-detail'
                  ? 'bg-[#416ebe] text-white'
                  : 'text-[#46464b] hover:text-[#416ebe]'
              }`}
            >
              Students
            </button>
            <button
              onClick={() => router.push('/admin/lessons')}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#46464b] hover:text-[#416ebe] transition-all"
            >
              Lessons
            </button>
            <button
              onClick={() => router.push('/admin/reports')}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#46464b] hover:text-[#416ebe] transition-all"
            >
              Reports
            </button>
          </div>
        </div>

        {/* ══════════ DASHBOARD VIEW ══════════ */}
        {view === 'dashboard' && overview && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard label="Total Students" value={overview.total_students} icon="👩‍🎓" />
              <StatCard label="Total Sessions" value={overview.total_sessions} icon="📊" />
              <StatCard label="This Week" value={overview.recent_sessions} icon="📅" />
              <StatCard label="Active Students" value={overview.active_this_week} icon="⚡" />
            </div>

            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e6f0fa]">
                <h2 className="font-bold text-[#46464b]">Recent Activity</h2>
              </div>
              {overview.recent_activity.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-400">No activity yet</div>
              ) : (
                <div className="divide-y divide-[#e6f0fa]">
                  {overview.recent_activity.map((a, i) => (
                    <div
                      key={i}
                      className="px-6 py-3 flex items-center justify-between hover:bg-[#f7fafd] cursor-pointer"
                      onClick={() => {
                        const student = students.find((s) => s.email === a.student_email)
                        if (student) loadStudentDetail(student)
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium text-[#46464b]">{a.student_name}</p>
                        <p className="text-xs text-gray-400">
                          {activityLabel(a.activity_type, a.activity_id)}
                          {a.score !== null && a.total ? (
                            <span className="ml-2 text-[#416ebe] font-bold">
                              {Math.round((a.score / a.total) * 100)}%
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{timeAgo(a.completed_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════ STUDENTS LIST VIEW ══════════ */}
        {view === 'students' && (
          <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e6f0fa]">
              <h2 className="font-bold text-[#46464b]">
                All Students <span className="text-xs font-normal text-gray-400">({students.length})</span>
              </h2>
            </div>
            {students.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">No students have signed up yet</div>
            ) : (
              <div className="divide-y divide-[#e6f0fa]">
                {students.map((student) => (
                  <div
                    key={student.email}
                    className={`px-6 py-4 flex items-center justify-between hover:bg-[#f7fafd] cursor-pointer transition-colors ${
                      student.blocked ? 'opacity-50' : ''
                    }`}
                    onClick={() => loadStudentDetail(student)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#46464b]">{student.name || 'Unknown'}</p>
                        {student.blocked && (
                          <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-bold">
                            BLOCKED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{student.email}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#416ebe]">{student.total_sessions}</p>
                          <p className="text-[10px] text-gray-400">sessions</p>
                        </div>
                        {student.avg_quiz_score !== null && (
                          <div className="text-center">
                            <p className="text-sm font-bold text-[#416ebe]">{student.avg_quiz_score}%</p>
                            <p className="text-[10px] text-gray-400">avg quiz</p>
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-xs text-gray-400">{timeAgo(student.last_activity)}</p>
                          <p className="text-[10px] text-gray-400">last active</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════ STUDENT DETAIL VIEW ══════════ */}
        {view === 'student-detail' && selectedStudent && (
          <>
            <button onClick={() => setView('students')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4">
              &larr; Back to students
            </button>

            {/* Student Info + Actions */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-6 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#46464b]">{selectedStudent.name || 'Unknown'}</h2>
                    {selectedStudent.blocked && (
                      <span className="text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-bold">BLOCKED</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{selectedStudent.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Joined {formatDate(selectedStudent.created_at)}</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#416ebe]">{selectedStudent.total_sessions}</p>
                    <p className="text-[10px] text-gray-400">sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#416ebe]">{selectedStudent.flashcard_modes}/3</p>
                    <p className="text-[10px] text-gray-400">flashcard modes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#416ebe]">{selectedStudent.exercises_done}</p>
                    <p className="text-[10px] text-gray-400">exercises</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-[#e6f0fa]">
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                >
                  ✉ Send Reminder
                </button>
                {session?.user?.role === 'superadmin' && (
                  <button
                    onClick={toggleBlock}
                    disabled={actionLoading}
                    className={`px-4 py-2 text-xs font-bold rounded-lg border-2 transition-colors ${
                      selectedStudent.blocked
                        ? 'border-green-300 text-green-600 hover:bg-green-50'
                        : 'border-red-200 text-red-400 hover:bg-red-50'
                    }`}
                  >
                    {selectedStudent.blocked ? '✓ Unblock Student' : '✗ Block Student'}
                  </button>
                )}
              </div>
            </div>


            {/* Teacher Notes */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
              <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Teacher Notes</p>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }}
                placeholder="Add private notes about this student..."
                className="w-full h-24 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={saveNotes}
                  disabled={notesSaving}
                  className="px-4 py-1.5 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors disabled:opacity-50"
                >
                  {notesSaving ? 'Saving...' : 'Save Notes'}
                </button>
                {notesSaved && <span className="text-xs text-green-500 font-bold">Saved!</span>}
              </div>
            </div>

            {/* Content Assignment */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
              <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Assigned Content</p>

              {/* Currently assigned */}
              {(selectedStudent.assigned_sets || []).length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedStudent.assigned_sets.map((setName) => (
                    <span
                      key={setName}
                      className="inline-flex items-center gap-1.5 bg-[#e6f0fa] text-[#416ebe] text-xs font-bold px-3 py-1.5 rounded-full"
                    >
                      {setName}
                      <button
                        onClick={() => removeSet(setName)}
                        className="hover:text-red-400 transition-colors text-sm leading-none"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-3">No content assigned yet</p>
              )}

              {/* Add sets */}
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_SETS.filter((s) => !(selectedStudent.assigned_sets || []).includes(s)).map((setName) => (
                  <button
                    key={setName}
                    onClick={() => assignSet(setName)}
                    className="text-xs text-gray-400 border border-dashed border-gray-300 px-3 py-1.5 rounded-full hover:border-[#416ebe] hover:text-[#416ebe] transition-colors"
                  >
                    + {setName}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress Completion */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-4">
                <p className="text-xs font-bold text-gray-400 mb-2">FLASHCARD MODES</p>
                {['flip', 'self-assess', 'quiz'].map((mode) => {
                  const done = studentProgress.some(
                    (p) => p.activity_type === 'flashcard' && p.activity_id === mode
                  )
                  return (
                    <div key={mode} className="flex items-center gap-2 py-1">
                      <span className={`text-sm ${done ? 'text-green-500' : 'text-gray-300'}`}>
                        {done ? '✓' : '○'}
                      </span>
                      <span className={`text-xs ${done ? 'text-[#46464b]' : 'text-gray-400'}`}>
                        {mode === 'flip' ? 'Flip' : mode === 'self-assess' ? 'Self-Assess' : 'Quiz'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-4">
                <p className="text-xs font-bold text-gray-400 mb-2">EXERCISES</p>
                {['1', '2', '3', '4', '5'].map((id) => {
                  const record = studentProgress.find(
                    (p) => p.activity_type === 'exercise' && p.activity_id === id
                  )
                  return (
                    <div key={id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${record ? 'text-green-500' : 'text-gray-300'}`}>
                          {record ? '✓' : '○'}
                        </span>
                        <span className={`text-xs ${record ? 'text-[#46464b]' : 'text-gray-400'}`}>
                          Exercise {id}
                        </span>
                      </div>
                      {record && record.score !== null && record.total ? (
                        <span className="text-xs font-bold text-[#416ebe]">{record.score}/{record.total}</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Activity History */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e6f0fa]">
                <h3 className="font-bold text-[#46464b]">Activity History</h3>
              </div>
              {studentProgress.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-400">No activity recorded yet</div>
              ) : (
                <div className="divide-y divide-[#e6f0fa]">
                  {studentProgress.map((p) => (
                    <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#46464b]">
                          {activityLabel(p.activity_type, p.activity_id)}
                        </p>
                        {p.score !== null && p.total ? (
                          <p className="text-xs text-gray-400">
                            Score: {p.score}/{p.total} ({Math.round((p.score / p.total) * 100)}%)
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">Completed</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(p.completed_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════ SEND REMINDER MODAL ══════════ */}
        {showReminderModal && selectedStudent && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="font-bold text-[#46464b] mb-1">Send Reminder</h3>
              <p className="text-xs text-gray-400 mb-4">
                Email to: {selectedStudent.name} ({selectedStudent.email})
              </p>
              {reminderSent ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">✉️</div>
                  <p className="text-sm font-bold text-green-600">Message sent!</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    placeholder="Write your message here..."
                    className="w-full h-32 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors mb-4"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setShowReminderModal(false); setReminderMessage('') }}
                      className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendReminder}
                      disabled={reminderSending || !reminderMessage.trim()}
                      className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors disabled:opacity-50"
                    >
                      {reminderSending ? 'Sending...' : 'Send Email'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-2xl font-bold text-[#416ebe]">{value}</p>
      <p className="text-[10px] text-gray-400 mt-1">{label}</p>
    </div>
  )
}
