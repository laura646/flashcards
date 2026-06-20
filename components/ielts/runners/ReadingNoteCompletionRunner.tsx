'use client'

// IELTS Reading runner — Note completion (Type 10).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// Condensed notes (short phrases, often under sub-headings) with inline gaps —
// rendered as an indented note block, NOT flowing prose (spec §10 build note).
// Session-only in-memory state; NO server calls, NO progress recording.
//
// Checking (spec §10): per-gap acceptedAnswers match + word limit. Over the
// limit is WRONG even if the words are right; misspelling is WRONG. Delegated
// to checkAccepted (correctness) / GapField (review reveal).

import { useMemo, useState } from 'react'
import type { NoteCompletionGroup } from '@/lib/ielts/types'
import { GapField } from '@/components/ielts/primitives'
import { checkAccepted } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

export interface ReadingNoteCompletionRunnerProps {
  group: NoteCompletionGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

type NoteGap = NonNullable<NoteCompletionGroup['lines'][number]['gap']>

export function ReadingNoteCompletionRunner({
  group,
  onScore,
  className,
}: ReadingNoteCompletionRunnerProps) {
  const { lines, instruction, title, wordLimit: groupLimit } = group

  /** Just the gapped lines, for scoring + blank-state construction. */
  const gaps = useMemo<NoteGap[]>(
    () => lines.flatMap((ln) => (ln.gap ? [ln.gap] : [])),
    [lines],
  )

  /** Effective word limit for a gap: per-gap overrides the group default. */
  const limitFor = (gap: NoteGap) => gap.wordLimit ?? groupLimit

  const blank = useMemo<Record<number, string>>(
    () => Object.fromEntries(gaps.map((g) => [g.number, ''])),
    [gaps],
  )
  const [answers, setAnswers] = useState<Record<number, string>>(blank)
  const [checked, setChecked] = useState(false)

  const setAnswer = (number: number, next: string) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  const countCorrect = () =>
    gaps.reduce(
      (n, g) =>
        checkAccepted(answers[g.number] ?? '', g.acceptedAnswers, limitFor(g))
          ? n + 1
          : n,
      0,
    )

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: gaps.length }
    return { correct: countCorrect(), total: gaps.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, answers, gaps])

  const hasAnyAnswer = gaps.some((g) => (answers[g.number] ?? '').trim() !== '')

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    onScore?.(countCorrect(), gaps.length)
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
      {/* Indented note block (surface-tinted card to read as "notes"). */}
      <div className="rounded-card border border-hairline bg-surface px-4 py-4">
        {title && (
          <p className="text-[15px] font-extrabold text-ink-black mb-3">{title}</p>
        )}
        <ul className="flex flex-col gap-2.5">
          {lines.map((ln, i) => {
            if (ln.gap) {
              const gap = ln.gap
              return (
                <li
                  key={`gap-${gap.number}`}
                  className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2 pl-4 text-[14px] leading-relaxed text-ink-black"
                >
                  <span aria-hidden="true" className="text-ink-muted">
                    •
                  </span>
                  {gap.before && <span>{gap.before}</span>}
                  <GapField
                    number={gap.number}
                    value={answers[gap.number] ?? ''}
                    onChange={(next) => setAnswer(gap.number, next)}
                    acceptedAnswers={gap.acceptedAnswers}
                    wordLimit={limitFor(gap)}
                    checked={checked}
                    ariaLabel={`${gap.before} ____ ${gap.after ?? ''}`.trim()}
                  />
                  {gap.after && <span>{gap.after}</span>}
                </li>
              )
            }
            // Heading line — bold, no gap, no indent.
            return (
              <li
                key={`head-${i}`}
                className="text-[14px] font-extrabold text-ink-black mt-1.5 first:mt-0"
              >
                {ln.heading}
              </li>
            )
          })}
        </ul>
      </div>
    </RunnerShell>
  )
}

export default ReadingNoteCompletionRunner
