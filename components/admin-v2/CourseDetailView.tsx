'use client'

// Wave 0 — redesigned COURSE DETAIL screen (10B), "new beside old".
//
// Presentational only: all data arrives via props and every mutation /
// navigation is a callback the real page owns (so this same component is
// verifiable in a mock harness AND reused live). It MAY hold local UI state
// (active tab, edit-mode toggle, the edit-form draft, inline save errors,
// the telegram-test result) — but it never fetches, never uses the session,
// and never touches the router. Tokens + kit match CoursesView /
// StudentsView: Rubik, sky-text for values/links, sky-wash/sky-border info
// tiles, hairline/rounded-card cards, Pill variant="level" honouring the
// LOCKED rule (brandblue text NEVER on a sky-wash background).

import { useMemo, useState } from 'react'
import { Pill, EmptyState, Skeleton, Button, InlineError, TextField, SegmentedControl } from '@/components/student-ui'
import { PageHeader } from '@/components/student-ui/PageHeader'
import { useConfirm } from '@/components/ConfirmDialog'
import { COMMON_ISSUES_BY_LEVEL, COURSE_TYPES, COURSE_CATEGORIES } from '@/lib/common-issues'

const LEVELS = Object.keys(COMMON_ISSUES_BY_LEVEL)

export interface CourseDetailData {
  id: string
  name: string
  description: string | null
  invite_code: string
  created_at: string
  course_type: string | null
  course_category: string | null
  level: string | null
  telegram_chat_id: string | null
  archived_at: string | null
}

export interface CourseStudentRow {
  email: string
  name: string
  level: string | null
  blocked: boolean
  total_sessions: number
  last_activity: string | null
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

export interface CourseSaveForm {
  name: string
  description: string
  level: string
  course_type: string
  course_category: string
  telegram_chat_id: string
  invite_code: string
}

// ── Helpers ported verbatim from the legacy admin page ──
// formatDate: en-GB 'd Mon yyyy', null -> 'Never'.
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

const INVITE_CODE_RE = /^[A-Za-z0-9]{3,20}$/

type Tab = 'lessons' | 'students' | 'info'

interface CourseDetailViewProps {
  course: CourseDetailData | null
  students: CourseStudentRow[]
  lessons: CourseLessonRow[]
  loading: boolean
  onBack: () => void
  onOpenLesson: (id: string) => void
  onOpenStudent: (email: string) => void
  onCreateLesson: () => void
  onSaveCourse: (form: CourseSaveForm) => Promise<{ ok: boolean; error?: string }>
  onSendTelegramTest: () => Promise<{ ok: boolean; error?: string }>
  onArchive: () => Promise<{ ok: boolean; error?: string }>
  onRestore: () => Promise<{ ok: boolean; error?: string }>
}

// A small read-only label/value row for the Course Info read view.
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow">{label}</p>
      <div className="text-sm text-ink-black mt-0.5">{children}</div>
    </div>
  )
}

