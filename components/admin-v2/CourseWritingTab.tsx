'use client'

// ─────────────────────────────────────────────────────────────────
// COURSE WRITING TAB (teacher review + grading) — W1.
//
// A "to grade" queue: every writing submission in the course, needs-grading
// first. Click one → an in-place grade panel showing the prompt + the essay,
// with a feedback box, an overall score %, an optional CEFR band, and an
// optional 4-criterion rubric. Reads/saves via /api/writing-feedback. HR sees
// it read-only (canGrade=false). Reads fail-safe (works before the migration;
// grades just show as ungraded).
// ─────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { Spinner, EmptyState, Button } from '@/components/student-ui'

const CEFR_BANDS = ['A1', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'C1', 'C2']
const RUBRIC_KEYS = [
  { k: 'task', label: 'Task' },
  { k: 'grammar', label: 'Grammar' },
  { k: 'vocab', label: 'Vocabulary' },
  { k: 'coherence', label: 'Coherence' },
] as const

interface Grade {
  score_pct: number | null
  cefr_band: string | null
  rubric: Record<string, number> | null
  feedback: string | null
  graded_by?: string
  graded_at?: string
}
interface Submission {
  progress_id: string
  student_email: string
  student_name: string
  block_id: string
  lesson_title: string
  block_title: string
  prompt: string
  guidelines: string
  word_limit: number | null
  response_text: string
  submitted_at: string
  grade: Grade | null
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}
const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

