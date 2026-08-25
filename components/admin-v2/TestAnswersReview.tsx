'use client'

// Teacher "See answers" review — full answer sheet for one student's
// submitted test attempt (Tests tab). Shows every question with the
// student's answer, the correct answer, and right/wrong marks. Print /
// Save-PDF via the browser print dialog (print CSS isolates this view).
//
// Attempts saved before answer capture shipped have per-question booleans
// only — those rows show "Not recorded" for the student's answer.

import { useEffect, useState } from 'react'
import { Spinner } from '@/components/student-ui'

interface Props {
  lessonId: string
  lessonTitle: string
  studentEmail: string
  studentName: string
  onClose: () => void
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyQ = any

interface AnswerRow {
  exercise_id: string
  score: number
  total: number
  per_question_results: boolean[] | null
  student_answers?: unknown
  teacher_overrides?: Record<string, { from: boolean; to: boolean }> | null
}

interface Adjustment { points: number; out_of: number; note: string; by?: string; at?: string }

interface ReviewData {
  session: { score: number | null; total: number | null; started_at: string | null; submitted_at: string | null; auto_submitted: boolean; adjustment?: Adjustment | null }
  exercises: AnyQ[]
  blocks: AnyQ[]
  answers: AnswerRow[]
}

function correctAnswerOf(type: string, q: AnyQ): string {
  if (type === 'true_or_false') return q.isTrue ? 'True' : 'False'
  if (type === 'type_answer') return String(q.answer ?? '—')
  if (type === 'error_correction') return String(q.correct ?? '—')
  if (type === 'hangman' || type === 'anagram' || type === 'unjumble') return String(q.word ?? '—')
  if (type === 'dictation') return String(q.text ?? '—')
  if (type === 'rank_order' || type === 'text_sequencing') {
    const items = q.items || q.segments
    return Array.isArray(items) ? items.join(' → ') : '—'
  }
  if (type === 'match_halves') return `${q.right ?? ''} ← ${q.left ?? ''}`
  if (Array.isArray(q.options)) {
    if (Array.isArray(q.correctIndexes)) return q.correctIndexes.map((i: number) => q.options[i]).join(', ')
    if (typeof q.correctIndex === 'number') return String(q.options[q.correctIndex] ?? '—')
  }
  return '—'
}

function promptOf(type: string, q: AnyQ, i: number): string {
  if (type === 'match_halves') return `Pair ${i + 1}`
  return String(q.prompt || q.statement || q.incorrect || q.criterion || q.clue || `Question ${i + 1}`)
}

function QuestionRow({ prompt, student, correct, ok, overridden, canKey, onMark }: {
  prompt: string; student: string | null; correct: string; ok: boolean | null
  overridden?: boolean
  canKey?: boolean
  onMark?: (mark: boolean | null, addToKey?: boolean) => void
}) {
  const wrong = ok === false
  return (
    <div className={`px-4 py-2.5 border-t border-hairline ${wrong ? 'bg-red-50/60' : ''}`}>
      <p className={`text-[13px] font-medium mb-1 ${wrong ? 'text-red-700' : 'text-ink-black'}`}>{prompt}</p>
      <div className="flex items-baseline gap-4 flex-wrap text-[13px]">
        {student === null ? (
          <span className="text-ink-muted italic">
            {ok === true ? '✓ Correct — ' : ok === false ? '✗ Wrong — ' : ''}answer text not recorded
          </span>
        ) : student === '(no answer)' ? (
          <span className="text-ink-muted italic">No answer</span>
        ) : (
          <span className={wrong ? 'text-red-600' : 'text-correct-fg'}>
            {ok === true ? '✓' : ok === false ? '✗' : '·'} Student: <b>{student}</b>
          </span>
        )}
        {(ok !== true) && (
          <span className="text-correct-fg">Correct: <b>{correct}</b></span>
        )}
        {onMark && ok !== null && (
          <span className="ml-auto inline-flex items-center gap-2 no-print">
            {overridden ? (
              <span className="text-[11px] font-bold bg-sky-wash text-sky-text px-2 py-0.5 rounded-full">
                re-marked · <button onClick={() => onMark(null)} className="underline">undo</button>
              </span>
            ) : ok === false ? (
              <>
                <button onClick={() => onMark(true)} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-correct-border text-correct-fg hover:bg-correct-bg transition-colors">Accept ✓</button>
                {canKey && (
                  <button onClick={() => onMark(true, true)} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-correct-border text-correct-fg hover:bg-correct-bg transition-colors">Accept + add to key</button>
                )}
              </>
            ) : (
              <button onClick={() => onMark(false)} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-hairline text-ink-muted hover:text-red-500 hover:border-red-200 transition-colors">✗ Mark wrong</button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

// One exercise (standalone or attached) → its question rows.
function ExerciseSection({ title, type, questions, per, sa, groupData, overrides, canKey, remark }: {
  title: string
  type: string
  questions: AnyQ[]
  per: boolean[] | null
  sa: unknown[] | null
  groupData?: AnyQ
  overrides?: Record<string, { from: boolean; to: boolean }>
  canKey?: boolean
  remark?: (i: number, mark: boolean | null, addToKey?: boolean) => void
}) {
  const rowProps = (i: number) => ({
    overridden: !!overrides?.[String(i)],
    canKey,
    onMark: remark ? (mark: boolean | null, addToKey?: boolean) => remark(i, mark, addToKey) : undefined,
  })
  // group_sort: rows are the items (in answer-key order, matching capture)
  if (type === 'group_sort') {
    const groups = (groupData?.groups || []) as AnyQ[]
    const rows: { item: string; group: string }[] = []
    groups.forEach((g) => (g.items || []).forEach((it: AnyQ) => rows.push({ item: String(it.text ?? it), group: String(g.name ?? '') })))
    return (
      <>
        {rows.map((r, i) => (
          <QuestionRow
            key={i}
            prompt={`${i + 1}. ${r.item}`}
            student={sa ? String(sa[i] ?? '(no answer)').split(' → ').slice(1).join(' → ') || '(not placed)' : null}
            correct={r.group}
            ok={per ? per[i] ?? null : null}
            {...rowProps(i)}
          />
        ))}
      </>
    )
  }
  // blanks types: one row per blank across all questions (matches capture order)
  if ((type === 'complete_sentence' || type === 'cloze_listening') && questions.length > 0) {
    const rows: { label: string; correct: string }[] = []
    questions.forEach((q, qi) => {
      Object.keys(q.blanks || {}).forEach((bid) => rows.push({ label: `${qi + 1} · ${bid}`, correct: String(q.blanks[bid]) }))
    })
    return (
      <>
        {rows.map((r, i) => (
          <QuestionRow
            key={i}
            prompt={r.label}
            student={sa ? String(sa[i] ?? '(no answer)') : null}
            correct={r.correct}
            ok={per ? per[i] ?? null : null}
            {...rowProps(i)}
          />
        ))}
      </>
    )
  }
  // match_halves: captured strings are self-contained ("definition ← chosen
  // half") in the student's shuffled order; look the correct half up by the
  // definition so ✓/✗ and correction stay aligned.
  if (type === 'match_halves' && sa) {
    return (
      <>
        {sa.map((s, i) => {
          const text = String(s ?? '')
          const def = text.split(' ← ')[0]
          const q = questions.find((x) => String(x.right) === def)
          return (
            <QuestionRow
              key={i}
              prompt={`Pair ${i + 1}`}
              student={text}
              correct={q ? `${q.right} ← ${q.left}` : '—'}
              ok={per ? per[i] ?? null : null}
              {...rowProps(i)}
            />
          )
        })}
      </>
    )
  }
  // gap_fill stores ONE cfg question whose gaps are the marks
  if (type === 'gap_fill' && questions.length > 0 && Array.isArray(questions[0]?.gaps)) {
    const gaps = questions[0].gaps as AnyQ[]
    return (
      <>
        {gaps.map((g, i) => (
          <QuestionRow
            key={g.id || i}
            prompt={`Gap ${i + 1}`}
            student={sa ? String(sa[i] ?? '(no answer)') : null}
            correct={String(g.answers?.[0] ?? '—') + (g.answers && g.answers.length > 1 ? `  (also accepted: ${g.answers.slice(1, 3).join(', ')}${g.answers.length > 3 ? '…' : ''})` : '')}
            ok={per ? per[i] ?? null : null}
            {...rowProps(i)}
          />
        ))}
      </>
    )
  }
  return (
    <>
      {questions.map((q, i) => (
        <QuestionRow
          key={q.id || i}
          prompt={`${i + 1}. ${promptOf(type, q, i)}`}
          student={sa ? String(sa[i] ?? '(no answer)') : null}
          correct={correctAnswerOf(type, q)}
          ok={per ? per[i] ?? null : null}
          {...rowProps(i)}
        />
      ))}
    </>
  )
}

export default function TestAnswersReview({ lessonId, lessonTitle, studentEmail, studentName, onClose }: Props) {
  const [data, setData] = useState<ReviewData | null>(null)
  const [error, setError] = useState('')

  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [adjPts, setAdjPts] = useState('')
  const [adjOutOf, setAdjOutOf] = useState('')
  const [adjNote, setAdjNote] = useState('')

  const load = async () => {
    try {
      const res = await fetch(`/api/test-session?lesson_id=${encodeURIComponent(lessonId)}&view=teacher-review&student_email=${encodeURIComponent(studentEmail)}`)
      const j = await res.json()
      if (!res.ok) setError(j.error || 'Could not load the attempt.')
      else { setError(''); setData(j) }
    } catch { setError('Network error.') }
  }
  useEffect(() => { load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, studentEmail])

  const post = async (payload: Record<string, unknown>, okMsg: string) => {
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      const res = await fetch('/api/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lessonId, student_email: studentEmail, ...payload }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setNotice(j.error || 'Could not save the change.')
      else { setNotice(okMsg); await load() }
    } catch { setNotice('Network error — change not saved.') }
    setBusy(false)
  }

  const remarkFor = (itemId: string, attachedId: string | null) =>
    (i: number, mark: boolean | null, addToKey?: boolean) =>
      post(
        { action: 'teacher-remark', item_id: itemId, attached_id: attachedId, question_index: i, mark, add_to_key: !!addToKey },
        mark === null ? 'Original mark restored.' : addToKey ? 'Re-marked — and the answer key now accepts this answer.' : 'Re-marked. The student sees the updated score too.',
      )

  const applyAdjustment = () => {
    const pts = parseInt(adjPts, 10)
    if (!pts) { setNotice('Enter a non-zero number of points.'); return }
    const oo = parseInt(adjOutOf, 10)
    post({ action: 'teacher-adjust', points: pts, out_of: Number.isFinite(oo) && oo >= 0 ? oo : pts, note: adjNote }, 'Adjustment applied.')
  }
  const removeAdjustment = () => post({ action: 'teacher-adjust', points: null }, 'Adjustment removed.')

  const answersById = new Map<string, AnswerRow>()
  if (data) for (const a of data.answers) answersById.set(a.exercise_id, a)

  const timeUsed = (() => {
    const s = data?.session
    if (!s?.started_at || !s?.submitted_at) return null
    const ms = new Date(s.submitted_at).getTime() - new Date(s.started_at).getTime()
    if (ms <= 0) return null
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return `${mins}:${String(secs).padStart(2, '0')}`
  })()

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto test-review-print-backdrop" role="dialog" aria-modal="true" aria-label={`Answers of ${studentName}`}>
      <style>{`@media print {
        body * { visibility: hidden; }
        .test-review-print, .test-review-print * { visibility: visible; }
        .test-review-print { position: absolute !important; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; }
        .test-review-print-backdrop { position: static !important; background: none !important; overflow: visible !important; }
        .no-print { display: none !important; }
      }`}</style>
      <div className="test-review-print font-rubik bg-white max-w-3xl mx-auto my-6 rounded-card border border-hairline">
        {/* Header */}
        <div className="px-5 py-4 border-b border-hairline flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{lessonTitle}</p>
            <p className="text-lg font-bold text-ink-black mt-0.5">{studentName}</p>
            <p className="text-xs text-ink-muted mt-0.5">
              {data?.session ? (() => {
                const sc = data.session.score ?? 0
                const tt = data.session.total ?? 0
                const adj = data.session.adjustment
                const fs = adj ? sc + adj.points : sc
                const ft = adj ? tt + adj.out_of : tt
                return (
                  <>
                    {adj ? `${sc}/${tt} + ${adj.points}${adj.note ? ` (${adj.note})` : ''} = ` : ''}
                    <b>{fs}/{ft}</b>
                    {ft > 0 ? ` · ${Math.round((fs / ft) * 100)}%` : ''}
                    {timeUsed ? ` · ${timeUsed}` : ''}
                    {data.session.auto_submitted ? ' · auto-submitted' : ' · submitted'}
                  </>
                )
              })() : '…'}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => window.print()} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-hairline text-ink-body hover:bg-surface transition-colors">🖨 Print</button>
            <button onClick={() => window.print()} title="Choose 'Save as PDF' in the print dialog" className="text-xs font-bold px-3 py-1.5 rounded-lg border border-hairline text-ink-body hover:bg-surface transition-colors">Save PDF</button>
            <button onClick={onClose} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-hairline text-ink-muted hover:text-ink-black hover:bg-surface transition-colors">✕ Close</button>
          </div>
        </div>

        {notice && <p className="px-5 py-2 text-xs font-bold text-sky-text bg-sky-wash border-b border-hairline no-print">{notice}</p>}
        {error && <p className="px-5 py-6 text-sm text-red-600">{error}</p>}
        {!error && !data && (
          <div className="px-5 py-10 flex items-center justify-center gap-2 text-sm text-ink-muted"><Spinner size={18} /> Loading answers…</div>
        )}

        {data && (
          <div className="p-4 space-y-3">
            {/* Standalone exercises, in test order */}
            {data.exercises.map((ex: AnyQ) => {
              const row = answersById.get(ex.id)
              const sa = Array.isArray(row?.student_answers) ? (row!.student_answers as unknown[]) : null
              return (
                <div key={ex.id} className="border border-hairline rounded-tile overflow-hidden">
                  <div className="px-4 py-2.5 bg-surface flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-ink-black">{ex.icon} {ex.title}</p>
                    <span className="text-xs font-bold text-ink-muted shrink-0">{row ? `${row.score}/${row.total}` : 'not answered'}</span>
                  </div>
                  {row ? (
                    <ExerciseSection title={ex.title} type={ex.exercise_type} questions={ex.questions || []} per={row.per_question_results} sa={sa} groupData={ex.groupData}
                      overrides={row.teacher_overrides || undefined}
                      canKey={sa != null && (ex.exercise_type === 'type_answer' || ex.exercise_type === 'gap_fill')}
                      remark={remarkFor(ex.id, null)} />
                  ) : (
                    <ExerciseSection title={ex.title} type={ex.exercise_type} questions={ex.questions || []} per={null} sa={(ex.questions || []).map(() => '(no answer)')} groupData={ex.groupData} />
                  )}
                </div>
              )
            })}

            {/* Blocks (listening / reading) with their follow-ups */}
            {data.blocks.map((b: AnyQ) => {
              const row = answersById.get(b.id)
              const detail = (row?.student_answers && typeof row.student_answers === 'object' && !Array.isArray(row.student_answers))
                ? (row.student_answers as Record<string, { per?: boolean[] | null; answers?: unknown[] | null }>)
                : null
              const attached: AnyQ[] = (b.content?.exercises || []) as AnyQ[]
              return (
                <div key={b.id} className="border border-hairline rounded-tile overflow-hidden">
                  <div className="px-4 py-2.5 bg-surface flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-ink-black">
                      {b.block_type === 'audio' ? '🎧' : b.block_type === 'video' ? '🎬' : '📖'} {b.title || (b.block_type === 'audio' ? 'Listening' : 'Reading')}
                    </p>
                    <span className="text-xs font-bold text-ink-muted shrink-0">{row ? `${row.score}/${row.total}` : 'not answered'}</span>
                  </div>
                  {attached.map((ax: AnyQ, ai: number) => {
                    const key = ax.id || String(ai)
                    const d = detail?.[key]
                    const type = ax.exercise_type || ax.type || 'multiple_choice'
                    return (
                      <div key={key}>
                        <p className="px-4 pt-2.5 pb-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{ax.title}</p>
                        <ExerciseSection
                          title={ax.title}
                          type={type}
                          questions={ax.questions || []}
                          per={d?.per ?? null}
                          sa={Array.isArray(d?.answers) ? (d!.answers as unknown[]) : (row ? null : (ax.questions || []).map(() => '(no answer)'))}
                          groupData={ax.groupData}
                          overrides={row?.teacher_overrides
                            ? Object.fromEntries(Object.entries(row.teacher_overrides)
                                .filter(([k]) => k.startsWith(`${key}:`))
                                .map(([k, v]) => [k.split(':')[1], v]))
                            : undefined}
                          remark={remarkFor(b.id, key)}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}

            <div className="border border-hairline rounded-tile p-4 no-print">
              <p className="text-[13px] font-bold text-ink-black mb-2">Score adjustment <span className="font-normal text-ink-muted">(for marks given outside the platform, e.g. writing)</span></p>
              {data.session.adjustment ? (
                <p className="text-[13px] text-ink-body">
                  Applied: <b>+{data.session.adjustment.points}/{data.session.adjustment.out_of}</b>
                  {data.session.adjustment.note ? ` — ${data.session.adjustment.note}` : ''}
                  <button onClick={removeAdjustment} disabled={busy} className="ml-3 text-[11px] font-bold text-red-500 hover:underline disabled:opacity-50">remove</button>
                </p>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={adjPts} onChange={(e) => setAdjPts(e.target.value)} type="number" placeholder="Points" aria-label="Points earned"
                    className="w-24 px-2 py-1.5 text-sm border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky" />
                  <span className="text-xs text-ink-muted" title="Enter 0 if these marks are already part of the test total (e.g. crediting a question that failed to record)">out of</span>
                  <input value={adjOutOf} onChange={(e) => setAdjOutOf(e.target.value)} type="number" placeholder="same" aria-label="Out of"
                    className="w-24 px-2 py-1.5 text-sm border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky" />
                  <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} type="text" placeholder="Reason, e.g. Writing task — graded on paper" aria-label="Reason"
                    className="flex-1 min-w-[200px] px-2 py-1.5 text-sm border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky" />
                  <button onClick={applyAdjustment} disabled={busy} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-sky-border text-brandblue hover:bg-sky-wash disabled:opacity-50 transition-colors">Apply</button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-ink-muted px-1 pt-1">
              Attempts taken before answer capture shipped show right/wrong and the correct answer; the student&apos;s own answer reads &quot;Not recorded&quot;.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
