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

import { useState } from 'react'
import { Pill, EmptyState, Button, Spinner } from '@/components/student-ui'

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
  vocabFocus: number | null
  aiSummary: string | null
  aiGeneratedAt?: string | null
  skills: { label: string; pct: number }[]
  trend: number[]
  vocab: number[] // 5 counts: New, Learning, Familiar, Known, Mastered
  attendance: { lesson: string; status: 'present' | 'absent' | 'late' | 'excused' }[]
  tests: { title: string; type: string; score: number }[]
  notes: { tag: string; author: string; text: string }[]
}

const VOCAB_LABELS = ['New', 'Learning', 'Familiar', 'Known', 'Mastered']
const VOCAB_BG = ['bg-leitner-new', 'bg-leitner-learning', 'bg-leitner-familiar', 'bg-leitner-known', 'bg-leitner-mastered']

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-sky-wash rounded-card border border-sky-border p-4">
      <p className="text-[12px] text-ink-body">{label}</p>
      <p className="text-2xl font-bold text-sky-text mt-0.5">{value}</p>
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

export function ReportsView({ courseName, students, onRegenerate, onGenerate, generatingEmail, courseOverview, onGenerateOverview, generatingOverview }: {
  courseName: string
  students: StudentReport[]
  onRegenerate?: (email: string) => void
  onGenerate?: (email: string) => void
  generatingEmail?: string | null
  courseOverview?: CourseOverviewData | null
  onGenerateOverview?: () => void
  generatingOverview?: boolean
}) {
  const [sel, setSel] = useState<string | null>(null)
  const s = students.find((x) => x.email === sel) || null

  if (!s) {
    return (
      <div className="font-rubik min-h-screen bg-surface px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <h1 className="text-2xl font-bold text-brandblue">Reports</h1>
            <span className="text-[12px] text-ink-muted">{courseName} · last 30 days</span>
          </div>

          {(courseOverview || onGenerateOverview) && (
            <CourseOverview overview={courseOverview ?? null} onGenerate={onGenerateOverview} generating={generatingOverview} />
          )}

          {students.length === 0 ? (
            <EmptyState icon="📊" title="No data yet" hint="Once students complete exercises, their progress shows here." />
          ) : (
            <div className="bg-white rounded-card border border-hairline overflow-hidden">
              {students.map((st, i) => (
                <button
                  key={st.email}
                  onClick={() => setSel(st.email)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${i > 0 ? 'border-t border-hairline' : ''}`}
                >
                  <div className="w-9 h-9 rounded-full bg-sky-wash text-sky-text flex items-center justify-center text-sm font-bold shrink-0" aria-hidden="true">{st.name[0]}</div>
                  <span className="flex-1 text-sm font-bold text-ink-black truncate">{st.name}</span>
                  <span className="text-[12px] text-ink-muted w-24 text-right">{st.completionPct}% done</span>
                  <span className="text-[12px] font-bold text-sky-text w-16 text-right">{st.avgLatestPct != null ? `${st.avgLatestPct}%` : '—'}</span>
                  <span aria-hidden="true" className="text-ink-muted">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => setSel(null)} className="text-[13px] font-bold text-sky-text mb-4 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40">‹ Back to all students</button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-sky-wash text-sky-text flex items-center justify-center font-bold" aria-hidden="true">{s.name[0]}</div>
          <div><h1 className="text-xl font-bold text-ink-black">{s.name}</h1>{s.cefr && <p className="text-[12px] text-ink-muted">Working at {s.cefr}</p>}</div>
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

        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Skill breakdown">
            <div className="space-y-2.5">
              {s.skills.map((sk) => (
                <div key={sk.label} className="flex items-center gap-3">
                  <span className="w-24 text-[12px] text-ink-body shrink-0">{sk.label}</span>
                  <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden"><div className="h-full bg-sky rounded-full" style={{ width: `${sk.pct}%` }} /></div>
                  <span className="w-9 text-[12px] font-bold text-ink-black text-right">{sk.pct}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Score trend">
            <div className="flex items-end gap-2 h-28">
              {s.trend.map((h, i) => <div key={i} className="flex-1 bg-sky rounded-t" style={{ height: `${h}%` }} />)}
            </div>
            <p className="text-[11px] text-ink-muted mt-2">Last {s.trend.length} exercises</p>
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

          <Card title="Tests">
            {s.tests.length === 0 ? <p className="text-[13px] text-ink-muted">No tests yet.</p> : (
              <div className="space-y-1.5">
                {s.tests.map((t) => (
                  <div key={t.title} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-body">{t.title}</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${t.score >= 80 ? 'bg-correct-bg text-correct-fg' : 'bg-sky-wash text-sky-text'}`}>{t.score}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

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
  )
}

export default ReportsView
