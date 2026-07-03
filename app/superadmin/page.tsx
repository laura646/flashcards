'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import SignOutButton from '@/components/SignOutButton'
import { useRouter } from 'next/navigation'
import { COMMON_ISSUES_BY_LEVEL, COURSE_TYPES, COUNTRY_FLAGS } from '@/lib/common-issues'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_COLORS } from '@/lib/account-types'
import { isOwner } from '@/lib/owner'

interface Course {
  id: string
  name: string
  description: string | null
  invite_code: string
  created_at: string
  teacher_count: number
  student_count: number
  lesson_count: number
  level: string | null
  telegram_link: string | null
  lesson_link: string | null
  schedule: string | null
  schedule_days: string | null
  schedule_time: string | null
  schedule_duration_min: number | null
  start_date: string | null
  self_study: boolean | null
  total_planned_sessions: number | null
  teacher_notes: string | null
  course_type: string | null
  archived_at: string | null
}

const SA_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// "Mon,Wed" + "16:00" + 60 -> "Mon & Wed · 16:00 · 1h" (matches the course page).
function formatSchedule(days: string | null, time: string | null, durationMin: number | null): string | null {
  const parts: string[] = []
  if (days && days.trim()) {
    const tokens = days.split(',').map((t) => t.trim()).filter(Boolean)
    if (tokens.length === 1) parts.push(tokens[0])
    else if (tokens.length === 2) parts.push(`${tokens[0]} & ${tokens[1]}`)
    else if (tokens.length > 2) parts.push(tokens.slice(0, -1).join(', ') + ' & ' + tokens[tokens.length - 1])
  }
  if (time && time.trim()) parts.push(time.trim())
  if (durationMin) {
    const h = durationMin / 60
    parts.push(Number.isInteger(h) ? `${h}h` : `${durationMin}m`)
  }
  return parts.length ? parts.join(' · ') : null
}

const COURSE_LEVELS = [
  'Beginner', 'Elementary Low', 'Elementary High',
  'Pre-Intermediate Low', 'Pre-Intermediate High',
  'Intermediate Low', 'Intermediate High',
  'Upper-Intermediate Low', 'Upper-Intermediate High',
  'Advanced',
]

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
  country: string | null
  specialization: string | null
  course_count: number
  is_editor?: boolean
}

interface Student {
  email: string
  name: string
  level: string | null
  learning_goals: string | null
  company: string | null
  account_type: string | null
  common_issues_tags: string[]
  common_issues_comments: string | null
  courses: string[]
  created_at: string
}

interface Template {
  id: string
  title: string
  lesson_type: string
  template_category: string | null
  template_level: string | null
  flashcard_count: number
  exercise_count: number
  block_counts: Record<string, number>
  updated_at: string
}

const TEMPLATE_LEVELS = COURSE_LEVELS
const TEMPLATE_CATEGORIES = ['General English', 'Business English']

type View = 'courses' | 'course-detail' | 'invite-teacher' | 'content-bank' | 'all-teachers' | 'all-students' | 'archived' | 'all-courses'

const COUNTRIES = Object.keys(COUNTRY_FLAGS).sort()

