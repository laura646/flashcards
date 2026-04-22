'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import SignOutButton from '@/components/SignOutButton'
import { useRouter } from 'next/navigation'
import { COMMON_ISSUES_BY_LEVEL, COURSE_TYPES } from '@/lib/common-issues'

// ── Interfaces ──

interface Course {
  id: string
  name: string
  description: string
  invite_code: string
  created_at: string
  course_type: string | null
  level: string | null
  student_count: number
  lesson_count: number
}

interface CourseDetail {
  id: string
  name: string
  description: string
  invite_code: string
  created_at: string
  course_type: string | null
  level: string | null
}

interface CourseStudent {
  email: string
  name: string
  created_at: string
  level: string | null
  learning_goals: string | null
  company: string | null
  common_issues_tags: string[]
  common_issues_comments: string | null
  blocked: boolean
  notes: string | null
  last_activity: string | null
  total_sessions: number
}

interface CourseLesson {
  id: string
  title: string
  created_at: string
  status: 'draft' | 'published'
  template_category: string | null
  template_level: string | null
  is_template: boolean
  lesson_date: string | null
}

interface MyStudent {
  email: string
  name: string
  created_at: string
  level: string | null
  learning_goals: string | null
  company: string | null
  common_issues_tags: string[]
  common_issues_comments: string | null
  blocked: boolean
  notes: string | null
  courses: { course_id: string; course_name: string }[]
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

type View = 'my-courses' | 'course-detail' | 'my-students' | 'student-detail' | 'reports'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [view, setView] = useState<View>('my-courses')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // My Courses state
  const [courses, setCourses] = useState<Course[]>([])

