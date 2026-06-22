'use client'

// ─────────────────────────────────────────────────────────────────
// AttendanceRail (10B) — the right-rail Attendance card + the
// "All classes" panel, wired to /api/course-sessions overview.
//
// Presentational: all data arrives via the `overview` prop; every
// action is a callback the page owns (mark today, new class, open a
// session). Renders nothing for self-study courses (caller gates that).
// ─────────────────────────────────────────────────────────────────

import { Button } from '@/components/student-ui'

// Mirrors GET /api/course-sessions?action=overview.
export interface SessionCounts {
  present: number
  late: number
  absent: number
  excused: number
  total: number
}

export interface OverviewSession {
  id: string
  session_date: string // YYYY-MM-DD
  start_time: string | null
  duration_min: number
  status: 'held' | 'cancelled'
  topic: string | null
  counts: SessionCounts
}

export interface AttendanceOverview {
  sessions: OverviewSession[]
  rollups: {
    classes_this_month: number
    hours_this_month: number
    avg_pct: number
  }
  today: {
    is_class_day: boolean
    session_id: string | null
    marked: boolean
  }
}

// Short date "22 Jun" from YYYY-MM-DD (parsed as local).
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Short date with weekday "Mon 23 Jun" from YYYY-MM-DD (parsed as local).
function dayShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Current month name, e.g. "June".
function monthName(): string {
  return new Date().toLocaleDateString('en-GB', { month: 'long' })
}

// A coloured count summary for one session row.
// 5/5 green · "4 · 1 late" amber · "4 · 1 absent" red · "Cancelled" grey · "—" when unmarked.
function CountBadge({ session }: { session: OverviewSession }) {
  if (session.status === 'cancelled') {
    return <span className="text-xs font-bold text-ink-muted">Cancelled</span>
  }
  const c = session.counts
  if (c.total === 0) {
    return <span className="text-xs font-bold text-ink-muted">Not marked</span>
  }
  const attended = c.present + c.late
  if (c.absent > 0) {
    return (
      <span className="text-xs font-bold text-[#d64545]">
        {attended} · {c.absent} absent
      </span>
    )
  }
  if (c.late > 0) {
    return (
      <span className="text-xs font-bold text-[#d6336c]">
        {attended} · {c.late} late
      </span>
    )
  }
  return (
    <span className="text-xs font-bold text-[#1a8f3c]">
      {c.present + c.late + c.excused}/{c.total}
    </span>
  )
}

// ─── Icons ───
const WarnIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
)
const ClipboardIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="3" width="8" height="4" rx="1" />
    <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6M9 16h4" />
  </svg>
)

interface AttendanceRailProps {
  overview: AttendanceOverview | null
  loading?: boolean
  // Open the mark modal for today's class (creates it on save if needed).
  onMarkToday: () => void
  // Open the mark modal for a brand-new class (date defaults today).
  onNewClass: () => void
  // Open an existing session to view/edit.
  onOpenSession: (sessionId: string) => void
  // Open the "all classes" panel.
  onViewAll: () => void
}