export default function CourseWritingTab({ courseId, canGrade }: { courseId: string; canGrade: boolean }) {
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'todo' | 'graded' | 'all'>('todo')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/writing-feedback?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d) => { setSubs(Array.isArray(d?.submissions) ? d.submissions : []); setLoading(false) })
      .catch(() => { setError('Could not load writing submissions.'); setLoading(false) })
  }
  useEffect(load, [courseId])

  const todo = subs.filter((s) => !s.grade).length
  const shown = useMemo(
    () => subs.filter((s) => (filter === 'todo' ? !s.grade : filter === 'graded' ? !!s.grade : true)),
    [subs, filter],
  )
  const open = openId ? subs.find((s) => s.progress_id === openId) : null

  const onSaved = (progressId: string, grade: Grade) => {
    setSubs((prev) => prev.map((s) => (s.progress_id === progressId ? { ...s, grade } : s)))
    setOpenId(null)
  }

  if (loading) return <div className="bg-white rounded-card border border-hairline p-10 flex justify-center"><Spinner label="Loading writing…" /></div>
  if (error) return <div className="bg-white rounded-card border border-hairline p-6"><EmptyState title="Couldn't load writing" hint={error} /></div>
  if (subs.length === 0) return <div className="bg-white rounded-card border border-hairline p-6"><EmptyState title="No writing submissions yet" hint="When students submit writing exercises in this course, they'll appear here to review and grade." /></div>

  if (open) return <GradePanel sub={open} courseId={courseId} canGrade={canGrade} onBack={() => setOpenId(null)} onSaved={onSaved} />

  return (
    <div className="space-y-3.5">
      <div className="flex gap-2">
        {([['todo', `To grade${todo ? ` (${todo})` : ''}`], ['graded', 'Graded'], ['all', 'All']] as const).map(([f, lab]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${filter === f ? 'bg-sky text-white border-sky' : 'bg-white text-sky-text border-sky-border hover:bg-sky-wash'}`}>{lab}</button>
        ))}
      </div>
      <div className="bg-white rounded-card border border-hairline overflow-hidden divide-y divide-hairline">
        {shown.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-ink-muted">{filter === 'todo' ? 'Nothing left to grade — nice.' : 'Nothing here.'}</div>
        ) : shown.map((s) => (
          <button key={s.progress_id} onClick={() => setOpenId(s.progress_id)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-sky-wash transition-colors">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-ink-black truncate">{s.student_name}</span>
              <span className="block text-[11px] text-ink-muted truncate">{s.block_title}{s.lesson_title ? ` · ${s.lesson_title}` : ''} · {wordCount(s.response_text)} words · {timeAgo(s.submitted_at)}</span>
            </span>
            {s.grade ? (
              <span className="flex items-center gap-2">
                {s.grade.cefr_band && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#eef4fb] text-brandblue">{s.grade.cefr_band}</span>}
                {s.grade.score_pct != null && <span className="text-[13px] font-bold text-correct-fg">{s.grade.score_pct}%</span>}
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-correct-bg text-correct-fg whitespace-nowrap">Graded</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#faeeda] text-[#854f0b] whitespace-nowrap">Needs grading</span>
            )}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink-muted">Writing submissions from this course. {canGrade ? 'Click one to read and grade it.' : 'Read-only.'}</p>
    </div>
  )
}

function GradePanel({ sub, courseId, canGrade, onBack, onSaved }: {
  sub: Submission; courseId: string; canGrade: boolean; onBack: () => void; onSaved: (id: string, g: Grade) => void
}) {
  const [score, setScore] = useState<string>(sub.grade?.score_pct != null ? String(sub.grade.score_pct) : '')
  const [cefr, setCefr] = useState<string>(sub.grade?.cefr_band || '')
  const [rubric, setRubric] = useState<Record<string, number>>(sub.grade?.rubric || {})
  const [feedback, setFeedback] = useState<string>(sub.grade?.feedback || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showRubric, setShowRubric] = useState(!!sub.grade?.rubric)

  const save = async () => {
    setSaving(true); setErr(null)
    const grade: Grade = {
      score_pct: score.trim() === '' ? null : Math.max(0, Math.min(100, Math.round(Number(score) || 0))),
      cefr_band: cefr || null,
      rubric: Object.keys(rubric).length ? rubric : null,
      feedback: feedback.trim() || null,
    }
    try {
      const res = await fetch('/api/writing-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress_id: sub.progress_id, student_email: sub.student_email, course_id: courseId, block_id: sub.block_id, ...grade }),
      })
      const body = await res.json()
      if (!res.ok) { setErr(body?.error || 'Could not save.'); setSaving(false); return }
      onSaved(sub.progress_id, { ...grade, graded_at: new Date().toISOString() })
    } catch { setErr('Could not save.'); setSaving(false) }
  }

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-sky-text bg-sky-wash border border-sky-border rounded-full px-3 py-1.5 hover:bg-[#daf0fd]">← Queue</button>
        <span className="text-[17px] font-bold text-ink-black">{sub.student_name}</span>
        <span className="text-[12px] text-ink-muted">{sub.block_title}{sub.lesson_title ? ` · ${sub.lesson_title}` : ''} · {wordCount(sub.response_text)} words</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-3.5 items-start">
        {/* Essay + prompt */}
        <div className="space-y-3">
          {sub.prompt && (
            <div className="bg-sky-wash rounded-card border border-sky-border p-3.5">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-brandblue mb-1">Prompt</div>
              <p className="text-[12.5px] text-ink-body leading-relaxed">{sub.prompt}</p>
              {sub.guidelines && <p className="text-[11.5px] text-ink-muted leading-relaxed whitespace-pre-wrap mt-2">{sub.guidelines}</p>}
            </div>
          )}
          <div className="bg-white rounded-card border border-hairline p-4">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted mb-2">Submission</div>
            <p className="text-[13.5px] text-ink-body leading-relaxed whitespace-pre-wrap">{sub.response_text}</p>
          </div>
        </div>

        {/* Grade form */}
        <div className="bg-white rounded-card border border-hairline p-4 space-y-3 md:sticky md:top-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted">Grade</div>
          <div className="flex gap-2.5">
            <label className="flex-1">
              <span className="block text-[11px] font-semibold text-ink-muted mb-1">Score %</span>
              <input type="number" min={0} max={100} value={score} disabled={!canGrade} onChange={(e) => setScore(e.target.value)}
                placeholder="—" className="w-full h-9 px-2.5 text-[14px] font-bold text-ink-black border border-[#cddcf0] rounded-lg focus:outline-none focus:border-sky disabled:bg-surface" />
            </label>
            <label className="flex-1">
              <span className="block text-[11px] font-semibold text-ink-muted mb-1">CEFR band</span>
              <select value={cefr} disabled={!canGrade} onChange={(e) => setCefr(e.target.value)}
                className="w-full h-9 px-2 text-[13px] text-ink-body border border-[#cddcf0] rounded-lg focus:outline-none focus:border-sky bg-white disabled:bg-surface">
                <option value="">—</option>
                {CEFR_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          </div>

          <button type="button" onClick={() => setShowRubric((v) => !v)} className="text-[11.5px] font-semibold text-sky-text">
            {showRubric ? '− Hide rubric' : '+ Rubric (optional)'}
          </button>
          {showRubric && (
            <div className="grid grid-cols-2 gap-2">
              {RUBRIC_KEYS.map(({ k, label }) => (
                <label key={k}>
                  <span className="block text-[10.5px] font-semibold text-ink-muted mb-0.5">{label} /5</span>
                  <input type="number" min={0} max={5} value={rubric[k] ?? ''} disabled={!canGrade}
                    onChange={(e) => setRubric((r) => { const n = { ...r }; if (e.target.value === '') delete n[k]; else n[k] = Math.max(0, Math.min(5, Math.round(Number(e.target.value) || 0))); return n })}
                    placeholder="—" className="w-full h-8 px-2 text-[13px] text-ink-body border border-[#cddcf0] rounded-lg focus:outline-none focus:border-sky disabled:bg-surface" />
                </label>
              ))}
            </div>
          )}

          <label className="block">
            <span className="block text-[11px] font-semibold text-ink-muted mb-1">Feedback</span>
            <textarea value={feedback} disabled={!canGrade} onChange={(e) => setFeedback(e.target.value)} rows={5}
              placeholder="What did they do well? What to work on next?" className="w-full px-3 py-2 text-[13px] text-ink-body border border-[#cddcf0] rounded-lg focus:outline-none focus:border-sky resize-y disabled:bg-surface" />
          </label>

          {err && <p className="text-[12px] text-incorrect-fg">{err}</p>}
          {canGrade ? (
            <Button variant="primary" size="sm" onClick={save} disabled={saving} className="w-full">{saving ? 'Saving…' : sub.grade ? 'Update grade' : 'Save grade'}</Button>
          ) : (
            <p className="text-[11px] text-ink-muted">Read-only — you don't have grading access for this course.</p>
          )}
          {sub.grade?.graded_at && <p className="text-[10.5px] text-ink-muted">Last graded {timeAgo(sub.grade.graded_at)}{sub.grade.graded_by ? ` by ${sub.grade.graded_by}` : ''}.</p>}
        </div>
      </div>
    </div>
  )
}
