'use client'

// Wave 0 — redesigned Reports (10B). Presentational + self-contained
// (manages selection internally) so it's viewable with mock data in a
// harness. The real /admin/reports has heavy data logic (computeStudentDigest,
// buildStudentDetail, AI summary fetch, notes CRUD, export) — wiring this view
// to that real data is the follow-up; this establishes the redesigned look.
//
// Sections mirror the per-student report Laura approved in the prototype:
// overview list → AI summary, stat band (sky-wash), skills, score trend,
// vocabulary mastery (Leitner ramp), attendance, tests, teacher notes.

import { useState, useEffect } from 'react'
import { Pill, EmptyState, Button, Spinner } from '@/components/student-ui'
import { buildReportCsv, downloadCsv, buildReportHtml, openPrintWindow, type ExportSection } from '@/lib/reports-export'
import type { CourseRollup } from '@/lib/reports-compute'

export interface StudentReport {
  email: string
  name: string
  cefr?: string
  completionPct: number
  attendancePct: number | null
  avgLatestPct: number | null
  streak: number
  wordsLearned: number
  groupRank: number | null
  groupSize: number
  courseProgressPct: number | null
  vocabFocus: number | null
  aiSummary: string | null
  aiGeneratedAt?: string | null
  skills: { label: string; pct: number }[]
  trend: number[]
  vocab: number[] // 5 counts: New, Learning, Familiar, Known, Mastered
  attendance: { lesson: string; status: 'present' | 'absent' | 'late' | 'excused' }[]
  tests: { title: string; type: string; score: number }[]
  manualTests: { id: string; name: string; date: string | null; scorePct: number | null; source: string }[]
  notes: { tag: string; author: string; text: string }[]
}

const VOCAB_LABELS = ['New', 'Learning', 'Familiar', 'Known', 'Mastered']
const VOCAB_BG = ['bg-leitner-new', 'bg-leitner-learning', 'bg-leitner-familiar', 'bg-leitner-known', 'bg-leitner-mastered']

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-card border border-hairline p-4">
      <p className="text-[12px] font-semibold text-ink-muted">{label}</p>
      <p className="text-2xl font-bold text-ink-black mt-1 leading-none">{value}</p>
      {sub && <p className="text-[11px] font-semibold text-correct-fg mt-1">{sub}</p>}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card border border-hairline p-5">
      <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-3">{title}</p>
      {children}
    </div>
  )
}

// "just now / 3h ago / 2d ago / date" — for the AI summary timestamp.
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString()
}

export type CourseOverviewData = { summary: string; needs: string; ready: string; generatedAt: string | null }