export default function AttendanceRail({
  overview,
  loading,
  onMarkToday,
  onNewClass,
  onOpenSession,
  onViewAll,
}: AttendanceRailProps) {
  if (loading || !overview) {
    return (
      <div className="bg-white rounded-card border border-hairline p-[18px]">
        <div className="h-4 w-24 bg-hairline rounded animate-pulse mb-3" />
        <div className="h-16 w-full bg-hairline rounded-card animate-pulse mb-3" />
        <div className="h-8 w-full bg-hairline rounded-tile animate-pulse" />
      </div>
    )
  }

  const { sessions, rollups, today } = overview
  const recent = sessions.slice(0, 3)
  const todaySession = today.session_id
    ? sessions.find((s) => s.id === today.session_id) || null
    : null

  return (
    <div className="bg-white rounded-card border border-hairline p-[18px]">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink-black mb-3">
        <span className="text-brandblue">{ClipboardIcon}</span> Attendance
      </h3>

      {/* TODAY block */}
      {today.is_class_day && !today.marked ? (
        <div className="rounded-card border border-hairline bg-white p-3.5 mb-3">
          <p className="text-[11px] font-medium text-ink-muted">
            Today · {dayShortDate(todayInfoIso())}
          </p>
          <p className="text-sm font-bold text-ink-black mt-1.5 flex items-center gap-2">
            <span className="text-[#e8730c]">{WarnIcon}</span> Not marked yet
          </p>
          <button
            onClick={onMarkToday}
            className="mt-3 w-full inline-flex items-center justify-center bg-sky text-white font-bold text-sm py-3.5 rounded-[14px] hover:bg-[#0099d6] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-sky/40"
          >
            Mark attendance
          </button>
        </div>
      ) : today.is_class_day && today.marked && todaySession ? (
        <button
          onClick={() => onOpenSession(todaySession.id)}
          className="w-full text-left rounded-card border border-correct-border bg-correct-bg p-3.5 mb-3 hover:brightness-[0.98] transition-all"
        >
          <p className="text-[10px] font-extrabold text-correct-fg uppercase tracking-eyebrow">
            Today · {shortDate(todaySession.session_date)}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs font-bold text-ink-black">Marked</p>
            <CountBadge session={todaySession} />
          </div>
        </button>
      ) : (
        <Button variant="secondary" size="sm" fullWidth className="mb-3" onClick={onNewClass}>
          + New class
        </Button>
      )}

      {/* Rollup chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f1fb] px-3 py-1.5 text-[11px] font-bold text-sky-dark">
          {monthName()} · {rollups.classes_this_month}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f1fb] px-3 py-1.5 text-[11px] font-bold text-sky-dark">
          {rollups.hours_this_month}h
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f7ee] px-3 py-1.5 text-[11px] font-bold text-[#1a8f3c]">
          avg {rollups.avg_pct}%
        </span>
      </div>

      {/* Recent */}
      {recent.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-extrabold text-ink-muted uppercase tracking-eyebrow mb-1.5">Recent</p>
          <div className="divide-y divide-hairline">
            {recent.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenSession(s.id)}
                className="w-full flex items-center justify-between gap-2 py-2.5 text-left hover:bg-surface rounded-tile px-1.5 -mx-1.5 transition-colors"
              >
                <span className="text-xs font-bold text-ink-black">{shortDate(s.session_date)}</span>
                <CountBadge session={s} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All classes */}
      <button
        onClick={onViewAll}
        className="text-xs font-bold text-brandblue hover:underline mt-1"
      >
        All classes ›
      </button>
    </div>
  )
}

// Local today ISO for the "Today ·" label (the overview's today.session_id
// may be null when no session exists yet, so we derive the date here).
function todayInfoIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────
// AllSessionsPanel — modal listing every session with counts + status.
// Clicking a row opens it (via onOpenSession).
// ─────────────────────────────────────────────────────────────────

export function AllSessionsPanel({
  courseName,
  sessions,
  onOpenSession,
  onNewClass,
  onClose,
}: {
  courseName: string
  sessions: OverviewSession[]
  onOpenSession: (sessionId: string) => void
  onNewClass: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 font-rubik flex items-end sm:items-center justify-center bg-black/45 px-0 sm:px-4 py-0 sm:py-6">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-card rounded-t-card shadow-[0_24px_64px_rgba(15,22,40,0.28)] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-hairline flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-sky-text uppercase tracking-eyebrow">All classes</p>
            <h2 className="text-lg font-bold text-ink-black mt-1 truncate">{courseName}</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {sessions.length} class{sessions.length !== 1 ? 'es' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-full hover:bg-surface text-ink-muted flex items-center justify-center text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-10">No classes yet.</p>
          ) : (
            <div className="divide-y divide-hairline">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onOpenSession(s.id)}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-surface rounded-tile px-2 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-black">{shortDate(s.session_date)}</p>
                    {s.topic && <p className="text-xs text-ink-muted truncate mt-0.5">{s.topic}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-ink-muted">{s.duration_min}m</span>
                    <CountBadge session={s} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-hairline px-5 py-3.5">
          <Button variant="secondary" size="md" fullWidth onClick={onNewClass}>
            + New class
          </Button>
        </div>
      </div>
    </div>
  )
}
