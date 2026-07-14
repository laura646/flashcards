'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  renderStandaloneRunner,
  ExerciseLoadingFallback,
  type StandaloneRunnerExercise,
} from '@/components/lesson-render/exerciseRunner'
import { Suspense } from 'react'
import {
  testStrings,
  type TestLang,
  type TestSessionState,
  type TestExerciseResult,
  type TestSettings,
} from '@/lib/test-mode'

// ═══════════════════════════════════════════════════════════════════
// Exam mode (student): rules gate → timed attempt → unified submit →
// results. Wraps the existing 16 exercise runners untouched:
//  - a finished run saves its result to the server (continuous save);
//  - the student can REDO any exercise until the deadline — the latest
//    run replaces the stored result;
//  - the runner unmounts the moment it reports completion, so its own
//    review screen (which shows right/wrong) never renders mid-test.
// The deadline is server-authoritative; the local countdown is display
// only (synced with server_now to absorb clock skew).
// ═══════════════════════════════════════════════════════════════════

export interface TestSessionExercise extends StandaloneRunnerExercise {
  id: string
}

interface Props {
  lessonId: string
  lessonTitle: string
  lessonType: string
  exercises: TestSessionExercise[]
  onExit: () => void
}

type View = 'loading' | 'gate' | 'list' | 'runner' | 'results' | 'legacy' | 'error'

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice', fill_blank: 'Fill in the Blank', match_halves: 'Match Halves',
  type_answer: 'Type the Answer', anagram: 'Unjumble', unjumble: 'Unjumble', true_or_false: 'True or False',
  hangman: 'Hangman', error_correction: 'Error Correction', complete_sentence: 'Complete the Sentence',
  group_sort: 'Group Sort', dictation: 'Dictation', rank_order: 'Rank Order',
  text_sequencing: 'Text Sequencing', transform: 'Transform', cloze_listening: 'Cloze Listening',
  odd_one_out: 'Odd One Out', gap_fill: 'Gap Fill',
}

const TEST_TYPE_BADGES: Record<string, string> = {
  mid_course_test: '📝 Mid-course Test',
  final_test: '🎓 Final Test',
  review_test: '🔄 Review Test',
}

