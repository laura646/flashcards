'use client'

// Wave 0 — redesigned Student DETAIL screen (10B), "new beside old".
//
// Presentational only: all data arrives via props and every mutation is a
// callback the real page owns (fetch + POST /api/admin). The View MAY hold
// local UI state (edit-mode toggle, profile draft, custom-tag input, notes
// draft + saved flash, reminder modal). Ports the legacy student-detail JSX
// from app/admin/page.tsx into the kit: Rubik, sky-text values, hairline
// cards, Pill levels, Skeleton/EmptyState, breadcrumb header. Honours the
// LOCKED rule (brandblue text never on a sky-wash background).

import { useState } from 'react'
import { Button, Pill, Eyebrow, Card, TextField, EmptyState, Skeleton, InlineError } from '@/components/student-ui'
import { PageHeader } from '@/components/student-ui/PageHeader'
import { COMMON_ISSUES_BY_LEVEL } from '@/lib/common-issues'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_COLORS } from '@/lib/account-types'

const LEVELS = Object.keys(COMMON_ISSUES_BY_LEVEL)

export interface StudentDetailData {
  email: string
  name: string
  created_at: string
  level: string | null
  learning_goals: string | null
  company: string | null
  account_type: string | null
  common_issues_tags: string[]
  common_issues_comments: string | null
  blocked: boolean
  notes: string | null
  courses: { id: string; name: string }[]
}

export interface ProgressRow {
  id?: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
}

export interface ProfileSaveForm {
  level: string
  company: string
  account_type: string
  learning_goals: string
  common_issues_tags: string[]
  common_issues_comments: string
}

