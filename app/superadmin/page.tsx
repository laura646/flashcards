'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import SignOutButton from '@/components/SignOutButton'
import { useRouter } from 'next/navigation'

interface Course {
  id: string
  name: string
  description: string | null
  invite_code: string
  created_at: string
  teacher_count: number
  student_count: number
  lesson_count: number
}

interface CourseTeacher {
  teacher_email: string
  users?: { name: string; email: string }
}

interface CourseStudent {
  student_email: string
  joined_at: string
  users?: { name: string; email: string }
}

interface Teacher {
  email: string
  name: string
}

type View = 'courses' | 'course-detail' | 'invite-teacher'

export default function SuperadminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // State
  const [view, setView] = useState<View>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Course form
  const [showNewCourse, setShowNewCourse] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [courseName, setCourseName] = useState('')
  const [courseDesc, setCourseDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Course detail
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courseTeachers, setCourseTeachers] = useState<CourseTeacher[]>([])
  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Invite teacher
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)

  // Assign teacher to course
  const [showAssignTeacher, setShowAssignTeacher] = useState(false)
  const [assignEmail, setAssignEmail] = useState('')

  // Add student manually
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [addStudentEmail, setAddStudentEmail] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)

  // Confirmation modal for removals
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  // Student management: move/enroll in additional course
  const [studentAction, setStudentAction] = useState<{ email: string; type: 'move' | 'add-to-course' } | null>(null)
  const [targetCourseId, setTargetCourseId] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Auth check ──
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
    }
  }, [status, router])

  // ── Load courses ──
  const loadCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin?action=courses')
      const data = await res.json()
      setCourses(data.courses || [])
    } catch {
      showToast('Failed to load courses')
    }
    setLoading(false)
  }, [])

  // ── Load teachers ──
  const loadTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin?action=teachers')
      const data = await res.json()
      setTeachers(data.teachers || [])
    } catch {}
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'superadmin') {
      loadCourses()
      loadTeachers()
    }
  }, [status, session, loadCourses, loadTeachers])

  // ── Load course detail ──
  const loadCourseDetail = async (course: Course) => {
    setSelectedCourse(course)
    setView('course-detail')
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/superadmin?action=course-detail&course_id=${course.id}`)
      const data = await res.json()
      setCourseTeachers(data.teachers || [])
      setCourseStudents(data.students || [])
    } catch {
      showToast('Failed to load course details')
    }
    setDetailLoading(false)
  }

  // ── Create / Update course ──
  const saveCourse = async () => {
    if (!courseName.trim()) return
    setSaving(true)
    try {
      const action = editingCourse ? 'update-course' : 'create-course'
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          course_id: editingCourse?.id,
          name: courseName,
          description: courseDesc,
        }),
      })
      if (!res.ok) throw new Error()
      showToast(editingCourse ? 'Course updated!' : 'Course created!')
      setShowNewCourse(false)
      setEditingCourse(null)
      setCourseName('')
      setCourseDesc('')
      await loadCourses()
    } catch {
      showToast('Failed to save course')
    }
    setSaving(false)
  }

  // ── Delete course ──
  const deleteCourse = async (courseId: string) => {
    try {
      await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-course', course_id: courseId }),
      })
      showToast('Course deleted')
      if (view === 'course-detail') setView('courses')
      await loadCourses()
    } catch {
      showToast('Failed to delete course')
    }
  }

  // ── Invite teacher ──
  const inviteTeacher = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite-teacher',
          email: inviteEmail,
          name: inviteName,
        }),
      })
      if (!res.ok) throw new Error()
      showToast('Teacher invited!')
      setInviteEmail('')
      setInviteName('')
      setView('courses')
      await loadTeachers()
    } catch {
      showToast('Failed to invite teacher')
    }
    setInviting(false)
  }

  // ── Assign teacher to course ──
  const assignTeacher = async () => {
    if (!assignEmail || !selectedCourse) return
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-teacher',
          course_id: selectedCourse.id,
          teacher_email: assignEmail,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to assign teacher')
        return
      }
      showToast('Teacher assigned!')
      setShowAssignTeacher(false)
      setAssignEmail('')
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch {
      showToast('Failed to assign teacher')
    }
  }

  // ── Remove teacher from course (with confirmation) ──
  const confirmRemoveTeacher = (teacherEmail: string, teacherName: string) => {
    setConfirmModal({
      title: 'Remove Teacher',
      message: `Are you sure you want to remove ${teacherName} from ${selectedCourse?.name}?`,
      onConfirm: () => doRemoveTeacher(teacherEmail),
    })
  }

  const doRemoveTeacher = async (teacherEmail: string) => {
    if (!selectedCourse) return
    setConfirmModal(null)
    try {
      await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-teacher',
          course_id: selectedCourse.id,
          teacher_email: teacherEmail,
        }),
      })
      showToast('Teacher removed')
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch {
      showToast('Failed to remove teacher')
    }
  }

  // ── Remove student from course (with confirmation) ──
  const confirmRemoveStudent = (studentEmail: string, studentName: string) => {
    setConfirmModal({
      title: 'Remove Student',
      message: `Are you sure you want to remove ${studentName} from ${selectedCourse?.name}? Their progress will be preserved.`,
      onConfirm: () => doRemoveStudent(studentEmail),
    })
  }

  const doRemoveStudent = async (studentEmail: string) => {
    if (!selectedCourse) return
    setConfirmModal(null)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-student',
          course_id: selectedCourse.id,
          student_email: studentEmail,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to remove student')
        return
      }
      showToast('Student removed (progress preserved)')
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch {
      showToast('Failed to remove student')
    }
  }

  // ── Add student manually ──
  const addStudent = async () => {
    if (!addStudentEmail.trim() || !selectedCourse) return
    setAddingStudent(true)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll-student',
          course_id: selectedCourse.id,
          student_email: addStudentEmail.trim().toLowerCase(),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to add student')
        return
      }
      showToast('Student added!')
      setAddStudentEmail('')
      setShowAddStudent(false)
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch {
      showToast('Failed to add student')
    }
    setAddingStudent(false)
  }

  // ── Move student to another course ──
  const moveStudent = async (studentEmail: string, tgtCourseId: string) => {
    if (!selectedCourse) return
    try {
      const enrollRes = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll-student',
          course_id: tgtCourseId,
          student_email: studentEmail,
        }),
      })
      if (!enrollRes.ok) {
        const data = await enrollRes.json()
        showToast(data.error || 'Failed to enroll in target course')
        return
      }
      await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-student',
          course_id: selectedCourse.id,
          student_email: studentEmail,
        }),
      })
      showToast('Student moved!')
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch {
      showToast('Failed to move student')
    }
  }

  // ── Add student to additional course ──
  const addStudentToCourse = async (studentEmail: string, tgtCourseId: string) => {
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll-student',
          course_id: tgtCourseId,
          student_email: studentEmail,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to enroll')
        return
      }
      showToast('Student enrolled in additional course!')
      await loadCourses()
    } catch {
      showToast('Failed to enroll student')
    }
  }

  // ── Regenerate invite code ──
  const regenerateInvite = async () => {
    if (!selectedCourse) return
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate-invite', course_id: selectedCourse.id }),
      })
      const data = await res.json()
      if (data.invite_code) {
        setSelectedCourse({ ...selectedCourse, invite_code: data.invite_code })
        showToast('Invite code regenerated!')
        await loadCourses()
      }
    } catch {
      showToast('Failed to regenerate')
    }
  }

  // ── Copy invite link ──
  const copyInviteLink = () => {
    if (!selectedCourse) return
    const link = `https://flashcards-app-navy.vercel.app/join/${selectedCourse.invite_code}`
    navigator.clipboard.writeText(link)
    showToast('Invite link copied!')
  }

  // ── Loading / Auth — these use early returns (no modals needed) ──
  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    )
  }

  if (status === 'unauthenticated' || session?.user?.role !== 'superadmin') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-sm text-gray-400">Access restricted to superadmin.</p>
          <button
            onClick={() => router.push('/home')}
            className="mt-4 text-sm text-[#416ebe] hover:underline"
          >
            &larr; Go home
          </button>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    )
  }

  // ══════════════════════════════════════
  //  MAIN RENDER — single return so modals always render
  // ══════════════════════════════════════
  return (
    <>
      {/* ── TOAST (always visible) ── */}
      {toast && (
        <div className="fixed top-4 right-4 bg-[#416ebe] text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* ── CONFIRMATION MODAL (always visible) ── */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-[#46464b] mb-2">{confirmModal.title}</h2>
            <p className="text-sm text-gray-500 mb-6">{confirmModal.message}</p>
            <div className="flex gap-2">
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Yes, remove
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#46464b] font-bold py-3 rounded-xl text-sm transition-colors"
              >
                No, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE TEACHER VIEW ── */}
      {view === 'invite-teacher' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button
            onClick={() => setView('courses')}
            className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4"
          >
            &larr; Back to dashboard
          </button>

          <h1 className="text-xl font-bold text-[#416ebe] mb-6">Invite a Teacher</h1>

          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Teacher&apos;s Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Teacher&apos;s Email (Google account)</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. john@gmail.com"
                className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe] transition-colors"
              />
            </div>
            <p className="text-xs text-gray-400">
              An invite email will be sent. When they sign in with this Google account, they&apos;ll be recognized as a teacher.
            </p>
            <button
              onClick={inviteTeacher}
              disabled={inviting || !inviteEmail.trim()}
              className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {inviting ? 'Sending invite...' : 'Send Invite'}
            </button>
          </div>

          {teachers.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-bold text-gray-500 mb-3">Existing Teachers</h2>
              <div className="bg-white rounded-2xl border-2 border-[#cddcf0] divide-y divide-[#e6f0fa]">
                {teachers.map((t) => (
                  <div key={t.email} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#46464b]">{t.name || 'Unnamed'}</p>
                      <p className="text-xs text-gray-400">{t.email}</p>
                    </div>
                    <span className="text-xs bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                      Teacher
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── COURSE DETAIL VIEW ── */}
      {view === 'course-detail' && selectedCourse && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button
            onClick={() => setView('courses')}
            className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4"
          >
            &larr; Back to courses
          </button>

          {/* Course header */}
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-[#416ebe]">{selectedCourse.name}</h1>
                {selectedCourse.description && (
                  <p className="text-sm text-gray-500 mt-1">{selectedCourse.description}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setEditingCourse(selectedCourse)
                  setCourseName(selectedCourse.name)
                  setCourseDesc(selectedCourse.description || '')
                  setShowNewCourse(true)
                }}
                className="text-xs text-[#416ebe] hover:underline font-bold"
              >
                Edit
              </button>
            </div>
          </div>

          {/* Invite link */}
          <div className="bg-[#e6f0fa] rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold text-[#416ebe] mb-2">Student Invite Link</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={`https://flashcards-app-navy.vercel.app/join/${selectedCourse.invite_code}`}
                className="flex-1 bg-white border border-[#cddcf0] rounded-lg px-3 py-2 text-xs text-[#46464b]"
              />
              <button
                onClick={copyInviteLink}
                className="bg-[#416ebe] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#3560b0] transition-colors"
              >
                Copy
              </button>
            </div>
            <button
              onClick={regenerateInvite}
              className="text-xs text-gray-400 hover:text-[#416ebe] mt-2 transition-colors"
            >
              Regenerate code
            </button>
          </div>

          {detailLoading ? (
            <div className="text-center py-8 text-sm text-gray-400">Loading...</div>
          ) : (
            <>
              {/* Teachers section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-[#416ebe]">
                    Teachers ({courseTeachers.length})
                  </h2>
                  <button
                    onClick={() => setShowAssignTeacher(true)}
                    className="text-xs text-[#416ebe] font-bold hover:underline"
                  >
                    + Assign Teacher
                  </button>
                </div>

                {showAssignTeacher && (
                  <div className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa] mb-3">
                    <p className="text-xs font-bold text-gray-500 mb-2">Select a teacher to assign</p>
                    <select
                      value={assignEmail}
                      onChange={(e) => setAssignEmail(e.target.value)}
                      className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#416ebe]"
                    >
                      <option value="">Choose teacher...</option>
                      {teachers
                        .filter((t) => !courseTeachers.find((ct) => ct.teacher_email === t.email))
                        .map((t) => (
                          <option key={t.email} value={t.email}>
                            {t.name || t.email}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={assignTeacher}
                        disabled={!assignEmail}
                        className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => { setShowAssignTeacher(false); setAssignEmail('') }}
                        className="px-4 py-2 text-xs text-gray-400 hover:text-[#46464b]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {courseTeachers.length === 0 ? (
                  <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 text-center">
                    <p className="text-sm text-gray-400">No teachers assigned yet</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-[#cddcf0] divide-y divide-[#e6f0fa]">
                    {courseTeachers.map((ct) => (
                      <div key={ct.teacher_email} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#46464b]">
                            {ct.users?.name || ct.teacher_email}
                          </p>
                          <p className="text-xs text-gray-400">{ct.teacher_email}</p>
                        </div>
                        <button
                          onClick={() => confirmRemoveTeacher(ct.teacher_email, ct.users?.name || ct.teacher_email)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Students section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-[#416ebe]">
                    Students ({courseStudents.length})
                  </h2>
                  <button
                    onClick={() => setShowAddStudent(true)}
                    className="text-xs text-[#416ebe] font-bold hover:underline"
                  >
                    + Add Student
                  </button>
                </div>

                {showAddStudent && (
                  <div className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa] mb-3">
                    <p className="text-xs font-bold text-gray-500 mb-2">Enter the student&apos;s email (Google account)</p>
                    <input
                      type="email"
                      value={addStudentEmail}
                      onChange={(e) => setAddStudentEmail(e.target.value)}
                      placeholder="e.g. student@gmail.com"
                      className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#416ebe]"
                      onKeyDown={(e) => e.key === 'Enter' && addStudent()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addStudent}
                        disabled={addingStudent || !addStudentEmail.trim()}
                        className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50"
                      >
                        {addingStudent ? 'Adding...' : 'Add'}
                      </button>
                      <button
                        onClick={() => { setShowAddStudent(false); setAddStudentEmail('') }}
                        className="px-4 py-2 text-xs text-gray-400 hover:text-[#46464b]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {courseStudents.length === 0 ? (
                  <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 text-center">
                    <p className="text-sm text-gray-400">No students enrolled yet</p>
                    <p className="text-xs text-gray-300 mt-1">Share the invite link or add students manually</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-[#cddcf0] divide-y divide-[#e6f0fa]">
                    {courseStudents.map((cs) => (
                      <div key={cs.student_email} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#46464b]">
                              {cs.users?.name || cs.student_email}
                            </p>
                            <p className="text-xs text-gray-400">{cs.student_email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setStudentAction(
                                  studentAction?.email === cs.student_email && studentAction?.type === 'move'
                                    ? null
                                    : { email: cs.student_email, type: 'move' }
                                )
                                setTargetCourseId('')
                              }}
                              className="text-xs text-[#416ebe] hover:underline font-bold"
                              title="Move to another course"
                            >
                              Move
                            </button>
                            <button
                              onClick={() => {
                                setStudentAction(
                                  studentAction?.email === cs.student_email && studentAction?.type === 'add-to-course'
                                    ? null
                                    : { email: cs.student_email, type: 'add-to-course' }
                                )
                                setTargetCourseId('')
                              }}
                              className="text-xs text-green-600 hover:underline font-bold"
                              title="Enroll in additional course"
                            >
                              + Course
                            </button>
                            <button
                              onClick={() => confirmRemoveStudent(cs.student_email, cs.users?.name || cs.student_email)}
                              className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {/* Move / Add to course panel */}
                        {studentAction?.email === cs.student_email && (
                          <div className="mt-3 bg-[#f7fafd] rounded-xl p-3 border border-[#e6f0fa]">
                            <p className="text-xs font-bold text-gray-500 mb-2">
                              {studentAction.type === 'move'
                                ? 'Move to another course (removes from this one):'
                                : 'Enroll in an additional course:'}
                            </p>
                            <select
                              value={targetCourseId}
                              onChange={(e) => setTargetCourseId(e.target.value)}
                              className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#416ebe]"
                            >
                              <option value="">Choose course...</option>
                              {courses
                                .filter((c) => c.id !== selectedCourse?.id)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (!targetCourseId) return
                                  if (studentAction.type === 'move') {
                                    moveStudent(cs.student_email, targetCourseId)
                                  } else {
                                    addStudentToCourse(cs.student_email, targetCourseId)
                                  }
                                  setStudentAction(null)
                                  setTargetCourseId('')
                                }}
                                disabled={!targetCourseId}
                                className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50"
                              >
                                {studentAction.type === 'move' ? 'Move' : 'Enroll'}
                              </button>
                              <button
                                onClick={() => { setStudentAction(null); setTargetCourseId('') }}
                                className="px-4 py-2 text-xs text-gray-400 hover:text-[#46464b]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Edit course modal overlay */}
          {showNewCourse && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                <h2 className="text-lg font-bold text-[#416ebe] mb-4">
                  {editingCourse ? 'Edit Course' : 'New Course'}
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Course Name</label>
                    <input
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="e.g. Business English Advanced"
                      className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Description (optional)</label>
                    <textarea
                      value={courseDesc}
                      onChange={(e) => setCourseDesc(e.target.value)}
                      placeholder="Brief description of the course"
                      rows={3}
                      className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe] resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={saveCourse}
                    disabled={saving || !courseName.trim()}
                    className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingCourse ? 'Update' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewCourse(false)
                      setEditingCourse(null)
                      setCourseName('')
                      setCourseDesc('')
                    }}
                    className="px-6 py-3 text-sm text-gray-400 hover:text-[#46464b]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── COURSES LIST (MAIN DASHBOARD) ── */}
      {view === 'courses' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <img
              src="/logo.svg"
              alt="English with Laura"
              className="h-12 mb-3"
            />
            <h1 className="text-xl font-bold text-[#416ebe]">Superadmin Dashboard</h1>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Manage courses, teachers, and students</span>
              <span>·</span>
              <SignOutButton />
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setShowNewCourse(true)
                setEditingCourse(null)
                setCourseName('')
                setCourseDesc('')
              }}
              className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              + New Course
            </button>
            <button
              onClick={() => setView('invite-teacher')}
              className="flex-1 bg-white text-[#416ebe] border-2 border-[#416ebe] font-bold py-3 rounded-xl text-sm hover:bg-[#e6f0fa] transition-colors"
            >
              + Invite Teacher
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 text-center">
              <div className="text-2xl font-bold text-[#416ebe]">{courses.length}</div>
              <div className="text-xs text-gray-400">Courses</div>
            </div>
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 text-center">
              <div className="text-2xl font-bold text-[#416ebe]">{teachers.length}</div>
              <div className="text-xs text-gray-400">Teachers</div>
            </div>
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 text-center">
              <div className="text-2xl font-bold text-[#416ebe]">
                {courses.reduce((sum, c) => sum + c.student_count, 0)}
              </div>
              <div className="text-xs text-gray-400">Students</div>
            </div>
          </div>

          {/* Courses list */}
          <h2 className="text-sm font-bold text-gray-500 mb-3">All Courses</h2>
          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-sm text-gray-400">No courses yet. Create your first one!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => loadCourseDetail(course)}
                  className="bg-white rounded-2xl border-2 border-[#cddcf0] hover:border-[#416ebe] p-5 text-left transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-[#46464b] group-hover:text-[#416ebe] transition-colors">
                        {course.name}
                      </h3>
                      {course.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{course.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-400">
                          {course.teacher_count} teacher{course.teacher_count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-400">
                          {course.student_count} student{course.student_count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-400">
                          {course.lesson_count} lesson{course.lesson_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-300 group-hover:text-[#416ebe] transition-colors text-lg">
                      &rarr;
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Navigation to admin */}
          <div className="mt-8 flex flex-col gap-2">
            <button
              onClick={() => router.push('/admin')}
              className="w-full bg-white text-[#416ebe] border-2 border-[#cddcf0] hover:border-[#416ebe] font-bold py-3 rounded-xl text-sm transition-colors"
            >
              Go to Teacher Admin Panel
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            englishwithlaura.com
          </p>

          {/* New course modal */}
          {showNewCourse && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                <h2 className="text-lg font-bold text-[#416ebe] mb-4">New Course</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Course Name</label>
                    <input
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="e.g. Business English Advanced"
                      className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Description (optional)</label>
                    <textarea
                      value={courseDesc}
                      onChange={(e) => setCourseDesc(e.target.value)}
                      placeholder="Brief description of the course"
                      rows={3}
                      className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe] resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={saveCourse}
                    disabled={saving || !courseName.trim()}
                    className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Creating...' : 'Create Course'}
                  </button>
                  <button
                    onClick={() => { setShowNewCourse(false); setCourseName(''); setCourseDesc('') }}
                    className="px-6 py-3 text-sm text-gray-400 hover:text-[#46464b]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </>
  )
}
