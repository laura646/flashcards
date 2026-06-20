'use client'

// IELTS primitive — RadioGroupQuestion (single- or multi-select MCQ).
//
// ADDITIVE: not imported by any live file. Controlled: parent owns the value.
// 10B styling (sky tokens). Review mode (`checked`) colours correct=green /
// incorrect=red and reveals the right answer(s) accessibly via <AnswerMark>.
//
// Single-select: value is the chosen option id (or null). selectCount = 1.
// Multi-select ("Choose TWO letters"): value is an array of ids; up to
// selectCount may be picked (extra clicks are ignored once the cap is hit, so
// the learner must deselect first).

import type { LetteredOption } from '@/lib/ielts/types'
import { AnswerMark } from '@/components/student-ui/AnswerMark'

export interface RadioGroupQuestionProps {
  /** Question number badge. */
  number: number
  stem: string
  options: LetteredOption[]
  /** How many to choose. 1 = radio, >1 = checkbox set. Default 1. */
  selectCount?: number
  /** Controlled value: a single id, or an array of ids for multi-select. */
  value: string | string[] | null
  onChange: (next: string | string[]) => void
  /** Review state. When set, the group is locked and shows correct/incorrect. */
  checked?: boolean
  /** Correct option id(s) — required to render review colours. */
  correct?: string[]
  className?: string
}

export function RadioGroupQuestion({
  number,
  stem,
  options,
  selectCount = 1,
  value,
  onChange,
  checked = false,
  correct = [],
  className = '',
}: RadioGroupQuestionProps) {
  const multi = selectCount > 1
  const selected: string[] = Array.isArray(value) ? value : value ? [value] : []
  const isSel = (id: string) => selected.includes(id)
  const isCorrect = (id: string) => correct.includes(id)

  const toggle = (id: string) => {
    if (checked) return
    if (!multi) {
      onChange(id)
      return
    }
    if (isSel(id)) {
      onChange(selected.filter((x) => x !== id))
    } else if (selected.length < selectCount) {
      onChange([...selected, id])
    }
  }

  const optionState = (id: string) => {
    if (!checked) {
      return isSel(id)
        ? 'border-sky bg-sky-wash text-ink-black'
        : 'border-[#e3e5e9] bg-white text-ink-body hover:border-sky'
    }
    if (isSel(id) && isCorrect(id)) return 'border-correct-border bg-correct-bg text-correct-fg'
    if (isSel(id) && !isCorrect(id)) return 'border-incorrect-border bg-incorrect-bg text-incorrect-fg'
    if (isCorrect(id)) return 'border-correct-border bg-correct-bg/60 text-correct-fg'
    return 'border-hairline bg-white text-ink-muted opacity-60'
  }

  const allRight =
    selected.length === correct.length && selected.every((id) => isCorrect(id))

  return (
    <fieldset className={`${className}`}>
      <legend className="flex gap-2 text-[15px] font-bold text-ink-black mb-2.5">
        <span className="text-sky-text shrink-0">{number}.</span>
        <span>{stem}</span>
      </legend>
      {multi && !checked && (
        <p className="text-[12px] text-ink-muted mb-2">Choose {selectCount}.</p>
      )}
      <div className="flex flex-col gap-2" role={multi ? 'group' : 'radiogroup'}>
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-start gap-2.5 rounded-tile border-[1.5px] px-3.5 py-2.5 text-[14px] font-medium transition-colors ${
              checked ? 'cursor-default' : 'cursor-pointer'
            } ${optionState(opt.id)}`}
          >
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={`q-${number}`}
              checked={isSel(opt.id)}
              disabled={checked}
              onChange={() => toggle(opt.id)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-sky focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
            />
            <span>
              <span className="font-extrabold mr-1.5">{opt.id}</span>
              {opt.text}
            </span>
          </label>
        ))}
      </div>
      {checked && (
        <div className="mt-2">
          <AnswerMark
            correct={allRight}
            detail={
              allRight
                ? undefined
                : `Correct: ${correct.join(', ') || '—'}`
            }
          />
        </div>
      )}
    </fieldset>
  )
}

export default RadioGroupQuestion