// Segmented tab control. Local-only (active tab is UI state on this View).
function Tabs({ value, onChange, lessonCount, studentCount }: {
  value: Tab
  onChange: (t: Tab) => void
  lessonCount: number
  studentCount: number
}) {
  const segs: { value: Tab; label: string }[] = [
    { value: 'lessons', label: `Lessons (${lessonCount})` },
    { value: 'students', label: `Students (${studentCount})` },
    { value: 'info', label: 'Course Info' },
  ]
  return (
    <div className="inline-flex bg-sky-wash rounded-full p-1">
      {segs.map((s) => {
        const active = s.value === value
        return (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`px-4 py-1.5 text-[13px] font-bold rounded-full transition-all ${
              active
                ? 'bg-white text-brandblue shadow-[0_1px_2px_rgba(15,22,40,0.08)]'
                : 'text-ink-body hover:text-ink-black'
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

export function CourseDetailView({
  course,
  students,
  lessons,
  loading,
  onBack,
  onOpenLesson,
  onOpenStudent,
  onCreateLesson,
  onSaveCourse,
  onSendTelegramTest,
  onArchive,
  onRestore,
}: CourseDetailViewProps) {
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('lessons')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CourseSaveForm>({
    name: '', description: '', level: '', course_type: '', course_category: '', telegram_chat_id: '', invite_code: '',
  })
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tgState, setTgState] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [tgSending, setTgSending] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [copied, setCopied] = useState(false)

  // ── Lessons-tab client-side search + status filter (over the `lessons` prop) ──
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

  // Seed the edit-form draft from the current course, then flip to edit mode.
  const startEditing = () => {
    if (!course) return
    setForm({
      name: course.name || '',
      description: course.description || '',
      level: course.level || '',
      course_type: course.course_type || '',
      course_category: course.course_category || '',
      telegram_chat_id: course.telegram_chat_id || '',
      invite_code: '',
    })
    setSaveError('')
    setEditing(true)
  }

  const handleSave = async () => {
    setSaveError('')
    // Client-validate the invite code before hitting the server (mirrors the
    // server regex so we fail fast with a useful message). Empty = unchanged.
    const code = form.invite_code.trim()
    if (code && !INVITE_CODE_RE.test(code)) {
      setSaveError('Invite code must be 3-20 letters or digits — no spaces or symbols.')
      return
    }
    setSaving(true)
    const res = await onSaveCourse(form)
    setSaving(false)
    if (res.ok) {
      setEditing(false)
    } else {
      setSaveError(res.error || 'Failed to update course')
    }
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

  const handleArchive = async () => {
    const ok = await confirm({
      title: 'Archive this course?',
      message: 'Archive this course? It will be hidden from the active list (you can restore it anytime).',
      confirmLabel: 'Archive',
    })
    if (!ok) return
    setArchiveError('')
    setArchiveBusy(true)
    const res = await onArchive()
    setArchiveBusy(false)
    if (!res.ok) setArchiveError(res.error || 'Failed to archive course')
  }

  const handleRestore = async () => {
    setArchiveError('')
    setArchiveBusy(true)
    const res = await onRestore()
    setArchiveBusy(false)
    if (!res.ok) setArchiveError(res.error || 'Failed to restore course')
  }

  const handleCopyInvite = async () => {
    if (!course) return
    try {
      await navigator.clipboard.writeText(course.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable — no-op */ }
  }

  // ── Loading skeleton ──
  if (loading || !course) {
    return (
      <div className="font-rubik min-h-screen bg-surface px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-4 w-40 mb-5" />
          <div className="bg-white rounded-card border border-hairline p-5 mb-4">
            <Skeleton className="h-6 w-52 mb-2" />
            <Skeleton className="h-3 w-72 mb-3" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-9 w-72 mb-4 rounded-full" />
          <div className="bg-white rounded-card border border-hairline p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          crumbs={[
            { label: 'My Courses', onClick: onBack },
            { label: course.name },
          ]}
          className="mb-5"
        />

        {/* Course header card */}
        <div className="bg-white rounded-card border border-hairline p-5 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-brandblue">{course.name}</h1>
                {course.archived_at && <Pill variant="status">Archived</Pill>}
              </div>
              <p className="text-sm text-ink-muted mt-1">{course.description || 'No description'}</p>
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {course.level && <Pill variant="level">{course.level}</Pill>}
                {course.course_type && <Pill variant="level">{course.course_type}</Pill>}
                {course.course_category && <Pill variant="level">{course.course_category}</Pill>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2.5 shrink-0">
              <div className="text-xs text-ink-muted">
                Invite: <span className="font-mono font-bold text-sky-text">{course.invite_code}</span>
              </div>
              {course.archived_at ? (
                <Button variant="secondary" size="sm" onClick={handleRestore} disabled={archiveBusy}>
                  {archiveBusy ? 'Restoring…' : 'Restore course'}
                </Button>
              ) : (
                <Button variant="neutral" size="sm" onClick={handleArchive} disabled={archiveBusy}>
                  {archiveBusy ? 'Archiving…' : 'Archive course'}
                </Button>
              )}
            </div>
          </div>
          {archiveError && (
            <div className="mt-3">
              <InlineError message={archiveError} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-4">
          <Tabs value={tab} onChange={setTab} lessonCount={lessons.length} studentCount={students.length} />
        </div>

        {/* ── Lessons tab ── */}
        {tab === 'lessons' && (
          <div className="bg-white rounded-card border border-hairline overflow-hidden">
            <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-3">
              <h2 className="font-bold text-ink-black">Lessons</h2>
              <Button variant="secondary" size="sm" onClick={onCreateLesson}>+ Create Lesson</Button>
            </div>
            {lessons.length === 0 ? (
              <EmptyState icon="📖" title="No lessons yet" hint="Create one from scratch or import a ready-made plan from the content bank." />
            ) : (
              <>
                {/* Dense filter strip — search + status filter over the lessons prop */}
                <div className="px-5 py-3 border-b border-hairline">
                  <div className="bg-sky-wash rounded-card border border-sky-border p-3 flex flex-wrap items-end gap-3">
                    <TextField
                      label="Search"
                      placeholder="Search lessons…"
                      value={lessonQuery}
                      onChange={(e) => setLessonQuery(e.target.value)}
                      className="flex-1 min-w-[220px]"
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
                </div>
                {filteredLessons.length === 0 ? (
                  <EmptyState icon="🔍" title="No matches" hint="No lessons match your search or filter. Try clearing the search or switching the status filter." />
                ) : (
                  <div className="divide-y divide-hairline">
                    {filteredLessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => onOpenLesson(lesson.id)}
                        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-sky-wash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky/40"
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
                          <span className="text-xs text-ink-muted">{formatDate(lesson.created_at)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Students tab ── */}
        {tab === 'students' && (
          <div className="bg-white rounded-card border border-hairline overflow-hidden">
            <div className="px-5 py-4 border-b border-hairline">
              <h2 className="font-bold text-ink-black">Students in this course</h2>
            </div>
            {students.length === 0 ? (
              <EmptyState icon="🦗" title="No students enrolled" hint="When a student signs up with this course's invite code, they'll appear here." />
            ) : (
              <div className="divide-y divide-hairline">
                {students.map((student) => (
                  <button
                    key={student.email}
                    onClick={() => onOpenStudent(student.email)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-sky-wash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-ink-black truncate">{student.name || 'Unknown'}</p>
                        {student.level && <Pill variant="level">{student.level}</Pill>}
                        {student.blocked && (
                          <span className="text-[10px] font-bold bg-incorrect-bg text-incorrect-fg px-2 py-0.5 rounded-full">BLOCKED</span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5 truncate">{student.email}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-center">
                      <div>
                        <p className="text-sm font-bold text-sky-text">{student.total_sessions}</p>
                        <p className="text-[10px] text-ink-muted">sessions</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted">{timeAgo(student.last_activity)}</p>
                        <p className="text-[10px] text-ink-muted">last active</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Course Info tab ── */}
        {tab === 'info' && (
          <div className="bg-white rounded-card border border-hairline p-5">
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1.5 block">Course Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1.5 block">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 h-20 resize-none bg-white focus:outline-none focus:border-sky"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1.5 block">Level</label>
                    <select
                      value={form.level}
                      onChange={(e) => setForm({ ...form, level: e.target.value })}
                      className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                    >
                      <option value="">Not set</option>
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1.5 block">Course Type</label>
                    <select
                      value={form.course_type}
                      onChange={(e) => setForm({ ...form, course_type: e.target.value })}
                      className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                    >
                      <option value="">Not set</option>
                      {COURSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1.5 block">Category</label>
                    <select
                      value={form.course_category}
                      onChange={(e) => setForm({ ...form, course_category: e.target.value })}
                      className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
                    >
                      <option value="">Not set</option>
                      {COURSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1.5 block">Invite code</label>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs text-ink-muted">
                      Current code: <span className="font-mono font-bold text-sky-text">{course.invite_code}</span>
                    </span>
                    <Button variant="neutral" size="sm" onClick={handleCopyInvite}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <input
                    type="text"
                    value={form.invite_code}
                    onChange={(e) => setForm({ ...form, invite_code: e.target.value.toUpperCase() })}
                    placeholder="Type a new code to change it (leave blank to keep current)"
                    maxLength={20}
                    className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white font-mono uppercase focus:outline-none focus:border-sky"
                  />
                  <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                    Must be 3-20 letters or digits. Stored uppercase. Changing it does not affect already-joined students.
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1.5 block">Telegram chat ID</label>
                  <input
                    type="text"
                    value={form.telegram_chat_id}
                    onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                    placeholder="e.g. -1001234567890"
                    className="w-full text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white font-mono focus:outline-none focus:border-sky"
                  />
                  <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                    Add <span className="font-mono">@English_with_Laura_Bot</span> to your group, then type <span className="font-mono">/chatid</span> in the group — the bot will reply with the ID. Paste it here. Leave blank to disable notifications for this course.
                  </p>
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
              <>
                <div className="space-y-3">
                  <InfoRow label="Name">{course.name}</InfoRow>
                  <InfoRow label="Description">{course.description || '—'}</InfoRow>
                  <div className="grid grid-cols-4 gap-4">
                    <InfoRow label="Level">{course.level || '—'}</InfoRow>
                    <InfoRow label="Type">{course.course_type || '—'}</InfoRow>
                    <InfoRow label="Category">{course.course_category || '—'}</InfoRow>
                    <InfoRow label="Invite Code">
                      <span className="font-mono text-sky-text">{course.invite_code}</span>
                    </InfoRow>
                  </div>
                  <InfoRow label="Created">{formatDate(course.created_at)}</InfoRow>
                  <InfoRow label="Telegram chat ID">
                    <span className="font-mono">{course.telegram_chat_id || '—'}</span>
                  </InfoRow>
                </div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  <Button variant="primary" size="sm" onClick={startEditing}>Edit Course Info</Button>
                  {course.telegram_chat_id && (
                    <Button variant="secondary" size="sm" onClick={handleTelegramTest} disabled={tgSending}>
                      {tgSending ? 'Sending…' : 'Send test message'}
                    </Button>
                  )}
                </div>
                {tgState && (
                  <div className="mt-3">
                    {tgState.kind === 'ok' ? (
                      <p className="text-xs font-medium text-correct-fg bg-correct-bg border border-correct-border rounded-tile px-3.5 py-2.5">
                        {tgState.message}
                      </p>
                    ) : (
                      <InlineError message={tgState.message} />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CourseDetailView
