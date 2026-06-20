'use client'

// IELTS Reading runner — Multiple choice (Type 1).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// Handles single-select (one radio) AND the two-answer variant (checkbox set,
// "Choose TWO letters, A–E"). Session-only in-memory state; NO server calls,
// NO progress recording.
//
// Checking (spec §1): exact match to the correct letter(s). In the multi
// variant, BOTH must be right and order does not matter → checkLetterSet.

import { useMemo, useState } from 'react'
import type { McqGroup } from '@/lib/ielts/types'
import { RadioGroupQuestion } from '@/components/ielts/primitives'
import { checkLetter, checkLetterSet } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

export interface ReadingMcqRunnerProps {
  group: McqGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

type McqAnswer = string | string[] | null

export function ReadingMcqRunner({ group, onScore, className }: ReadingMcqRunnerProps) {
  const { questions, instruction } = group

  const blank = useMemo<Record<number, McqAnswer>>(
    () => Object.fromEntries(questions.map((q) => [q.number, (q.selectCount ?? 1) > 1 ? [] : null])),
    [questions],
  )
  const [answers, setAnswers] = useState<Record<number, McqAnswer>>(blank)
  const [checked, setChecked] = useState(false)

  const setAnswer = (number: number, next: string | string[]) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  const isQuestionRight = (q: McqGroup['questions'][number]): boolean => {
    const a = answers[q.number]
    if ((q.selectCount ?? 1) > 1) {
      return checkLetterSet(Array.isArray(a) ? a : a ? [a] : [], q.correct)
    }
    const single = Array.isArray(a) ? a[0] : a
    return checkLetter(single ?? null, q.correct[0] ?? '')
  }

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: questions.length }
    const correct = questions.reduce((n, q) => (isQuestionRight(q) ? n + 1 : n), 0)
    return { correct, total: questions.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, answers, questions])

  const hasAnyAnswer = questions.some((q) => {
    const a = answers[q.number]
    return Array.isArray(a) ? a.length > 0 : a != null
  })

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    const correct = questions.reduce((n, q) => (isQuestionRight(q) ? n + 1 : n), 0)
    onScore?.(correct, questions.length)
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
        <RadioGroupQuestion
          key={q.number}
          number={q.number}
          stem={q.stem}
          options={q.options}
          selectCount={q.selectCount ?? 1}
          value={answers[q.number] ?? ((q.selectCount ?? 1) > 1 ? [] : null)}
          onChange={(next) => setAnswer(q.number, next)}
          checked={checked}
          correct={q.correct}
        />
      ))}
    </RunnerShell>
  )
}

export default ReadingMcqRunner
