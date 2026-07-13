'use client'

// ─────────────────────────────────────────────────────────────────
// COURSE DETAIL (10B) — course-native restructure.
//
// Header: course name + description ONLY (Archive lives in Superadmin now).
// Body is a two-column layout (desktop md+):
//   LEFT  = tabs "Lessons (n)" | "Students (n)" + the + Create action; the
//           list is the ONLY scroll area (its own max-height + overflow).
//   RIGHT = a (non-scrolling) rail: a "Course info" card (displayed, with an
//           Edit affordance) + the Attendance card (hidden when self_study).
// On mobile the rail stacks on top.
//
// Presentational only: data via props, every mutation/navigation is a
// callback the page owns. It MAY hold local UI state (active tab, edit-mode,
// the edit-form draft, inline errors). It never fetches / uses the session /
// touches the router.
// ─────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { Pill, EmptyState, Skeleton, Button, InlineError, TextField, SegmentedControl } from '@/components/student-ui'
import { PageHeader } from '@/components/student-ui/PageHeader'
import { COMMON_ISSUES_BY_LEVEL } from '@/lib/common-issues'
import AttendanceRail, { AttendanceOverview } from '@/components/admin-v2/AttendanceRail'
import BulkAttendanceModal from '@/components/admin-v2/BulkAttendanceModal'
import CourseProgressTab from '@/components/admin-v2/CourseProgressTab'

const LEVELS = Object.keys(COMMON_ISSUES_BY_LEVEL)
// CEFR half-steps for the group level (starting → goal); mirrors the Reports view.
const CEFR_LEVELS = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2', 'C2.1', 'C2.2']

const WEEKDAY_TOKENS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface CourseDetailData {
  id: string
  name: string
  description: string | null
  invite_code: string
  created_at: string
  course_type: string | null
  course_category: string | null
  level: string | null
  current_level?: string | null
  goal_level?: string | null
  group_progress_pct?: number | null
  telegram_chat_id: string | null
  archived_at: string | null
  // ── Course-native schedule fields ──
  schedule_days: string | null // "Mon,Wed"
  schedule_time: string | null // "16:00"
  schedule_duration_min: number | null
  start_date: string | null // YYYY-MM-DD
  self_study: boolean
  telegram_link: string | null
  lesson_link: string | null // Zoom
  trainer_name?: string | null
}

export interface CourseStudentRow {
  email: string
  name: string
  level: string | null
  blocked: boolean
  total_sessions: number
  last_activity: string | null
  archived_at: string | null
}

export interface CourseLessonRow {
  id: string
  title: string
  status: 'draft' | 'published'
  template_category: string | null
  template_level: string | null
  is_template: boolean
  created_at: string
}

// What the Course-Info edit form sends (maps to update-schedule).
export interface CourseInfoForm {
  description: string
  level: string
  current_level: string
  goal_level: string
  group_progress_pct: number | null
  schedule_days: string // "Mon,Wed"
  schedule_time: string
  schedule_duration_min: number
  start_date: string
  self_study: boolean
  telegram_link: string
  lesson_link: string
}

