'use client'

// IELTS Reading runner — Table completion (Type 11).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// A grid (rows × cols) where some cells are gaps (typed in) and the rest are
// read-only labels. An optional `header` row renders as bold column headings
// (spec §11: "show a real table; empty cells outlined as input boxes, pre-filled
// cells in plain text"). Session-only in-memory state; NO server calls, NO
// progress recording.
//
// Checking (spec §11): per-gap acceptedAnswers match + word limit. Over the
// limit is WRONG even if the words are right; misspelling is WRONG. Delegated
// to checkAccepted (correctness) / GapField (review reveal).

import { useMemo, useState } from 'react'
import type { TableCompletionGroup, TableCell } from '@/lib/ielts/types'
import { GapField } from '@/components/ielts/primitives'
import { checkAccepted } from '@/lib/ielts/wordLimit'
import { RunnerShell } from './RunnerShell'

export interface ReadingTableCompletionRunnerProps {
  group: TableCompletionGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

/** Narrow a cell to a gap cell. */
type GapCell = Extract<TableCell, { type: 'gap' }>
const isGap = (c: TableCell): c is GapCell => c.type === 'gap'

export function ReadingTableCompletionRunner({
  group,
  onScore,
  className,
}: ReadingTableCompletionRunnerProps) {
  const { rows, header, instruction, wordLimit: groupLimit } = group

  /** Every gap cell across the table, for scoring + blank-state construction. */
  const gaps = useMemo<GapCell[]>(
    () => rows.flatMap((row) => row.filter(isGap)),
    [rows],
  )

  /** Effective word limit for a gap: per-gap overrides the group default. */
  const limitFor = (gap: GapCell) => gap.wordLimit ?? groupLimit

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
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-collapse text-[14px] text-ink-black">
          {header && header.length > 0 && (
            <thead>
              <tr>
                {header.map((h, i) => (
                  <th
                    key={`h-${i}`}
                    scope="col"
                    className="border border-hairline bg-[#f7f8fa] px-3 py-2 text-left text-[13px] font-extrabold text-ink-black"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={`r-${ri}`}>
                {row.map((cell, ci) =>
                  cell.type === 'gap' ? (
                    <td
                      key={`c-${ri}-${ci}`}
                      className="border border-hairline px-3 py-2 align-top"
                    >
                      <GapField
                        number={cell.number}
                        value={answers[cell.number] ?? ''}
                        onChange={(next) => setAnswer(cell.number, next)}
                        acceptedAnswers={cell.acceptedAnswers}
                        wordLimit={limitFor(cell)}
                        checked={checked}
                        ariaLabel={`Table gap ${cell.number}`}
                      />
                    </td>
                  ) : (
                    <td
                      key={`c-${ri}-${ci}`}
                      className="border border-hairline px-3 py-2 align-top leading-relaxed"
                    >
                      {cell.text}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RunnerShell>
  )
}

export default ReadingTableCompletionRunner
