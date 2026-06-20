'use client'

// IELTS Reading runner — Short-answer questions (Type 14).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// Open who/what/where/how-many questions answered in a few words (or a number)
// from the passage, each with a single-line field + word limit. Session-only
// in-memory state; NO server calls, NO progress recording.
//
// Checking (spec §14): match against the per-question acceptedAnswers list;
// only the key noun/number is needed (put each acceptable phrasing in that
// list). Enforce the word limit — over the limit is WRONG; misspelling is
// WRONG. Delegated to checkAccepted (correctness) / GapField (review reveal).

import { useMemo, useState } from 'react'
import type { ShortAnswerGroup } from '@/lib/ielts/types'
import { GapField } from '@/components/ielts/primitives'
import { checkAccepted } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

export interface ReadingShortAnswerRunnerProps {
  group: ShortAnswerGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

export function ReadingShortAnswerRunner({
  group,
  onScore,
  className,
}: ReadingShortAnswerRunnerProps) {
  const { questions, instruction, wordLimit: groupLimit } = group

  /** Effective word limit for a question: per-question overrides group default. */
  const limitFor = (q: ShortAnswerGroup['questions'][number]) =>
    q.wordLimit ?? groupLimit

  const blank = useMemo<Record<number, string>>(
    () => Object.fromEntries(questions.map((q) => [q.number, ''])),
    [questions],
  )
  const [answers, setAnswers] = useState<Record<number, string>>(blank)
  const [checked, setChecked] = useState(false)

  const setAnswer = (number: number, next: string) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  const countCorrect = () =>
    questions.reduce(
      (n, q) =>
        checkAccepted(answers[q.number] ?? '', q.acceptedAnswers, limitFor(q))
          ? n + 1
          : n,
      0,
    )

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: questions.length }
    return { correct: countCorrect(), total: questions.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, answers, questions])

  const hasAnyAnswer = questions.some((q) => (answers[q.number] ?? '').trim() !== '')

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    onScore?.(countCorrect(), questions.length)
  }

  const handleReset = () => {
    setAnswers(blank)
    setChecked(false)
  }

  return (
    <RunnerShell
      instruction={instruction}
      checked={checked}
      score={score}
      onCheck={handleCheck}
      onReset={handleReset}
      canCheck={hasAnyAnswer}
      className={className}
    >
      {questions.map((q) => (
        <div key={q.number} className="flex flex-col gap-2">
          <p className="flex items-baseline gap-1.5 text-[15px] leading-relaxed text-ink-black font-medium">
            <span aria-hidden="true" className="text-sky-text font-bold">
              {q.number}.
            </span>
            <span>{q.text}</span>
          </p>
          <GapField
            number={q.number}
            value={answers[q.number] ?? ''}
            onChange={(next) => setAnswer(q.number, next)}
            acceptedAnswers={q.acceptedAnswers}
            wordLimit={limitFor(q)}
            checked={checked}
            ariaLabel={q.text}
          />
        </div>
      ))}
    </RunnerShell>
  )
}

export default ReadingShortAnswerRunner