export default function SuperadminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // State
  const [view, setView] = useState<View>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [archivedCourses, setArchivedCourses] = useState<Course[]>([])
  // ── All Courses search/filter (mirrors the Courses area) ──
  const [caSearch, setCaSearch] = useState('')
  const [caStatus, setCaStatus] = useState<'active' | 'archived' | 'all'>('active')
  const [caSort, setCaSort] = useState<'newest' | 'students' | 'az'>('newest')
  const [caLevel, setCaLevel] = useState<string | null>(null)
  const [caType, setCaType] = useState<string | null>(null)
  const caAllCourses = [...courses, ...archivedCourses]
  const caLevelOptions = Array.from(new Set(caAllCourses.map((c) => c.level).filter((l): l is string => !!l))).sort()
  const caTypeOptions = Array.from(new Set(caAllCourses.map((c) => c.course_type).filter((t): t is string => !!t))).sort()
  const caFiltered = (caStatus === 'active' ? courses : caStatus === 'archived' ? archivedCourses : caAllCourses)
    .filter((c) => (!caLevel || c.level === caLevel) && (!caType || c.course_type === caType) && (!caSearch.trim() || c.name.toLowerCase().includes(caSearch.trim().toLowerCase())))
    .sort((a, b) => (caSort === 'students' ? (b.student_count || 0) - (a.student_count || 0) : caSort === 'az' ? a.name.localeCompare(b.name) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Course form
  const [showNewCourse, setShowNewCourse] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [courseName, setCourseName] = useState('')
  const [courseDesc, setCourseDesc] = useState('')
  const [courseSelfStudy, setCourseSelfStudy] = useState(false)
  const [saving, setSaving] = useState(false)

  // Course detail
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courseTeachers, setCourseTeachers] = useState<CourseTeacher[]>([])
  const [courseStudents, setCourseStudents] = useState<CourseStudent[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Invite teacher
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [superadmins, setSuperadmins] = useState<{ email: string; name: string; created_at: string }[]>([])
  const [saInviteEmail, setSaInviteEmail] = useState('')
  const [saInviteName, setSaInviteName] = useState('')
  const [showInviteSa, setShowInviteSa] = useState(false)
  const [hrList, setHrList] = useState<{ email: string; name: string; created_at: string }[]>([])
  const [hrInviteEmail, setHrInviteEmail] = useState('')
  const [hrInviteName, setHrInviteName] = useState('')
  const [showInviteHr, setShowInviteHr] = useState(false)
  const [managingHr, setManagingHr] = useState<string | null>(null)
  const [hrCourseSel, setHrCourseSel] = useState<Set<string>>(new Set())
  const [hrStudentSel, setHrStudentSel] = useState<Set<string>>(new Set())
  const [hrStudentSearch, setHrStudentSearch] = useState('')
  const [savingHrAccess, setSavingHrAccess] = useState(false)
  const [inviting, setInviting] = useState(false)

  // Assign teacher to course
  const [showAssignTeacher, setShowAssignTeacher] = useState(false)
  const [assignEmail, setAssignEmail] = useState('')

  // Add student manually
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [addStudentEmail, setAddStudentEmail] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)

  // Course info editing
  const [editingCourseInfo, setEditingCourseInfo] = useState(false)
  const [editingInviteCode, setEditingInviteCode] = useState(false)
  const [inviteCodeDraft, setInviteCodeDraft] = useState('')
  const [savingInviteCode, setSavingInviteCode] = useState(false)
  const [courseInfoForm, setCourseInfoForm] = useState({
    level: '' as string,
    telegram_link: '',
    lesson_link: '',
    schedule_days: '',
    schedule_time: '',
    schedule_duration_min: 60,
    start_date: '',
    self_study: false,
    total_planned_sessions: '' as string,
    teacher_notes: '',
    course_type: '' as string,
  })
  const [savingCourseInfo, setSavingCourseInfo] = useState(false)

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    onConfirm: () => void
    confirmLabel?: string
  } | null>(null)

  // Student management
  const [studentAction, setStudentAction] = useState<{ email: string; type: 'move' | 'add-to-course' } | null>(null)
  const [targetCourseId, setTargetCourseId] = useState('')

  // Content Bank management
  const [cbTemplates, setCbTemplates] = useState<Template[]>([])
  const [cbLoading, setCbLoading] = useState(false)
  const [cbFilterLevel, setCbFilterLevel] = useState('')
  const [cbFilterCategory, setCbFilterCategory] = useState('')
  const [cbEditingId, setCbEditingId] = useState<string | null>(null)
  const [cbEditCategory, setCbEditCategory] = useState('')
  const [cbEditLevel, setCbEditLevel] = useState('')

  // Teacher profile editing
  const [editingTeacher, setEditingTeacher] = useState<string | null>(null)
  const [teacherForm, setTeacherForm] = useState({ name: '', country: '', specialization: '' })

  // Add student (no course)
  const [showAddNewStudent, setShowAddNewStudent] = useState(false)
  const [newStudentEmail, setNewStudentEmail] = useState('')
  const [newStudentName, setNewStudentName] = useState('')
  const [addingNewStudent, setAddingNewStudent] = useState(false)

  // Student profile editing
  const [editingStudent, setEditingStudent] = useState<string | null>(null)
  const [studentForm, setStudentForm] = useState({
    name: '',
    level: '',
    learning_goals: '',
    company: '',
    account_type: '',
    common_issues_tags: [] as string[],
    common_issues_comments: '',
  })
  const [saAccount, setSaAccount] = useState('')
  const [saCompany, setSaCompany] = useState('')
  const [customTag, setCustomTag] = useState('')
  const filteredStudents = allStudents.filter((s) => {
    if (saAccount && s.account_type !== saAccount) return false
    if (saCompany && !((s.company || '').toLowerCase().includes(saCompany.trim().toLowerCase()))) return false
    return true
  })
  const amOwner = isOwner(session?.user?.email)

  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const showToast = (msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }

  // ── Auth check ──
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  // ── Load courses ──
  const loadCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin?action=courses')
      const data = await res.json()
      setCourses(data.courses || [])
    } catch { showToast('Failed to load courses') }
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

  // Owner-only: grant/revoke a teacher's Editor permission (edit any shared
  // School Library lesson). Optimistic, then reload to confirm.
  const toggleEditor = useCallback(async (email: string, next: boolean) => {
    setTeachers((prev) => prev.map((t) => (t.email === email ? { ...t, is_editor: next } : t)))
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-editor', email, is_editor: next }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        showToast(b.error || 'Failed to update Editor access')
      }
      await loadTeachers()
    } catch {
      showToast('Failed to update Editor access')
      await loadTeachers()
    }
  }, [loadTeachers])

  const loadSuperadmins = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin?action=superadmins')
      const data = await res.json()
      setSuperadmins(data.superadmins || [])
    } catch {}
  }, [])

  const loadHr = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin?action=hr')
      const data = await res.json()
      setHrList(data.hr || [])
    } catch {}
  }, [])

  // ── Load all students ──
  const loadAllStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin?action=all-students')
      const data = await res.json()
      setAllStudents(data.students || [])
    } catch { showToast('Failed to load students') }
  }, [])

  // ── Load archived courses ──
  const loadArchivedCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin?action=courses&include_archived=true')
      const data = await res.json()
      setArchivedCourses((data.courses || []).filter((c: Course) => c.archived_at))
    } catch { showToast('Failed to load archived courses') }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'superadmin') {
      loadCourses()
      loadTeachers()
      loadAllStudents()
      loadSuperadmins()
      loadHr()
    }
  }, [status, session, loadCourses, loadTeachers, loadSuperadmins, loadHr])

  // Deep-link: /superadmin?view=hr opens the team view and jumps to the HR section.
  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'superadmin') return
    if (new URLSearchParams(window.location.search).get('view') === 'hr') {
      setView('all-teachers'); loadTeachers(); loadSuperadmins(); loadHr()
      setTimeout(() => document.getElementById('hr-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }, [status, session, loadTeachers, loadSuperadmins, loadHr])

  // ── Content Bank functions ──
  const loadContentBank = useCallback(async (level?: string, category?: string) => {
    setCbLoading(true)
    try {
      const params = new URLSearchParams({ action: 'list' })
      if (level) params.set('level', level)
      if (category) params.set('category', category)
      const res = await fetch(`/api/content-bank?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCbTemplates(data.templates || [])
    } catch { showToast('Failed to load templates') }
    setCbLoading(false)
  }, [])

  const openContentBank = () => {
    setView('content-bank')
    loadContentBank(cbFilterLevel, cbFilterCategory)
  }

  const cbUpdateTemplate = async (lessonId: string, enabled: boolean, category: string, level: string) => {
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-template',
          lesson_id: lessonId,
          is_template: enabled,
          template_category: category || null,
          template_level: level || null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(enabled ? 'Template updated' : 'Removed from Content Bank')
      setCbEditingId(null)
      loadContentBank(cbFilterLevel, cbFilterCategory)
    } catch { showToast('Failed to update template') }
  }

  // ── Load course detail ──
  const loadCourseDetail = async (course: Course) => {
    setSelectedCourse(course)
    setView('course-detail')
    setDetailLoading(true)
    setEditingCourseInfo(false)
    try {
      const res = await fetch(`/api/superadmin?action=course-detail&course_id=${course.id}`)
      const data = await res.json()
      setCourseTeachers(data.teachers || [])
      setCourseStudents(data.students || [])
      const c = data.course
      if (c) {
        setSelectedCourse({ ...course, ...c })
        setCourseInfoForm({
          level: c.level || '',
          telegram_link: c.telegram_link || '',
          lesson_link: c.lesson_link || '',
          schedule_days: c.schedule_days || '',
          schedule_time: c.schedule_time || '',
          schedule_duration_min: c.schedule_duration_min || 60,
          start_date: c.start_date || '',
          self_study: !!c.self_study,
          total_planned_sessions: c.total_planned_sessions?.toString() || '',
          teacher_notes: c.teacher_notes || '',
          course_type: c.course_type || '',
        })
      }
    } catch { showToast('Failed to load course details') }
    setDetailLoading(false)
  }

  // ── Save course info ──
  const saveCourseInfo = async () => {
    if (!selectedCourse) return
    setSavingCourseInfo(true)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-course',
          course_id: selectedCourse.id,
          level: courseInfoForm.level || null,
          telegram_link: courseInfoForm.telegram_link,
          lesson_link: courseInfoForm.lesson_link,
          schedule_days: courseInfoForm.schedule_days || null,
          schedule_time: courseInfoForm.schedule_time || null,
          schedule_duration_min: courseInfoForm.schedule_duration_min,
          start_date: courseInfoForm.start_date || null,
          self_study: courseInfoForm.self_study,
          total_planned_sessions: courseInfoForm.total_planned_sessions ? parseInt(courseInfoForm.total_planned_sessions) : null,
          teacher_notes: courseInfoForm.teacher_notes,
          course_type: courseInfoForm.course_type || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to save')
        return
      }
      showToast('Course info saved!')
      setEditingCourseInfo(false)
      setSelectedCourse({
        ...selectedCourse,
        level: courseInfoForm.level || null,
        telegram_link: courseInfoForm.telegram_link || null,
        lesson_link: courseInfoForm.lesson_link || null,
        schedule_days: courseInfoForm.schedule_days || null,
        schedule_time: courseInfoForm.schedule_time || null,
        schedule_duration_min: courseInfoForm.schedule_duration_min || null,
        start_date: courseInfoForm.start_date || null,
        self_study: courseInfoForm.self_study,
        total_planned_sessions: courseInfoForm.total_planned_sessions ? parseInt(courseInfoForm.total_planned_sessions) : null,
        teacher_notes: courseInfoForm.teacher_notes || null,
        course_type: courseInfoForm.course_type || null,
      })
    } catch { showToast('Failed to save course info') }
    setSavingCourseInfo(false)
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
          // self_study is only set on create (edit happens in Course Info now).
          ...(editingCourse ? {} : { self_study: courseSelfStudy }),
        }),
      })
      if (!res.ok) throw new Error()
      showToast(editingCourse ? 'Course updated!' : 'Course created!')
      // If we're editing the currently-open course detail, patch its visible state too
      if (editingCourse && selectedCourse?.id === editingCourse.id) {
        setSelectedCourse({ ...selectedCourse, name: courseName.trim(), description: courseDesc.trim() || null })
      }
      setShowNewCourse(false)
      setEditingCourse(null)
      setCourseName('')
      setCourseDesc('')
      setCourseSelfStudy(false)
      await loadCourses()
    } catch { showToast('Failed to save course') }
    setSaving(false)
  }

  // ── Delete course ──
  const deleteCourse = async (courseId: string) => {
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-course', course_id: courseId }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to delete course')
        return
      }
      showToast('Course deleted')
      if (view === 'course-detail') setView('courses')
      await loadCourses()
    } catch { showToast('Failed to delete course') }
  }

  // ── Archive course ──
  const archiveCourse = async (courseId: string) => {
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive-course', course_id: courseId }),
      })
      if (!res.ok) throw new Error()
      showToast('Course archived')
      setConfirmModal(null)
      if (view === 'course-detail') setView('courses')
      await loadCourses()
    } catch { showToast('Failed to archive course') }
  }

  // ── Restore course ──
  const restoreCourse = async (courseId: string) => {
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore-course', course_id: courseId }),
      })
      if (!res.ok) throw new Error()
      showToast('Course restored')
      await Promise.all([loadCourses(), loadArchivedCourses()])
    } catch { showToast('Failed to restore course') }
  }

  // ── Invite teacher ──
  const inviteTeacher = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite-teacher', email: inviteEmail, name: inviteName }),
      })
      if (!res.ok) throw new Error()
      showToast('Teacher invited!')
      setInviteEmail('')
      setInviteName('')
      setView('courses')
      await loadTeachers()
    } catch { showToast('Failed to invite teacher') }
    setInviting(false)
  }

  const inviteSuperadmin = async () => {
    if (!saInviteEmail.trim()) return
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite-superadmin', email: saInviteEmail, name: saInviteName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.error || 'Failed to invite superadmin'); return }
      showToast('Superadmin invited!')
      setSaInviteEmail(''); setSaInviteName(''); setShowInviteSa(false)
      loadSuperadmins()
    } catch { showToast('Failed to invite superadmin') }
  }

  const removeSuperadmin = (email: string, name: string) => {
    setConfirmModal({
      title: 'Remove Superadmin',
      message: `Remove ${name || email} as a superadmin? This deletes their account and admin access. This cannot be undone.`,
      confirmLabel: 'Yes, Remove',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/superadmin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-superadmin', email }),
          })
          const data = await res.json().catch(() => ({}))
          setConfirmModal(null)
          if (!res.ok) { showToast(data.error || 'Failed to remove superadmin'); return }
          showToast('Superadmin removed')
          loadSuperadmins()
        } catch { setConfirmModal(null); showToast('Failed to remove superadmin') }
      },
    })
  }

  const inviteHr = async () => {
    if (!hrInviteEmail.trim()) return
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite-hr', email: hrInviteEmail, name: hrInviteName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.error || 'Failed to invite HR'); return }
      showToast('HR invited!')
      setHrInviteEmail(''); setHrInviteName(''); setShowInviteHr(false)
      loadHr()
    } catch { showToast('Failed to invite HR') }
  }

  const removeHr = (email: string, name: string) => {
    setConfirmModal({
      title: 'Remove HR',
      message: `Remove ${name || email}? This deletes their account and all their access. This cannot be undone.`,
      confirmLabel: 'Yes, Remove',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/superadmin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-hr', email }),
          })
          const data = await res.json().catch(() => ({}))
          setConfirmModal(null)
          if (!res.ok) { showToast(data.error || 'Failed to remove HR'); return }
          showToast('HR removed')
          if (managingHr === email) setManagingHr(null)
          loadHr()
        } catch { setConfirmModal(null); showToast('Failed to remove HR') }
      },
    })
  }

  const openManageAccess = async (email: string) => {
    if (managingHr === email) { setManagingHr(null); return }
    setManagingHr(email)
    setHrStudentSearch('')
    setHrCourseSel(new Set())
    setHrStudentSel(new Set())
    try {
      const res = await fetch(`/api/superadmin?action=hr-access&hr_email=${encodeURIComponent(email)}`)
      const data = await res.json()
      setHrCourseSel(new Set<string>(data.course_ids || []))
      setHrStudentSel(new Set<string>(data.student_emails || []))
    } catch { showToast('Failed to load HR access') }
  }

  const saveHrAccess = async () => {
    if (!managingHr) return
    setSavingHrAccess(true)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-hr-access', hr_email: managingHr, course_ids: Array.from(hrCourseSel), student_emails: Array.from(hrStudentSel) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.error || 'Failed to save access'); setSavingHrAccess(false); return }
      showToast('Access saved')
      setManagingHr(null)
    } catch { showToast('Failed to save access') }
    setSavingHrAccess(false)
  }

  // ── Assign teacher to course ──
  const assignTeacher = async () => {
    if (!assignEmail || !selectedCourse) return
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign-teacher', course_id: selectedCourse.id, teacher_email: assignEmail }),
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
    } catch { showToast('Failed to assign teacher') }
  }

  // ── Remove teacher (with confirmation) ──
  const confirmRemoveTeacher = (email: string, name: string) => {
    setConfirmModal({
      title: 'Remove Teacher',
      message: `Are you sure you want to remove ${name} from ${selectedCourse?.name}?`,
      onConfirm: () => doRemoveTeacher(email),
    })
  }

  const doRemoveTeacher = async (email: string) => {
    if (!selectedCourse) return
    setConfirmModal(null)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-teacher', course_id: selectedCourse.id, teacher_email: email }),
      })
      if (!res.ok) { showToast('Failed to remove teacher'); return }
      showToast('Teacher removed')
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch { showToast('Failed to remove teacher') }
  }

  // ── Remove student (with confirmation) ──
  const confirmRemoveStudent = (email: string, name: string) => {
    setConfirmModal({
      title: 'Remove Student',
      message: `Are you sure you want to remove ${name} from ${selectedCourse?.name}? Their progress will be preserved.`,
      onConfirm: () => doRemoveStudent(email),
    })
  }

  const doRemoveStudent = async (email: string) => {
    if (!selectedCourse) return
    setConfirmModal(null)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-student', course_id: selectedCourse.id, student_email: email }),
      })
      if (!res.ok) { showToast('Failed to remove student'); return }
      showToast('Student removed (progress preserved)')
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch { showToast('Failed to remove student') }
  }

  // ── Add student manually ──
  const addStudent = async () => {
    if (!addStudentEmail.trim() || !selectedCourse) return
    setAddingStudent(true)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enroll-student', course_id: selectedCourse.id, student_email: addStudentEmail.trim().toLowerCase() }),
      })
      if (!res.ok) { showToast('Failed to add student'); return }
      showToast('Student added!')
      setAddStudentEmail('')
      setShowAddStudent(false)
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch { showToast('Failed to add student') }
    setAddingStudent(false)
  }

  // ── Move student ──
  const moveStudent = async (email: string, tgtCourseId: string) => {
    if (!selectedCourse) return
    try {
      await fetch('/api/superadmin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enroll-student', course_id: tgtCourseId, student_email: email }) })
      await fetch('/api/superadmin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove-student', course_id: selectedCourse.id, student_email: email }) })
      showToast('Student moved!')
      await Promise.all([loadCourseDetail(selectedCourse), loadCourses()])
    } catch { showToast('Failed to move student') }
  }

  // ── Add student to additional course ──
  const addStudentToCourse = async (email: string, tgtCourseId: string) => {
    try {
      const res = await fetch('/api/superadmin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enroll-student', course_id: tgtCourseId, student_email: email }) })
      if (!res.ok) { showToast('Failed to enroll'); return }
      showToast('Student enrolled!')
      await loadCourses()
    } catch { showToast('Failed to enroll') }
  }

  // ── Save custom invite code ──
  const saveInviteCode = async () => {
    if (!selectedCourse) return
    const codeRaw = inviteCodeDraft.trim()
    if (!/^[A-Za-z0-9]{3,20}$/.test(codeRaw)) {
      showToast('Code must be 3-20 letters or digits — no spaces or symbols.')
      return
    }
    setSavingInviteCode(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-course', course_id: selectedCourse.id, invite_code: codeRaw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'Failed to save invite code')
        setSavingInviteCode(false)
        return
      }
      const normalized = codeRaw.toUpperCase()
      setSelectedCourse({ ...selectedCourse, invite_code: normalized })
      setEditingInviteCode(false)
      showToast('Invite code saved!')
      await loadCourses()
    } catch {
      showToast('Failed to save invite code')
    }
    setSavingInviteCode(false)
  }

  // ── Regenerate invite code ──
  const regenerateInvite = async () => {
    if (!selectedCourse) return
    try {
      const res = await fetch('/api/superadmin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'regenerate-invite', course_id: selectedCourse.id }) })
      const data = await res.json()
      if (data.invite_code) {
        setSelectedCourse({ ...selectedCourse, invite_code: data.invite_code })
        showToast('Invite code regenerated!')
        await loadCourses()
      }
    } catch { showToast('Failed to regenerate') }
  }

  const copyInviteLink = () => {
    if (!selectedCourse) return
    navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.englishwithlaura.com'}/join/${selectedCourse.invite_code}`)
    showToast('Invite link copied!')
  }

  // ── Save teacher profile ──
  const saveTeacherProfile = async (email: string) => {
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-teacher-profile', email, ...teacherForm }),
      })
      if (!res.ok) throw new Error()
      showToast('Teacher profile updated!')
      setEditingTeacher(null)
      await loadTeachers()
    } catch { showToast('Failed to update profile') }
  }

  // ── Save student profile ──
  const saveStudentProfile = async (email: string) => {
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-student-profile', email, ...studentForm }),
      })
      if (!res.ok) throw new Error()
      showToast('Student profile updated!')
      setEditingStudent(null)
      await loadAllStudents()
    } catch { showToast('Failed to update profile') }
  }

  // ── Add new student (no course) ──
  const createNewStudent = async () => {
    if (!newStudentEmail.trim()) return
    setAddingNewStudent(true)
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-student', email: newStudentEmail, name: newStudentName }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || 'Failed to add student')
        setAddingNewStudent(false)
        return
      }

      // Save profile data if any was filled in
      const hasProfile = studentForm.level || studentForm.learning_goals || studentForm.company || studentForm.account_type || studentForm.common_issues_tags.length > 0 || studentForm.common_issues_comments
      if (hasProfile) {
        await fetch('/api/superadmin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-student-profile', email: newStudentEmail.trim().toLowerCase(), ...studentForm }),
        })
      }

      showToast('Student added!')
      setNewStudentEmail('')
      setNewStudentName('')
      setShowAddNewStudent(false)
      setStudentForm({ name: '', level: '', learning_goals: '', company: '', account_type: '', common_issues_tags: [], common_issues_comments: '' })
      setCustomTag('')
      await loadAllStudents()
    } catch { showToast('Failed to add student') }
    setAddingNewStudent(false)
  }

  // ── Toggle common issue tag ──
  const toggleTag = (tag: string) => {
    setStudentForm(f => ({
      ...f,
      common_issues_tags: f.common_issues_tags.includes(tag)
        ? f.common_issues_tags.filter(t => t !== tag)
        : [...f.common_issues_tags, tag],
    }))
  }

  const addCustomTag = () => {
    if (!customTag.trim()) return
    if (!studentForm.common_issues_tags.includes(customTag.trim())) {
      setStudentForm(f => ({ ...f, common_issues_tags: [...f.common_issues_tags, customTag.trim()] }))
    }
    setCustomTag('')
  }

  // ── Auth guards ──
  if (status === 'loading') return <main className="min-h-screen flex items-center justify-center"><div className="text-[#416ebe] text-sm">Loading...</div></main>
  if (status === 'unauthenticated' || session?.user?.role !== 'superadmin') return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-4xl mb-3">&#128274;</div>
        <p className="text-sm text-gray-400">Access restricted to superadmin.</p>
        <button onClick={() => router.push('/home')} className="mt-4 text-sm text-[#416ebe] hover:underline">&larr; Go home</button>
      </div>
    </main>
  )
  if (loading) return <main className="min-h-screen flex items-center justify-center"><div className="text-[#416ebe] text-sm">Loading...</div></main>

  const totalStudents = allStudents.length > 0 ? allStudents.length : courses.reduce((sum, c) => sum + c.student_count, 0)

  // ══════════════════════════════════════
  //  MAIN RENDER
  // ══════════════════════════════════════
  return (
    <>
      {/* TOAST */}
      {toast && <div className="fixed top-4 right-4 bg-[#416ebe] text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-[#46464b] mb-2">{confirmModal.title}</h2>
            <p className="text-sm text-gray-500 mb-6">{confirmModal.message}</p>
            <div className="flex gap-2">
              <button onClick={confirmModal.onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                {confirmModal.confirmLabel || 'Yes, confirm'}
              </button>
              <button onClick={() => setConfirmModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#46464b] font-bold py-3 rounded-xl text-sm transition-colors">
                No, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ ALL TEACHERS VIEW ══════════ */}
      {view === 'all-teachers' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button onClick={() => setView('courses')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4">&larr; Back to dashboard</button>

          {/* ── Superadmins ── */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">Superadmins ({superadmins.length})</h1>
              <p className="text-xs text-gray-400 mt-1">{amOwner ? 'School administrators with full access. Only you can invite or remove them.' : 'Only the owner can invite or remove superadmins.'}</p>
            </div>
            {amOwner && (
              <button onClick={() => setShowInviteSa(v => !v)} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0]">{showInviteSa ? 'Cancel' : '+ Invite Superadmin'}</button>
            )}
          </div>
          {amOwner && showInviteSa && (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 mb-3 flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Email</label>
                <input type="email" value={saInviteEmail} onChange={e => setSaInviteEmail(e.target.value)} placeholder="name@example.com" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Name (optional)</label>
                <input type="text" value={saInviteName} onChange={e => setSaInviteName(e.target.value)} placeholder="Full name" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
              </div>
              <button onClick={inviteSuperadmin} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0] whitespace-nowrap">Send invite</button>
            </div>
          )}
          <div className="flex flex-col gap-2 mb-8">
            {superadmins.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5 text-center"><p className="text-sm text-gray-400">No superadmins yet.</p></div>
            ) : superadmins.map(a => {
              const owner = isOwner(a.email)
              return (
                <div key={a.email} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#46464b] truncate">
                      {a.name || 'Unnamed'}
                      {owner && <span className="ml-2 px-2 py-0.5 bg-[#eef0fb] text-[#416ebe] text-[10px] rounded-full align-middle">Owner</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{a.email}</p>
                  </div>
                  {amOwner && !owner && (
                    <button onClick={() => removeSuperadmin(a.email, a.name)} className="text-xs font-bold text-red-500 border-2 border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl whitespace-nowrap">Remove</button>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── HR (read-only viewers) ── */}
          <div id="hr-section" className="flex items-center justify-between mb-2 scroll-mt-6">
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">HR ({hrList.length})</h1>
              <p className="text-xs text-gray-400 mt-1">View-only accounts. Assign the courses and individual students each HR can follow.</p>
            </div>
            <button onClick={() => setShowInviteHr(v => !v)} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0]">{showInviteHr ? 'Cancel' : '+ Invite HR'}</button>
          </div>
          {showInviteHr && (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 mb-3 flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Email</label>
                <input type="email" value={hrInviteEmail} onChange={e => setHrInviteEmail(e.target.value)} placeholder="name@example.com" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Name (optional)</label>
                <input type="text" value={hrInviteName} onChange={e => setHrInviteName(e.target.value)} placeholder="Full name" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
              </div>
              <button onClick={inviteHr} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0] whitespace-nowrap">Send invite</button>
            </div>
          )}
          <div className="flex flex-col gap-2 mb-8">
            {hrList.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5 text-center"><p className="text-sm text-gray-400">No HR accounts yet.</p></div>
            ) : hrList.map(h => (
              <div key={h.email} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#46464b] truncate">{h.name || 'Unnamed'} <span className="ml-1 px-2 py-0.5 bg-[#f3eafe] text-[#5b3aa0] text-[10px] rounded-full align-middle">HR</span></p>
                    <p className="text-xs text-gray-400 truncate">{h.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openManageAccess(h.email)} className="text-xs font-bold text-[#416ebe] border-2 border-[#cddcf0] hover:bg-[#e6f0fa] px-3 py-1.5 rounded-xl whitespace-nowrap">{managingHr === h.email ? 'Close' : 'Manage access'}</button>
                    <button onClick={() => removeHr(h.email, h.name)} className="text-xs font-bold text-red-500 border-2 border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl whitespace-nowrap">Remove</button>
                  </div>
                </div>
                {managingHr === h.email && (
                  <div className="mt-4 pt-4 border-t border-[#e6f0fa] grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">Courses ({hrCourseSel.size})</p>
                      <div className="max-h-52 overflow-y-auto pr-1 flex flex-col gap-1">
                        {courses.length === 0 ? <p className="text-xs text-gray-400">No courses.</p> : courses.map(c => (
                          <label key={c.id} className="flex items-center gap-2 text-sm text-[#46464b] py-1">
                            <input type="checkbox" checked={hrCourseSel.has(c.id)} onChange={() => setHrCourseSel(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} />
                            <span className="truncate">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">Individual students ({hrStudentSel.size})</p>
                      <input type="text" value={hrStudentSearch} onChange={e => setHrStudentSearch(e.target.value)} placeholder="Search students" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-1.5 text-xs mb-2 focus:outline-none focus:border-[#416ebe]" />
                      <div className="max-h-44 overflow-y-auto pr-1 flex flex-col gap-1">
                        {allStudents.filter(s => { const q = hrStudentSearch.trim().toLowerCase(); return !q || (s.name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q) }).slice(0, 50).map(s => (
                          <label key={s.email} className="flex items-center gap-2 text-sm text-[#46464b] py-1">
                            <input type="checkbox" checked={hrStudentSel.has(s.email)} onChange={() => setHrStudentSel(prev => { const n = new Set(prev); if (n.has(s.email)) n.delete(s.email); else n.add(s.email); return n })} />
                            <span className="truncate">{s.name || s.email}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2">
                      <button onClick={() => setManagingHr(null)} className="px-4 py-2 text-xs font-bold text-gray-400">Cancel</button>
                      <button onClick={saveHrAccess} disabled={savingHrAccess} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0] disabled:opacity-50">{savingHrAccess ? 'Saving…' : 'Save access'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Teachers ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-[#416ebe]">All Teachers ({teachers.length})</h1>
              <p className="text-xs text-gray-400 mt-1">Click on a teacher to edit their profile.</p>
            </div>
            <button onClick={() => setView('invite-teacher')} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0]">+ Invite Teacher</button>
          </div>

          {teachers.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
              <p className="text-sm text-gray-400">No teachers yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {teachers.map(t => (
                <div key={t.email} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {t.country && COUNTRY_FLAGS[t.country] && (
                        <span className="text-2xl">{COUNTRY_FLAGS[t.country]}</span>
                      )}
                      <div>
                        <p className="text-sm font-bold text-[#46464b]">{t.name || 'Unnamed'}</p>
                        <p className="text-xs text-gray-400">{t.email}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                          {t.specialization && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">{t.specialization}</span>}
                          <span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-xs rounded-full">{t.course_count} course{t.course_count !== 1 ? 's' : ''}</span>
                          {amOwner ? (
                            <button
                              onClick={() => toggleEditor(t.email, !t.is_editor)}
                              title="Editors can edit any shared School Library lesson, even ones they didn't create"
                              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${t.is_editor ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-white text-gray-400 border-[#cddcf0] hover:border-[#416ebe]'}`}
                            >
                              {t.is_editor ? '✎ Editor ✓' : '✎ Make Editor'}
                            </button>
                          ) : (
                            t.is_editor && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">✎ Editor</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (editingTeacher === t.email) { setEditingTeacher(null); return }
                        setEditingTeacher(t.email)
                        setTeacherForm({ name: t.name || '', country: t.country || '', specialization: t.specialization || '' })
                      }}
                      className="text-xs text-[#416ebe] font-bold hover:underline"
                    >
                      {editingTeacher === t.email ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {editingTeacher === t.email && (
                    <div className="mt-4 pt-4 border-t border-[#e6f0fa] space-y-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Name</label>
                        <input type="text" value={teacherForm.name} onChange={e => setTeacherForm(f => ({ ...f, name: e.target.value }))} placeholder="Teacher's full name" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Country</label>
                        <select value={teacherForm.country} onChange={e => setTeacherForm(f => ({ ...f, country: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
                          <option value="">Not set</option>
                          {COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_FLAGS[c]} {c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Specialization</label>
                        <input type="text" value={teacherForm.specialization} onChange={e => setTeacherForm(f => ({ ...f, specialization: e.target.value }))} placeholder="e.g. Business English, Exam Prep" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                      </div>
                      <button onClick={() => saveTeacherProfile(t.email)} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-2.5 rounded-xl text-sm transition-colors">Save</button>

                      <button
                        onClick={() => setConfirmModal({
                          title: 'Delete Teacher',
                          message: `Are you sure you want to permanently delete ${t.name || t.email}? This will remove them from all courses. This cannot be undone.`,
                          confirmLabel: 'Yes, Delete',
                          onConfirm: async () => {
                            try {
                              await fetch('/api/superadmin', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'delete-teacher', email: t.email }),
                              })
                              setConfirmModal(null)
                              setEditingTeacher(null)
                              loadTeachers()
                            } catch {
                              setConfirmModal(null)
                            }
                          },
                        })}
                        className="w-full border-2 border-red-200 text-red-500 hover:bg-red-50 font-bold py-2.5 rounded-xl text-sm transition-colors mt-2"
                      >
                        Delete Teacher
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ══════════ ALL STUDENTS VIEW ══════════ */}
      {view === 'all-students' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button onClick={() => setView('courses')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4">&larr; Back to dashboard</button>
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold text-[#416ebe]">All Students ({filteredStudents.length})</h1>
            <button onClick={() => { setShowAddNewStudent(!showAddNewStudent); setStudentForm({ name: '', level: '', learning_goals: '', company: '', account_type: '', common_issues_tags: [], common_issues_comments: '' }); setCustomTag(''); setNewStudentEmail(''); setNewStudentName('') }} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0]">+ Add Student</button>
          </div>
          <p className="text-xs text-gray-400 mb-3">Click Edit to update student profiles with level, goals, and common issues.</p>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <select value={saAccount} onChange={e => setSaAccount(e.target.value)} className="border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
              <option value="">All account types</option>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={saCompany} onChange={e => setSaCompany(e.target.value)} placeholder="Filter by company…" className="border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm w-52 focus:outline-none focus:border-[#416ebe]" />
            {(saAccount || saCompany) && <button onClick={() => { setSaAccount(''); setSaCompany('') }} className="text-xs font-bold text-gray-400 hover:text-[#416ebe] px-2">Clear</button>}
          </div>

          {showAddNewStudent && (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5 mb-4">
              <h3 className="text-sm font-bold text-[#46464b] mb-3">Add Student (without course)</h3>
              <p className="text-xs text-gray-400 mb-3">Add a student to the system. You can assign them to a course later.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Name</label>
                  <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="e.g. John Smith" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Email (Google account)</label>
                  <input type="email" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} placeholder="e.g. student@gmail.com" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                </div>

                <hr className="border-[#e6f0fa]" />

                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Level</label>
                  <select value={studentForm.level} onChange={e => setStudentForm(f => ({ ...f, level: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
                    <option value="">Not set</option>
                    {COURSE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Learning Goals</label>
                  <textarea value={studentForm.learning_goals} onChange={e => setStudentForm(f => ({ ...f, learning_goals: e.target.value }))} placeholder="What does this student want to achieve?" rows={2} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe] resize-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Company (optional)</label>
                  <input type="text" value={studentForm.company} onChange={e => setStudentForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Google, Freelancer" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                  <label className="text-xs font-bold text-gray-500 block mb-1 mt-3">Account type</label>
                  <select value={studentForm.account_type} onChange={e => setStudentForm(f => ({ ...f, account_type: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
                    <option value="">Not set</option>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Common Issues Tags */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-2">Common Issues / Mistakes</label>
                  {studentForm.level ? (
                    <>
                      <p className="text-[10px] text-gray-400 mb-2">Tags for {studentForm.level} level. Click to toggle.</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(COMMON_ISSUES_BY_LEVEL[studentForm.level] || []).map((tag, i) => (
                          <button key={i} onClick={() => toggleTag(tag)} className={`px-2 py-1 text-[11px] rounded-full border transition-colors ${studentForm.common_issues_tags.includes(tag) ? 'bg-red-100 border-red-300 text-red-700 font-semibold' : 'bg-white border-[#cddcf0] text-gray-500 hover:border-red-300'}`}>{tag}</button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-400 mb-2">Select a level above to see level-specific tags.</p>
                  )}
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={customTag} onChange={e => setCustomTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomTag()} placeholder="Other (type custom issue)..." className="flex-1 border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#416ebe]" />
                    <button onClick={addCustomTag} disabled={!customTag.trim()} className="px-3 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg disabled:opacity-50">Add</button>
                  </div>
                  {studentForm.common_issues_tags.length > 0 && (
                    <div className="bg-red-50 rounded-xl p-3 mb-2">
                      <p className="text-[10px] font-bold text-red-500 mb-1.5">Selected ({studentForm.common_issues_tags.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {studentForm.common_issues_tags.map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full">
                            {tag.length > 50 ? tag.substring(0, 50) + '...' : tag}
                            <button onClick={() => toggleTag(tag)} className="text-red-400 hover:text-red-600">&times;</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Comments</label>
                  <textarea value={studentForm.common_issues_comments} onChange={e => setStudentForm(f => ({ ...f, common_issues_comments: e.target.value }))} placeholder="Additional notes about this student's issues..." rows={2} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe] resize-none" />
                </div>

                <div className="flex gap-2">
                  <button onClick={createNewStudent} disabled={addingNewStudent || !newStudentEmail.trim()} className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">{addingNewStudent ? 'Adding...' : 'Add Student'}</button>
                  <button onClick={() => { setShowAddNewStudent(false); setNewStudentEmail(''); setNewStudentName(''); setStudentForm({ name: '', level: '', learning_goals: '', company: '', account_type: '', common_issues_tags: [], common_issues_comments: '' }); setCustomTag('') }} className="px-6 py-2.5 text-sm text-gray-400">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
              <p className="text-sm text-gray-400">{allStudents.length === 0 ? 'No students yet.' : 'No students match your filters.'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredStudents.map(s => (
                <div key={s.email} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#46464b]">{s.name || 'Unnamed'}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {s.level && <span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-xs rounded-full font-medium">{s.level}</span>}
                        {s.company && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{s.company}</span>}
                        {s.account_type && <span className="px-2 py-0.5 text-xs rounded-full font-medium" style={{ backgroundColor: ACCOUNT_TYPE_COLORS[s.account_type]?.bg, color: ACCOUNT_TYPE_COLORS[s.account_type]?.text }}>{s.account_type}</span>}
                        {s.courses.length > 0 ? <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full">{s.courses.length} course{s.courses.length !== 1 ? 's' : ''}</span> : <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs rounded-full">No course</span>}
                      </div>
                      {s.courses.length > 0 && <p className="text-xs text-gray-400 mt-1">{s.courses.join(', ')}</p>}
                      {s.common_issues_tags && s.common_issues_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.common_issues_tags.map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] rounded-full">{tag.length > 40 ? tag.substring(0, 40) + '...' : tag}</span>
                          ))}
                        </div>
                      )}
                      {s.learning_goals && <p className="text-xs text-gray-500 mt-1"><strong>Goals:</strong> {s.learning_goals}</p>}
                    </div>
                    <button
                      onClick={() => {
                        if (editingStudent === s.email) { setEditingStudent(null); return }
                        setEditingStudent(s.email)
                        setStudentForm({
                          name: s.name || '',
                          level: s.level || '',
                          learning_goals: s.learning_goals || '',
                          company: s.company || '',
                          account_type: s.account_type || '',
                          common_issues_tags: s.common_issues_tags || [],
                          common_issues_comments: s.common_issues_comments || '',
                        })
                        setCustomTag('')
                      }}
                      className="text-xs text-[#416ebe] font-bold hover:underline shrink-0"
                    >
                      {editingStudent === s.email ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {editingStudent === s.email && (
                    <div className="mt-4 pt-4 border-t border-[#e6f0fa] space-y-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Name</label>
                        <input type="text" value={studentForm.name} onChange={e => setStudentForm(f => ({ ...f, name: e.target.value }))} placeholder="Student's full name" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Level</label>
                        <select value={studentForm.level} onChange={e => setStudentForm(f => ({ ...f, level: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
                          <option value="">Not set</option>
                          {COURSE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Learning Goals</label>
                        <textarea value={studentForm.learning_goals} onChange={e => setStudentForm(f => ({ ...f, learning_goals: e.target.value }))} placeholder="What does this student want to achieve?" rows={2} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe] resize-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Company (optional)</label>
                        <input type="text" value={studentForm.company} onChange={e => setStudentForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Google, Freelancer" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                  <label className="text-xs font-bold text-gray-500 block mb-1 mt-3">Account type</label>
                  <select value={studentForm.account_type} onChange={e => setStudentForm(f => ({ ...f, account_type: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
                    <option value="">Not set</option>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                      </div>

                      {/* Common Issues Tags */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-2">Common Issues / Mistakes</label>
                        {studentForm.level ? (
                          <>
                            <p className="text-[10px] text-gray-400 mb-2">Tags for {studentForm.level} level. Click to toggle.</p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {(COMMON_ISSUES_BY_LEVEL[studentForm.level] || []).map((tag, i) => (
                                <button
                                  key={i}
                                  onClick={() => toggleTag(tag)}
                                  className={`px-2 py-1 text-[11px] rounded-full border transition-colors ${
                                    studentForm.common_issues_tags.includes(tag)
                                      ? 'bg-red-100 border-red-300 text-red-700 font-semibold'
                                      : 'bg-white border-[#cddcf0] text-gray-500 hover:border-red-300'
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-[10px] text-gray-400 mb-2">Select a level above to see level-specific tags.</p>
                        )}

                        {/* Custom tags */}
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={customTag}
                            onChange={e => setCustomTag(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                            placeholder="Other (type custom issue)..."
                            className="flex-1 border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#416ebe]"
                          />
                          <button onClick={addCustomTag} disabled={!customTag.trim()} className="px-3 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg disabled:opacity-50">Add</button>
                        </div>

                        {/* Show selected tags */}
                        {studentForm.common_issues_tags.length > 0 && (
                          <div className="bg-red-50 rounded-xl p-3 mb-2">
                            <p className="text-[10px] font-bold text-red-500 mb-1.5">Selected ({studentForm.common_issues_tags.length}):</p>
                            <div className="flex flex-wrap gap-1">
                              {studentForm.common_issues_tags.map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full">
                                  {tag.length > 50 ? tag.substring(0, 50) + '...' : tag}
                                  <button onClick={() => toggleTag(tag)} className="text-red-400 hover:text-red-600">&times;</button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Comments</label>
                        <textarea value={studentForm.common_issues_comments} onChange={e => setStudentForm(f => ({ ...f, common_issues_comments: e.target.value }))} placeholder="Additional notes about this student's issues..." rows={2} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe] resize-none" />
                      </div>

                      <button onClick={() => saveStudentProfile(s.email)} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-2.5 rounded-xl text-sm transition-colors">Save Student Profile</button>

                      <button
                        onClick={() => setConfirmModal({
                          title: 'Delete Student',
                          message: `Are you sure you want to permanently delete ${s.name || s.email}? This will remove all their data, progress, and course enrollments. This cannot be undone.`,
                          confirmLabel: 'Yes, Delete',
                          onConfirm: async () => {
                            try {
                              await fetch('/api/superadmin', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'delete-student', email: s.email }),
                              })
                              setConfirmModal(null)
                              setEditingStudent(null)
                              loadAllStudents()
                            } catch {
                              setConfirmModal(null)
                            }
                          },
                        })}
                        className="w-full border-2 border-red-200 text-red-500 hover:bg-red-50 font-bold py-2.5 rounded-xl text-sm transition-colors mt-2"
                      >
                        Delete Student
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ══════════ ALL COURSES VIEW ══════════ */}
      {view === 'all-courses' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button onClick={() => setView('courses')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4">&larr; Back to dashboard</button>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-[#416ebe]">All Courses <span className="text-sm font-normal text-gray-400">({caFiltered.length})</span></h1>
            <div className="flex gap-2">
              <button onClick={() => { setView('archived'); loadArchivedCourses() }} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors">View Archived</button>
              <button onClick={() => { setShowNewCourse(true); setEditingCourse(null); setCourseName(''); setCourseDesc(''); setCourseSelfStudy(false) }} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors">+ New Course</button>
            </div>
          </div>

          {/* Search + filters (same as the Courses area) */}
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-3 mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={caSearch}
                onChange={(e) => setCaSearch(e.target.value)}
                placeholder="Search courses…"
                className="flex-1 min-w-[200px] border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]"
              />
              <div className="flex rounded-xl border-2 border-[#cddcf0] overflow-hidden text-xs font-bold">
                {(['active', 'archived', 'all'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => { setCaStatus(st); if (st !== 'active' && archivedCourses.length === 0) loadArchivedCourses() }}
                    className={`px-3 py-2 capitalize transition-colors ${caStatus === st ? 'bg-[#416ebe] text-white' : 'text-gray-500 hover:bg-[#e6f0fa]'}`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <select
                value={caSort}
                onChange={(e) => setCaSort(e.target.value as 'newest' | 'students' | 'az')}
                className="border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-xs font-bold text-gray-600 focus:outline-none focus:border-[#416ebe]"
              >
                <option value="newest">Newest</option>
                <option value="students">Most students</option>
                <option value="az">A–Z</option>
              </select>
            </div>
            {(caLevelOptions.length > 0 || caTypeOptions.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {caLevelOptions.length > 0 && <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mr-0.5">Level</span>}
                {caLevelOptions.map((l) => (
                  <button key={l} onClick={() => setCaLevel(caLevel === l ? null : l)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${caLevel === l ? 'bg-[#416ebe] text-white border-[#416ebe]' : 'bg-white text-gray-600 border-[#cddcf0] hover:border-[#416ebe]'}`}>{l}</button>
                ))}
                {caTypeOptions.length > 0 && <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 ml-2 mr-0.5">Type</span>}
                {caTypeOptions.map((t) => (
                  <button key={t} onClick={() => setCaType(caType === t ? null : t)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${caType === t ? 'bg-[#416ebe] text-white border-[#416ebe]' : 'bg-white text-gray-600 border-[#cddcf0] hover:border-[#416ebe]'}`}>{t}</button>
                ))}
                {(caLevel || caType || caSearch) && <button onClick={() => { setCaLevel(null); setCaType(null); setCaSearch('') }} className="text-xs text-gray-400 hover:text-[#416ebe] ml-1">Clear</button>}
              </div>
            )}
          </div>

          {caFiltered.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
              <p className="text-sm text-gray-400">{courses.length === 0 && archivedCourses.length === 0 ? 'No courses yet. Create your first one!' : 'No courses match your search or filters.'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {caFiltered.map(course => (
                <button key={course.id} onClick={() => loadCourseDetail(course)} className="bg-white rounded-2xl border-2 border-[#cddcf0] hover:border-[#416ebe] p-5 text-left transition-all group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-[#46464b] group-hover:text-[#416ebe] transition-colors">{course.name}</h3>
                      {course.description && <p className="text-xs text-gray-400 mt-0.5">{course.description}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        {course.course_type && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">{course.course_type}</span>}
                        {course.level && <span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-xs rounded-full">{course.level}</span>}
                        {course.archived_at && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Archived</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-400">{course.teacher_count} teacher{course.teacher_count !== 1 ? 's' : ''}</span>
                        <span className="text-xs text-gray-400">{course.student_count} student{course.student_count !== 1 ? 's' : ''}</span>
                        <span className="text-xs text-gray-400">{course.lesson_count} lesson{course.lesson_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className="text-gray-300 group-hover:text-[#416ebe] transition-colors text-lg">&rarr;</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* New course modal */}
          {showNewCourse && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                <h2 className="text-lg font-bold text-[#416ebe] mb-4">New Course</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Course Name</label>
                    <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g. Business English Advanced" className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Description (optional)</label>
                    <textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)} placeholder="Brief description" rows={3} className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe] resize-none" />
                  </div>
                  {!editingCourse && (
                    <label className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#cddcf0] px-4 py-3 cursor-pointer">
                      <span className="min-w-0">
                        <span className="text-sm font-bold text-[#46464b] block">Self-study course</span>
                        <span className="text-xs text-gray-400 leading-snug">No live classes — hides attendance.</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={courseSelfStudy}
                        onClick={() => setCourseSelfStudy(v => !v)}
                        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${courseSelfStudy ? 'bg-[#00aff0]' : 'bg-[#cddcf0]'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${courseSelfStudy ? 'translate-x-5' : ''}`} />
                      </button>
                    </label>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={saveCourse} disabled={saving || !courseName.trim()} className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">{saving ? 'Creating...' : 'Create Course'}</button>
                  <button onClick={() => { setShowNewCourse(false); setCourseName(''); setCourseDesc('') }} className="px-6 py-3 text-sm text-gray-400">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ══════════ ARCHIVED COURSES VIEW ══════════ */}
      {view === 'archived' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button onClick={() => setView('courses')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4">&larr; Back to dashboard</button>
          <h1 className="text-xl font-bold text-[#416ebe] mb-1">Archived Courses</h1>
          <p className="text-xs text-gray-400 mb-6">Archived courses are read-only for students. Restore to make them active again.</p>

          {archivedCourses.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
              <p className="text-sm text-gray-400">No archived courses.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {archivedCourses.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5 opacity-75">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#46464b]">{c.name}</h3>
                      {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        Archived {c.archived_at ? new Date(c.archived_at).toLocaleDateString() : ''}
                      </p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-400">{c.teacher_count} teacher{c.teacher_count !== 1 ? 's' : ''}</span>
                        <span className="text-xs text-gray-400">{c.student_count} student{c.student_count !== 1 ? 's' : ''}</span>
                        <span className="text-xs text-gray-400">{c.lesson_count} lesson{c.lesson_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => restoreCourse(c.id)} className="px-3 py-1.5 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0]">Restore</button>
                      <button onClick={() => setConfirmModal({
                        title: 'Delete Course',
                        message: `Permanently delete "${c.name}"? This cannot be undone.`,
                        onConfirm: () => { deleteCourse(c.id); setConfirmModal(null); loadArchivedCourses() },
                        confirmLabel: 'Yes, delete',
                      })} className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-bold rounded-lg hover:border-red-400">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ══════════ INVITE TEACHER VIEW ══════════ */}
      {view === 'invite-teacher' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button onClick={() => setView('courses')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4">&larr; Back to dashboard</button>
          <h1 className="text-xl font-bold text-[#416ebe] mb-6">Invite a Teacher</h1>
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Teacher&apos;s Name</label>
              <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="e.g. John Smith" className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe]" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Teacher&apos;s Email (Google account)</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="e.g. john@gmail.com" className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe]" />
            </div>
            <p className="text-xs text-gray-400">An invite email will be sent. When they sign in with this Google account, they&apos;ll be recognized as a teacher.</p>
            <button onClick={inviteTeacher} disabled={inviting || !inviteEmail.trim()} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
              {inviting ? 'Sending invite...' : 'Send Invite'}
            </button>
          </div>
        </main>
      )}

      {/* ══════════ COURSE DETAIL VIEW ══════════ */}
      {view === 'course-detail' && selectedCourse && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button onClick={() => setView('courses')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-4">&larr; Back to courses</button>

          {/* Course header */}
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-[#416ebe]">{selectedCourse.name}</h1>
                {selectedCourse.description && <p className="text-sm text-gray-500 mt-1">{selectedCourse.description}</p>}
                <div className="flex gap-2 mt-2">
                  {selectedCourse.course_type && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium">{selectedCourse.course_type}</span>}
                  {selectedCourse.level && <span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-xs rounded-full font-medium">{selectedCourse.level}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setEditingCourse(selectedCourse); setCourseName(selectedCourse.name); setCourseDesc(selectedCourse.description || ''); setShowNewCourse(true) }} className="text-xs text-[#416ebe] hover:underline font-bold">Edit</button>
                <button onClick={() => setConfirmModal({
                  title: 'Archive Course',
                  message: `Archive "${selectedCourse.name}"? Students will still be able to view their content (read-only).`,
                  onConfirm: () => archiveCourse(selectedCourse.id),
                  confirmLabel: 'Yes, archive',
                })} className="text-xs text-amber-600 hover:underline font-bold">Archive</button>
                <button onClick={() => setConfirmModal({
                  title: 'Delete Course',
                  message: `Permanently delete "${selectedCourse.name}"? This cannot be undone.`,
                  onConfirm: () => { deleteCourse(selectedCourse.id); setConfirmModal(null) },
                  confirmLabel: 'Yes, delete',
                })} className="text-xs text-red-400 hover:underline font-bold">Delete</button>
              </div>
            </div>
          </div>

          {/* Course Info Section */}
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[#416ebe]">Course Information</h2>
              <button onClick={() => {
                if (editingCourseInfo) { setEditingCourseInfo(false); return }
                setCourseInfoForm({
                  level: selectedCourse?.level || '',
                  telegram_link: selectedCourse?.telegram_link || '',
                  lesson_link: selectedCourse?.lesson_link || '',
                  schedule_days: selectedCourse?.schedule_days || '',
                  schedule_time: selectedCourse?.schedule_time || '',
                  schedule_duration_min: selectedCourse?.schedule_duration_min || 60,
                  start_date: selectedCourse?.start_date || '',
                  self_study: !!selectedCourse?.self_study,
                  total_planned_sessions: selectedCourse?.total_planned_sessions?.toString() || '',
                  teacher_notes: selectedCourse?.teacher_notes || '',
                  course_type: selectedCourse?.course_type || '',
                })
                setEditingCourseInfo(true)
              }} className="text-xs text-[#416ebe] font-bold hover:underline">
                {editingCourseInfo ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editingCourseInfo ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Level</label>
                    <select value={courseInfoForm.level} onChange={e => setCourseInfoForm(f => ({ ...f, level: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
                      <option value="">Not set</option>
                      {COURSE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Course Type</label>
                    <select value={courseInfoForm.course_type} onChange={e => setCourseInfoForm(f => ({ ...f, course_type: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
                      <option value="">Not set</option>
                      {COURSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Schedule days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SA_WEEKDAYS.map((d) => {
                      const on = new Set(courseInfoForm.schedule_days.split(',').map(t => t.trim()).filter(Boolean)).has(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setCourseInfoForm(f => {
                            const s = new Set(f.schedule_days.split(',').map(t => t.trim()).filter(Boolean))
                            if (s.has(d)) s.delete(d); else s.add(d)
                            return { ...f, schedule_days: SA_WEEKDAYS.filter(w => s.has(w)).join(',') }
                          })}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-colors ${on ? 'bg-[#00aff0] border-[#00aff0] text-white' : 'bg-white border-[#cddcf0] text-[#46464b] hover:border-[#416ebe]'}`}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Time</label>
                    <input type="time" value={courseInfoForm.schedule_time} onChange={e => setCourseInfoForm(f => ({ ...f, schedule_time: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Duration</label>
                    <select value={courseInfoForm.schedule_duration_min} onChange={e => setCourseInfoForm(f => ({ ...f, schedule_duration_min: Number(e.target.value) }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]">
                      <option value={30}>30m</option>
                      <option value={60}>1h</option>
                      <option value={90}>1.5h</option>
                      <option value={120}>2h</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Start date</label>
                    <input type="date" value={courseInfoForm.start_date} onChange={e => setCourseInfoForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Self-study course</label>
                    <button type="button" onClick={() => setCourseInfoForm(f => ({ ...f, self_study: !f.self_study }))} className={`w-full border-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${courseInfoForm.self_study ? 'bg-[#00aff0] border-[#00aff0] text-white' : 'bg-white border-[#cddcf0] text-[#46464b] hover:border-[#416ebe]'}`}>
                      {courseInfoForm.self_study ? 'On — no live classes' : 'Off'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Total Planned Sessions</label>
                  <input type="number" min="1" value={courseInfoForm.total_planned_sessions} onChange={e => setCourseInfoForm(f => ({ ...f, total_planned_sessions: e.target.value }))} placeholder="e.g. 24" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Telegram Group Link</label>
                  <input type="url" value={courseInfoForm.telegram_link} onChange={e => setCourseInfoForm(f => ({ ...f, telegram_link: e.target.value }))} placeholder="https://t.me/..." className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Lesson Link (Zoom / Google Meet)</label>
                  <input type="url" value={courseInfoForm.lesson_link} onChange={e => setCourseInfoForm(f => ({ ...f, lesson_link: e.target.value }))} placeholder="https://zoom.us/..." className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Teacher Notes (admin only)</label>
                  <textarea value={courseInfoForm.teacher_notes} onChange={e => setCourseInfoForm(f => ({ ...f, teacher_notes: e.target.value }))} placeholder="Internal notes..." rows={3} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#416ebe] resize-none" />
                </div>
                <button onClick={saveCourseInfo} disabled={savingCourseInfo} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                  {savingCourseInfo ? 'Saving...' : 'Save Course Info'}
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {selectedCourse?.level && <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-28">Level</span><span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-xs rounded-full font-bold">{selectedCourse.level}</span></div>}
                {selectedCourse?.course_type && <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-28">Type</span><span className="text-xs text-[#46464b]">{selectedCourse.course_type}</span></div>}
                {formatSchedule(selectedCourse?.schedule_days ?? null, selectedCourse?.schedule_time ?? null, selectedCourse?.schedule_duration_min ?? null) && <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-28">Schedule</span><span className="text-xs text-[#46464b]">{formatSchedule(selectedCourse?.schedule_days ?? null, selectedCourse?.schedule_time ?? null, selectedCourse?.schedule_duration_min ?? null)}</span></div>}
                {selectedCourse?.self_study && <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-28">Self-study</span><span className="text-xs text-[#46464b]">Yes — no live classes</span></div>}
                {selectedCourse?.start_date && <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-28">Start date</span><span className="text-xs text-[#46464b]">{selectedCourse.start_date}</span></div>}
                {selectedCourse?.total_planned_sessions && <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-28">Planned sessions</span><span className="text-xs text-[#46464b]">{selectedCourse.total_planned_sessions}</span></div>}
                {selectedCourse?.lesson_link && <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-28">Lesson link</span><a href={selectedCourse.lesson_link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#416ebe] hover:underline truncate">{selectedCourse.lesson_link}</a></div>}
                {selectedCourse?.telegram_link && <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-28">Telegram</span><a href={selectedCourse.telegram_link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#416ebe] hover:underline truncate">{selectedCourse.telegram_link}</a></div>}
                {selectedCourse?.teacher_notes && <div className="flex items-start gap-2"><span className="text-xs font-bold text-gray-400 w-28 shrink-0">Teacher notes</span><span className="text-xs text-[#46464b] whitespace-pre-wrap">{selectedCourse.teacher_notes}</span></div>}
                {!selectedCourse?.level && !selectedCourse?.schedule_days && !selectedCourse?.lesson_link && !selectedCourse?.telegram_link && !selectedCourse?.course_type && (
                  <p className="text-xs text-gray-400">No course info set yet. Click Edit to add details.</p>
                )}
              </div>
            )}
          </div>

          {/* Invite link */}
          <div className="bg-[#e6f0fa] rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold text-[#416ebe] mb-2">Student Invite Link</p>
            <div className="flex gap-2">
              <input readOnly value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.englishwithlaura.com'}/join/${selectedCourse.invite_code}`} className="flex-1 bg-white border border-[#cddcf0] rounded-lg px-3 py-2 text-xs text-[#46464b]" />
              <button onClick={copyInviteLink} className="bg-[#416ebe] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#3560b0]">Copy</button>
            </div>
            {editingInviteCode ? (
              <div className="mt-3">
                <p className="text-[11px] font-bold text-gray-500 mb-1">Custom invite code (3-20 letters or digits)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteCodeDraft}
                    onChange={(e) => setInviteCodeDraft(e.target.value)}
                    placeholder="e.g. TRAVEL24"
                    maxLength={20}
                    autoFocus
                    disabled={savingInviteCode}
                    className="flex-1 bg-white border border-[#cddcf0] rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[#416ebe]"
                  />
                  <button
                    onClick={saveInviteCode}
                    disabled={savingInviteCode || !inviteCodeDraft.trim()}
                    className="bg-[#416ebe] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#3560b0] disabled:opacity-50"
                  >
                    {savingInviteCode ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingInviteCode(false); setInviteCodeDraft('') }}
                    disabled={savingInviteCode}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Stored UPPERCASE. Students typing any case will match. Doesn&apos;t affect anyone already enrolled.</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => { setInviteCodeDraft(selectedCourse.invite_code || ''); setEditingInviteCode(true) }}
                  className="text-xs text-[#416ebe] hover:underline font-bold"
                >
                  ✎ Edit code
                </button>
                <span className="text-xs text-gray-300">·</span>
                <button onClick={regenerateInvite} className="text-xs text-gray-400 hover:text-[#416ebe]">Regenerate code</button>
              </div>
            )}
          </div>

          {detailLoading ? <div className="text-center py-8 text-sm text-gray-400">Loading...</div> : (
            <>
              {/* Teachers section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-[#416ebe]">Teachers ({courseTeachers.length})</h2>
                  <button onClick={() => setShowAssignTeacher(true)} className="text-xs text-[#416ebe] font-bold hover:underline">+ Assign Teacher</button>
                </div>

                {showAssignTeacher && (
                  <div className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa] mb-3">
                    <p className="text-xs font-bold text-gray-500 mb-2">Select a teacher to assign</p>
                    <select value={assignEmail} onChange={e => setAssignEmail(e.target.value)} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#416ebe]">
                      <option value="">Choose teacher...</option>
                      {teachers.filter(t => !courseTeachers.find(ct => ct.teacher_email === t.email)).map(t => (
                        <option key={t.email} value={t.email}>{t.name || t.email}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={assignTeacher} disabled={!assignEmail} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50">Assign</button>
                      <button onClick={() => { setShowAssignTeacher(false); setAssignEmail('') }} className="px-4 py-2 text-xs text-gray-400">Cancel</button>
                    </div>
                  </div>
                )}

                {courseTeachers.length === 0 ? (
                  <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-6 text-center"><p className="text-sm text-gray-400">No teachers assigned yet</p></div>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-[#cddcf0] divide-y divide-[#e6f0fa]">
                    {courseTeachers.map(ct => (
                      <div key={ct.teacher_email} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#46464b]">{ct.users?.name || ct.teacher_email}</p>
                          <p className="text-xs text-gray-400">{ct.teacher_email}</p>
                        </div>
                        <button onClick={() => confirmRemoveTeacher(ct.teacher_email, ct.users?.name || ct.teacher_email)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Students section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-[#416ebe]">Students ({courseStudents.length})</h2>
                  <button onClick={() => setShowAddStudent(true)} className="text-xs text-[#416ebe] font-bold hover:underline">+ Add Student</button>
                </div>

                {showAddStudent && (
                  <div className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa] mb-3">
                    <p className="text-xs font-bold text-gray-500 mb-2">Enter the student&apos;s email (Google account)</p>
                    <input type="email" value={addStudentEmail} onChange={e => setAddStudentEmail(e.target.value)} placeholder="e.g. student@gmail.com" className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#416ebe]" onKeyDown={e => e.key === 'Enter' && addStudent()} />
                    <div className="flex gap-2">
                      <button onClick={addStudent} disabled={addingStudent || !addStudentEmail.trim()} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50">{addingStudent ? 'Adding...' : 'Add'}</button>
                      <button onClick={() => { setShowAddStudent(false); setAddStudentEmail('') }} className="px-4 py-2 text-xs text-gray-400">Cancel</button>
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
                    {courseStudents.map(cs => (
                      <div key={cs.student_email} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#46464b]">{cs.users?.name || cs.student_email}</p>
                            <p className="text-xs text-gray-400">{cs.student_email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setStudentAction(studentAction?.email === cs.student_email && studentAction?.type === 'move' ? null : { email: cs.student_email, type: 'move' }); setTargetCourseId('') }} className="text-xs text-[#416ebe] hover:underline font-bold">Move</button>
                            <button onClick={() => { setStudentAction(studentAction?.email === cs.student_email && studentAction?.type === 'add-to-course' ? null : { email: cs.student_email, type: 'add-to-course' }); setTargetCourseId('') }} className="text-xs text-green-600 hover:underline font-bold">+ Course</button>
                            <button onClick={() => confirmRemoveStudent(cs.student_email, cs.users?.name || cs.student_email)} className="text-xs text-red-400 hover:text-red-600 font-bold">Remove</button>
                          </div>
                        </div>

                        {studentAction?.email === cs.student_email && (
                          <div className="mt-3 bg-[#f7fafd] rounded-xl p-3 border border-[#e6f0fa]">
                            <p className="text-xs font-bold text-gray-500 mb-2">
                              {studentAction.type === 'move' ? 'Move to another course (removes from this one):' : 'Enroll in an additional course:'}
                            </p>
                            <select value={targetCourseId} onChange={e => setTargetCourseId(e.target.value)} className="w-full border-2 border-[#cddcf0] rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#416ebe]">
                              <option value="">Choose course...</option>
                              {courses.filter(c => c.id !== selectedCourse?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => { if (!targetCourseId) return; studentAction.type === 'move' ? moveStudent(cs.student_email, targetCourseId) : addStudentToCourse(cs.student_email, targetCourseId); setStudentAction(null); setTargetCourseId('') }} disabled={!targetCourseId} className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50">{studentAction.type === 'move' ? 'Move' : 'Enroll'}</button>
                              <button onClick={() => { setStudentAction(null); setTargetCourseId('') }} className="px-4 py-2 text-xs text-gray-400">Cancel</button>
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

          {/* Edit course modal */}
          {showNewCourse && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                <h2 className="text-lg font-bold text-[#416ebe] mb-4">{editingCourse ? 'Edit Course' : 'New Course'}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Course Name</label>
                    <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g. Business English Advanced" className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Description (optional)</label>
                    <textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)} placeholder="Brief description" rows={3} className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe] resize-none" />
                  </div>
                  {!editingCourse && (
                    <label className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#cddcf0] px-4 py-3 cursor-pointer">
                      <span className="min-w-0">
                        <span className="text-sm font-bold text-[#46464b] block">Self-study course</span>
                        <span className="text-xs text-gray-400 leading-snug">No live classes — hides attendance.</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={courseSelfStudy}
                        onClick={() => setCourseSelfStudy(v => !v)}
                        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${courseSelfStudy ? 'bg-[#00aff0]' : 'bg-[#cddcf0]'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${courseSelfStudy ? 'translate-x-5' : ''}`} />
                      </button>
                    </label>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={saveCourse} disabled={saving || !courseName.trim()} className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">{saving ? 'Saving...' : editingCourse ? 'Update' : 'Create'}</button>
                  <button onClick={() => { setShowNewCourse(false); setEditingCourse(null); setCourseName(''); setCourseDesc('') }} className="px-6 py-3 text-sm text-gray-400">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ══════════ COURSES LIST (MAIN DASHBOARD) ══════════ */}
      {view === 'courses' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <div className="mb-6">
            <img src="/logo.svg" alt="English with Laura" className="h-12 mb-3" />
            <h1 className="text-xl font-bold text-[#416ebe]">Superadmin Dashboard</h1>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Manage courses, teachers, and students</span>
              <span>&middot;</span>
              <SignOutButton />
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => { setShowNewCourse(true); setEditingCourse(null); setCourseName(''); setCourseDesc(''); setCourseSelfStudy(false) }} className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors">+ New Course</button>
            <button onClick={() => setView('invite-teacher')} className="flex-1 bg-white text-[#416ebe] border-2 border-[#416ebe] font-bold py-3 rounded-xl text-sm hover:bg-[#e6f0fa] transition-colors">+ Invite Teacher</button>
            <button onClick={() => router.push('/admin/content-bank')} className="flex-1 bg-white text-[#416ebe] border-2 border-[#cddcf0] font-bold py-3 rounded-xl text-sm hover:border-[#416ebe] hover:bg-[#e6f0fa] transition-colors">Content Bank</button>
          </div>

          {/* Stats row — CLICKABLE */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button onClick={() => setView('all-courses')} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 text-center hover:border-[#416ebe] transition-colors">
              <div className="text-2xl font-bold text-[#416ebe]">{courses.length}</div>
              <div className="text-xs text-gray-400">Courses</div>
            </button>
            <button onClick={() => { setView('all-teachers'); loadTeachers(); loadSuperadmins(); loadHr() }} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 text-center hover:border-[#416ebe] transition-colors">
              <div className="text-2xl font-bold text-[#416ebe]">{teachers.length}</div>
              <div className="text-xs text-gray-400">Teachers</div>
            </button>
            <button onClick={() => { setView('all-students'); loadAllStudents() }} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 text-center hover:border-[#416ebe] transition-colors">
              <div className="text-2xl font-bold text-[#416ebe]">{totalStudents}</div>
              <div className="text-xs text-gray-400">Students</div>
            </button>
            <button onClick={() => { setView('all-teachers'); loadTeachers(); loadSuperadmins(); loadHr(); setTimeout(() => document.getElementById('hr-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4 text-center hover:border-[#00aff0] transition-colors">
              <div className="text-2xl font-bold text-[#0076a8]">{hrList.length}</div>
              <div className="text-xs text-gray-400">HR</div>
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => router.push('/admin/courses')} className="w-full bg-white text-[#416ebe] border-2 border-[#cddcf0] hover:border-[#416ebe] font-bold py-3 rounded-xl text-sm transition-colors">Go to Teacher Admin Panel</button>
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">englishwithlaura.com</p>

          {/* New course modal */}
          {showNewCourse && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                <h2 className="text-lg font-bold text-[#416ebe] mb-4">New Course</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Course Name</label>
                    <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g. Business English Advanced" className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Description (optional)</label>
                    <textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)} placeholder="Brief description" rows={3} className="w-full border-2 border-[#cddcf0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#416ebe] resize-none" />
                  </div>
                  {!editingCourse && (
                    <label className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#cddcf0] px-4 py-3 cursor-pointer">
                      <span className="min-w-0">
                        <span className="text-sm font-bold text-[#46464b] block">Self-study course</span>
                        <span className="text-xs text-gray-400 leading-snug">No live classes — hides attendance.</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={courseSelfStudy}
                        onClick={() => setCourseSelfStudy(v => !v)}
                        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${courseSelfStudy ? 'bg-[#00aff0]' : 'bg-[#cddcf0]'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${courseSelfStudy ? 'translate-x-5' : ''}`} />
                      </button>
                    </label>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={saveCourse} disabled={saving || !courseName.trim()} className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">{saving ? 'Creating...' : 'Create Course'}</button>
                  <button onClick={() => { setShowNewCourse(false); setCourseName(''); setCourseDesc('') }} className="px-6 py-3 text-sm text-gray-400">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ══════════ CONTENT BANK VIEW ══════════ */}
      {view === 'content-bank' && (
        <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
          <button onClick={() => setView('courses')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-2">&larr; Back to Dashboard</button>
          <h1 className="text-xl font-bold text-[#416ebe] mb-1">Content Bank</h1>
          <p className="text-xs text-gray-400 mb-6">Manage shared lesson templates.</p>

          <div className="flex flex-wrap gap-3 mb-6">
            <select value={cbFilterLevel} onChange={e => { setCbFilterLevel(e.target.value); loadContentBank(e.target.value, cbFilterCategory) }} className="px-3 py-2 border border-[#cddcf0] rounded-lg text-sm bg-white">
              <option value="">All Levels</option>
              {TEMPLATE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={cbFilterCategory} onChange={e => { setCbFilterCategory(e.target.value); loadContentBank(cbFilterLevel, e.target.value) }} className="px-3 py-2 border border-[#cddcf0] rounded-lg text-sm bg-white">
              <option value="">All Categories</option>
              {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {cbLoading ? <p className="text-center text-gray-400 py-12">Loading templates...</p> : cbTemplates.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
              <p className="text-sm text-gray-400 mb-1">No templates found.</p>
              <p className="text-xs text-gray-300">Teachers can share lessons as templates from the Lesson Manager.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cbTemplates.map(t => (
                <div key={t.id} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-[#46464b]">{t.title}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {t.template_level && <span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-xs rounded-full">{t.template_level}</span>}
                        {t.template_category && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">{t.template_category}</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {[t.flashcard_count > 0 ? `${t.flashcard_count} flashcards` : '', t.exercise_count > 0 ? `${t.exercise_count} exercises` : '', Object.values(t.block_counts).reduce((a, b) => a + b, 0) > 0 ? `${Object.values(t.block_counts).reduce((a, b) => a + b, 0)} blocks` : ''].filter(Boolean).join(' \u00b7 ') || 'Empty'}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setCbEditingId(t.id); setCbEditCategory(t.template_category || ''); setCbEditLevel(t.template_level || '') }} className="px-3 py-1.5 text-xs font-bold text-[#416ebe] border border-[#cddcf0] rounded-lg hover:border-[#416ebe]">Edit</button>
                      <button onClick={() => setConfirmModal({ title: 'Remove Template', message: `Remove "${t.title}" from the Content Bank?`, onConfirm: () => { cbUpdateTemplate(t.id, false, '', ''); setConfirmModal(null) }, confirmLabel: 'Yes, remove' })} className="px-3 py-1.5 text-xs font-bold text-red-500 border border-red-200 rounded-lg hover:border-red-400">Remove</button>
                    </div>
                  </div>

                  {cbEditingId === t.id && (
                    <div className="mt-4 pt-4 border-t border-[#e6f0fa]">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Category</label>
                          <select value={cbEditCategory} onChange={e => setCbEditCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#cddcf0] rounded-lg bg-white">
                            <option value="">No category</option>
                            {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Level</label>
                          <select value={cbEditLevel} onChange={e => setCbEditLevel(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#cddcf0] rounded-lg bg-white">
                            <option value="">No level</option>
                            {TEMPLATE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setCbEditingId(null)} className="px-4 py-1.5 text-xs text-gray-400">Cancel</button>
                        <button onClick={() => cbUpdateTemplate(t.id, true, cbEditCategory, cbEditLevel)} className="px-4 py-1.5 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0]">Save</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </>
  )
}
