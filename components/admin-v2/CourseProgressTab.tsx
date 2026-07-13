'use client'

// ─────────────────────────────────────────────────────────────────
// COURSE PROGRESS TAB (teacher triage) — P1 grid + P2 per-student deep-dive.
//
// Self-contained: fetches GET /api/reports?courseId=…&days=all and reuses the
// existing reports compute (buildStudentReports) so accuracy/completion/trend
// match the Reports section exactly. Adds last-active, exercises-this-week, and
// a TUNABLE "needs attention" flag (two sliders) on top.
//
// Clicking a student swaps the grid for a per-student DEEP-DIVE (in-place
// master-detail, matching the Reports pattern): accuracy trend, skills, the
// most-missed exercises (the "reteach" list), recent activity, and an AI
// "reteach focus" that reuses the existing /api/student-summary pipeline.
//
// Reads only existing tables. No new tracking, no migration.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { Spinner, EmptyState, Button } from '@/components/student-ui'
import { buildStudentReports, buildDigestPayload, type ReportsData, type StudentReport } from '@/lib/reports-compute'

const DAY = 86400000
const LOW_ACC = 55
const SKILL_LABEL: Record<string, string> = {
  vocabulary: 'Vocabulary', grammar: 'Grammar', listening: 'Listening',
  reading: 'Reading', writing: 'Writing', speaking: 'Speaking', pronunciation: 'Pronunciation',
}

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
const accColor = (p: number) => (p >= 70 ? '#15803d' : p >= 55 ? '#c07a00' : '#c92a2a')

function trendDrop(trend: number[]): number | null {
  if (!trend || trend.length < 2) return null
  const n = trend.length
  const half = Math.max(1, Math.floor(n / 2))
  return Math.round(mean(trend.slice(0, half)) - mean(trend.slice(n - half)))
}

// Tiny sparkline for the grid — same palette as ReportsView.
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
  email: string; name: string; archived: boolean
  lastActiveIso: string | null; lastDays: number; week: number; courseTotal: number
  acc: number | null; trend: number[]; drop: number | null
  completionPct: number; streak: number; cefr: string | null
  status: 'att' | 'imp' | 'ok' | 'none'; reasons: string[]
}

