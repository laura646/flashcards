'use client'

// IELTS Reading runner — Matching features (Type 6).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// Each statement is attributed to a short lettered "feature" (a person, thing,
// date or place). Features are REUSABLE and some may stay unused (spec §6:
// "You may use any letter more than once."). NO one-to-one constraint, so the
// same feature letter may answer many statements. Session-only in-memory state;
// NO server calls, NO progress recording.
//
// Checking (spec §6): exact feature-id match per item.

import { useMemo, useState } from 'react'
import type { MatchingFeaturesGroup } from '@/lib/ielts/types'
import { LetterMatchRow } from '@/components/ielts/primitives'
import { checkLetter } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

export interface ReadingMatchingFeaturesRunnerProps {
  group: MatchingFeaturesGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

export function ReadingMatchingFeaturesRunner({
  group,
  onScore,
  className,
}: ReadingMatchingFeaturesRunnerProps) {
  const { features, items, instruction } = group

  const blank = useMemo<Record<number, string | null>>(
    () => Object.fromEntries(items.map((it) => [it.number, null])),
    [items],
  )
  const [answers, setAnswers] = useState<Record<number, string | null>>(blank)
  const [checked, setChecked] = useState(false)

  const setAnswer = (number: number, next: string) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  const countCorrect = () =>
    items.reduce(
      (n, it) => (checkLetter(answers[it.number] ?? null, it.correct) ? n + 1 : n),
      0,
    )

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: items.length }
    return { correct: countCorrect(), total: items.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, answers, items])

  const hasAnyAnswer = items.some((it) => answers[it.number] != null)

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    onScore?.(countCorrect(), items.length)
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
      {/* Features bank — reusable; some may stay unused. */}
      <div className="rounded-card border border-hairline bg-[#f7f8fa] p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-2.5">
          List of features
        </p>
        <ul className="flex flex-col gap-1.5">
          {features.map((f) => (
            <li key={f.id} className="flex gap-2 text-[13px] text-ink-body">
              <span className="font-extrabold text-sky-text shrink-0 min-w-[1.75rem]">{f.id}</span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* One dropdown row per statement. Reuse allowed → no "(used)" hint. */}
      <div className="flex flex-col gap-4">
        {items.map((it) => (
          <LetterMatchRow
            key={it.number}
            number={it.number}
            prompt={it.text}
            options={features}
            value={answers[it.number] ?? null}
            onChange={(next) => setAnswer(it.number, next)}
            allowReuse
            checked={checked}
            correct={it.correct}
          />
        ))}
      </div>
    </RunnerShell>
  )
}

export default ReadingMatchingFeaturesRunner
