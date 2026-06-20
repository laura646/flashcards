'use client'

// IELTS runner shell — shared Check / Reset / score footer for every runner.
//
// ADDITIVE: not imported by any live file. Internal helper for the runner
// components in this dir so the Check/Reset/score row + the grey instruction
// line look identical across types. Session-only: no server calls.
//
// The runner owns its answer state and passes:
//   • instruction  — the grey rule line shown above the questions,
//   • checked      — whether Check has been pressed (locks the questions),
//   • score        — { correct, total } shown after Check,
//   • onCheck      — locks answers + computes score,
//   • onReset      — clears answers + unlocks,
//   • canCheck     — disables Check until at least one answer exists.

import type { ReactNode } from 'react'
import { Button } from '@/components/student-ui'

export interface RunnerShellProps {
  /** The grey instruction line for this question set (spec convention). */
  instruction: string
  /** The numbered questions / controls. */
  children: ReactNode
  /** Review state — Check pressed, answers locked. */
  checked: boolean
  /** Score shown after Check. */
  score: { correct: number; total: number }
  onCheck: () => void
  onReset: () => void
  /** Disable Check until there is something to check. */
  canCheck?: boolean
  className?: string
}

export function RunnerShell({
  instruction,
  children,
  checked,
  score,
  onCheck,
  onReset,
  canCheck = true,
  className = '',
}: RunnerShellProps) {
  const pct = score.total > 0 ? score.correct / score.total : 0
  const scoreTone =
    pct === 1
      ? 'bg-correct-bg text-correct-fg border-correct-border'
      : pct === 0
        ? 'bg-incorrect-bg text-incorrect-fg border-incorrect-border'
        : 'bg-sky-wash text-sky-text border-sky-border'

  return (
    <section className={`font-rubik ${className}`}>
      {/* Grey instruction line */}
      <p className="text-[13px] leading-relaxed text-ink-muted bg-[#f7f8fa] border border-hairline rounded-tile px-3.5 py-2.5 mb-4">
        {instruction}
      </p>

      <div className="flex flex-col gap-5">{children}</div>

      {/* Check / Reset / score footer */}
      <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-hairline">
        {!checked ? (
          <Button variant="primary" size="md" onClick={onCheck} disabled={!canCheck}>
            Check answers
          </Button>
        ) : (
          <Button variant="secondary" size="md" onClick={onReset}>
            Try again
          </Button>
        )}
        {checked && (
          <span
            role="status"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-extrabold ${scoreTone}`}
          >
            <span className="sr-only">You scored </span>
            {score.correct} / {score.total}
          </span>
        )}
      </div>
    </section>
  )
}

export default RunnerShell