export default function CourseProgressTab({ courseId }: { courseId: string }) {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inactiveDays, setInactiveDays] = useState(7)
  const [accDrop, setAccDrop] = useState(10)
  const [filter, setFilter] = useState<'all' | 'att' | 'ok'>('all')
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [ai, setAi] = useState<{ text: string; loading: boolean; error: boolean }>({ text: '', loading: false, error: false })

  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    fetch(`/api/reports?courseId=${encodeURIComponent(courseId)}&days=all`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d: ReportsData) => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) { setError('Could not load progress data.'); setLoading(false) } })
    return () => { alive = false }
  }, [courseId])

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const reports: StudentReport[] = buildStudentReports(data, 'all')
    const repByEmail = new Map(reports.map((r) => [r.email, r]))
    const exIds = new Set((data.exercises || []).map((e) => e.id))
    const blockIds = new Set((data.blocks || []).map((b) => b.id))
    const lessonIds = new Set((data.lessons || []).map((l) => l.id))
    const inCourse = (t: string, id: string) =>
      (t === 'exercise' && exIds.has(id)) ||
      ((t === 'block' || t === 'writing') && blockIds.has(id)) ||
      (t === 'flashcard' && lessonIds.has(id.split(':')[0]))

    const now = Date.now()
    const byStudent = new Map<string, typeof data.progress>()
    for (const p of data.progress || []) {
      if (!inCourse(p.activity_type, p.activity_id)) continue
      const arr = byStudent.get(p.user_email) || []; arr.push(p); byStudent.set(p.user_email, arr)
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
      const reasons: string[] = []
      let status: Row['status']
      if (prog.length === 0) status = 'none'
      else {
        if (lastDays >= inactiveDays) reasons.push(`inactive ${lastDays}d`)
        if (drop != null && drop >= accDrop) reasons.push(`accuracy ↓${drop}`)
        if (acc != null && acc < LOW_ACC) reasons.push(`low accuracy ${acc}%`)
        status = archived ? 'ok' : reasons.length ? 'att' : drop != null && drop <= -8 ? 'imp' : 'ok'
      }
      return {
        email: s.email, name: rep?.name || s.name || s.email, archived,
        lastActiveIso, lastDays, week, courseTotal: prog.length,
        acc, trend, drop, completionPct: rep?.completionPct ?? 0, streak: rep?.streak ?? 0,
        cefr: rep?.cefr ?? null, status, reasons: archived ? [] : reasons,
      }
    })
    out.sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1
      const rank = (r: Row) => (r.status === 'att' ? 0 : r.status === 'none' ? 1 : 2)
      return rank(a) - rank(b) || b.lastDays - a.lastDays
    })
    return out
  }, [data, inactiveDays, accDrop])

  // ── Deep-dive data for the selected student (exercise-level) ──
  const detail = useMemo(() => {
    if (!data || !selectedEmail) return null
    const exById = new Map((data.exercises || []).map((e) => [e.id, e]))
    const exIds = new Set((data.exercises || []).map((e) => e.id))
    const prog = (data.progress || [])
      .filter((p) => p.user_email === selectedEmail && p.activity_type === 'exercise' && exIds.has(p.activity_id) && typeof p.score === 'number' && typeof p.total === 'number' && p.total)
      .slice()
      .sort((a, b) => +new Date(b.completed_at) - +new Date(a.completed_at)) // newest first
    const perEx = new Map<string, { title: string; latest: number; best: number }>()
    for (const p of prog) {
      const pct = Math.round((p.score as number / (p.total as number)) * 100)
      const cur = perEx.get(p.activity_id)
      if (!cur) perEx.set(p.activity_id, { title: exById.get(p.activity_id)?.title || 'Exercise', latest: pct, best: pct })
      else cur.best = Math.max(cur.best, pct)
    }
    const mostMissed = Array.from(perEx.values()).sort((a, b) => a.latest - b.latest).slice(0, 6)
    const trend = prog.slice().reverse().slice(-16).map((p) => ({
      date: new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      score: Math.round((p.score as number / (p.total as number)) * 100),
    }))
    const skillSum: Record<string, { sum: number; n: number }> = {}
    for (const [exId, v] of Array.from(perEx.entries())) {
      const ex = exById.get(exId)
      if (!ex?.skills) continue
      for (const sk of ex.skills) { (skillSum[sk] ||= { sum: 0, n: 0 }); skillSum[sk].sum += v.best; skillSum[sk].n += 1 }
    }
    const skills = Object.entries(skillSum).map(([sk, v]) => ({ label: SKILL_LABEL[sk] || sk, pct: Math.round(v.sum / v.n) })).sort((a, b) => b.pct - a.pct)
    const recent = prog.slice(0, 6).map((p) => ({ title: exById.get(p.activity_id)?.title || 'Exercise', score: p.score as number, total: p.total as number, iso: p.completed_at }))
    return { trend, mostMissed, skills, recent }
  }, [data, selectedEmail])

  const openStudent = (email: string) => { setSelectedEmail(email); setAi({ text: '', loading: false, error: false }) }

  const runAi = async () => {
    if (!data || !selectedEmail) return
    setAi({ text: '', loading: true, error: false })
    const payload = buildDigestPayload(selectedEmail, data, data.course?.name || '', 'all')
    if (!payload) { setAi({ text: '', loading: false, error: true }); return }
    try {
      const res = await fetch('/api/student-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json()
      setAi({ text: body.summary || '', loading: false, error: !body.summary })
    } catch { setAi({ text: '', loading: false, error: true }) }
  }

  if (loading) return <div className="bg-white rounded-card border border-hairline p-10 flex justify-center"><Spinner label="Loading progress…" /></div>
  if (error) return <div className="bg-white rounded-card border border-hairline p-6"><EmptyState title="Couldn't load progress" hint={error} /></div>
  if (!rows.length) return <div className="bg-white rounded-card border border-hairline p-6"><EmptyState title="No students yet" hint="Enrolled students will appear here once they start practising." /></div>

  // ── P2: per-student deep-dive ──
  const sel = selectedEmail ? rows.find((r) => r.email === selectedEmail) : null
  if (sel && detail) {
    return (
      <div className="space-y-3.5">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setSelectedEmail(null)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-sky-text bg-sky-wash border border-sky-border rounded-full px-3 py-1.5 hover:bg-[#daf0fd]">← Class</button>
          <span className="text-[19px] font-bold text-ink-black">{sel.name}</span>
          {sel.cefr && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#eef4fb] text-brandblue">{sel.cefr}</span>}
          <StatusBadge r={sel} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Chip v={`${sel.completionPct}%`} l="course complete" />
          <Chip v={sel.acc == null ? '—' : `${sel.acc}%`} l={sel.drop && sel.drop > 0 ? `accuracy (↓${sel.drop})` : 'accuracy'} bad={sel.acc != null && sel.acc < LOW_ACC} />
          <Chip v={`${sel.streak}`} l="day streak" />
          <Chip v={timeAgo(sel.lastActiveIso)} l="last active" />
        </div>

        <div className="bg-white rounded-card border border-hairline p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted mb-2.5">Accuracy over time</div>
          <TrendChart pts={detail.trend} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="bg-white rounded-card border border-hairline p-4">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted mb-2.5">Skills</div>
            {detail.skills.length === 0 ? <p className="text-[12px] text-ink-muted">No skill-tagged exercises yet.</p> : detail.skills.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 my-1.5 text-[12.5px]">
                <span className="w-[76px] text-ink-body">{s.label}</span>
                <span className="flex-1 h-2 bg-[#f0f3f8] rounded-full overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${s.pct}%`, background: accColor(s.pct) }} /></span>
                <span className="w-8 text-right font-semibold tabular-nums">{s.pct}%</span>
              </div>
            ))}
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted mt-4 mb-2">Recent activity</div>
            {detail.recent.length === 0 ? <p className="text-[12px] text-ink-muted">No graded exercises yet.</p> : detail.recent.map((e, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5 border-t border-[#f4f6f9] first:border-t-0 text-[12.5px]">
                <span className="w-[52px] text-[11px] text-ink-muted shrink-0">{timeAgo(e.iso)}</span>
                <span className="flex-1 truncate text-ink-body">{e.title}</span>
                <span className="font-semibold tabular-nums text-ink-muted">{e.score}/{e.total}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-card border border-hairline p-4">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted mb-2">Most-missed exercises</div>
            {detail.mostMissed.length === 0 ? <p className="text-[12px] text-ink-muted">Nothing graded yet.</p> : detail.mostMissed.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5 border-t border-[#f4f6f9] first:border-t-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accColor(m.latest) }} />
                <span className="flex-1 text-[12.5px] text-ink-body truncate">{m.title}</span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: accColor(m.latest) }}>{m.latest}%</span>
              </div>
            ))}
            <div className="mt-3.5 pt-3 border-t border-hairline">
              {!ai.text && (
                <Button variant="primary" size="sm" onClick={runAi} disabled={ai.loading} className="w-full">
                  {ai.loading ? 'Thinking…' : 'Suggest a reteach focus'}
                </Button>
              )}
              {ai.error && <p className="text-[12px] text-incorrect-fg mt-2">Couldn't generate — try again.</p>}
              {ai.text && (
                <div className="text-[13px] leading-relaxed text-ink-body bg-sky-wash border border-sky-border rounded-tile p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-sky-text mb-1">AI reteach focus</span>
                  {ai.text}
                  <button onClick={runAi} className="block mt-2 text-[11px] font-semibold text-sky-text underline">Regenerate</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-ink-muted">Everything here is computed from existing practice data — matches the Reports section.</p>
      </div>
    )
  }

  // ── P1: class grid ──
  const attCount = rows.filter((r) => r.status === 'att').length
  const activeCount = rows.filter((r) => r.week > 0 && !r.archived).length
  const shown = rows.filter((r) => (filter === 'att' ? r.status === 'att' : filter === 'ok' ? r.status !== 'att' : true))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Tile n={rows.filter((r) => !r.archived).length} label="students" />
        <Tile n={activeCount} label="active this week" />
        <Tile n={attCount} label="need attention" warn />
      </div>

      <div className="bg-white rounded-card border border-hairline p-4 space-y-2.5">
        <SliderRow label="Flag if inactive ≥" value={inactiveDays} min={3} max={14} unit="days" onChange={setInactiveDays} />
        <SliderRow label="…or accuracy dropped ≥" value={accDrop} min={5} max={25} unit="pts" onChange={setAccDrop} />
        <p className="text-[11px] text-ink-muted">…or accuracy below {LOW_ACC}%. Tune the rule to match who you'd flag.</p>
        <div className="flex gap-2 pt-1">
          {([['all', 'All'], ['att', 'Needs attention'], ['ok', 'On track']] as const).map(([f, lab]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${filter === f ? 'bg-sky text-white border-sky' : 'bg-white text-sky-text border-sky-border hover:bg-sky-wash'}`}>{lab}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-card border border-hairline overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1.7fr_0.9fr_0.7fr_1.3fr_1.1fr] gap-3 px-4 py-2.5 bg-surface text-[10px] font-bold uppercase tracking-wide text-ink-muted">
          <span>Student</span><span>Last active</span><span>This week</span><span>Accuracy</span><span>Status</span>
        </div>
        <div className="divide-y divide-hairline">
          {shown.map((r) => (
            <button key={r.email} onClick={() => openStudent(r.email)}
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
                {r.drop != null && r.drop !== 0 && <span className={`text-[11px] font-bold ${r.drop > 0 ? 'text-incorrect-fg' : 'text-correct-fg'}`}>{r.drop > 0 ? `↓${r.drop}` : `↑${-r.drop}`}</span>}
              </span>
              <span className="justify-self-end"><StatusBadge r={r} /></span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-ink-muted">Reads your existing practice data — no extra tracking. Click a student for their full breakdown.</p>
    </div>
  )
}

function TrendChart({ pts }: { pts: { date: string; score: number }[] }) {
  if (!pts || pts.length < 2) return <p className="text-[12px] text-ink-muted">Not enough graded activity to chart a trend yet.</p>
  const W = 520, H = 150, padL = 34, padB = 22, padT = 8
  const iw = W - padL - 6, ih = H - padB - padT
  const x = (i: number) => padL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw)
  const y = (v: number) => padT + (1 - v / 100) * ih
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
  const area = `${padL},${padT + ih} ${line.join(' ')} ${x(pts.length - 1).toFixed(1)},${padT + ih}`
  const labelEvery = Math.ceil(pts.length / 6)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Accuracy trend from ${pts[0].score}% to ${pts[pts.length - 1].score}%`} style={{ display: 'block' }}>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={padL} y1={y(g)} x2={W - 6} y2={y(g)} stroke="#f4f6f9" />
          <text x={padL - 6} y={y(g) + 3} fontSize="10" fill="#9aa0a8" textAnchor="end">{g}</text>
        </g>
      ))}
      <line x1={padL} y1={y(LOW_ACC)} x2={W - 6} y2={y(LOW_ACC)} stroke="#f0d9a8" strokeDasharray="3 3" />
      <polygon points={area} fill="#E1F5FE" />
      <polyline points={line.join(' ')} fill="none" stroke="#0098D4" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.score)} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? accColor(p.score) : '#0098D4'} />)}
      {pts.map((p, i) => (i % labelEvery === 0 || i === pts.length - 1) ? <text key={`l${i}`} x={x(i)} y={H - 6} fontSize="9.5" fill="#9aa0a8" textAnchor="middle">{p.date}</text> : null)}
    </svg>
  )
}

function Chip({ v, l, bad }: { v: string; l: string; bad?: boolean }) {
  return (
    <div className="bg-white border border-hairline rounded-tile p-3">
      <div className={`text-[19px] font-bold leading-none ${bad ? 'text-incorrect-fg' : 'text-ink-black'}`}>{v}</div>
      <div className="text-[11px] text-ink-muted mt-1">{l}</div>
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

function SliderRow({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-ink-body">
      <span className="font-semibold whitespace-nowrap">{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 min-w-[100px] accent-sky" />
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
