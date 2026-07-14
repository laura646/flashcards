'use client'

import { useState, useEffect, useCallback } from 'react'
import { isTestLessonType } from '@/lib/test-mode'

// ═══════════════════════════════════════════════════════════════════
// Course ▸ Tests tab — the dedicated test-results view (exam mode).
// Pick a test lesson of the course → per-student table: score, time
// used / time left, status (Submitted / Auto-submitted / In progress /
// Not started), and Reset attempt for retakes. The table asks the
// test-session API with view=teacher, which also sweeps any expired
// open sessions so what's shown is truthful.
// ═══════════════════════════════════════════════════════════════════

export interface TestsTabLesson {
  id: string
  title: string
  lesson_type?: string | null
  status: 'draft' | 'published'
}

interface ResultRow {
  student_email: string
  student_name: string
  status: 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted'
  score: number | null
  total: number | null
  started_at: string | null
  submitted_at: string | null
  deadline: string | null
}

const TYPE_BADGES: Record<string, string> = {
  mid_course_test: '📝 Mid-course',
  final_test: '🎓 Final',
  review_test: '🔄 Review',
}

const STATUS_STYLE: Record<ResultRow['status'], { label: string; cls: string }> = {
  submitted: { label: 'Submitted', cls: 'bg-correct-bg text-correct-fg' },
  auto_submitted: { label: 'Auto-submitted', cls: 'bg-[#fef3e2] text-[#b45309]' },
  in_progress: { label: 'In progress', cls: 'bg-sky-wash text-sky-text' },
  not_started: { label: 'Not started', cls: 'bg-surface text-ink-muted' },
}

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss < 10 ? '0' : ''}${ss}`
}

export default function CourseTestsTab({ lessons, canEdit }: { lessons: TestsTabLesson[]; canEdit: boolean }) {
  const testLessons = lessons.filter((l) => isTestLessonType(l.lesson_type))
  const [selectedId, setSelectedId] = useState<string | null>(testLessons[0]?.id ?? null)
  const [rows, setRows] = useState<ResultRow[] | null>(null)
  const [limitMin, setLimitMin] = useState<number>(30)
  const [serverNow, setServerNow] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async (lessonId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/test-session?lesson_id=${encodeURIComponent(lessonId)}&view=teacher`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not load results.'); setRows(null); return }
      setRows(data.rows || [])
      setLimitMin(data.settings?.time_limit_minutes ?? 30)
      setServerNow(data.server_now || null)
    } catch {
      setError('Network error — could not load results.')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) load(selectedId)
  }, [selectedId, load])

  const resetAttempt = async (email: string) => {
    if (!selectedId) return
    setResetting(true)
    try {
      const res = await fetch('/api/test-session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: selectedId, student_email: email }),
      })
      if (res.ok) await load(selectedId)
      else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Could not reset the attempt.')
      }
    } catch {
      setError('Network error — could not reset the attempt.')
    } finally {
      setResetting(false)
      setConfirmReset(null)
    }
  }

  if (testLessons.length === 0) {
    return (
      <div className="bg-white rounded-card border border-hairline p-8 text-center">
        <div className="text-3xl mb-2">📝</div>
        <p className="text-sm font-bold text-ink-body">No tests in this course yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Create a lesson and set its type to Mid-course, Final or Review Test — it will appear here with per-student results.
        </p>
      </div>
    )
  }

  const timeCell = (r: ResultRow): string => {
    if (r.status === 'in_progress' && r.deadline && serverNow) {
      const left = new Date(r.deadline).getTime() - new Date(serverNow).getTime()
      return `${fmtMs(left)} left`
    }
    if ((r.status === 'submitted' || r.status === 'auto_submitted') && r.started_at && r.submitted_at) {
      const used = new Date(r.submitted_at).getTime() - new Date(r.started_at).getTime()
      return fmtMs(Math.min(used, limitMin * 60_000))
    }
    return '—'
  }

  return (
    <div className="space-y-4">
      {/* Test picker */}
      <div className="bg-white rounded-card border border-hairline p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-2.5">Pick a test</p>
        <div className="flex flex-wrap gap-2">
          {testLessons.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`text-[12px] font-bold px-3.5 py-2 rounded-full border-[1.5px] transition-colors ${
                selectedId === l.id
                  ? 'bg-sky border-sky text-white'
                  : 'bg-white border-sky-border text-ink-body hover:border-sky'
              }`}
            >
              {TYPE_BADGES[l.lesson_type || ''] || '📝'} {l.title}
              {l.status !== 'published' && <span className="ml-1 opacity-70">(draft)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white rounded-card border border-hairline p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">Results</p>
          <span className="text-[11px] text-ink-muted font-bold">⏱ {limitMin} min limit</span>
        </div>

        {error && (
          <div className="bg-incorrect-bg border border-incorrect-border rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between">
            <p className="text-xs text-incorrect-fg font-bold">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-incorrect-fg font-bold ml-2">✕</button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-ink-muted text-center py-6">Loading results…</p>
        ) : !rows || rows.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-6">No students enrolled in this course.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-[1.5px] border-hairline">
                  <th className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted py-2 pr-3">Student</th>
                  <th className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted py-2 pr-3">Score</th>
                  <th className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted py-2 pr-3">Time</th>
                  <th className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted py-2 pr-3">Status</th>
                  {canEdit && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = STATUS_STYLE[r.status]
                  const pct = r.score !== null && r.total ? Math.round((r.score / r.total) * 100) : null
                  return (
                    <tr key={r.student_email} className="border-b border-hairline last:border-b-0">
                      <td className="py-2.5 pr-3">
                        <p className="text-[13px] font-bold text-ink-body">{r.student_name}</p>
                        <p className="text-[11px] text-ink-muted">{r.student_email}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-[13px] font-bold text-ink-body tabular-nums whitespace-nowrap">
                        {r.score !== null && r.total !== null ? `${r.score}/${r.total} · ${pct}%` : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-[12px] text-ink-muted tabular-nums whitespace-nowrap">{timeCell(r)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                      </td>
                      {canEdit && (
                        <td className="py-2.5 text-right whitespace-nowrap">
                          {r.status !== 'not_started' && (
                            confirmReset === r.student_email ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="text-[11px] text-ink-muted">Reset attempt?</span>
                                <button onClick={() => resetAttempt(r.student_email)} disabled={resetting}
                                  className="text-[11px] font-extrabold text-incorrect-fg hover:underline disabled:opacity-50">
                                  {resetting ? '…' : 'Yes'}
                                </button>
                                <button onClick={() => setConfirmReset(null)} disabled={resetting}
                                  className="text-[11px] font-bold text-ink-muted hover:text-ink-body">No</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmReset(r.student_email)}
                                className="text-[11px] font-bold text-ink-muted hover:text-incorrect-fg transition-colors">
                                ↺ Reset
                              </button>
                            )
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-ink-muted leading-relaxed mt-3">
          Scores also feed each student&apos;s accuracy and the course reports automatically.
          “Auto-submitted” = time ran out; answers saved before the deadline were scored.
          Reset deletes the attempt <b>and</b> its scores so the student can retake.
        </p>
      </div>
    </div>
  )
}
