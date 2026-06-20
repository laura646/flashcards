'use client'

// IELTS primitive — ThreeValueControl (TRUE/FALSE/NOT GIVEN or YES/NO/NOT GIVEN).
//
// ADDITIVE: not imported by any live file. Controlled. Three configurable
// labels (the type passes its own set). Renders as a compact three-button group
// (computer-delivered IELTS style). Review mode colours the picked + correct
// buttons and announces via <AnswerMark>.

import { AnswerMark } from '@/components/student-ui/AnswerMark'

export interface ThreeValueControlProps {
  number: number
  statement: string
  /** The three allowed values in display order. */
  labels: [string, string, string]
  /** Controlled selected value (one of `labels`) or null. */
  value: string | null
  onChange: (next: string) => void
  /** Review state — locks the control and shows correct/incorrect. */
  checked?: boolean
  /** The correct value (one of `labels`). Required for review colours. */
  correct?: string
  className?: string
}

export function ThreeValueControl({
  number,
  statement,
  labels,
  value,
  onChange,
  checked = false,
  correct,
  className = '',
}: ThreeValueControlProps) {
  const isRight = value != null && value === correct

  const btnState = (label: string) => {
    const selected = value === label
    if (!checked) {
      return selected
        ? 'border-sky bg-sky-wash text-ink-black'
        : 'border-[#e3e5e9] bg-white text-ink-body hover:border-sky'
    }
    if (selected && label === correct) return 'border-correct-border bg-correct-bg text-correct-fg'
    if (selected && label !== correct) return 'border-incorrect-border bg-incorrect-bg text-incorrect-fg'
    if (label === correct) return 'border-correct-border bg-correct-bg/60 text-correct-fg'
    return 'border-hairline bg-white text-ink-muted opacity-60'
  }

  return (
    <div className={`${className}`}>
      <div className="flex gap-2 text-[15px] font-bold text-ink-black mb-2.5">
        <span className="text-sky-text shrink-0">{number}.</span>
        <span>{statement}</span>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Statement ${number}`}>
        {labels.map((label) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={value === label}
            disabled={checked}
            onClick={() => onChange(label)}
            className={`rounded-tile border-[1.5px] px-3.5 py-2 text-[12px] font-extrabold uppercase tracking-[0.04em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${
              checked ? 'cursor-default' : 'cursor-pointer'
            } ${btnState(label)}`}
          >
            {label}
          </button>
        ))}
      </div>
      {checked && (
        <div className="mt-2">
          <AnswerMark correct={isRight} detail={isRight ? undefined : `Correct: ${correct ?? '—'}`} />
        </div>
      )}
    </div>
  )
}

export default ThreeValueControl
