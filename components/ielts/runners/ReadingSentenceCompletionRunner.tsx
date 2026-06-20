'use client'

// IELTS Reading runner — Sentence completion (Type 8).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// Sentences with one inline gap each; the learner types words taken from the
// passage, within a word limit. Session-only in-memory state; NO server calls,
// NO progress recording.
//
// Checking (spec §8): match against the per-item acceptedAnswers list
// (bracketed variants live in that list). Enforce the word limit — over the
// limit is WRONG even if the words are right; a misspelling is WRONG. All of
// this is delegated to checkAccepted (correctness) / GapField (review reveal).

import { useMemo, useState } from 'react'
import type { SentenceCompletionGroup } from '@/lib/ielts/types'
import { GapField } from '@/components/ielts/primitives'
import { checkAccepted } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

export interface ReadingSentenceCompletionRunnerProps {
  group: SentenceCompletionGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

export function ReadingSentenceCompletionRunner({
  group,
  onScore,
  className,
}: ReadingSentenceCompletionRunnerProps) {
  const { items, instruction, wordLimit: groupLimit } = group

  /** Effective word limit for an item: per-item overrides the group default. */
  const limitFor = (item: SentenceCompletionGroup['items'][number]) =>
    item.wordLimit ?? groupLimit

  const blank = useMemo<Record<number, string>>(
    () => Object.fromEntries(items.map((it) => [it.number, ''])),
    [items],
  )
  const [answers, setAnswers] = useState<Record<number, string>>(blank)
  const [checked, setChecked] = useState(false)

  const setAnswer = (number: number, next: string) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  const countCorrect = () =>
    items.reduce(
      (n, it) =>
        checkAccepted(answers[it.number] ?? '', it.acceptedAnswers, limitFor(it))
          ? n + 1
          : n,
      0,
    )

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: items.length }
    return { correct: countCorrect(), total: items.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, answers, items])

  const hasAnyAnswer = items.some((it) => (answers[it.number] ?? '').trim() !== '')

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
      {items.map((it) => (
        <div
          key={it.number}
          className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2 text-[15px] leading-relaxed text-ink-black"
        >
          {it.before && <span>{it.before}</span>}
          <GapField
            number={it.number}
            value={answers[it.number] ?? ''}
            onChange={(next) => setAnswer(it.number, next)}
            acceptedAnswers={it.acceptedAnswers}
            wordLimit={limitFor(it)}
            checked={checked}
            ariaLabel={`${it.before} ____ ${it.after ?? ''}`.trim()}
          />
          {it.after && <span>{it.after}</span>}
        </div>
      ))}
    </RunnerShell>
  )
}

export default ReadingSentenceCompletionRunner
