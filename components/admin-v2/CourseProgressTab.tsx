'use client'

// ─────────────────────────────────────────────────────────────────
// COURSE PROGRESS TAB (teacher triage grid) — P1.
//
// Self-contained: fetches GET /api/reports?courseId=…&days=all and reuses the
// existing reports compute (buildStudentReports) so accuracy/completion/trend
// match the Reports section exactly. Adds three things on top: last-active,
// exercises-this-week, and a TUNABLE "needs attention" flag (two sliders), so a
// teacher can dial the rule against their real class and spot who's struggling.
//
// Reads only existing tables (progress via /api/reports). No new tracking, no
// migration. Course-scopes progress the same way computeItemCompletion does
// (intersect activity_id with this course's exercise / block / flashcard-lesson
// ids) so "active" reflects THIS course, not the whole platform.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { Spinner, EmptyState } from '@/components/student-ui'
import { buildStudentReports, type ReportsData, type StudentReport } from '@/lib/reports-compute'

const DAY = 86400000

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}
const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : Infinity)
const mean = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0)

// Accuracy drop from the trend series (chronological). Positive = declining.
function trendDrop(trend: number[]): number | null {
  if (!trend || trend.length < 2) return null
  const n = trend.length
  const half = Math.max(1, Math.floor(n / 2))
  return Math.round(mean(trend.slice(0, half)) - mean(trend.slice(n - half)))
}