  // Course Detail state
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null)
  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([])
  const [courseLessons, setCourseLessons] = useState<CourseLesson[]>([])
  const [editingCourse, setEditingCourse] = useState(false)
  const [courseForm, setCourseForm] = useState({ name: '', description: '', level: '', course_type: '' })
  const [courseTab, setCourseTab] = useState<'lessons' | 'students' | 'info'>('lessons')

  // My Students state
  const [myStudents, setMyStudents] = useState<MyStudent[]>([])
  const [studentSearch, setStudentSearch] = useState('')

  // Student Detail state
  const [selectedStudent, setSelectedStudent] = useState<MyStudent | null>(null)
  const [studentProgress, setStudentProgress] = useState<ProgressRecord[]>([])
  const [studentCourses, setStudentCourses] = useState<{ id: string; name: string }[]>([])
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    level: '',
    learning_goals: '',
    company: '',
    common_issues_tags: [] as string[],
    common_issues_comments: '',
  })
  const [customTag, setCustomTag] = useState('')
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Reminder modal
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderMessage, setReminderMessage] = useState('')
  const [reminderSending, setReminderSending] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)

  // Reports state
  const [reportCourse, setReportCourse] = useState<string>('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
    }
  }, [status, router])

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Data Loading ──

  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin?action=my-courses')
      const data = await res.json()
      setCourses(data.courses || [])
    } catch { /* */ }
    setLoading(false)
  }, [])

  const loadCourseDetail = async (courseId: string) => {
    setLoading(true)
    setCourseTab('lessons')
    try {
      const res = await fetch(`/api/admin?action=course-detail&course_id=${courseId}`)
      const data = await res.json()
      setSelectedCourse(data.course)
      setCourseStudents(data.students || [])
      setCourseLessons(data.lessons || [])
      setCourseForm({
        name: data.course?.name || '',
        description: data.course?.description || '',
        level: data.course?.level || '',
        course_type: data.course?.course_type || '',
      })
      setView('course-detail')
    } catch { /* */ }
    setLoading(false)
  }

  const loadMyStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin?action=my-students')
      const data = await res.json()
      setMyStudents(data.students || [])
    } catch { /* */ }
    setLoading(false)
  }, [])

  const loadStudentDetail = async (student: MyStudent) => {
    setSelectedStudent(student)
    setNotes(student.notes || '')
    setNotesSaved(false)
    setEditingProfile(false)
    setProfileForm({
      level: student.level || '',
      learning_goals: student.learning_goals || '',
      company: student.company || '',
      common_issues_tags: student.common_issues_tags || [],
      common_issues_comments: student.common_issues_comments || '',
    })
    setView('student-detail')

    try {
      const res = await fetch(`/api/admin?action=student-detail&email=${encodeURIComponent(student.email)}`)
      const data = await res.json()
      setStudentProgress(data.progress || [])
      setStudentCourses(data.courses || [])
      if (data.user) {
        setNotes(data.user.notes || '')
        setProfileForm({
          level: data.user.level || '',
          learning_goals: data.user.learning_goals || '',
          company: data.user.company || '',
          common_issues_tags: data.user.common_issues_tags || [],
          common_issues_comments: data.user.common_issues_comments || '',
        })
      }
    } catch {
      setStudentProgress([])
      setStudentCourses([])
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      loadCourses()
    }
  }, [status, isAdmin, loadCourses])

  // ── Actions ──

  const saveCourseInfo = async () => {
    if (!selectedCourse) return
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-course',
          course_id: selectedCourse.id,
          name: courseForm.name,
          description: courseForm.description,
          level: courseForm.level || null,
          course_type: courseForm.course_type || null,
        }),
      })
      setSelectedCourse({ ...selectedCourse, ...courseForm })
      setEditingCourse(false)
      showToast('Course updated')
      loadCourses()
    } catch {
      showToast('Failed to update course')
    }
  }

  const saveStudentProfile = async () => {
    if (!selectedStudent) return
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-student-profile',
          studentEmail: selectedStudent.email,
          level: profileForm.level || null,
          learning_goals: profileForm.learning_goals || null,
          company: profileForm.company || null,
          common_issues_tags: profileForm.common_issues_tags,
          common_issues_comments: profileForm.common_issues_comments || null,
        }),
      })
      setSelectedStudent({
        ...selectedStudent,
        level: profileForm.level || null,
        learning_goals: profileForm.learning_goals || null,
        company: profileForm.company || null,
        common_issues_tags: profileForm.common_issues_tags,
        common_issues_comments: profileForm.common_issues_comments || null,
      })
      setEditingProfile(false)
      showToast('Profile updated')
    } catch {
      showToast('Failed to update profile')
    }
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

  const toggleIssueTag = (tag: string) => {
    setProfileForm(prev => ({
      ...prev,
      common_issues_tags: prev.common_issues_tags.includes(tag)
        ? prev.common_issues_tags.filter(t => t !== tag)
        : [...prev.common_issues_tags, tag],
    }))
  }

  const addCustomTag = () => {
    const trimmed = customTag.trim()
    if (trimmed && !profileForm.common_issues_tags.includes(trimmed)) {
      setProfileForm(prev => ({
        ...prev,
        common_issues_tags: [...prev.common_issues_tags, trimmed],
      }))
      setCustomTag('')
    }
  }

  // ── Helpers ──

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
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

  const LEVELS = Object.keys(COMMON_ISSUES_BY_LEVEL)

  const filteredStudents = myStudents.filter(s => {
    if (!studentSearch) return true
    const q = studentSearch.toLowerCase()
    return (s.name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
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
      <div className="max-w-5xl mx-auto">

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
            <h1 className="text-2xl font-bold text-[#416ebe]">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-1 bg-white border border-[#cddcf0] rounded-xl p-1">
            {[
              { key: 'my-courses' as View, label: 'My Courses' },
              { key: 'my-students' as View, label: 'My Students' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setView(tab.key)
                  if (tab.key === 'my-courses') loadCourses()
                  if (tab.key === 'my-students') loadMyStudents()
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  view === tab.key || (tab.key === 'my-courses' && view === 'course-detail') || (tab.key === 'my-students' && view === 'student-detail')
                    ? 'bg-[#416ebe] text-white'
                    : 'text-[#46464b] hover:text-[#416ebe]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => router.push('/admin/content-bank')}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#46464b] hover:text-[#416ebe] transition-all"
            >
              Content Bank
            </button>
            <button
              onClick={() => router.push('/admin/reports')}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#46464b] hover:text-[#416ebe] transition-all"
            >
              Reports
            </button>
          </div>
        </div>

        {/* ══════════ MY COURSES VIEW ══════════ */}
        {view === 'my-courses' && (
          <>
            <h2 className="text-lg font-bold text-[#46464b] mb-4">
              My Courses <span className="text-xs font-normal text-gray-400">({courses.length})</span>
            </h2>
            {courses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-12 text-center text-sm text-gray-400">
                No courses assigned to you yet
              </div>
            ) : (
              <div className="grid gap-3">
                {courses.map(course => (
                  <div
                    key={course.id}
                    onClick={() => loadCourseDetail(course.id)}
                    className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 hover:border-[#416ebe] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-[#46464b]">{course.name}</h3>
                        <p className="text-xs text-gray-400 mt-1">{course.description || 'No description'}</p>
                        <div className="flex gap-2 mt-2">
                          {course.level && (
                            <span className="text-[10px] bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                              {course.level}
                            </span>
                          )}
                          {course.course_type && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                              {course.course_type}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-6 text-center">
                        <div>
                          <p className="text-xl font-bold text-[#416ebe]">{course.student_count}</p>
                          <p className="text-[10px] text-gray-400">students</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-[#416ebe]">{course.lesson_count}</p>
                          <p className="text-[10px] text-gray-400">lessons</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════ COURSE DETAIL VIEW ══════════ */}
        {view === 'course-detail' && selectedCourse && (
          <>
            <button
              onClick={() => { setView('my-courses'); loadCourses() }}
              className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4"
            >
              &larr; Back to My Courses
            </button>

            {/* Course Header */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#46464b]">{selectedCourse.name}</h2>
                  <p className="text-xs text-gray-400 mt-1">{selectedCourse.description || 'No description'}</p>
                  <div className="flex gap-2 mt-2">
                    {selectedCourse.level && (
                      <span className="text-[10px] bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                        {selectedCourse.level}
                      </span>
                    )}
                    {selectedCourse.course_type && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                        {selectedCourse.course_type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Invite: <span className="font-mono font-bold text-[#416ebe]">{selectedCourse.invite_code}</span>
                </div>
              </div>
            </div>

            {/* Course Tabs */}
            <div className="flex gap-1 mb-4 bg-white border border-[#cddcf0] rounded-xl p-1 w-fit">
              {(['lessons', 'students', 'info'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setCourseTab(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    courseTab === tab ? 'bg-[#416ebe] text-white' : 'text-[#46464b] hover:text-[#416ebe]'
                  }`}
                >
                  {tab === 'lessons' ? `Lessons (${courseLessons.length})` : tab === 'students' ? `Students (${courseStudents.length})` : 'Course Info'}
                </button>
              ))}
            </div>

            {/* Lessons Tab */}
            {courseTab === 'lessons' && (
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e6f0fa] flex items-center justify-between">
                  <h3 className="font-bold text-[#46464b]">Lessons</h3>
                  <button
                    onClick={() => router.push(`/admin/lessons?course_id=${selectedCourse.id}`)}
                    className="text-xs font-bold text-[#416ebe] hover:underline"
                  >
                    + Create Lesson
                  </button>
                </div>
                {courseLessons.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-gray-400">No lessons yet</div>
                ) : (
                  <div className="divide-y divide-[#e6f0fa]">
                    {courseLessons.map(lesson => (
                      <div
                        key={lesson.id}
                        onClick={() => router.push(`/admin/lessons?id=${lesson.id}`)}
                        className="px-6 py-4 flex items-center justify-between hover:bg-[#f7fafd] cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#46464b]">{lesson.title || 'Untitled'}</p>
                          <div className="flex gap-2 mt-1">
                            {lesson.template_level && (
                              <span className="text-[10px] bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                                {lesson.template_level}
                              </span>
                            )}
                            {lesson.template_category && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                                {lesson.template_category}
                              </span>
                            )}
                            {lesson.is_template && (
                              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                                Template
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            lesson.status === 'published' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {lesson.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(lesson.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Students Tab */}
            {courseTab === 'students' && (
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e6f0fa]">
                  <h3 className="font-bold text-[#46464b]">Students in this Course</h3>
                </div>
                {courseStudents.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-gray-400">No students enrolled</div>
                ) : (
                  <div className="divide-y divide-[#e6f0fa]">
                    {courseStudents.map(student => (
                      <div
                        key={student.email}
                        className="px-6 py-4 flex items-center justify-between hover:bg-[#f7fafd] cursor-pointer transition-colors"
                        onClick={() => {
                          const myStudent: MyStudent = {
                            ...student,
                            courses: [{ course_id: selectedCourse.id, course_name: selectedCourse.name }],
                          }
                          loadStudentDetail(myStudent)
                        }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#46464b]">{student.name || 'Unknown'}</p>
                            {student.level && (
                              <span className="text-[10px] bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                                {student.level}
                              </span>
                            )}
                            {student.blocked && (
                              <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-bold">
                                BLOCKED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{student.email}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-sm font-bold text-[#416ebe]">{student.total_sessions}</p>
                            <p className="text-[10px] text-gray-400">sessions</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-400">{timeAgo(student.last_activity)}</p>
                            <p className="text-[10px] text-gray-400">last active</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Course Info Tab */}
            {courseTab === 'info' && (
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-6">
                {editingCourse ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">Course Name</label>
                      <input
                        type="text"
                        value={courseForm.name}
                        onChange={e => setCourseForm({ ...courseForm, name: e.target.value })}
                        className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">Description</label>
                      <textarea
                        value={courseForm.description}
                        onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                        className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 h-20 resize-none focus:outline-none focus:border-[#416ebe]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">Level</label>
                        <select
                          value={courseForm.level}
                          onChange={e => setCourseForm({ ...courseForm, level: e.target.value })}
                          className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]"
                        >
                          <option value="">Not set</option>
                          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">Course Type</label>
                        <select
                          value={courseForm.course_type}
                          onChange={e => setCourseForm({ ...courseForm, course_type: e.target.value })}
                          className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]"
                        >
                          <option value="">Not set</option>
                          {COURSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={saveCourseInfo}
                        className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCourse(false)}
                        className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</p>
                        <p className="text-sm text-[#46464b]">{selectedCourse.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Description</p>
                        <p className="text-sm text-[#46464b]">{selectedCourse.description || '—'}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Level</p>
                          <p className="text-sm text-[#46464b]">{selectedCourse.level || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</p>
                          <p className="text-sm text-[#46464b]">{selectedCourse.course_type || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invite Code</p>
                          <p className="text-sm font-mono text-[#416ebe]">{selectedCourse.invite_code}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Created</p>
                        <p className="text-sm text-[#46464b]">{formatDate(selectedCourse.created_at)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingCourse(true)}
                      className="mt-4 px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                    >
                      Edit Course Info
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════ MY STUDENTS VIEW ══════════ */}
        {view === 'my-students' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#46464b]">
                My Students <span className="text-xs font-normal text-gray-400">({myStudents.length})</span>
              </h2>
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="text-sm border border-[#cddcf0] rounded-lg px-3 py-2 w-64 focus:outline-none focus:border-[#416ebe]"
              />
            </div>

            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
              {filteredStudents.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-400">
                  {myStudents.length === 0 ? 'No students in your courses yet' : 'No matching students'}
                </div>
              ) : (
                <div className="divide-y divide-[#e6f0fa]">
                  {filteredStudents.map(student => (
                    <div
                      key={student.email}
                      className="px-6 py-4 flex items-center justify-between hover:bg-[#f7fafd] cursor-pointer transition-colors"
                      onClick={() => loadStudentDetail(student)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#46464b]">{student.name || 'Unknown'}</p>
                          {student.level && (
                            <span className="text-[10px] bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                              {student.level}
                            </span>
                          )}
                          {student.blocked && (
                            <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-bold">BLOCKED</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{student.email}</p>
                        {student.courses.length > 0 && (
                          <div className="flex gap-1.5 mt-1">
                            {student.courses.map(c => (
                              <span key={c.course_id} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                {c.course_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {student.company && (
                          <p className="text-xs text-gray-400">{student.company}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════ STUDENT DETAIL VIEW ══════════ */}
        {view === 'student-detail' && selectedStudent && (
          <>
            <button
              onClick={() => { setView('my-students'); loadMyStudents() }}
              className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4"
            >
              &larr; Back to My Students
            </button>

            {/* Student Info */}
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
                  {studentCourses.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {studentCourses.map(c => (
                        <span key={c.id} className="text-[10px] bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                >
                  Send Reminder
                </button>
              </div>
            </div>

            {/* Student Profile */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Student Profile</p>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="text-xs font-bold text-[#416ebe] hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingProfile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">Level</label>
                      <select
                        value={profileForm.level}
                        onChange={e => setProfileForm({ ...profileForm, level: e.target.value })}
                        className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]"
                      >
                        <option value="">Not set</option>
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">Company</label>
                      <input
                        type="text"
                        value={profileForm.company}
                        onChange={e => setProfileForm({ ...profileForm, company: e.target.value })}
                        className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]"
                        placeholder="Company name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Learning Goals</label>
                    <textarea
                      value={profileForm.learning_goals}
                      onChange={e => setProfileForm({ ...profileForm, learning_goals: e.target.value })}
                      className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 h-16 resize-none focus:outline-none focus:border-[#416ebe]"
                      placeholder="What does this student want to achieve?"
                    />
                  </div>

                  {/* Common Issues Tags */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-2 block">Common Issues / Structure Tags</label>
                    {profileForm.level && COMMON_ISSUES_BY_LEVEL[profileForm.level] ? (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {COMMON_ISSUES_BY_LEVEL[profileForm.level].map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleIssueTag(tag)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                              profileForm.common_issues_tags.includes(tag)
                                ? 'bg-[#416ebe] text-white border-[#416ebe]'
                                : 'bg-white text-gray-500 border-gray-300 hover:border-[#416ebe]'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-3">Select a level to see common issues for that level</p>
                    )}

                    {/* Custom tag */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customTag}
                        onChange={e => setCustomTag(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                        placeholder="Add custom tag..."
                        className="text-xs border border-[#cddcf0] rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:border-[#416ebe]"
                      />
                      <button
                        onClick={addCustomTag}
                        className="text-xs font-bold text-[#416ebe] hover:underline px-2"
                      >
                        + Add
                      </button>
                    </div>

                    {/* Show selected tags */}
                    {profileForm.common_issues_tags.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] text-gray-400 mb-1">Selected tags:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {profileForm.common_issues_tags.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 bg-[#e6f0fa] text-[#416ebe] text-[11px] font-bold px-2.5 py-1 rounded-full"
                            >
                              {tag}
                              <button
                                onClick={() => toggleIssueTag(tag)}
                                className="hover:text-red-400 text-sm leading-none"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Comments on Common Issues</label>
                    <textarea
                      value={profileForm.common_issues_comments}
                      onChange={e => setProfileForm({ ...profileForm, common_issues_comments: e.target.value })}
                      className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 h-16 resize-none focus:outline-none focus:border-[#416ebe]"
                      placeholder="Additional notes about this student's common mistakes..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveStudentProfile}
                      className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                    >
                      Save Profile
                    </button>
                    <button
                      onClick={() => setEditingProfile(false)}
                      className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Level</p>
                      <p className="text-sm text-[#46464b]">{selectedStudent.level || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company</p>
                      <p className="text-sm text-[#46464b]">{selectedStudent.company || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Joined</p>
                      <p className="text-sm text-[#46464b]">{formatDate(selectedStudent.created_at)}</p>
                    </div>
                  </div>
                  {selectedStudent.learning_goals && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Learning Goals</p>
                      <p className="text-sm text-[#46464b]">{selectedStudent.learning_goals}</p>
                    </div>
                  )}
                  {(selectedStudent.common_issues_tags || []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Common Issues</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {selectedStudent.common_issues_tags.map(tag => (
                          <span key={tag} className="text-[11px] bg-[#e6f0fa] text-[#416ebe] px-2.5 py-1 rounded-full font-bold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedStudent.common_issues_comments && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comments</p>
                      <p className="text-sm text-[#46464b]">{selectedStudent.common_issues_comments}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Teacher Notes */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 mb-4">
              <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Teacher Notes</p>
              <textarea
                value={notes}
                onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
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

            {/* Activity History */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e6f0fa]">
                <h3 className="font-bold text-[#46464b]">Activity History</h3>
              </div>
              {studentProgress.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-400">No activity recorded yet</div>
              ) : (
                <div className="divide-y divide-[#e6f0fa]">
                  {studentProgress.slice(0, 20).map(p => (
                    <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#46464b]">
                          {p.activity_type === 'flashcard' ? `Flashcards: ${p.activity_id}` : `Exercise ${p.activity_id}`}
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

        {/* ══════════ REPORTS VIEW ══════════ */}
        {view === 'reports' && (
          <>
            <h2 className="text-lg font-bold text-[#46464b] mb-4">Reports</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Per Course Reports */}
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5">
                <h3 className="font-bold text-[#46464b] mb-3">Course Reports</h3>
                <p className="text-xs text-gray-400 mb-4">Select a course to generate a report</p>
                <select
                  value={reportCourse}
                  onChange={e => setReportCourse(e.target.value)}
                  className="w-full text-sm border border-[#cddcf0] rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-[#416ebe]"
                >
                  <option value="">Choose a course...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    disabled={!reportCourse}
                    className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors disabled:opacity-30"
                    onClick={() => showToast('PDF export coming soon')}
                  >
                    Export PDF
                  </button>
                  <button
                    disabled={!reportCourse}
                    className="px-4 py-2 border-2 border-[#416ebe] text-[#416ebe] text-xs font-bold rounded-lg hover:bg-[#e6f0fa] transition-colors disabled:opacity-30"
                    onClick={() => showToast('CSV export coming soon')}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Per Student Reports */}
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5">
                <h3 className="font-bold text-[#46464b] mb-3">Student Reports</h3>
                <p className="text-xs text-gray-400 mb-4">Go to a student profile to generate their report</p>
                <button
                  onClick={() => { setView('my-students'); loadMyStudents() }}
                  className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                >
                  Go to My Students
                </button>
              </div>
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
                  <p className="text-sm font-bold text-green-600">Message sent!</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={reminderMessage}
                    onChange={e => setReminderMessage(e.target.value)}
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
