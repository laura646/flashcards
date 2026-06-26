'use client'

// ─────────────────────────────────────────────────────────────────
// MarkAttendanceModal (10B) — course-native attendance marking.
//
// Presentational: receives the roster + any existing marks + schedule
// prefills, and reports a single onSave payload. The page owns the
// create-session / save-attendance API calls; this component never
// fetches and never touches the router.
//
// Design (LOCKED): eyebrow "MARK ATTENDANCE" + big date title, course
// + N students subline, close X. A row of pill controls — Date (calendar
// popup), Time, Duration chips. Optional "what did you cover" topic.
// Info bar "Everyone starts Present — tap the exceptions." + "Mark all
// present". Roster rows: avatar + name + 4 status buttons; Late reveals
// minutes-late + note, Excused reveals a note. Whole-class cancel.
// Footer: live tally + "Save class".
// ─────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { Button, InlineError, Spinner } from '@/components/student-ui'

export type AttStatus = 'present' | 'late' | 'absent' | 'excused'

export interface RosterStudent {
  student_email: string
  name: string
}

export interface ExistingMark {
  student_email: string
  status: AttStatus
  minutes_late: number | null
  note: string | null
}

export interface MarkSavePayload {
  session_date: string // YYYY-MM-DD
  start_time: string | null
  duration_min: number
  topic: string | null
  cancelled: boolean
  records: { student_email: string; status: AttStatus; minutes_late?: number; note?: string }[]
}

interface MarkAttendanceModalProps {
  courseName: string
  roster: RosterStudent[]
  // Prefills (schedule defaults for a NEW class, or the existing session's values).
  defaultDate: string // YYYY-MM-DD
  defaultTime: string | null
  defaultDuration: number
  defaultTopic?: string | null
  defaultCancelled?: boolean
  existingMarks?: ExistingMark[]
  loading?: boolean
  saving?: boolean
  saveError?: string | null
  onClose: () => void
  onSave: (payload: MarkSavePayload) => void
  canEdit?: boolean
}

const DURATION_CHIPS: { value: number; label: string }[] = [
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
  { value: 120, label: '2h' },
]

const STATUS_META: Record<
  AttStatus,
  { label: string; active: string; idle: string }
> = {
  present: {
    label: 'Present',
    active: 'bg-[#e7f7ee] text-[#1a8f3c] border-[#bce6cd]',
    idle: 'bg-white text-ink-muted border-hairline hover:border-[#bce6cd]',
  },
  late: {
    label: 'Late',
    active: 'bg-[#fdecd9] text-[#e8730c] border-[#f6d3a8]',
    idle: 'bg-white text-ink-muted border-hairline hover:border-[#f6d3a8]',
  },
  absent: {
    label: 'Absent',
    active: 'bg-[#fdecec] text-[#d64545] border-[#f3c9c9]',
    idle: 'bg-white text-ink-muted border-hairline hover:border-[#f3c9c9]',
  },
  excused: {
    label: 'Excused',
    active: 'bg-[#e7f1fd] text-[#1f6fb2] border-[#c2dcf6]',
    idle: 'bg-white text-ink-muted border-hairline hover:border-[#c2dcf6]',
  },
}

// Local per-student editable mark.
interface RowState {
  status: AttStatus
  minutesLate: string
  note: string
}