// Tiny area+line sparkline — same palette as ReportsView (#0098D4 / #E1F5FE).
function Spark({ pts }: { pts: number[] }) {
  if (!pts || pts.length < 2) return <span className="text-[11px] text-ink-muted">—</span>
  const w = 50, h = 16, min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1
  const step = w / (pts.length - 1)
  const xy = pts.map((p, i) => `${(i * step).toFixed(1)},${(h - ((p - min) / rng) * h).toFixed(1)}`)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polygon points={`0,${h} ${xy.join(' ')} ${w},${h}`} fill="#E1F5FE" />
      <polyline points={xy.join(' ')} fill="none" stroke="#0098D4" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

type Row = {
  email: string
  name: string
  archived: boolean
  lastActiveIso: string | null
  lastDays: number
  week: number
  courseTotal: number
  acc: number | null
  trend: number[]
  drop: number | null
  completionPct: number
  status: 'att' | 'imp' | 'ok' | 'none'
  reasons: string[]
  recent: { title: string; score: number; total: number }[]
}

const LOW_ACC = 55

export default function CourseProgressTab({ courseId }: { courseId: string }) {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inactiveDays, setInactiveDays] = useState(7)
  const [accDrop, setAccDrop] = useState(10)
  const [filter, setFilter] = useState<'all' | 'att' | 'ok'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetch(`/api/reports?courseId=${encodeURIComponent(courseId)}&days=all`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d: ReportsData) => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) { setError('Could not load progress data.'); setLoading(false) } })
    return () => { alive = false }
  }, [courseId])

  // Per-student rows. Recomputed when the data or the slider thresholds change.
  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const reports: StudentReport[] = buildStudentReports(data, 'all')
    const repByEmail = new Map(reports.map((r) => [r.email, r]))

    // This course's activity ids (mirror computeItemCompletion scoping).
    const exIds = new Set((data.exercises || []).map((e) => e.id))
    const blockIds = new Set((data.blocks || []).map((b) => b.id))
    const lessonIds = new Set((data.lessons || []).map((l) => l.id))
    const exTitle = new Map((data.exercises || []).map((e) => [e.id, e.title || 'Exercise']))
    const inCourse = (aType: string, aId: string) =>
      (aType === 'exercise' && exIds.has(aId)) ||
      ((aType === 'block' || aType === 'writing') && blockIds.has(aId)) ||
      (aType === 'flashcard' && lessonIds.has(aId.split(':')[0]))

    const now = Date.now()
    const byStudent = new Map<string, typeof data.progress>()
    for (const p of data.progress || []) {
      if (!inCourse(p.activity_type, p.activity_id)) continue
      const arr = byStudent.get(p.user_email) || []
      arr.push(p)
      byStudent.set(p.user_email, arr)
    }

    const out: Row[] = (data.students || []).map((s) => {
      const rep = repByEmail.get(s.email)
      const prog = (byStudent.get(s.email) || []).slice().sort((a, b) => +new Date(b.completed_at) - +new Date(a.completed_at))
      const lastActiveIso = prog[0]?.completed_at ?? null
      const lastDays = daysSince(lastActiveIso)
      const week = prog.filter((p) => now - +new Date(p.completed_at) <= 7 * DAY).length
      const acc = rep?.avgLatestPct ?? null
      const trend = rep?.trend ?? []
      const drop = trendDrop(trend)
      const archived = !!rep?.archived
      const recent = prog
        .filter((p) => p.activity_type === 'exercise' && typeof p.score === 'number' && typeof p.total === 'number' && p.total)
        .slice(0, 6)
        .map((p) => ({ title: exTitle.get(p.activity_id) || 'Exercise', score: p.score as number, total: p.total as number }))

      const reasons: string[] = []
      let status: Row['status']
      if (prog.length === 0) {
        status = 'none'
      } else {
        if (lastDays >= inactiveDays) reasons.push(`inactive ${lastDays}d`)
        if (drop != null && drop >= accDrop) reasons.push(`accuracy ↓${drop}`)
        if (acc != null && acc < LOW_ACC) reasons.push(`low accuracy ${acc}%`)
        status = archived ? 'ok' : reasons.length ? 'att' : drop != null && drop <= -8 ? 'imp' : 'ok'
      }

      return {
        email: s.email, name: rep?.name || s.name || s.email, archived,
        lastActiveIso, lastDays, week, courseTotal: prog.length,
        acc, trend, drop, completionPct: rep?.completionPct ?? 0,
        status, reasons: archived ? [] : reasons, recent,
      }
    })

    // Flagged first, then most-recently-inactive; archived sink to the bottom.
    out.sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1
      const rank = (r: Row) => (r.status === 'att' ? 0 : r.status === 'none' ? 1 : 2)
      return rank(a) - rank(b) || b.lastDays - a.lastDays
    })
    return out
  }, [data, inactiveDays, accDrop])

  const attCount = rows.filter((r) => r.status === 'att').length
  const activeCount = rows.filter((r) => r.week > 0 && !r.archived).length
  const shown = rows.filter((r) => (filter === 'att' ? r.status === 'att' : filter === 'ok' ? r.status !== 'att' : true))

  if (loading) return <div className="bg-white rounded-card border border-hairline p-10 flex justify-center"><Spinner label="Loading progress…" /></div>
  if (error) return <div className="bg-white rounded-card border border-hairline p-6"><EmptyState title="Couldn't load progress" hint={error} /></div>
  if (!rows.length) return <div className="bg-white rounded-card border border-hairline p-6"><EmptyState title="No students yet" hint="Enrolled students will appear here once they start practising." /></div>

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-3">
        <Tile n={rows.filter((r) => !r.archived).length} label="students" />
        <Tile n={activeCount} label="active this week" />
        <Tile n={attCount} label="need attention" warn />
      </div>

      {/* Tunable rule */}
      <div className="bg-white rounded-card border border-hairline p-4 space-y-2.5">
        <Slider label="Flag if inactive ≥" value={inactiveDays} min={3} max={14} unit="days" onChange={setInactiveDays} />
        <Slider label="…or accuracy dropped ≥" value={accDrop} min={5} max={25} unit="pts" onChange={setAccDrop} />
        <p className="text-[11px] text-ink-muted">…or accuracy below {LOW_ACC}%. Tune the rule to match who you'd flag.</p>
        <div className="flex gap-2 pt-1">
          {([['all', 'All'], ['att', 'Needs attention'], ['ok', 'On track']] as const).map(([f, lab]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                filter === f ? 'bg-sky text-white border-sky' : 'bg-white text-sky-text border-sky-border hover:bg-sky-wash'
              }`}>{lab}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-card border border-hairline overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1.7fr_0.9fr_0.7fr_1.3fr_1.1fr] gap-3 px-4 py-2.5 bg-surface text-[10px] font-bold uppercase tracking-wide text-ink-muted">
          <span>Student</span><span>Last active</span><span>This week</span><span>Accuracy</span><span>Status</span>
        </div>
        <div className="divide-y divide-hairline">
          {shown.map((r) => (
            <div key={r.email}>
              <button onClick={() => setExpanded(expanded === r.email ? null : r.email)}
                className={`w-full text-left grid grid-cols-[1.7fr_1fr] sm:grid-cols-[1.7fr_0.9fr_0.7fr_1.3fr_1.1fr] gap-3 items-center px-4 py-3 hover:bg-sky-wash transition-colors ${r.status === 'att' ? 'bg-[#fffaf1]' : ''}`}>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-ink-black truncate">{r.name}
                    {r.archived && <span className="ml-1.5 text-[9px] font-bold bg-surface text-ink-muted px-1.5 py-0.5 rounded-full align-middle">Archived</span>}
                  </span>
                  <span className="block text-[11px] text-ink-muted">{r.completionPct}% of course complete</span>
                </span>
                <span className={`hidden sm:block text-[12px] ${r.lastDays >= inactiveDays && !r.archived ? 'text-incorrect-fg font-semibold' : 'text-ink-body'}`}>{timeAgo(r.lastActiveIso)}</span>
                <span className="hidden sm:block text-[12px] text-ink-body">{r.week} done</span>
                <span className="hidden sm:flex items-center gap-2">
                  <span className="text-[13px] font-bold text-ink-black w-9">{r.acc == null ? '—' : `${r.acc}%`}</span>
                  <Spark pts={r.trend} />
                  {r.drop != null && r.drop !== 0 && (
                    <span className={`text-[11px] font-bold ${r.drop > 0 ? 'text-incorrect-fg' : 'text-correct-fg'}`}>{r.drop > 0 ? `↓${r.drop}` : `↑${-r.drop}`}</span>
                  )}
                </span>
                <span className="justify-self-end"><StatusBadge r={r} /></span>
              </button>
              {expanded === r.email && (
                <div className="px-4 py-3 bg-[#fbfdff] border-t border-dashed border-sky-border">
                  {r.reasons.length > 0 && <p className="text-[11.5px] font-semibold text-[#8a5a12] mb-2">⚑ {r.reasons.join(' · ')}</p>}
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-2">Recent exercises</p>
                  {r.recent.length === 0 ? (
                    <p className="text-[12px] text-ink-muted">No graded exercises in this course yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {r.recent.map((e, i) => {
                        const p = e.total ? e.score / e.total : 0
                        const c = p >= 0.7 ? '#15803d' : p >= 0.5 ? '#c07a00' : '#c92a2a'
                        return (
                          <div key={i} className="flex items-center gap-2.5 text-[12.5px]">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
                            <span className="flex-1 truncate text-ink-body">{e.title}</span>
                            <span className="text-ink-muted tabular-nums">{e.score}/{e.total}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-ink-muted mt-2.5">Full timeline + trend chart come in the next phase.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-ink-muted">Reads your existing practice data — no extra tracking. Accuracy &amp; completion match the Reports section.</p>
    </div>
  )
}

function Tile({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div className={`rounded-card p-4 ${warn ? 'bg-[#faeeda]' : 'bg-white border border-hairline'}`}>
      <div className={`text-2xl font-bold leading-none ${warn ? 'text-[#854f0b]' : 'text-ink-black'}`}>{n}</div>
      <div className={`text-[12px] font-semibold mt-1 ${warn ? 'text-[#8a5a12]' : 'text-ink-muted'}`}>{label}</div>
    </div>
  )
}

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-ink-body">
      <span className="font-semibold whitespace-nowrap">{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-[100px] accent-sky" />
      <span className="font-bold text-sky-text w-14 text-right">{value} {unit}</span>
    </div>
  )
}

function StatusBadge({ r }: { r: Row }) {
  if (r.status === 'att') return <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#faeeda] text-[#854f0b] whitespace-nowrap">Needs attention</span>
  if (r.status === 'imp') return <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-correct-bg text-correct-fg whitespace-nowrap">Improving</span>
  if (r.status === 'none') return <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface text-ink-muted whitespace-nowrap">Not started</span>
  return <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-wash text-sky-text whitespace-nowrap">On track</span>
}
