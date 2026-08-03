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
}

interface ReviewData {
  session: { score: number | null; total: number | null; started_at: string | null; submitted_at: string | null; auto_submitted: boolean }
  exercises: AnyQ[]
  blocks: AnyQ[]
  answers: AnswerRow[]
}

function correctAnswerOf(type: string, q: AnyQ): string {
  if (type === 'true_or_false') return q.isTrue ? 'True' : 'False'
  if (type === 'type_answer') return String(q.answer ?? '—')
  if (type === 'error_correction') return String(q.correct ?? '—')
  if (Array.isArray(q.options)) {
    if (Array.isArray(q.correctIndexes)) return q.correctIndexes.map((i: number) => q.options[i]).join(', ')
    if (typeof q.correctIndex === 'number') return String(q.options[q.correctIndex] ?? '—')
  }
  return '—'
}

function promptOf(type: string, q: AnyQ, i: number): string {
  return String(q.prompt || q.statement || q.incorrect || `Question ${i + 1}`)
}

function QuestionRow({ prompt, student, correct, ok }: { prompt: string; student: string | null; correct: string; ok: boolean | null }) {
  const wrong = ok === false
  return (
    <div className={`px-4 py-2.5 border-t border-hairline ${wrong ? 'bg-red-50/60' : ''}`}>
      <p className={`text-[13px] font-medium mb-1 ${wrong ? 'text-red-700' : 'text-ink-black'}`}>{prompt}</p>
      <div className="flex items-baseline gap-4 flex-wrap text-[13px]">
        {student === null ? (
          <span className="text-ink-muted italic">Not recorded</span>
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
      </div>
    </div>
  )
}

// One exercise (standalone or attached) → its question rows.
function ExerciseSection({ title, type, questions, per, sa }: {
  title: string
  type: string
  questions: AnyQ[]
  per: boolean[] | null
  sa: unknown[] | null
}) {
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
        />
      ))}
    </>
  )
}

export default function TestAnswersReview({ lessonId, lessonTitle, studentEmail, studentName, onClose }: Props) {
  const [data, setData] = useState<ReviewData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const res = await fetch(`/api/test-session?lesson_id=${encodeURIComponent(lessonId)}&view=teacher-review&student_email=${encodeURIComponent(studentEmail)}`)
        const j = await res.json()
        if (!live) return
        if (!res.ok) setError(j.error || 'Could not load the attempt.')
        else setData(j)
      } catch { if (live) setError('Network error.') }
    })()
    return () => { live = false }
  }, [lessonId, studentEmail])

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
              {data?.session ? (
                <>
                  {data.session.score ?? '—'}/{data.session.total ?? '—'}
                  {typeof data.session.score === 'number' && typeof data.session.total === 'number' && data.session.total > 0
                    ? ` · ${Math.round((data.session.score / data.session.total) * 100)}%` : ''}
                  {timeUsed ? ` · ${timeUsed}` : ''}
                  {data.session.auto_submitted ? ' · auto-submitted' : ' · submitted'}
                </>
              ) : '…'}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => window.print()} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-hairline text-ink-body hover:bg-surface transition-colors">🖨 Print</button>
            <button onClick={() => window.print()} title="Choose 'Save as PDF' in the print dialog" className="text-xs font-bold px-3 py-1.5 rounded-lg border border-hairline text-ink-body hover:bg-surface transition-colors">Save PDF</button>
            <button onClick={onClose} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-hairline text-ink-muted hover:text-ink-black hover:bg-surface transition-colors">✕ Close</button>
          </div>
        </div>

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
                    <ExerciseSection title={ex.title} type={ex.exercise_type} questions={ex.questions || []} per={row.per_question_results} sa={sa} />
                  ) : (
                    <ExerciseSection title={ex.title} type={ex.exercise_type} questions={ex.questions || []} per={null} sa={(ex.questions || []).map(() => '(no answer)')} />
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
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}

            <p className="text-[11px] text-ink-muted px-1 pt-1">
              Attempts taken before answer capture shipped show right/wrong and the correct answer; the student&apos;s own answer reads &quot;Not recorded&quot;.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