function fmtClock(totalSecs: number): string {
  const s = Math.max(0, Math.floor(totalSecs))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss < 10 ? '0' : ''}${ss}`
}

// Best-effort question prompt + correct answer extraction for the results
// review. Question shapes vary per exercise type — unknown shapes just fall
// back to "Question N" / no reveal.
/* eslint-disable @typescript-eslint/no-explicit-any */
function questionPrompt(q: any, i: number, fallback: string): string {
  const t = q?.question || q?.prompt || q?.text || q?.sentence || q?.clue || q?.word_scrambled
  return typeof t === 'string' && t.trim() ? t : `${fallback} ${i + 1}`
}
function correctAnswerText(q: any): string | null {
  if (!q || typeof q !== 'object') return null
  if (Array.isArray(q.options)) {
    if (typeof q.correctIndex === 'number') return String(q.options[q.correctIndex] ?? '')
    if (Array.isArray(q.correctIndices)) {
      const vals = q.correctIndices.map((i: number) => q.options[i]).filter(Boolean)
      if (vals.length) return vals.join(', ')
    }
  }
  const direct = q.answer ?? q.correct_answer ?? q.correct ?? q.word
  if (typeof direct === 'string' && direct.trim()) return direct
  if (Array.isArray(direct) && direct.length && typeof direct[0] === 'string') return direct[0]
  return null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function TestSession({ lessonId, lessonTitle, lessonType, exercises, onExit }: Props) {
  const [view, setView] = useState<View>('loading')
  const [settings, setSettings] = useState<TestSettings | null>(null)
  const [lang, setLang] = useState<TestLang>('hy')
  const [showRules, setShowRules] = useState(false)
  const [laterNote, setLaterNote] = useState(false)
  const [answers, setAnswers] = useState<Record<string, TestExerciseResult>>({})
  const [activeEx, setActiveEx] = useState<TestSessionExercise | null>(null)
  const [secsLeft, setSecsLeft] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [toast, setToast] = useState<{ kind: '15' | '5'; msg: string } | null>(null)
  const [result, setResult] = useState<{
    score: number; total: number; auto: boolean; started_at?: string; submitted_at?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const deadlineRef = useRef<number>(0)
  const skewRef = useRef<number>(0) // serverNow - clientNow
  const warned15 = useRef(false)
  const warned5 = useRef(false)
  const finishing = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const S = testStrings(lang)

  const computeSecsLeft = useCallback(
    () => (deadlineRef.current - (Date.now() + skewRef.current)) / 1000,
    []
  )

  const applyRunning = useCallback((deadline: string, serverNow: string, saved: Record<string, TestExerciseResult>) => {
    deadlineRef.current = new Date(deadline).getTime()
    skewRef.current = new Date(serverNow).getTime() - Date.now()
    setAnswers(saved || {})
    const left = (deadlineRef.current - (Date.now() + skewRef.current)) / 1000
    // Don't fire warnings for thresholds already passed at load/resume.
    warned15.current = left <= 900
    warned5.current = left <= 300
    setSecsLeft(left)
    setView('list')
  }, [])

  const applySubmitted = useCallback((data: {
    score: number; total: number; auto_submitted: boolean
    started_at?: string; submitted_at?: string
    answers?: Record<string, TestExerciseResult>
  }) => {
    if (data.answers) setAnswers(data.answers)
    setResult({
      score: data.score, total: data.total, auto: data.auto_submitted,
      started_at: data.started_at, submitted_at: data.submitted_at,
    })
    setView('results')
  }, [])

  // ── initial state ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/test-session?lesson_id=${encodeURIComponent(lessonId)}`)
        const data: TestSessionState & { error?: string } = await res.json()
        if (cancelled) return
        if (!res.ok) { setError(data.error || 'Could not load the test.'); setView('error'); return }
        if (data.status === 'legacy_completed') { setView('legacy'); return }
        setSettings(data.settings)
        setLang(data.settings.test_rules_lang)
        if (data.status === 'none') setView('gate')
        else if (data.status === 'in_progress') applyRunning(data.deadline, data.server_now, data.answers)
        else applySubmitted(data)
      } catch {
        if (!cancelled) { setError('Network error — could not load the test.'); setView('error') }
      }
    })()
    return () => { cancelled = true }
  }, [lessonId, applyRunning, applySubmitted])

  // ── deadline reached (from any running view) ──
  const timeUp = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    setActiveEx(null)
    setConfirmOpen(false)
    try {
      const res = await fetch('/api/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', lesson_id: lessonId }),
      })
      const data = await res.json()
      if (res.ok) applySubmitted({ ...data, auto_submitted: true })
      else { setError(data.error || 'Could not finish the test.'); setView('error') }
    } catch {
      setError('Network error — please reload the page.'); setView('error')
    }
    finishing.current = false
  }, [lessonId, applySubmitted])

  // ── countdown ──
  const running = view === 'list' || view === 'runner'
  useEffect(() => {
    if (!running) { if (timerRef.current) clearInterval(timerRef.current); return }
    timerRef.current = setInterval(() => {
      const left = computeSecsLeft()
      setSecsLeft(left)
      if (left <= 900 && !warned15.current) {
        warned15.current = true
        setToast({ kind: '15', msg: S.minutesLeft15 })
        setTimeout(() => setToast(null), 4000)
      }
      if (left <= 300 && !warned5.current) {
        warned5.current = true
        setToast({ kind: '5', msg: S.minutesLeft5 })
        setTimeout(() => setToast(null), 4000)
      }
      if (left <= 0) timeUp()
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running, computeSecsLeft, timeUp, S])

  // ── actions ──
  const start = async () => {
    try {
      const res = await fetch('/api/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', lesson_id: lessonId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not start the test.'); setView('error'); return }
      setShowRules(false)
      applyRunning(data.deadline, data.server_now, data.answers || {})
    } catch {
      setError('Network error — could not start the test.'); setView('error')
    }
  }

  const saveExercise = async (ex: TestSessionExercise, score: number, total: number, per?: boolean[]) => {
    // Optimistic local update so the list status flips instantly.
    setAnswers((prev) => ({
      ...prev,
      [ex.id]: { exercise_id: ex.id, score, total, per_question_results: per ?? null },
    }))
    setActiveEx(null)
    setView('list')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1600)
    try {
      const res = await fetch('/api/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-exercise', lesson_id: lessonId, exercise_id: ex.id,
          score, total, per_question_results: per ?? null,
        }),
      })
      if (res.status === 410) timeUp()
    } catch { /* keep optimistic state; finalize will use last server-accepted save */ }
  }

  const submitNow = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', lesson_id: lessonId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not submit.'); setView('error'); return }
      setConfirmOpen(false)
      applySubmitted(data)
    } catch {
      setError('Network error — could not submit. Your answers are saved; please reload.')
      setView('error')
    }
    setSubmitting(false)
  }

  const answeredCount = exercises.filter((e) => answers[e.id]).length
  const unanswered = exercises.length - answeredCount

  // ─────────────────────────── RENDER ───────────────────────────

  if (view === 'loading') {
    return <div className="flex items-center justify-center py-16"><div className="text-brandblue text-sm">Loading…</div></div>
  }

  if (view === 'error') {
    return (
      <div className="bg-incorrect-bg border border-incorrect-border rounded-2xl p-5 text-center">
        <p className="text-sm text-incorrect-fg font-bold mb-3">{error}</p>
        <button onClick={onExit} className="text-xs font-bold text-ink-muted hover:text-ink-body">← Back</button>
      </div>
    )
  }

  if (view === 'legacy') {
    return (
      <div className="bg-white border border-sky-border rounded-2xl p-6 text-center">
        <div className="text-3xl mb-2">✅</div>
        <p className="text-sm font-bold text-ink-body mb-1">{S.alreadyTaken}</p>
        <p className="text-xs text-ink-muted mb-4">You have already taken this test.</p>
        <button onClick={onExit} className="text-xs font-bold text-ink-muted hover:text-ink-body">← Back</button>
      </div>
    )
  }

  const timerDanger = secsLeft <= 300
  const timerWarn = secsLeft <= 900 && !timerDanger

  // ── GATE ──
  if (view === 'gate' && settings) {
    return (
      <>
        <div className="bg-white border-[1.5px] border-sky-border rounded-2xl p-5 shadow-sm">
          <span className="inline-block bg-brandblue text-white text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full mb-3">
            {TEST_TYPE_BADGES[lessonType] || '📝 Test'}
          </span>
          <h2 className="text-lg font-bold text-ink-black mb-2">{lessonTitle}</h2>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="text-[10.5px] font-bold bg-sky-wash text-sky-text px-2.5 py-1 rounded-full">⏱ {settings.time_limit_minutes} {S.minutesShort}</span>
            <span className="text-[10.5px] font-bold bg-surface text-ink-muted px-2.5 py-1 rounded-full">{exercises.length} {lang === 'hy' ? 'վարժություն' : `exercise${exercises.length === 1 ? '' : 's'}`}</span>
            <span className="text-[10.5px] font-bold bg-surface text-ink-muted px-2.5 py-1 rounded-full">{S.oneAttempt}</span>
          </div>
          <button onClick={() => { setLaterNote(false); setShowRules(true) }}
            className="w-full bg-sky hover:brightness-95 text-white font-bold py-3.5 rounded-xl text-sm transition-colors">
            {S.startTest}
          </button>
          {laterNote && (
            <div className="mt-3 bg-sky-wash border border-sky-border rounded-xl px-3 py-2.5 text-xs text-ink-body text-center">
              👍 {S.laterNote}
            </div>
          )}
          <button onClick={onExit} className="w-full text-xs font-bold text-ink-muted hover:text-ink-body mt-3 py-1">← Back</button>
        </div>

        {showRules && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setShowRules(false)}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-brandblue">{S.rulesTitle}</h3>
                <div className="inline-flex bg-surface rounded-full p-0.5">
                  {(['hy', 'en'] as TestLang[]).map((l) => (
                    <button key={l} onClick={() => setLang(l)}
                      className={`text-[10.5px] font-extrabold px-2.5 py-1 rounded-full ${lang === l ? 'bg-white text-brandblue shadow-sm' : 'text-ink-muted'}`}>
                      {l === 'hy' ? 'Հայ' : 'Eng'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-ink-muted mb-3">{S.rulesSub}</p>
              <div className="space-y-2 mb-4">
                {S.rules(settings.time_limit_minutes).map((r, i) => (
                  <div key={i} className="bg-surface rounded-xl px-3 py-2.5 text-xs leading-relaxed text-ink-body">{r}</div>
                ))}
              </div>
              <button onClick={start}
                className="w-full bg-sky hover:brightness-95 text-white font-bold py-3.5 rounded-xl text-sm transition-colors mb-2">
                {S.agreeStart}
              </button>
              <button onClick={() => { setShowRules(false); setLaterNote(true) }}
                className="w-full bg-white border-[1.5px] border-hairline text-ink-muted hover:text-ink-body font-bold py-3 rounded-xl text-xs transition-colors">
                {S.takeLater}
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── shared timer bar for running views ──
  const timerBar = (
    <div className={`sticky top-0 z-30 -mx-4 px-4 py-2.5 flex items-center gap-3 transition-colors ${
      timerDanger ? 'bg-[#c23434]' : timerWarn ? 'bg-[#c47d0e]' : 'bg-brandblue'} text-white`}>
      <div>
        <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-85">{S.timeLeft}</p>
        <p className="text-xl font-extrabold tabular-nums leading-none">{fmtClock(secsLeft)}</p>
      </div>
      <span className={`ml-auto text-[10.5px] font-bold bg-white/20 rounded-full px-2.5 py-1 transition-opacity ${savedFlash ? 'opacity-100' : 'opacity-0'}`}>
        {S.saved}
      </span>
    </div>
  )

  const toastEl = toast && (
    <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg border ${
      toast.kind === '5' ? 'bg-incorrect-bg text-incorrect-fg border-incorrect-border' : 'bg-[#fef3e2] text-[#b45309] border-[#f5dcb5]'}`}>
      {toast.msg}
    </div>
  )

  // ── RUNNER (one exercise open) ──
  if (view === 'runner' && activeEx) {
    return (
      <div className="flex flex-col gap-4">
        {timerBar}
        {toastEl}
        <Suspense fallback={<ExerciseLoadingFallback />}>
          {renderStandaloneRunner(
            activeEx,
            (score, total, per) => saveExercise(activeEx, score, total, per),
            () => { setActiveEx(null); setView('list') }
          )}
        </Suspense>
      </div>
    )
  }

  // ── LIST (running) ──
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-3 pb-24">
        {timerBar}
        {toastEl}
        {exercises.map((ex, i) => {
          const done = !!answers[ex.id]
          return (
            <div key={ex.id} className="bg-white border border-sky-border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h4 className="text-sm font-bold text-ink-black min-w-0 truncate">
                  {i + 1} · {ex.title || TYPE_LABELS[ex.exercise_type] || 'Exercise'}
                </h4>
                <span className={`shrink-0 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                  done ? 'bg-correct-bg text-correct-fg' : 'bg-surface text-ink-muted'}`}>
                  {done ? S.statusAnswered : S.statusNotStarted}
                </span>
              </div>
              <p className="text-[11px] text-ink-muted mb-3">{TYPE_LABELS[ex.exercise_type] || ex.exercise_type}</p>
              <button
                onClick={() => { setActiveEx(ex); setView('runner') }}
                className={`w-full font-bold py-2.5 rounded-xl text-xs transition-colors ${
                  done
                    ? 'bg-white border-[1.5px] border-sky-border text-sky-text hover:border-sky'
                    : 'bg-sky text-white hover:brightness-95'}`}>
                {done ? `✎ ${S.changeAnswers}` : `${S.open} →`}
              </button>
            </div>
          )
        })}

        {/* pinned submit — fixed to the viewport, never scrolls (prototype lesson) */}
        <div className="fixed bottom-0 inset-x-0 z-20 px-4 pb-4 pt-8 bg-gradient-to-t from-[#f6f8fb] via-[#f6f8fb]/90 to-transparent">
          <div className="max-w-lg mx-auto">
            <button onClick={() => setConfirmOpen(true)}
              className="w-full bg-correct-fg hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl text-sm shadow-lg transition-all">
              {S.submitTest}
            </button>
          </div>
        </div>

        {confirmOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setConfirmOpen(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md text-center" onClick={(e) => e.stopPropagation()}>
              <div className="text-3xl mb-2">{unanswered > 0 ? '⚠️' : '🤔'}</div>
              {unanswered > 0 && (
                <span className="inline-block bg-[#fef3e2] border border-[#f5dcb5] text-[#b45309] text-[11px] font-bold rounded-full px-3 py-1 mb-3">
                  {S.unansweredCount(unanswered)}
                </span>
              )}
              <p className="text-sm font-semibold text-ink-body leading-relaxed mb-5">
                {unanswered > 0 ? S.confirmIncomplete : S.confirmComplete}
              </p>
              <div className="flex gap-2.5">
                <button onClick={() => setConfirmOpen(false)} disabled={submitting}
                  className="flex-1 bg-white border-[1.5px] border-hairline text-ink-body font-bold py-3 rounded-xl text-xs">
                  {S.backToTest}
                </button>
                <button onClick={submitNow} disabled={submitting}
                  className="flex-1 bg-correct-fg text-white font-extrabold py-3 rounded-xl text-xs disabled:opacity-50">
                  {submitting ? '…' : S.yesSubmit}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── RESULTS ──
  if (view === 'results' && result) {
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0
    const usedMs = result.started_at && result.submitted_at
      ? new Date(result.submitted_at).getTime() - new Date(result.started_at).getTime()
      : null
    const reveal = settings?.test_reveal_answers !== false
    return (
      <div className="flex flex-col gap-4">
        {result.auto && (
          <div className="bg-[#fef3e2] border border-[#f5dcb5] text-[#b45309] rounded-xl px-4 py-3 text-xs font-bold leading-relaxed">
            ⏱ {S.autoSubmitted}
          </div>
        )}
        <div className="bg-sky rounded-card p-6 text-white text-center">
          <div className="text-3xl mb-1">{pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}</div>
          <div className="text-4xl font-extrabold tabular-nums">{result.score} / {result.total}</div>
          <div className="text-sm font-bold opacity-95 mt-1">{pct}%</div>
          {usedMs !== null && settings && (
            <div className="text-[11px] opacity-85 mt-2">
              {S.timeUsed} {fmtClock(Math.min(usedMs / 1000, settings.time_limit_minutes * 60))} / {fmtClock(settings.time_limit_minutes * 60)}
            </div>
          )}
        </div>

        <div className="bg-white border border-sky-border rounded-2xl p-4">
          <p className="text-xs font-bold text-ink-muted uppercase mb-3">{S.yourAnswers}</p>
          <div className="space-y-4">
            {exercises.map((ex, i) => {
              const a = answers[ex.id]
              const per = a?.per_question_results
              const qs: unknown[] = Array.isArray(ex.questions) ? ex.questions : []
              return (
                <div key={ex.id}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-[12.5px] font-bold text-ink-black min-w-0 truncate">{i + 1} · {ex.title || TYPE_LABELS[ex.exercise_type] || 'Exercise'}</p>
                    <span className="shrink-0 text-[10.5px] font-bold text-ink-muted tabular-nums">{a ? `${a.score}/${a.total}` : '—'}</span>
                  </div>
                  {Array.isArray(per) && per.length > 0 ? (
                    <div className="divide-y divide-hairline">
                      {per.map((ok, qi) => {
                        const q = qs[qi]
                        const correct = !ok && reveal ? correctAnswerText(q) : null
                        return (
                          <div key={qi} className="flex items-start gap-2.5 py-2">
                            <span className={`shrink-0 w-5 h-5 rounded-full grid place-items-center text-[10px] font-extrabold mt-0.5 ${
                              ok ? 'bg-correct-bg text-correct-fg' : 'bg-incorrect-bg text-incorrect-fg'}`}>
                              {ok ? '✓' : '✗'}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11.5px] text-ink-muted leading-snug">{questionPrompt(q, qi, lang === 'hy' ? 'Հարց' : 'Question')}</p>
                              {correct && <p className="text-[11.5px] font-bold text-correct-fg mt-0.5">{S.correctAnswerWas} {correct}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-muted italic">{a ? '' : lang === 'hy' ? 'Չի պատասխանվել' : 'Not answered'}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-sky-wash border border-sky-border rounded-xl px-4 py-3 text-xs text-ink-body leading-relaxed">
          ✅ {S.resultsSaved}
        </div>
        <button onClick={onExit} className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors">
          ← {lang === 'hy' ? 'Վերադառնալ' : 'Back'}
        </button>
      </div>
    )
  }

  return null
}