// ── Helpers ──
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Format a YYYY-MM-DD as a local "26 Jun 2024".
function formatStartDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(dateStr: string | null): string {
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

// "Mon,Wed" + "16:00" + 60 -> "Mon & Wed · 16:00 · 1h".
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

const INVITE_CODE_RE = /^[A-Za-z0-9]{3,20}$/

type Tab = 'lessons' | 'students' | 'progress'

// ── Tabler-style line icons for the Course-info rail ──
const iconBase = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}
const IcCalendar = (<svg {...iconBase}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>)
const IcClock = (<svg {...iconBase}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>)
const IcUser = (<svg {...iconBase}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 12 0v1" /></svg>)
const IcKey = (<svg {...iconBase}><circle cx="8" cy="15" r="4" /><path d="M10.85 12.15 19 4M18 5l2 2M15 8l2 2" /></svg>)
const IcVideo = (<svg {...iconBase}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3v10l-6-3" /></svg>)
const IcSend = (<svg {...iconBase}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>)

interface CourseDetailViewProps {
  course: CourseDetailData | null
  students: CourseStudentRow[]
  lessons: CourseLessonRow[]
  loading: boolean
  // Attendance rail
  overview: AttendanceOverview | null
  overviewLoading?: boolean
  onMarkToday: () => void
  onNewClass: () => void
  onOpenSession: (sessionId: string) => void
  onViewAllSessions: () => void
  // Navigation / lesson actions
  onBack: () => void
  onOpenLesson: (id: string) => void
  onOpenStudent: (email: string) => void
  onCreateLesson: () => void
  onAssignFromLibrary: () => void
  // Course-info save (update-schedule)
  onSaveCourseInfo: (form: CourseInfoForm) => Promise<{ ok: boolean; error?: string }>
  // Invite-code change is a separate concern (kept via update-course).
  onSaveInviteCode: (code: string) => Promise<{ ok: boolean; error?: string }>
  onSendTelegramTest: () => Promise<{ ok: boolean; error?: string }>
  onAddStudent?: (email: string) => Promise<void> | void
  onRemoveStudent?: (email: string) => void
  onArchiveStudent?: (email: string) => void
  onUnarchiveStudent?: (email: string) => void
  canEdit?: boolean
  manageHr?: {
    all: { email: string; name: string }[]
    assigned: { email: string; name: string }[]
    onAdd: (email: string) => void
    onRemove: (email: string) => void
  }
}

// Read-only icon + value row for the Course Info card.
// `label` is kept for accessibility (sr-only) — the screenshots show icon + value inline.
function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-ink-muted mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="sr-only">{label}: </span>
        <div className="text-sm text-ink-black break-words">{children}</div>
      </div>
    </div>
  )
}

// Add a student to the course by email (pre-enrol + emails them the join link).
function AddStudentRow({ onAdd }: { onAdd: (email: string) => Promise<void> | void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const e = email.trim()
    if (!e || busy) return
    setBusy(true)
    await onAdd(e)
    setBusy(false)
    setEmail('')
  }
  return (
    <div className="bg-white rounded-card border border-hairline p-3 flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(ev) => setEmail(ev.target.value)}
        onKeyDown={(ev) => { if (ev.key === 'Enter') submit() }}
        placeholder="student@email.com"
        className="flex-1 text-sm border border-hairline rounded-tile px-3 py-2 focus:outline-none focus:border-sky"
        aria-label="Student email"
      />
      <Button variant="primary" size="sm" onClick={submit}>{busy ? 'Adding…' : '+ Add student'}</Button>
    </div>
  )
}