// Course-level AI overview card (cohort view) — three tabbed narratives.
// Mirrors the per-student AI summary: cached + generated on demand. HR sees
// the cached overview but gets no Generate button (onGenerate is undefined).
function CourseOverview({ overview, onGenerate, generating }: {
  overview: CourseOverviewData | null
  onGenerate?: () => void
  generating?: boolean
}) {
  const [tab, setTab] = useState<'summary' | 'needs' | 'ready'>('summary')
  const TABS = [
    ['summary', 'Summary'],
    ['needs', 'Needs attention'],
    ['ready', 'Ready to level up'],
  ] as const

  return (
    <div className="bg-white rounded-card border border-sky-border p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky-text">✨ AI overview</span>
        {overview && onGenerate && !generating && (
          <button onClick={onGenerate} className="text-[12px] text-ink-body border border-hairline rounded-tile px-2.5 py-1 hover:bg-surface">↻ Regenerate</button>
        )}
      </div>

      {overview && !generating && (
        <div className="flex gap-1 mb-3 bg-surface rounded-tile p-1 w-fit">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`text-[12px] font-bold px-3 py-1 rounded-tile transition-colors ${tab === k ? 'bg-white text-sky-text' : 'text-ink-muted hover:text-ink-body'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {generating ? (
        <div className="flex items-center gap-2.5 py-1.5">
          <Spinner size={18} label="Generating overview…" />
          <span className="text-[13px] text-ink-muted">Generating overview…</span>
        </div>
      ) : overview ? (
        <>
          <p className="text-[14px] text-ink-body leading-relaxed">{overview[tab]}</p>
          {overview.generatedAt && <p className="text-[11px] text-ink-muted mt-2">Generated {relativeTime(overview.generatedAt)}</p>}
        </>
      ) : (
        <div className="py-1">
          <p className="text-[13px] text-ink-body">No overview yet for this course.</p>
          {onGenerate ? (
            <div className="mt-3">
              <Button variant="primary" size="sm" onClick={onGenerate}>✨ Generate overview</Button>
            </div>
          ) : (
            <p className="text-[11px] text-ink-muted mt-1">Ask a teacher to generate it.</p>
          )}
        </div>
      )}
    </div>
  )
}

// CEFR half-steps: X.1 = the start of level X, X.2 = the middle of X. Used for
// both the course's current (starting) level and its goal level, so a learner
// can start "halfway through A1" and progress is measured across that span.
const CEFR_LEVELS = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2', 'C2.1', 'C2.2']

// Course CEFR endpoints (current → goal) shown in the reports header. Teachers
// can edit both; HR sees the values but gets no edit affordance (onSet undefined).
function CourseLevels({ current, goal, onSet }: {
  current: string | null
  goal: string | null
  onSet?: (current: string, goal: string) => Promise<void> | void
}) {
  const [editing, setEditing] = useState(false)
  const [c, setC] = useState(current || '')
  const [g, setG] = useState(goal || '')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setC(current || '')
    setG(goal || '')
  }, [current, goal])

  if (editing && onSet) {
    return (
      <span className="flex items-center gap-1.5">
        <select value={c} onChange={(e) => setC(e.target.value)} className="text-[12px] border border-hairline rounded-tile px-1.5 py-1" aria-label="Current level">
          <option value="">—</option>
          {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <span className="text-ink-muted">→</span>
        <select value={g} onChange={(e) => setG(e.target.value)} className="text-[12px] border border-hairline rounded-tile px-1.5 py-1" aria-label="Goal level">
          <option value="">—</option>
          {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={async () => { setSaving(true); await onSet(c, g); setSaving(false); setEditing(false) }} className="text-[12px] font-bold text-sky-text">{saving ? '…' : 'Save'}</button>
      </span>
    )
  }
  return (
    <span className="text-[12px] text-ink-muted flex items-center gap-1.5">
      Level: <span className="font-bold text-ink-body">{current || '—'} → {goal || '—'}</span>
      {onSet && <button onClick={() => setEditing(true)} className="text-sky-text" aria-label="Edit course levels">✎</button>}
    </span>
  )
}

// CEFR progress: current → goal endpoints + a manual course-progress % bar.
// The % is teacher-set (Edit → slider → Save). HR sees the bar and the value
// but no Edit button (onSet is undefined for HR), so it reads as an objective
// metric with no hint that it's hand-set.
function CefrProgress({ report, current, goal, onSet }: {
  report: StudentReport
  current: string | null
  goal: string | null
  onSet?: (email: string, pct: number) => Promise<void> | void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(report.courseProgressPct ?? 0)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setVal(report.courseProgressPct ?? 0)
    setEditing(false)
  }, [report.email, report.courseProgressPct])
  const pct = report.courseProgressPct

  return (
    <div className="bg-white rounded-card border border-hairline p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">CEFR progress</p>
        {onSet && !editing && (
          <button onClick={() => setEditing(true)} className="text-[12px] text-sky-text border border-hairline rounded-tile px-2.5 py-1 hover:bg-surface">✎ Edit</button>
        )}
      </div>
      <div className="flex items-center justify-between text-[12px] font-bold mb-2">
        <span className="text-sky-text">Current · {current || '—'}</span>
        <span className="text-correct-fg">Goal · {goal || '—'}</span>
      </div>
      <div className="h-2.5 bg-surface rounded-full overflow-hidden">
        <div className="h-full bg-correct-fg rounded-full" style={{ width: `${editing ? val : pct ?? 0}%` }} />
      </div>
      {editing ? (
        <div className="flex items-center gap-3 mt-3">
          <input type="range" min={0} max={100} value={val} onChange={(e) => setVal(parseInt(e.target.value, 10))} className="flex-1" aria-label="Course progress percent" />
          <span className="text-[13px] font-bold text-ink-black w-10 text-right">{val}%</span>
          <Button variant="primary" size="sm" onClick={async () => { if (!onSet) return; setSaving(true); await onSet(report.email, val); setSaving(false); setEditing(false) }}>{saving ? 'Saving…' : 'Save'}</Button>
          <button onClick={() => setEditing(false)} className="text-[12px] text-ink-muted">Cancel</button>
        </div>
      ) : (
        <p className="text-[12px] text-ink-muted mt-2">{pct != null ? `${pct}% through the course` : 'Not set'}</p>
      )}
    </div>
  )
}

// Tests card: platform-derived tests (read-only) + manual results (offline /
// written / oral). Teachers get an "+ Add result" form and per-row delete;
// HR sees everything read-only (onAdd / onDelete undefined).
function TestsCard({ report, onAdd, onDelete }: {
  report: StudentReport
  onAdd?: (email: string, t: { name: string; date: string; score: number; max: number; source: string }) => Promise<void> | void
  onDelete?: (id: string, email: string) => Promise<void> | void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [score, setScore] = useState('')
  const [max, setMax] = useState('100')
  const [source, setSource] = useState('Written')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setAdding(false)
  }, [report.email])

  const pillCls = (n: number | null) => (n != null && n >= 80 ? 'bg-correct-bg text-correct-fg' : 'bg-sky-wash text-sky-text')
  const empty = report.tests.length === 0 && report.manualTests.length === 0

  return (
    <div className="bg-white rounded-card border border-hairline p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">Tests</p>
        {onAdd && !adding && (
          <button onClick={() => setAdding(true)} className="text-[12px] text-sky-text border border-hairline rounded-tile px-2.5 py-1 hover:bg-surface">+ Add result</button>
        )}
      </div>

      {empty && !adding ? (
        <p className="text-[13px] text-ink-muted">No tests yet.</p>
      ) : (
        <div className="space-y-1.5">
          {report.tests.map((t) => (
            <div key={`p-${t.title}`} className="flex items-center justify-between text-[13px]">
              <span className="text-ink-body">{t.title}</span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${t.score >= 80 ? 'bg-correct-bg text-correct-fg' : 'bg-sky-wash text-sky-text'}`}>{t.score}%</span>
            </div>
          ))}
          {report.manualTests.map((t) => (
            <div key={`m-${t.id}`} className="flex items-center justify-between text-[13px] gap-2">
              <span className="text-ink-body flex items-center gap-1.5 min-w-0">
                <span className="truncate">{t.name}</span>
                <span className="text-[10px] font-bold text-ink-muted bg-surface rounded px-1.5 py-0.5 shrink-0">{t.source}</span>
                {t.date && <span className="text-[11px] text-ink-muted shrink-0">{t.date}</span>}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${pillCls(t.scorePct)}`}>{t.scorePct != null ? `${t.scorePct}%` : '—'}</span>
                {onDelete && <button onClick={() => onDelete(t.id, report.email)} className="text-ink-muted hover:text-incorrect-fg text-[12px]" aria-label="Delete test result">✕</button>}
              </span>
            </div>
          ))}
        </div>
      )}

      {adding && onAdd && (
        <div className="mt-3 pt-3 border-t border-hairline flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Test name" className="text-[12px] border border-hairline rounded-tile px-2 py-1 flex-1 min-w-[120px]" />
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="text-[12px] border border-hairline rounded-tile px-2 py-1" aria-label="Test date" />
          <input value={score} onChange={(e) => setScore(e.target.value)} type="number" placeholder="Score" className="text-[12px] border border-hairline rounded-tile px-2 py-1 w-20" aria-label="Score" />
          <span className="text-[12px] text-ink-muted">/</span>
          <input value={max} onChange={(e) => setMax(e.target.value)} type="number" className="text-[12px] border border-hairline rounded-tile px-2 py-1 w-16" aria-label="Max score" />
          <select value={source} onChange={(e) => setSource(e.target.value)} className="text-[12px] border border-hairline rounded-tile px-2 py-1" aria-label="Source">
            <option>Written</option>
            <option>Oral</option>
            <option>Platform</option>
          </select>
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              const sc = parseFloat(score)
              const mx = parseFloat(max) || 100
              if (!name.trim() || isNaN(sc)) return
              setSaving(true)
              await onAdd(report.email, { name: name.trim(), date, score: sc, max: mx, source })
              setSaving(false)
              setAdding(false)
              setName(''); setDate(''); setScore(''); setMax('100'); setSource('Written')
            }}
          >
            {saving ? 'Saving…' : 'Add'}
          </Button>
          <button onClick={() => setAdding(false)} className="text-[12px] text-ink-muted">Cancel</button>
        </div>
      )}
    </div>
  )
}

// Export dialog — pick learners + sections + format, then download CSV (Excel)
// or open a branded print window (PDF). Fully client-side from loaded data.
// Available to admins AND HR.
const EXPORT_SECTIONS: { key: ExportSection; label: string }[] = [
  { key: 'summary', label: 'AI summary' },
  { key: 'kpis', label: 'KPIs' },
  { key: 'cefr', label: 'CEFR / progress' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'tests', label: 'Test results' },
  { key: 'notes', label: "Teacher's notes" },
]

function ExportDialog({ students, courseName, currentLevel, goalLevel, groupProgress, onClose }: {
  students: StudentReport[]
  courseName: string
  currentLevel: string | null
  goalLevel: string | null
  groupProgress: number | null
  onClose: () => void
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(students.map((s) => s.email)))
  const [sections, setSections] = useState<Set<ExportSection>>(() => new Set(EXPORT_SECTIONS.map((s) => s.key)))
  const [fmt, setFmt] = useState<'pdf' | 'excel'>('pdf')
  const allOn = picked.size === students.length

  const togglePicked = (email: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(email)) n.delete(email)
      else n.add(email)
      return n
    })
  const toggleSection = (k: ExportSection) =>
    setSections((p) => {
      const n = new Set(p)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const run = () => {
    const chosen = students.filter((s) => picked.has(s.email))
    if (chosen.length === 0) return
    const opts = { courseName, currentLevel, goalLevel, sections, groupProgressPct: groupProgress }
    if (fmt === 'excel') {
      const safe = (courseName || 'report').replace(/[^a-z0-9.\-]+/gi, '_')
      downloadCsv(`${safe}.csv`, buildReportCsv(chosen, opts))
    } else {
      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      openPrintWindow(buildReportHtml(chosen, opts, today))
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-hairline p-5 w-full max-w-lg max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-ink-black">Export report</h2>
          <button onClick={onClose} className="text-ink-muted" aria-label="Close">✕</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-bold text-ink-black">Learners ({picked.size}/{students.length})</span>
              <button onClick={() => setPicked(allOn ? new Set() : new Set(students.map((s) => s.email)))} className="text-[11px] font-bold text-sky-text">{allOn ? 'Clear' : 'Select all'}</button>
            </div>
            <div className="border border-hairline rounded-tile max-h-52 overflow-auto p-1">
              {students.map((s) => (
                <label key={s.email} className="flex items-center gap-2 px-2 py-1.5 text-[13px] cursor-pointer hover:bg-surface rounded">
                  <input type="checkbox" checked={picked.has(s.email)} onChange={() => togglePicked(s.email)} />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[12px] font-bold text-ink-black">Include</span>
            <div className="mt-1.5 space-y-1">
              {EXPORT_SECTIONS.map((sec) => (
                <label key={sec.key} className="flex items-center gap-2 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={sections.has(sec.key)} onChange={() => toggleSection(sec.key)} />
                  {sec.label}
                </label>
              ))}
            </div>
            <div className="text-[12px] font-bold text-ink-black mt-3 mb-1.5">Format</div>
            <div className="flex gap-1 bg-surface rounded-tile p-1 w-fit">
              {(['pdf', 'excel'] as const).map((f) => (
                <button key={f} onClick={() => setFmt(f)} className={`text-[12px] font-bold px-3 py-1 rounded-tile ${fmt === f ? 'bg-white text-sky-text' : 'text-ink-muted'}`}>{f === 'pdf' ? 'PDF' : 'Excel'}</button>
              ))}
            </div>
            <p className="text-[11px] text-ink-muted mt-1.5">{fmt === 'pdf' ? 'PDF — one page per learner.' : 'Excel — one row per learner (CSV).'}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="text-[13px] font-bold text-ink-muted px-3 py-2">Cancel</button>
          <Button variant="primary" size="sm" onClick={run}>Export {picked.size} learner{picked.size === 1 ? '' : 's'}</Button>
        </div>
      </div>
    </div>
  )
}

// Course-level HR rollup — cohort KPIs, a weekly score trend, and a
// needs-attention list (click a learner to drill in). Sits atop the report.
function CohortRollup({ cohort, onSelect, view = 'kpis' }: { cohort: CourseRollup; onSelect: (email: string) => void; view?: 'kpis' | 'detail' }) {
  // Top-of-page cohort KPI cards.
  if (view === 'kpis') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Stat label="Learners" value={`${cohort.learnerCount}`} />
        <Stat label="Avg completion" value={`${cohort.avgCompletionPct}%`} />
        <Stat label="Avg score" value={cohort.avgScorePct != null ? `${cohort.avgScorePct}%` : '—'} />
        <Stat label="Team attendance" value={cohort.avgAttendancePct != null ? `${cohort.avgAttendancePct}%` : '—'} />
        <Stat label="On a streak" value={`${cohort.activeStreaks}/${cohort.learnerCount}`} />
      </div>
    )
  }
  // Bottom-of-page detail: score trend + needs attention.
  return (
    <div className="grid md:grid-cols-2 gap-4 mt-6">
      <Card title="Cohort score trend">
        {cohort.trend.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Not enough data yet.</p>
        ) : (
          <>
            {(() => {
              const vals = cohort.trend.map((t) => t.avgPct)
              const W = 320
              const H = 96
              const pad = 18
              const lo = Math.min(...vals)
              const hi = Math.max(...vals)
              const flat = hi === lo
              const xs = (i: number) => (vals.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (vals.length - 1))
              const ys = (v: number) => (flat ? H / 2 : H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad))
              const linePts = vals.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ')
              const areaPts = `${xs(0).toFixed(1)},${H - pad} ${linePts} ${xs(vals.length - 1).toFixed(1)},${H - pad}`
              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label="Cohort average score by week">
                  <polygon points={areaPts} fill="#E1F5FE" />
                  <polyline points={linePts} fill="none" stroke="#0098D4" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {vals.map((v, i) => (
                    <g key={i}>
                      <circle cx={xs(i)} cy={ys(v)} r="3.2" fill="#fff" stroke="#0098D4" strokeWidth="2" />
                      <text x={xs(i)} y={ys(v) - 7} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0098D4">{v}%</text>
                    </g>
                  ))}
                </svg>
              )
            })()}
            <p className="text-[12px] text-ink-body mt-1">The group's <b>average exercise score each week</b> — shows whether scores are trending up or down over the period.</p>
            <p className="text-[11px] text-ink-muted mt-0.5">{cohort.trend[0].label} – {cohort.trend[cohort.trend.length - 1].label}</p>
          </>
        )}
      </Card>
      <Card title="Needs attention">
        {cohort.needsAttention.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Everyone is on track.</p>
        ) : (
          <div className="space-y-0.5">
            {cohort.needsAttention.map((r) => (
              <button key={r.email} onClick={() => onSelect(r.email)} className="w-full text-left flex items-center justify-between gap-2 py-1.5 px-2 rounded-tile hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40">
                <span className="text-[13px] font-bold text-ink-black truncate">{r.name}</span>
                <span className="text-[11px] text-ink-muted shrink-0">{r.reason}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// One line under the overview: the group's level (current → goal) with a dot
// per learner at their course-progress %, so you see where everyone sits.
// "Where the group is" — a single, manually-set group progress % along the
// Current → Goal journey. Teacher edits it with a slider; HR sees it read-only.
function GroupLevelStrip({ current, goal, progress, onSet }: { current: string | null; goal: string | null; progress: number | null; onSet?: (pct: number) => Promise<void> | void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(progress ?? 0)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setVal(progress ?? 0)
    setEditing(false)
  }, [progress])
  const shown = editing ? val : progress ?? 0
  return (
    <div className="bg-white rounded-card border border-hairline p-5 mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">Where the group is</p>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-bold"><span className="text-sky-text">{current || '—'}</span> <span className="text-ink-muted">→</span> <span className="text-correct-fg">{goal || '—'}</span></span>
          {onSet && !editing && (
            <button onClick={() => setEditing(true)} className="text-[12px] text-sky-text border border-hairline rounded-tile px-2.5 py-1 hover:bg-surface">✎ Edit</button>
          )}
        </div>
      </div>
      <div className="relative">
        <div className="h-2.5 bg-surface rounded-full overflow-hidden">
          <div className="h-full bg-correct-fg rounded-full" style={{ width: `${shown}%` }} />
        </div>
        <div className="absolute top-1/2 w-4 h-4 rounded-full bg-white border-[3px] border-correct-fg -translate-x-1/2 -translate-y-1/2" style={{ left: `${shown}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-ink-muted mt-2">
        <span>{current || 'start'}</span>
        <span>{goal || 'goal'}</span>
      </div>
      {editing ? (
        <div className="flex items-center gap-3 mt-3">
          <input type="range" min={0} max={100} value={val} onChange={(e) => setVal(parseInt(e.target.value, 10))} className="flex-1" aria-label="Group progress percent" />
          <span className="text-[13px] font-bold text-ink-black w-10 text-right">{val}%</span>
          <Button variant="primary" size="sm" onClick={async () => { if (!onSet) return; setSaving(true); await onSet(val); setSaving(false); setEditing(false) }}>{saving ? 'Saving…' : 'Save'}</Button>
          <button onClick={() => setEditing(false)} className="text-[12px] text-ink-muted">Cancel</button>
        </div>
      ) : (
        <p className="text-[12px] text-ink-muted mt-2">{progress != null ? `The group is ${progress}% of the way from ${current || '—'} to ${goal || '—'}.` : 'Not set — click Edit to set where the group is.'}</p>
      )}
    </div>
  )
}

export function ReportsView({ courseName, students, onRegenerate, onGenerate, generatingEmail, courseOverview, onGenerateOverview, generatingOverview, cohort, courseCurrentLevel, courseGoalLevel, onSetProgress, onSetLevels, onAddTest, onDeleteTest, courseGroupProgress, onSetGroupProgress }: {
  courseName: string
  students: StudentReport[]
  onRegenerate?: (email: string) => void
  onGenerate?: (email: string) => void
  generatingEmail?: string | null
  courseOverview?: CourseOverviewData | null
  onGenerateOverview?: () => void
  generatingOverview?: boolean
  cohort?: CourseRollup | null
  courseCurrentLevel?: string | null
  courseGoalLevel?: string | null
  onSetProgress?: (email: string, pct: number) => Promise<void> | void
  onSetLevels?: (current: string, goal: string) => Promise<void> | void
  onAddTest?: (email: string, t: { name: string; date: string; score: number; max: number; source: string }) => Promise<void> | void
  onDeleteTest?: (id: string, email: string) => Promise<void> | void
  courseGroupProgress?: number | null
  onSetGroupProgress?: (pct: number) => Promise<void> | void
}) {
  const [sel, setSel] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const s = students.find((x) => x.email === sel) || students[0] || null

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-0.5">Reports</p>
            <h1 className="text-xl font-bold text-ink-black leading-tight">{courseName}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {students.length > 0 && (
              <button onClick={() => setExporting(true)} className="text-[12px] font-bold text-white bg-sky rounded-tile px-3 py-1.5 hover:opacity-90">Export</button>
            )}
          </div>
        </div>

        {exporting && (
          <ExportDialog
            students={students}
            courseName={courseName}
            currentLevel={courseCurrentLevel ?? null}
            goalLevel={courseGoalLevel ?? null}
            groupProgress={courseGroupProgress ?? null}
            onClose={() => setExporting(false)}
          />
        )}

        {cohort && students.length > 0 && <CohortRollup cohort={cohort} onSelect={setSel} view="kpis" />}

        {(courseOverview || onGenerateOverview) && (
          <CourseOverview overview={courseOverview ?? null} onGenerate={onGenerateOverview} generating={generatingOverview} />
        )}

        {students.length > 0 && (
          <GroupLevelStrip current={courseCurrentLevel ?? null} goal={courseGoalLevel ?? null} progress={courseGroupProgress ?? null} onSet={onSetGroupProgress} />
        )}

        {students.length === 0 ? (
          <EmptyState icon="📊" title="No data yet" hint="Once students complete exercises, their progress shows here." />
        ) : !s ? null : (
          <div className="grid grid-cols-1 md:grid-cols-[248px_1fr] gap-4 items-start">
            {/* Left rail — learners list (always visible) */}
            <div className="bg-white rounded-card border border-hairline overflow-hidden self-start">
              <div className="px-3.5 py-2.5 border-b border-hairline flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">Learners</span>
                <span className="text-[11px] font-bold text-ink-muted">{students.length}</span>
              </div>
              <div className="max-h-[74vh] overflow-auto">
                {students.map((st, i) => {
                  const on = s.email === st.email
                  return (
                    <button
                      key={st.email}
                      onClick={() => setSel(st.email)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${i > 0 ? 'border-t border-hairline' : ''} ${on ? 'bg-sky-wash' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${on ? 'bg-sky text-white' : 'bg-sky-wash text-sky-text'}`} aria-hidden="true">{st.name[0]}</div>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-bold text-ink-black truncate">{st.name}</span>
                        <span className="block text-[11px] text-ink-muted">{st.completionPct}% done · {st.avgLatestPct != null ? `${st.avgLatestPct}%` : '—'}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right panel — selected student's full overview */}
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-sky-wash text-sky-text flex items-center justify-center font-bold" aria-hidden="true">{s.name[0]}</div>
                <div><h2 className="text-lg font-bold text-ink-black leading-tight">{s.name}</h2>{courseCurrentLevel && <p className="text-[12px] text-ink-muted">Working at {courseCurrentLevel} (group level)</p>}</div>
              </div>

        {/* AI summary — on demand: generate / loading / cached */}
        <div className="bg-white rounded-card border border-sky-border p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky-text">✨ AI progress summary</span>
            {generatingEmail !== s.email && s.aiSummary && onRegenerate && (
              <button onClick={() => onRegenerate(s.email)} className="text-[12px] text-ink-body border border-hairline rounded-tile px-2.5 py-1 hover:bg-surface">↻ Regenerate</button>
            )}
          </div>

          {generatingEmail === s.email ? (
            <div className="flex items-center gap-2.5 py-1.5">
              <Spinner size={18} label="Generating summary…" />
              <span className="text-[13px] text-ink-muted">Generating summary…</span>
            </div>
          ) : s.aiSummary ? (
            <>
              <p className="text-[14px] text-ink-body leading-relaxed">{s.aiSummary}</p>
              {s.aiGeneratedAt && <p className="text-[11px] text-ink-muted mt-2">Generated {relativeTime(s.aiGeneratedAt)}</p>}
              <p className="text-[11px] text-ink-muted mt-1">AI estimate — your read is the final word.</p>
            </>
          ) : (
            <div className="py-1">
              <p className="text-[13px] text-ink-body">No summary yet for {s.name.split(' ')[0]}.</p>
              <p className="text-[11px] text-ink-muted mt-1 mb-3">Uses AI to read this student&rsquo;s data — costs nothing until you click.</p>
              {onGenerate && (
                <Button variant="primary" size="sm" onClick={() => onGenerate(s.email)}>✨ Generate summary</Button>
              )}
            </div>
          )}
        </div>

        {/* Stat band */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <Stat label="Words learned" value={`${s.wordsLearned}`} />
          <Stat label="Completion" value={`${s.completionPct}%`} />
          <Stat label="Avg. score" value={s.avgLatestPct != null ? `${s.avgLatestPct}%` : '—'} />
          <Stat label="Attendance" value={s.attendancePct != null ? `${s.attendancePct}%` : '—'} />
          <Stat label="Streak" value={s.streak ? `${s.streak}🔥` : '—'} />
          <Stat label="Group rank" value={s.groupRank != null ? `#${s.groupRank} of ${s.groupSize}` : '—'} />
        </div>

        {/* Personal CEFR progress — temporarily hidden via CSS (kept in code, not deleted) */}
        <div className="hidden">
          <CefrProgress report={s} current={courseCurrentLevel ?? null} goal={courseGoalLevel || null} onSet={onSetProgress} />
        </div>

        {/* Course goal (group level) — editable, applies to the whole group */}
        <div className="bg-white rounded-card border border-hairline p-5 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">Course goal</p>
              <p className="text-[12px] text-ink-muted mt-0.5">Applies to the whole group</p>
            </div>
            <CourseLevels current={courseCurrentLevel ?? null} goal={courseGoalLevel ?? null} onSet={onSetLevels} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Skill breakdown — hidden for now (s.skills still computed; revisit later) */}

          <Card title="Score trend">
            {s.trend.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No exercises yet.</p>
            ) : (() => {
              const vals = s.trend
              const W = 320
              const H = 96
              const pad = 14
              const lo = Math.min(...vals)
              const hi = Math.max(...vals)
              const flat = hi === lo
              const xs = (i: number) => (vals.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (vals.length - 1))
              const ys = (v: number) => (flat ? H / 2 : H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad))
              const linePts = vals.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ')
              const areaPts = `${xs(0).toFixed(1)},${H - pad} ${linePts} ${xs(vals.length - 1).toFixed(1)},${H - pad}`
              return (
                <>
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label="Score per exercise">
                    <polygon points={areaPts} fill="#E1F5FE" />
                    <polyline points={linePts} fill="none" stroke="#0098D4" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                  <p className="text-[11px] text-ink-muted mt-2">Score per exercise · last {vals.length}</p>
                </>
              )
            })()}
          </Card>

          <Card title="Vocabulary mastery">
            <div className="flex items-end gap-2">
              {s.vocab.map((c, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-ink-black">{c}</span>
                  <div className="w-full h-16 bg-surface rounded flex items-end overflow-hidden"><div className={`w-full ${VOCAB_BG[i]}`} style={{ height: `${Math.min(c * 6 + 12, 100)}%` }} /></div>
                  <span className="text-[9px] text-ink-muted">{VOCAB_LABELS[i]}</span>
                </div>
              ))}
            </div>
          </Card>

          <TestsCard report={s} onAdd={onAddTest} onDelete={onDeleteTest} />

          <Card title="Attendance">
            {s.attendance.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No attendance marked yet.</p>
            ) : (() => {
              const present = s.attendance.filter((a) => a.status === 'present').length
              const late = s.attendance.filter((a) => a.status === 'late').length
              const excused = s.attendance.filter((a) => a.status === 'excused').length
              const absent = s.attendance.filter((a) => a.status === 'absent').length
              const total = s.attendance.length
              const w = (n: number) => `${Math.round((n / total) * 100)}%`
              return (
                <>
                  <div className="flex h-3.5 rounded-full overflow-hidden bg-surface mb-2.5">
                    {present > 0 && <div className="bg-correct-bg" style={{ width: w(present) }} />}
                    {late > 0 && <div className="bg-streak-fill" style={{ width: w(late) }} />}
                    {excused > 0 && <div className="bg-sky-wash" style={{ width: w(excused) }} />}
                    {absent > 0 && <div className="bg-incorrect-bg" style={{ width: w(absent) }} />}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                    <span><span className="inline-block w-2 h-2 rounded-sm bg-correct-bg mr-1 align-middle" />{present} present</span>
                    {late > 0 && <span><span className="inline-block w-2 h-2 rounded-sm bg-streak-fill mr-1 align-middle" />{late} late</span>}
                    {excused > 0 && <span><span className="inline-block w-2 h-2 rounded-sm bg-sky-wash mr-1 align-middle" />{excused} excused</span>}
                    <span><span className="inline-block w-2 h-2 rounded-sm bg-incorrect-bg mr-1 align-middle" />{absent} absent</span>
                  </div>
                </>
              )
            })()}
          </Card>

          <Card title="Teacher notes">
            {s.notes.length === 0 ? <p className="text-[13px] text-ink-muted">No notes yet.</p> : (
              <div className="space-y-2.5">
                {s.notes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Pill variant="level" className="shrink-0">{n.tag}</Pill>
                    <p className="text-[13px] text-ink-body">{n.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
            </div>
          </div>
        )}

        {cohort && students.length > 0 && <CohortRollup cohort={cohort} onSelect={setSel} view="detail" />}
      </div>
    </div>
  )
}

export default ReportsView
