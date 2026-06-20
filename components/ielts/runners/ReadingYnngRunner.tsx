'use client'

// IELTS Reading runner — Identifying writer's views: YES / NO / NOT GIVEN (Type 3).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// Tests whether a statement matches the writer's OPINION or CLAIM (not facts —
// keep distinct from the TRUE/FALSE/NOT GIVEN type; spec §3). Mechanics are
// identical to type 2 with the YES/NO/NOT GIVEN value set.
// Session-only in-memory state; NO server calls, NO progress recording.
//
// Checking (spec §3): exact match to YES / NO / NOT GIVEN → checkLetter.

import { useMemo, useState } from 'react'
import type { YnngGroup } from '@/lib/ielts/types'
import { ThreeValueControl } from '@/components/ielts/primitives'
import { checkLetter } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

const YNNG_LABELS: [string, string, string] = ['YES', 'NO', 'NOT GIVEN']

export interface ReadingYnngRunnerProps {
  group: YnngGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

export function ReadingYnngRunner({ group, onScore, className }: ReadingYnngRunnerProps) {
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
          labels={YNNG_LABELS}
          value={answers[s.number] ?? null}
          onChange={(next) => setAnswer(s.number, next)}
          checked={checked}
          correct={s.correct}
        />
      ))}
    </RunnerShell>
  )
}

export default ReadingYnngRunner