// ── Helpers (ported from legacy app/admin/page.tsx) ──

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function StudentDetailView({
  student,
  progress,
  loading,
  onBack,
  onSaveProfile,
  onSaveNotes,
  onSendReminder,
}: {
  student: StudentDetailData | null
  progress: ProgressRow[]
  loading: boolean
  onBack: () => void
  onSaveProfile: (f: ProfileSaveForm) => Promise<{ ok: boolean; error?: string }>
  onSaveNotes: (notes: string) => Promise<{ ok: boolean; error?: string }>
  onSendReminder: (message: string) => Promise<{ ok: boolean; error?: string }>
}) {
  // ── Profile edit state ──
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileSaveForm>({
    level: '', company: '', account_type: '', learning_goals: '', common_issues_tags: [], common_issues_comments: '',
  })
  const [customTag, setCustomTag] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  // ── Notes state ──
  const [notes, setNotes] = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesError, setNotesError] = useState('')

  // ── Reminder modal state ──
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderMessage, setReminderMessage] = useState('')
  const [reminderSending, setReminderSending] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)
  const [reminderError, setReminderError] = useState('')

  // Seed the notes draft once we have a student (only if untouched).
  const seededNotes = student?.notes ?? ''
  if (student && !notesDirty && notes !== seededNotes && !notesSaving && !notesSaved) {
    setNotes(seededNotes)
  }

  const startEditProfile = () => {
    if (!student) return
    setProfileForm({
      level: student.level || '',
      company: student.company || '',
      account_type: student.account_type || '',
      learning_goals: student.learning_goals || '',
      common_issues_tags: [...(student.common_issues_tags || [])],
      common_issues_comments: student.common_issues_comments || '',
    })
    setCustomTag('')
    setProfileError('')
    setEditingProfile(true)
  }

  const toggleIssueTag = (tag: string) => {
    setProfileForm((prev) => ({
      ...prev,
      common_issues_tags: prev.common_issues_tags.includes(tag)
        ? prev.common_issues_tags.filter((t) => t !== tag)
        : [...prev.common_issues_tags, tag],
    }))
  }

  const addCustomTag = () => {
    const trimmed = customTag.trim()
    if (trimmed && !profileForm.common_issues_tags.includes(trimmed)) {
      setProfileForm((prev) => ({ ...prev, common_issues_tags: [...prev.common_issues_tags, trimmed] }))
      setCustomTag('')
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileError('')
    const res = await onSaveProfile(profileForm)
    setSavingProfile(false)
    if (res.ok) {
      setEditingProfile(false)
    } else {
      setProfileError(res.error || 'Failed to save profile')
    }
  }

  const handleSaveNotes = async () => {
    setNotesSaving(true)
    setNotesError('')
    const res = await onSaveNotes(notes)
    setNotesSaving(false)
    if (res.ok) {
      setNotesDirty(false)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } else {
      setNotesError(res.error || 'Failed to save notes')
    }
  }

  const handleSendReminder = async () => {
    if (!reminderMessage.trim()) return
    setReminderSending(true)
    setReminderError('')
    const res = await onSendReminder(reminderMessage)
    setReminderSending(false)
    if (res.ok) {
      setReminderSent(true)
      setTimeout(() => {
        setShowReminderModal(false)
        setReminderMessage('')
        setReminderSent(false)
      }, 2000)
    } else {
      setReminderError(res.error || 'Failed to send email')
    }
  }

  const closeReminder = () => {
    setShowReminderModal(false)
    setReminderMessage('')
    setReminderError('')
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="font-rubik min-h-screen bg-surface px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-4 w-44 mb-5" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-card border border-hairline p-5 mb-4">
              <Skeleton className="h-5 w-40 mb-3" />
              <Skeleton className="h-3 w-full mb-1.5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Student not found ──
  if (!student) {
    return (
      <div className="font-rubik min-h-screen bg-surface px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <PageHeader crumbs={[{ label: 'My Students', onClick: onBack }, { label: 'Student' }]} className="mb-5" />
          <InlineError message="Student not found, or you don't have access to them." />
        </div>
      </div>
    )
  }

  const levelIssues = profileForm.level ? COMMON_ISSUES_BY_LEVEL[profileForm.level] : undefined

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          crumbs={[{ label: 'My Students', onClick: onBack }, { label: student.name || 'Unknown' }]}
          className="mb-5"
        />

        {/* ── Info card ── */}
        <Card className="mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-ink-black">{student.name || 'Unknown'}</h1>
                {student.blocked && (
                  <span className="bg-incorrect-bg text-incorrect-fg text-[10px] font-bold px-2 py-0.5 rounded-full">BLOCKED</span>
                )}
              </div>
              <p className="text-xs text-ink-muted mt-0.5">{student.email}</p>
              {student.courses.length > 0 && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {student.courses.map((c) => (
                    <Pill key={c.id} variant="level">{c.name}</Pill>
                  ))}
                </div>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowReminderModal(true)}>
              Send Reminder
            </Button>
          </div>
        </Card>

        {/* ── Two-column body: Profile (left) · Notes + Activity (right) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* ── Student profile card ── */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <Eyebrow>Student Profile</Eyebrow>
            {!editingProfile && (
              <button onClick={startEditProfile} className="text-xs font-bold text-sky-text hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40">
                Edit
              </button>
            )}
          </div>

          {editingProfile ? (
            <div className="space-y-4">
              {profileError && <InlineError message={profileError} />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">Level</span>
                  <select
                    value={profileForm.level}
                    onChange={(e) => setProfileForm({ ...profileForm, level: e.target.value })}
                    className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors"
                  >
                    <option value="">Not set</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <TextField
                  label="Company"
                  value={profileForm.company}
                  onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                  placeholder="Company name"
                />
                <div>
                  <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">Account type</span>
                  <select
                    value={profileForm.account_type}
                    onChange={(e) => setProfileForm({ ...profileForm, account_type: e.target.value })}
                    className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors"
                  >
                    <option value="">Not set</option>
                    {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">Learning Goals</span>
                <textarea
                  value={profileForm.learning_goals}
                  onChange={(e) => setProfileForm({ ...profileForm, learning_goals: e.target.value })}
                  placeholder="What does this student want to achieve?"
                  className="w-full h-16 text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] resize-none focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]"
                />
              </div>

              {/* Common-issues tag picker */}
              <div>
                <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-2 text-ink-muted">Common Issues / Structure Tags</span>
                {levelIssues ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {levelIssues.map((tag) => {
                      const on = profileForm.common_issues_tags.includes(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleIssueTag(tag)}
                          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                            on ? 'bg-sky text-white border-sky' : 'bg-white text-ink-body border-hairline hover:border-sky'
                          }`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted mb-3">Select a level to see common issues for that level</p>
                )}

                {/* Custom tag input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                    placeholder="Add custom tag…"
                    className="text-xs text-ink-body border border-hairline rounded-tile px-3 py-2 flex-1 bg-white placeholder:text-ink-muted focus:outline-none focus:border-sky"
                  />
                  <button onClick={addCustomTag} className="text-xs font-bold text-sky-text hover:underline px-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40">
                    + Add
                  </button>
                </div>

                {/* Selected tags */}
                {profileForm.common_issues_tags.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] text-ink-muted mb-1">Selected tags:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profileForm.common_issues_tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 bg-sky-wash text-ink-body text-[11px] font-bold px-2.5 py-1 rounded-full">
                          {tag}
                          <button onClick={() => toggleIssueTag(tag)} aria-label={`Remove ${tag}`} className="text-sm leading-none hover:text-incorrect-fg">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">Comments on Common Issues</span>
                <textarea
                  value={profileForm.common_issues_comments}
                  onChange={(e) => setProfileForm({ ...profileForm, common_issues_comments: e.target.value })}
                  placeholder="Additional notes about this student's common mistakes…"
                  className="w-full h-16 text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] resize-none focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]"
                />
              </div>

              <div className="flex gap-2 pt-1 items-center">
                <Button variant="primary" size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save Profile'}
                </Button>
                <button onClick={() => setEditingProfile(false)} className="text-xs font-bold text-ink-muted hover:text-ink-body px-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Level</p>
                  <p className="text-sm text-ink-black mt-0.5">{student.level || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Company</p>
                  <p className="text-sm text-ink-black mt-0.5">{student.company || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Account type</p>
                  {student.account_type ? (
                    <span className="inline-block mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: ACCOUNT_TYPE_COLORS[student.account_type]?.bg, color: ACCOUNT_TYPE_COLORS[student.account_type]?.text }}>{student.account_type}</span>
                  ) : (
                    <p className="text-sm text-ink-black mt-0.5">—</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Joined</p>
                  <p className="text-sm text-ink-black mt-0.5">{formatDate(student.created_at)}</p>
                </div>
              </div>
              {student.learning_goals && (
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Learning Goals</p>
                  <p className="text-sm text-ink-black mt-0.5">{student.learning_goals}</p>
                </div>
              )}
              {(student.common_issues_tags || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Common Issues</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {student.common_issues_tags.map((tag) => (
                      <Pill key={tag} variant="level">{tag}</Pill>
                    ))}
                  </div>
                </div>
              )}
              {student.common_issues_comments && (
                <div>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Comments</p>
                  <p className="text-sm text-ink-black mt-0.5">{student.common_issues_comments}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Right column: Notes + Activity ── */}
        <div className="space-y-4">
        {/* ── Teacher notes card ── */}
        <Card>
          <Eyebrow>Teacher Notes</Eyebrow>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); setNotesSaved(false) }}
            placeholder="Add private notes about this student…"
            className="w-full h-24 text-sm text-ink-body bg-white border border-hairline rounded-tile p-3 mt-2 resize-none focus:outline-none focus:border-sky transition-colors placeholder:text-ink-muted"
          />
          {notesError && <InlineError message={notesError} className="mt-2" />}
          <div className="flex items-center gap-2 mt-2">
            <Button variant="primary" size="sm" onClick={handleSaveNotes} disabled={notesSaving}>
              {notesSaving ? 'Saving…' : 'Save Notes'}
            </Button>
            {notesSaved && <span className="text-xs font-bold text-correct-fg">Saved!</span>}
          </div>
        </Card>

        {/* ── Activity history card ── */}
        <Card padding="sm">
          <div className="px-1 pb-3 mb-1 border-b border-hairline">
            <h3 className="font-bold text-ink-black">Activity History</h3>
          </div>
          {progress.length === 0 ? (
            <EmptyState icon="📭" title="No activity recorded yet" />
          ) : (
            <div className="divide-y divide-hairline">
              {progress.slice(0, 20).map((p, i) => (
                <div key={p.id ?? `${p.activity_type}-${p.activity_id}-${i}`} className="px-1 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-black truncate">
                      {p.activity_type === 'flashcard' ? `Flashcards: ${p.activity_id}` : `Exercise ${p.activity_id}`}
                    </p>
                    {p.score != null && p.total ? (
                      <p className="text-xs text-ink-muted">
                        Score: {p.score}/{p.total} ({Math.round((p.score / p.total) * 100)}%)
                      </p>
                    ) : (
                      <p className="text-xs text-ink-muted">Completed</p>
                    )}
                  </div>
                  <span className="text-xs text-ink-muted shrink-0">{formatDate(p.completed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>
        </div>

        {/* ── Send reminder modal ── */}
        {showReminderModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4 font-rubik">
            <div className="bg-white rounded-card border border-hairline shadow-xl w-full max-w-md p-6">
              <h3 className="font-bold text-ink-black mb-1">Send Reminder</h3>
              <p className="text-xs text-ink-muted mb-4">
                Email to: {student.name} ({student.email})
              </p>
              {reminderSent ? (
                <div className="text-center py-8">
                  <p className="text-sm font-bold text-correct-fg">Message sent!</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    placeholder="Write your message here…"
                    autoFocus
                    className="w-full h-32 text-sm text-ink-body bg-white border border-hairline rounded-tile p-3 resize-none focus:outline-none focus:border-sky transition-colors mb-3 placeholder:text-ink-muted"
                  />
                  {reminderError && <InlineError message={reminderError} className="mb-3" />}
                  <div className="flex gap-2 justify-end items-center">
                    <button onClick={closeReminder} className="text-xs font-bold text-ink-muted hover:text-ink-body px-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40">
                      Cancel
                    </button>
                    <Button variant="primary" size="sm" onClick={handleSendReminder} disabled={reminderSending || !reminderMessage.trim()}>
                      {reminderSending ? 'Sending…' : 'Send Email'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentDetailView
