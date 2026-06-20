'use client'

// IELTS Reading runner — Matching sentence endings (Type 7).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// Numbered sentence beginnings are matched to longer lettered endings. There
// are MORE endings than beginnings (distractors stay unused) and each ending is
// used at most ONCE — a one-to-one match, like matching headings (spec §7).
// Session-only in-memory state; NO server calls, NO progress recording.
//
// One-to-one hint: `usedIds` is passed to each row so endings picked by OTHER
// rows show "(used)" (allowReuse=false). This is a VISUAL hint only — the
// dropdown never disables a used ending, so the learner can still reassign and
// the checker stays the source of truth. Checking (spec §7): exact ending-id
// match per beginning.

import { useMemo, useState } from 'react'
import type { MatchingSentenceEndingsGroup } from '@/lib/ielts/types'
import { LetterMatchRow } from '@/components/ielts/primitives'
import { checkLetter } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

export interface ReadingMatchingSentenceEndingsRunnerProps {
  group: MatchingSentenceEndingsGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

export function ReadingMatchingSentenceEndingsRunner({
  group,
  onScore,
  className,
}: ReadingMatchingSentenceEndingsRunnerProps) {
  const { endings, items, instruction } = group

  const blank = useMemo<Record<number, string | null>>(
    () => Object.fromEntries(items.map((it) => [it.number, null])),
    [items],
  )
  const [answers, setAnswers] = useState<Record<number, string | null>>(blank)
  const [checked, setChecked] = useState(false)

  const setAnswer = (number: number, next: string) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  // All ending ids currently assigned to some row (for the one-to-one hint).
  const usedIds = useMemo(
    () => Object.values(answers).filter((v): v is string => v != null),
    [answers],
  )

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
      {/* Endings bank — more endings than beginnings; distractors stay unused. */}
      <div className="rounded-card border border-hairline bg-[#f7f8fa] p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-2.5">
          List of endings
        </p>
        <ul className="flex flex-col gap-1.5">
          {endings.map((e) => (
            <li key={e.id} className="flex gap-2 text-[13px] text-ink-body">
              <span className="font-extrabold text-sky-text shrink-0 min-w-[1.75rem]">{e.id}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* One dropdown row per sentence beginning. One-to-one → "(used)" hint. */}
      <div className="flex flex-col gap-4">
        {items.map((it) => (
          <LetterMatchRow
            key={it.number}
            number={it.number}
            prompt={it.beginning}
            options={endings}
            value={answers[it.number] ?? null}
            onChange={(next) => setAnswer(it.number, next)}
            allowReuse={false}
            usedIds={usedIds}
            checked={checked}
            correct={it.correct}
          />
        ))}
      </div>
    </RunnerShell>
  )
}

export default ReadingMatchingSentenceEndingsRunner
