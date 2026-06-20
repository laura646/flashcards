'use client'

// IELTS Reading runner — Matching headings (Type 5).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// More headings than paragraphs (distractors stay unused); each heading used
// once (one-to-one). v1 uses a dropdown per paragraph (LetterMatchRow) — drag
// is a later enhancement (spec §5 allows either). Session-only in-memory state;
// NO server calls, NO progress recording.
//
// One-to-one hint: `usedIds` is passed to each row so headings picked by OTHER
// rows show "(used)". This is a VISUAL hint only — the dropdown never disables a
// used heading, so the learner can still reassign (and the checker is the source
// of truth). Checking (spec §5): exact heading-id match per paragraph.

import { useMemo, useState } from 'react'
import type { MatchingHeadingsGroup } from '@/lib/ielts/types'
import { LetterMatchRow } from '@/components/ielts/primitives'
import { checkLetter } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

export interface ReadingMatchingHeadingsRunnerProps {
  group: MatchingHeadingsGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

export function ReadingMatchingHeadingsRunner({
  group,
  onScore,
  className,
}: ReadingMatchingHeadingsRunnerProps) {
  const { headings, items, instruction } = group

  const blank = useMemo<Record<number, string | null>>(
    () => Object.fromEntries(items.map((it) => [it.number, null])),
    [items],
  )
  const [answers, setAnswers] = useState<Record<number, string | null>>(blank)
  const [checked, setChecked] = useState(false)

  const setAnswer = (number: number, next: string) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  // All heading ids currently assigned to some row (for the one-to-one hint).
  const usedIds = useMemo(
    () => Object.values(answers).filter((v): v is string => v != null),
    [answers],
  )

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: items.length }
    const correct = items.reduce(
      (n, it) => (checkLetter(answers[it.number] ?? null, it.correct) ? n + 1 : n),
      0,
    )
    return { correct, total: items.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, answers, items])

  const hasAnyAnswer = items.some((it) => answers[it.number] != null)

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    const correct = items.reduce(
      (n, it) => (checkLetter(answers[it.number] ?? null, it.correct) ? n + 1 : n),
      0,
    )
    onScore?.(correct, items.length)
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
      {/* Heading bank — shows all headings incl. distractors that stay unused. */}
      <div className="rounded-card border border-hairline bg-[#f7f8fa] p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-2.5">
          List of headings
        </p>
        <ul className="flex flex-col gap-1.5">
          {headings.map((h) => (
            <li key={h.id} className="flex gap-2 text-[13px] text-ink-body">
              <span className="font-extrabold text-sky-text shrink-0 min-w-[1.75rem]">{h.id}</span>
              <span>{h.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* One dropdown row per paragraph. */}
      <div className="flex flex-col gap-4">
        {items.map((it) => (
          <LetterMatchRow
            key={it.number}
            number={it.number}
            prompt={`Paragraph ${it.paragraphLabel}`}
            options={headings}
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

export default ReadingMatchingHeadingsRunner
