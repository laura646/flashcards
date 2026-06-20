'use client'

// IELTS Reading runner — Identifying information: TRUE / FALSE / NOT GIVEN (Type 2).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// Tests whether a statement agrees with FACTS in the passage (keep distinct
// from the YES/NO/NOT GIVEN opinion type — spec §2 key build note).
// Session-only in-memory state; NO server calls, NO progress recording.
//
// Checking (spec §2): exact match to TRUE / FALSE / NOT GIVEN → checkLetter.

import { useMemo, useState } from 'react'
import type { TfngGroup } from '@/lib/ielts/types'
import { ThreeValueControl } from '@/components/ielts/primitives'
import { checkLetter } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

const TFNG_LABELS: [string, string, string] = ['TRUE', 'FALSE', 'NOT GIVEN']

export interface ReadingTfngRunnerProps {
  group: TfngGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

export function ReadingTfngRunner({ group, onScore, className }: ReadingTfngRunnerProps) {
  const { statements, instruction } = group

  const blank = useMemo<Record<number, string | null>>(
    () => Object.fromEntries(statements.map((s) => [s.number, null])),
    [statements],
  )
  const [answers, setAnswers] = useState<Record<number, string | null>>(blank)
  const [checked, setChecked] = useState(false)

  const setAnswer = (number: number, next: string) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: statements.length }
    const correct = statements.reduce(
      (n, s) => (checkLetter(answers[s.number] ?? null, s.correct) ? n + 1 : n),
      0,
    )
    return { correct, total: statements.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, answers, statements])

  const hasAnyAnswer = statements.some((s) => answers[s.number] != null)

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    const correct = statements.reduce(
      (n, s) => (checkLetter(answers[s.number] ?? null, s.correct) ? n + 1 : n),
      0,
    )
    onScore?.(correct, statements.length)
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
      {statements.map((s) => (
        <ThreeValueControl
          key={s.number}
          number={s.number}
          statement={s.text}
          labels={TFNG_LABELS}
          value={answers[s.number] ?? null}
          onChange={(next) => setAnswer(s.number, next)}
          checked={checked}
          correct={s.correct}
        />
      ))}
    </RunnerShell>
  )
}

export default ReadingTfngRunner