export function CourseDetailView({
  course,
  students,
  lessons,
  loading,
  overview,
  overviewLoading,
  onMarkToday,
  onNewClass,
  onOpenSession,
  onViewAllSessions,
  onBack,
  onOpenLesson,
  onOpenStudent,
  onCreateLesson,
  onAssignFromLibrary,
  onSaveCourseInfo,
  onSaveInviteCode,
  onSendTelegramTest,
  onAddStudent,
  onRemoveStudent,
  onArchiveStudent,
  onUnarchiveStudent,
  canEdit = true,
  manageHr,
}: CourseDetailViewProps) {
  const [tab, setTab] = useState<Tab>('lessons')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CourseInfoForm>({
    description: '', level: '', current_level: '', goal_level: '', group_progress_pct: null,
    schedule_days: '', schedule_time: '',
    schedule_duration_min: 60, start_date: '', self_study: false,
    telegram_link: '', lesson_link: '',
  })
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tgState, setTgState] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [tgSending, setTgSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [bulkAttOpen, setBulkAttOpen] = useState(false)

  // Invite-code change (inside the edit form).
  const [inviteCode, setInviteCode] = useState('')

  // ── Lessons list search + status filter ──
  const [lessonQuery, setLessonQuery] = useState('')
  const [lessonStatus, setLessonStatus] = useState<'all' | 'draft' | 'published'>('all')

  const filteredLessons = useMemo(() => {
    const q = lessonQuery.trim().toLowerCase()
    return lessons.filter((lesson) => {
      const matchesQuery = !q || (lesson.title || '').toLowerCase().includes(q)
      const matchesStatus = lessonStatus === 'all' || lesson.status === lessonStatus
      return matchesQuery && matchesStatus
    })
  }, [lessons, lessonQuery, lessonStatus])

  const scheduleDaySet = useMemo(() => {
    const set = new Set<string>()
    if (form.schedule_days) for (const t of form.schedule_days.split(',')) { const v = t.trim(); if (v) set.add(v) }
    return set
  }, [form.schedule_days])

  const startEditing = () => {
    if (!course) return
    setForm({
      description: course.description || '',
      level: course.level || '',
      current_level: course.current_level || '',
      goal_level: course.goal_level || '',
      group_progress_pct: course.group_progress_pct ?? null,
      schedule_days: course.schedule_days || '',
      schedule_time: course.schedule_time || '',
      schedule_duration_min: course.schedule_duration_min || 60,
      start_date: course.start_date || '',
      self_study: !!course.self_study,
      telegram_link: course.telegram_link || '',
      lesson_link: course.lesson_link || '',
    })
    setInviteCode('')
    setSaveError('')
    setEditing(true)
  }

  const toggleDay = (day: string) => {
    setForm((prev) => {
      const set = new Set<string>()
      if (prev.schedule_days) for (const t of prev.schedule_days.split(',')) { const v = t.trim(); if (v) set.add(v) }
      if (set.has(day)) set.delete(day)
      else set.add(day)
      // Re-order canonically (Mon..Sun).
      const ordered = WEEKDAY_TOKENS.filter((d) => set.has(d))
      return { ...prev, schedule_days: ordered.join(',') }
    })
  }

  const handleSave = async () => {
    setSaveError('')
    const code = inviteCode.trim()
    if (code && !INVITE_CODE_RE.test(code)) {
      setSaveError('Invite code must be 3-20 letters or digits — no spaces or symbols.')
      return
    }
    setSaving(true)
    // Save the schedule/info first, then the invite code (if changed).
    const res = await onSaveCourseInfo(form)
    if (res.ok && code) {
      const codeRes = await onSaveInviteCode(code)
      if (!codeRes.ok) {
        setSaving(false)
        setSaveError(codeRes.error || 'Course info saved, but the invite code could not be updated.')
        return
      }
    }
    setSaving(false)
    if (res.ok) setEditing(false)
    else setSaveError(res.error || 'Failed to update course')
  }

  const handleTelegramTest = async () => {
    setTgState(null)
    setTgSending(true)
    const res = await onSendTelegramTest()
    setTgSending(false)
    setTgState(
      res.ok
        ? { kind: 'ok', message: 'Test message sent to Telegram.' }
        : { kind: 'error', message: res.error || 'Failed to send test message.' }
    )
  }

  const handleCopyInvite = async () => {
    if (!course) return
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.englishwithlaura.com'
      await navigator.clipboard.writeText(`${base}/join/${course.invite_code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  // ── Loading skeleton ──
  if (loading || !course) {
    return (
      <div className="font-rubik min-h-screen bg-surface px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-4 w-40 mb-5" />
          <div className="bg-white rounded-card border border-hairline p-5 mb-4">
            <Skeleton className="h-6 w-52 mb-2" />
            <Skeleton className="h-3 w-72" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr,320px] gap-4">
            <Skeleton className="h-72 w-full rounded-card" />
            <Skeleton className="h-72 w-full rounded-card" />
          </div>
        </div>
      </div>
    )
  }

  const scheduleText = formatSchedule(course.schedule_days, course.schedule_time, course.schedule_duration_min)

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          crumbs={[{ label: 'My Courses', onClick: onBack }, { label: course.name }]}
          className="mb-5"
        />

        {/* Header card — name + description + report shortcut */}
        <div className="bg-white rounded-card border border-hairline p-6 mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[30px] font-extrabold text-brandblue leading-tight tracking-hero">{course.name}</h1>
              {course.archived_at && <Pill variant="status">Archived</Pill>}
              {course.self_study && <Pill variant="level">Self-study</Pill>}
            </div>
            <p className="text-sm text-ink-muted mt-1.5">{course.description || 'No description'}</p>
          </div>
          <a
            href={`/admin/reports?courseId=${course.id}`}
            className="shrink-0 inline-flex items-center gap-2 bg-sky text-white rounded-tile px-4 py-2.5 text-sm font-bold hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-6M20 20H4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            View report
          </a>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,330px] gap-4 items-start">
          {/* ─── LEFT: header card + list card (the list is the only scroll area) ─── */}
          <div className="order-2 md:order-1 min-w-0 space-y-4">
            {/* HEADER CARD — tabs + (lessons) actions + search/filter */}
            <div className="bg-white rounded-card border border-hairline p-4">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-6">
                  {([
                    { value: 'lessons' as Tab, label: `Lessons (${lessons.length})` },
                    { value: 'students' as Tab, label: `Students (${students.length})` },
                    { value: 'progress' as Tab, label: 'Progress' },
                  ]).map((t) => {
                    const active = tab === t.value
                    return (
                      <button
                        key={t.value}
                        onClick={() => setTab(t.value)}
                        className={`relative pb-2 text-[15px] font-bold transition-colors ${
                          active ? 'text-brandblue' : 'text-ink-muted hover:text-ink-body'
                        }`}
                      >
                        {t.label}
                        {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-brandblue" />}
                      </button>
                    )
                  })}
                </div>
                {tab === 'lessons' && canEdit && (
                  <div className="flex items-center gap-2">
                    <Button variant="neutral" size="sm" onClick={onAssignFromLibrary}>Assign from Library</Button>
                    <button
                      onClick={onCreateLesson}
                      className="inline-flex items-center justify-center gap-1 rounded-full border-[1.5px] border-sky-border bg-white text-brandblue font-bold text-[12px] px-3.5 py-2 hover:border-sky transition-colors"
                    >
                      + Create
                    </button>
                  </div>
                )}
              </div>
              {tab === 'lessons' && lessons.length > 0 && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <TextField
                    label="Search"
                    placeholder="Search lessons…"
                    value={lessonQuery}
                    onChange={(e) => setLessonQuery(e.target.value)}
                    className="flex-1 min-w-[180px]"
                  />
                  <SegmentedControl<'all' | 'draft' | 'published'>
                    segments={[
                      { value: 'all', label: 'All' },
                      { value: 'draft', label: 'Draft' },
                      { value: 'published', label: 'Published' },
                    ]}
                    value={lessonStatus}
                    onChange={setLessonStatus}
                  />
                </div>
              )}
            </div>

            {/* LIST CARD */}
            {/* Lessons */}
            {tab === 'lessons' && (
              <div className="bg-white rounded-card border border-hairline overflow-hidden">
                {lessons.length === 0 ? (
                  <div className="py-2">
                    <EmptyState icon="📖" title="No lessons yet" hint="Create one from scratch or import a ready-made plan from the content bank." />
                    {canEdit && (
                      <div className="flex items-center justify-center gap-2 pb-8">
                        <Button variant="secondary" size="sm" onClick={onCreateLesson}>+ Create Lesson</Button>
                        <Button variant="neutral" size="sm" onClick={onAssignFromLibrary}>Assign from Library</Button>
                      </div>
                    )}
                  </div>
                ) : filteredLessons.length === 0 ? (
                  <EmptyState icon="🔍" title="No matches" hint="No lessons match your search or filter." />
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-hairline">
                    {filteredLessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => onOpenLesson(lesson.id)}
                        className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-sky-wash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink-black truncate">{lesson.title || 'Untitled'}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {lesson.template_level && <Pill variant="level">{lesson.template_level}</Pill>}
                            {lesson.template_category && <Pill variant="level">{lesson.template_category}</Pill>}
                            {lesson.is_template && (
                              <span className="text-[10px] font-bold bg-surface text-ink-muted px-2 py-0.5 rounded-full">Template</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Pill variant={lesson.status === 'published' ? 'correct' : 'wash'}>
                            {lesson.status === 'published' ? 'Published' : 'Draft'}
                          </Pill>
                          <span className="text-xs text-ink-muted hidden sm:inline">{formatDate(lesson.created_at)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Students */}
            {tab === 'students' && (
              <div className="space-y-3">
                {canEdit && onAddStudent && <AddStudentRow onAdd={onAddStudent} />}
                <div className="bg-white rounded-card border border-hairline overflow-hidden">
                  {students.length === 0 ? (
                    <EmptyState icon="🦗" title="No students yet" hint="Add a student by email above, or share the invite link." />
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto divide-y divide-hairline">
                      {students.map((student) => (
                        <div key={student.email} className={`px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-sky-wash transition-colors ${student.archived_at ? 'opacity-70' : ''}`}>
                          <button
                            onClick={() => onOpenStudent(student.email)}
                            className="min-w-0 flex-1 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-ink-black truncate">{student.name || 'Unknown'}</p>
                              {student.level && <Pill variant="level">{student.level}</Pill>}
                              {student.archived_at && (
                                <span className="text-[10px] font-bold bg-streak-fill text-streak-ink px-2 py-0.5 rounded-full">ARCHIVED</span>
                              )}
                              {student.blocked && (
                                <span className="text-[10px] font-bold bg-incorrect-bg text-incorrect-fg px-2 py-0.5 rounded-full">BLOCKED</span>
                              )}
                            </div>
                            <p className="text-xs text-ink-muted mt-0.5 truncate">{student.email}</p>
                          </button>
                          <div className="flex items-center gap-4 shrink-0 text-center">
                            <div>
                              <p className="text-sm font-bold text-sky-text">{student.total_sessions}</p>
                              <p className="text-[10px] text-ink-muted">sessions</p>
                            </div>
                            <div className="hidden sm:block">
                              <p className="text-xs text-ink-muted">{timeAgo(student.last_activity)}</p>
                              <p className="text-[10px] text-ink-muted">last active</p>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1.5">
                                {student.archived_at
                                  ? onUnarchiveStudent && <button onClick={() => onUnarchiveStudent(student.email)} className="text-[11px] font-bold text-sky-text border border-hairline rounded-tile px-2 py-1 hover:bg-surface">Unarchive</button>
                                  : onArchiveStudent && <button onClick={() => onArchiveStudent(student.email)} className="text-[11px] font-bold text-ink-body border border-hairline rounded-tile px-2 py-1 hover:bg-surface">Archive</button>}
                                {onRemoveStudent && <button onClick={() => onRemoveStudent(student.email)} className="text-[11px] font-bold text-incorrect-fg border border-hairline rounded-tile px-2 py-1 hover:bg-incorrect-bg">Remove</button>}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Progress (teacher triage grid) */}
            {tab === 'progress' && course && (
              <CourseProgressTab courseId={course.id} />
            )}
          </div>

          {/* ─── RIGHT RAIL: Course info + Attendance (does not scroll) ─── */}
          <div className="order-1 md:order-2 space-y-4">
            {/* Course info card */}
            <div className="bg-white rounded-card border border-hairline p-[18px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink-black">Course info</h3>
                {!editing && canEdit && (
                  <button onClick={startEditing} className="text-xs font-bold text-brandblue hover:underline">Edit</button>
                )}
              </div>

              {editing ? (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 h-16 resize-none bg-white focus:outline-none focus:border-sky"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Schedule days</label>
                    <div className="flex flex-wrap gap-1">
                      {WEEKDAY_TOKENS.map((d) => {
                        const active = scheduleDaySet.has(d)
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDay(d)}
                            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-tile border transition-colors ${
                              active ? 'bg-sky text-white border-sky' : 'bg-white text-ink-muted border-hairline hover:border-sky-border'
                            }`}
                          >
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Time</label>
                      <input
                        type="time"
                        value={form.schedule_time}
                        onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
                        className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Duration</label>
                      <select
                        value={form.schedule_duration_min}
                        onChange={(e) => setForm({ ...form, schedule_duration_min: Number(e.target.value) })}
                        className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                      >
                        <option value={30}>30m</option>
                        <option value={60}>1h</option>
                        <option value={90}>1.5h</option>
                        <option value={120}>2h</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Start date</label>
                      <input
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Level</label>
                      <select
                        value={form.level}
                        onChange={(e) => setForm({ ...form, level: e.target.value })}
                        className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                      >
                        <option value="">Not set</option>
                        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Group level (CEFR) — starting → goal + % achieved (shown in the report) */}
                  <div className="rounded-tile border border-hairline px-3 py-2.5">
                    <span className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-2 block">Group level (CEFR)</span>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[10px] font-bold text-ink-muted uppercase tracking-eyebrow mb-1 block">Starting level</label>
                        <select
                          value={form.current_level}
                          onChange={(e) => setForm({ ...form, current_level: e.target.value })}
                          className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                        >
                          <option value="">Not set</option>
                          {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-ink-muted uppercase tracking-eyebrow mb-1 block">Goal level</label>
                        <select
                          value={form.goal_level}
                          onChange={(e) => setForm({ ...form, goal_level: e.target.value })}
                          className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                        >
                          <option value="">Not set</option>
                          {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                    <label className="text-[10px] font-bold text-ink-muted uppercase tracking-eyebrow mb-1 block">% achieved</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.group_progress_pct ?? 0}
                        onChange={(e) => setForm({ ...form, group_progress_pct: parseInt(e.target.value, 10) })}
                        className="flex-1"
                        aria-label="Percent achieved"
                      />
                      <span className="text-sm font-bold text-ink-black w-10 text-right">{form.group_progress_pct ?? 0}%</span>
                    </div>
                  </div>
                  {/* Self-study toggle */}
                  <label className="flex items-center justify-between gap-3 rounded-tile border border-hairline px-3 py-2.5 cursor-pointer">
                    <span className="min-w-0">
                      <span className="text-sm font-bold text-ink-black block">Self-study course</span>
                      <span className="text-[11px] text-ink-muted leading-snug">No live classes — hides attendance.</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.self_study}
                      onClick={() => setForm({ ...form, self_study: !form.self_study })}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${form.self_study ? 'bg-sky' : 'bg-hairline'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.self_study ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                  <div>
                    <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Zoom link</label>
                    <input
                      type="url"
                      value={form.lesson_link}
                      onChange={(e) => setForm({ ...form, lesson_link: e.target.value })}
                      placeholder="https://zoom.us/j/…"
                      className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Telegram link</label>
                    <input
                      type="url"
                      value={form.telegram_link}
                      onChange={(e) => setForm({ ...form, telegram_link: e.target.value })}
                      placeholder="https://t.me/…"
                      className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1 block">Invite code</label>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs text-ink-muted">
                        Current: <span className="font-mono font-bold text-sky-text">{course.invite_code}</span>
                      </span>
                      <Button variant="neutral" size="sm" onClick={handleCopyInvite}>{copied ? 'Copied!' : 'Copy'}</Button>
                    </div>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="New code (blank = keep current)"
                      maxLength={20}
                      className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white font-mono uppercase focus:outline-none focus:border-sky"
                    />
                  </div>
                  {saveError && <InlineError message={saveError} />}
                  <div className="flex gap-2 pt-1">
                    <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant="neutral" size="sm" onClick={() => { setEditing(false); setSaveError('') }} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduleText && <InfoRow icon={IcCalendar} label="Schedule">{scheduleText}</InfoRow>}
                  {course.self_study && !scheduleText && (
                    <InfoRow icon={IcCalendar} label="Schedule">Self-study (no fixed schedule)</InfoRow>
                  )}
                  <InfoRow icon={IcClock} label="Started">Started {formatStartDate(course.start_date)}</InfoRow>
                  <InfoRow icon={IcUser} label="Trainer · Level">
                    {(course.trainer_name || 'Unassigned')}{course.level ? ` · ${course.level}` : ''}
                  </InfoRow>
                  <InfoRow icon={IcKey} label="Invite code">
                    <span className="inline-flex items-center gap-2">
                      <span>Invite <span className="font-mono font-bold text-brandblue">{course.invite_code}</span></span>
                      <button onClick={handleCopyInvite} className="text-[11px] font-bold text-brandblue underline">
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </span>
                  </InfoRow>
                  {(course.lesson_link || course.telegram_link) && (
                    <div className="border-t border-hairline pt-3 flex items-center gap-5">
                      {course.lesson_link && (
                        <a href={course.lesson_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brandblue font-bold text-sm hover:underline">
                          <span>{IcVideo}</span> Zoom
                        </a>
                      )}
                      {course.telegram_link && (
                        <a href={course.telegram_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brandblue font-bold text-sm hover:underline">
                          <span>{IcSend}</span> Telegram
                        </a>
                      )}
                    </div>
                  )}
                  {course.telegram_chat_id && canEdit && (
                    <div className="pt-1">
                      <Button variant="secondary" size="sm" onClick={handleTelegramTest} disabled={tgSending}>
                        {tgSending ? 'Sending…' : 'Send Telegram test'}
                      </Button>
                    </div>
                  )}
                  {tgState && (
                    tgState.kind === 'ok' ? (
                      <p className="text-xs font-medium text-correct-fg bg-correct-bg border border-correct-border rounded-tile px-3 py-2">{tgState.message}</p>
                    ) : (
                      <InlineError message={tgState.message} />
                    )
                  )}
                </div>
              )}
            </div>

            {/* HR observers card — superadmin only (course-first HR assignment) */}
            {manageHr && (
              <div className="bg-white rounded-card border border-hairline p-[18px]">
                <h3 className="text-sm font-bold text-ink-black mb-1">HR observers</h3>
                <p className="text-xs text-ink-muted mb-2">Read-only HRs who follow this course.</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {manageHr.assigned.length === 0 ? (
                    <span className="text-xs text-ink-muted">None yet.</span>
                  ) : manageHr.assigned.map((h) => (
                    <span key={h.email} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#f3eafe', color: '#5b3aa0' }}>
                      {h.name || h.email}
                      <button onClick={() => manageHr.onRemove(h.email)} aria-label="Remove HR" style={{ color: '#5b3aa0' }} className="hover:opacity-70">✕</button>
                    </span>
                  ))}
                </div>
                {(() => {
                  const avail = manageHr.all.filter((h) => !manageHr.assigned.some((a) => a.email === h.email))
                  return avail.length > 0 ? (
                    <select value="" onChange={(e) => { if (e.target.value) manageHr.onAdd(e.target.value) }} className="w-full text-sm text-ink-body bg-white border border-hairline rounded-tile px-3 py-2 focus:outline-none focus:border-sky">
                      <option value="">+ Add HR…</option>
                      {avail.map((h) => <option key={h.email} value={h.email}>{h.name || h.email}</option>)}
                    </select>
                  ) : manageHr.all.length === 0 ? (
                    <p className="text-[11px] text-ink-muted">No HR accounts yet — invite one from the team page.</p>
                  ) : (
                    <p className="text-[11px] text-ink-muted">All HR accounts already follow this course.</p>
                  )
                })()}
              </div>
            )}

            {/* Attendance card — only for non-self-study courses */}
            {!course.self_study && (
              <>
                <AttendanceRail
                  overview={overview}
                  loading={overviewLoading}
                  onMarkToday={onMarkToday}
                  onNewClass={onNewClass}
                  onOpenSession={onOpenSession}
                  onViewAll={onViewAllSessions}
                  canEdit={canEdit}
                />
                {canEdit && (
                  <button
                    onClick={() => setBulkAttOpen(true)}
                    className="mt-2 w-full text-[12px] font-bold text-sky-text border border-hairline rounded-tile py-2 hover:bg-sky-wash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
                  >
                    Bulk attendance backfill
                  </button>
                )}
                {bulkAttOpen && (
                  <BulkAttendanceModal
                    courseId={course.id}
                    students={students.map((s) => ({ email: s.email, name: s.name, archived_at: s.archived_at }))}
                    onClose={() => setBulkAttOpen(false)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CourseDetailView