// Initials from a name / email (max 2 chars).
function initials(name: string, email: string): string {
  const src = (name || email || '').trim()
  if (!src) return '?'
  const base = src.includes('@') ? src.split('@')[0] : src
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

// Pretty long date for the title, e.g. "Monday, 23 June".
function longDate(iso: string): string {
  // Parse as a LOCAL date (avoid the UTC shift from new Date('YYYY-MM-DD')).
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Short date for the Date pill, e.g. "Mon, 23 Jun".
function shortDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// A small month calendar popup. Single-select, defaults to the picked date's month.
function CalendarPopup({
  value,
  onPick,
  onClose,
}: {
  value: string
  onPick: (iso: string) => void
  onClose: () => void
}) {
  const [y0, m0] = value.split('-').map(Number)
  const initial = new Date(y0 || new Date().getFullYear(), (m0 || 1) - 1, 1)
  const [cursor, setCursor] = useState(initial)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const isoFor = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden="true" />
      <div className="absolute top-full left-0 mt-2 z-[61] bg-white rounded-card border border-hairline shadow-[0_12px_32px_rgba(15,22,40,0.16)] p-3 w-[260px]">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="w-7 h-7 rounded-tile hover:bg-sky-wash text-ink-body flex items-center justify-center"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="text-[13px] font-bold text-ink-black">{monthLabel}</span>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="w-7 h-7 rounded-tile hover:bg-sky-wash text-ink-body flex items-center justify-center"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[10px] font-bold text-ink-muted py-1">
              {w[0]}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />
            const iso = isoFor(d)
            const selected = iso === value
            return (
              <button
                key={iso}
                onClick={() => { onPick(iso); onClose() }}
                className={`h-8 rounded-tile text-[13px] font-bold transition-colors ${
                  selected
                    ? 'bg-sky text-white'
                    : 'text-ink-body hover:bg-sky-wash'
                }`}
              >
                {d}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// Calendar / clock / chevron icons (Tabler-style line icons).
const CalIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)
const ClockIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
const InfoIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
)

export default function MarkAttendanceModal({
  courseName,
  roster,
  defaultDate,
  defaultTime,
  defaultDuration,
  defaultTopic,
  defaultCancelled,
  existingMarks,
  loading,
  saving,
  saveError,
  onClose,
  onSave,
  canEdit = true,
}: MarkAttendanceModalProps) {
  const [date, setDate] = useState(defaultDate)
  const [showCal, setShowCal] = useState(false)
  const [time, setTime] = useState(defaultTime || '')
  const [duration, setDuration] = useState(defaultDuration || 60)
  const [topic, setTopic] = useState(defaultTopic || '')
  const [cancelled, setCancelled] = useState(!!defaultCancelled)

  // Seed per-student rows: existing mark if present, else default Present.
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const byEmail: Record<string, ExistingMark> = {}
    for (const m of existingMarks || []) byEmail[m.student_email] = m
    const init: Record<string, RowState> = {}
    for (const s of roster) {
      const m = byEmail[s.student_email]
      init[s.student_email] = {
        status: m?.status || 'present',
        minutesLate: m?.minutes_late != null ? String(m.minutes_late) : '',
        note: m?.note || '',
      }
    }
    return init
  })

  const setStatus = (email: string, status: AttStatus) =>
    setRows((prev) => ({ ...prev, [email]: { ...prev[email], status } }))
  const setMinutes = (email: string, minutesLate: string) =>
    setRows((prev) => ({ ...prev, [email]: { ...prev[email], minutesLate } }))
  const setNote = (email: string, note: string) =>
    setRows((prev) => ({ ...prev, [email]: { ...prev[email], note } }))

  const markAllPresent = () =>
    setRows((prev) => {
      const next: Record<string, RowState> = {}
      for (const email of Object.keys(prev)) next[email] = { ...prev[email], status: 'present' }
      return next
    })

  // Live tally.
  const tally = useMemo(() => {
    const t = { present: 0, late: 0, absent: 0, excused: 0 }
    for (const s of roster) {
      const st = rows[s.student_email]?.status || 'present'
      t[st]++
    }
    return t
  }, [rows, roster])
  const drawnDown = tally.present + tally.late + tally.absent

  const handleSave = () => {
    const records = roster.map((s) => {
      const r = rows[s.student_email]
      const minutes = parseInt(r.minutesLate, 10)
      return {
        student_email: s.student_email,
        status: r.status,
        minutes_late: r.status === 'late' && !isNaN(minutes) ? minutes : undefined,
        note: r.note.trim() ? r.note.trim() : undefined,
      }
    })
    onSave({
      session_date: date,
      start_time: time.trim() || null,
      duration_min: duration,
      topic: topic.trim() || null,
      cancelled,
      records,
    })
  }

  return (
    <div className="fixed inset-0 z-50 font-rubik flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4 py-0 sm:py-6">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-[20px] rounded-t-[20px] shadow-[0_24px_64px_rgba(15,22,40,0.28)] max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-brandblue uppercase tracking-eyebrow">Mark attendance</p>
            <h2 className="text-[30px] font-extrabold text-ink-black mt-1.5 leading-[1.1] tracking-hero">{longDate(date)}</h2>
            <p className="text-sm text-ink-muted mt-1.5 truncate">
              {courseName} · {roster.length} student{roster.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full bg-surface hover:bg-hairline text-ink-muted flex items-center justify-center text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={28} />
          </div>
        ) : (
          <>
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Pill controls */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Date */}
                <div className="relative">
                  <button
                    onClick={() => setShowCal((v) => !v)}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border-[1.5px] border-hairline bg-white text-[13px] font-bold text-ink-black hover:border-sky-border transition-colors"
                  >
                    <span className="text-ink-muted">{CalIcon}</span>
                    {shortDateLabel(date)}
                  </button>
                  {showCal && (
                    <CalendarPopup value={date} onPick={setDate} onClose={() => setShowCal(false)} />
                  )}
                </div>
                {/* Time */}
                <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border-[1.5px] border-hairline bg-white text-[13px] font-bold text-ink-black focus-within:border-sky-border transition-colors">
                  <span className="text-ink-muted">{ClockIcon}</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-transparent outline-none w-[68px] text-ink-black"
                    aria-label="Class time"
                  />
                </label>
                {/* Duration chips */}
                {DURATION_CHIPS.map((c) => {
                  const active = duration === c.value
                  return (
                    <button
                      key={c.value}
                      onClick={() => setDuration(c.value)}
                      className={`px-3.5 py-2.5 text-[13px] font-bold rounded-full border-[1.5px] transition-all ${
                        active
                          ? 'bg-[#e7f1fd] text-brandblue border-[#c2dcf6]'
                          : 'bg-white text-ink-muted border-hairline hover:border-sky-border'
                      }`}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>

              {/* Topic */}
              <div className="mb-4">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What did you cover today? (optional)"
                  className="w-full text-sm text-ink-body bg-white border-[1.5px] border-hairline rounded-[14px] px-4 py-3 placeholder:text-[#b6bac2] focus:outline-none focus:border-sky transition-colors"
                />
              </div>

              {cancelled ? (
                <div className="bg-surface border border-hairline rounded-card p-5 text-center">
                  <p className="text-sm font-bold text-ink-body">This class is marked cancelled.</p>
                  <p className="text-xs text-ink-muted mt-1">No attendance is recorded for a cancelled class.</p>
                  <Button variant="neutral" size="sm" className="mt-3" onClick={() => setCancelled(false)}>
                    Un-cancel — mark attendance
                  </Button>
                </div>
              ) : (
                <>
                  {/* Info bar */}
                  <div className="flex items-center justify-between gap-3 bg-[#e9f1fb] rounded-[14px] px-4 py-3 mb-3.5">
                    <p className="flex items-center gap-2 text-xs text-ink-muted leading-snug">
                      <span className="shrink-0 text-brandblue">{InfoIcon}</span>
                      <span>Everyone starts <span className="font-bold text-ink-black">Present</span> — tap the exceptions.</span>
                    </p>
                    <button
                      onClick={markAllPresent}
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-brandblue hover:underline whitespace-nowrap"
                    >
                      <span aria-hidden="true">✓✓</span> Mark all present
                    </button>
                  </div>

                  {/* Roster */}
                  <div className="divide-y divide-hairline border-t border-hairline">
                    {roster.length === 0 ? (
                      <p className="text-sm text-ink-muted text-center py-6">No students enrolled in this course yet.</p>
                    ) : (
                      roster.map((s) => {
                        const r = rows[s.student_email]
                        return (
                          <div key={s.student_email} className="py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 shrink-0 rounded-full bg-[#cfe4fb] text-brandblue font-bold flex items-center justify-center text-[11px]">
                                {initials(s.name, s.student_email)}
                              </div>
                              <p className="flex-1 min-w-0 text-sm font-bold text-ink-black truncate">{s.name}</p>
                              <div className="flex gap-1.5 shrink-0">
                                {(['present', 'late', 'absent', 'excused'] as AttStatus[]).map((st) => {
                                  const meta = STATUS_META[st]
                                  const active = r.status === st
                                  return (
                                    <button
                                      key={st}
                                      onClick={() => setStatus(s.student_email, st)}
                                      className={`px-2.5 py-1.5 rounded-[10px] border-[1.5px] text-[12px] font-bold transition-colors ${
                                        active ? meta.active : meta.idle
                                      }`}
                                    >
                                      {meta.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                            {/* Late: minutes + note */}
                            {r.status === 'late' && (
                              <div className="mt-2 ml-11 flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                                  <input
                                    type="number"
                                    min={0}
                                    value={r.minutesLate}
                                    onChange={(e) => setMinutes(s.student_email, e.target.value)}
                                    placeholder="0"
                                    className="w-16 text-sm text-ink-body border border-hairline rounded-tile px-2 py-1.5 focus:outline-none focus:border-sky"
                                  />
                                  min late
                                </label>
                                <input
                                  type="text"
                                  value={r.note}
                                  onChange={(e) => setNote(s.student_email, e.target.value)}
                                  placeholder="Note (optional)"
                                  className="flex-1 min-w-[140px] text-sm text-ink-body border border-hairline rounded-tile px-2.5 py-1.5 focus:outline-none focus:border-sky"
                                />
                              </div>
                            )}
                            {/* Excused: note (make-up eligible label, no scheduling) */}
                            {r.status === 'excused' && (
                              <div className="mt-2 ml-11">
                                <input
                                  type="text"
                                  value={r.note}
                                  onChange={(e) => setNote(s.student_email, e.target.value)}
                                  placeholder="Reason / note (optional)"
                                  className="w-full text-sm text-ink-body border border-hairline rounded-tile px-2.5 py-1.5 focus:outline-none focus:border-sky"
                                />
                                <p className="text-[10px] text-sky-text font-bold mt-1">Make-up eligible</p>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Whole-class cancel */}
                  <button
                    onClick={() => setCancelled(true)}
                    className="mt-3 text-xs font-bold text-ink-muted hover:text-incorrect-fg underline"
                  >
                    Cancel this whole class instead
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#e9f1fb] px-6 py-4">
              {saveError && (
                <div className="mb-2.5">
                  <InlineError message={saveError} />
                </div>
              )}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {!cancelled ? (
                  <p className="text-[12px] text-ink-muted leading-snug">
                    <span className="font-bold text-[#1a8f3c]">{tally.present} present</span> ·{' '}
                    <span className="font-bold text-[#e8730c]">{tally.late} late</span> ·{' '}
                    <span className="font-bold text-[#d64545]">{tally.absent} absent</span> ·{' '}
                    <span className="font-bold text-[#1f6fb2]">{tally.excused} excused</span> ·{' '}
                    <span className="font-bold text-ink-black">{drawnDown} drawn down</span>
                  </p>
                ) : (
                  <span />
                )}
                {canEdit ? (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="shrink-0 inline-flex items-center justify-center bg-sky text-white font-bold text-[15px] px-7 py-3.5 rounded-[14px] hover:bg-[#0099d6] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-sky/40 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : cancelled ? 'Save (cancelled)' : 'Save class'}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs font-bold text-ink-muted px-2">View only</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
