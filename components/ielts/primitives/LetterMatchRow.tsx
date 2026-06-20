'use client'

// IELTS primitive — LetterMatchRow (one row: prompt + a dropdown of letters).
//
// ADDITIVE: not imported by any live file. Controlled. Used by matching-headings
// (and, later, matching-info / matching-features / sentence-endings). A native
// <select> of letter options per item — computer-delivered IELTS style.
//
// `allowReuse` only affects an optional caller-side "used" hint; the dropdown
// always lists every option (matching types like features/info allow reuse,
// headings do not — the caller decides whether to grey used options via the
// `usedIds` prop, which is purely a visual hint and never disables).

import type { LetteredOption } from '@/lib/ielts/types'
import { AnswerMark } from '@/components/student-ui/AnswerMark'

export interface LetterMatchRowProps {
  number: number
  /** The statement / paragraph reference shown on the left. */
  prompt: string
  /** Full option bank (headings, features, endings…). */
  options: LetteredOption[]
  /** Controlled selected option id, or null. */
  value: string | null
  onChange: (next: string) => void
  /** When true, options used elsewhere are shown greyed (hint only). */
  allowReuse?: boolean
  /** Ids already used by OTHER rows — for the greyed "used" hint. */
  usedIds?: string[]
  /** Review state — locks the select and shows correct/incorrect. */
  checked?: boolean
  /** Correct option id. Required for review colours. */
  correct?: string
  className?: string
}

export function LetterMatchRow({
  number,
  prompt,
  options,
  value,
  onChange,
  allowReuse = false,
  usedIds = [],
  checked = false,
  correct,
  className = '',
}: LetterMatchRowProps) {
  const isRight = value != null && value === correct

  const selectTone = !checked
    ? 'border-[1.5px] border-[#e3e5e9] focus:border-sky text-ink-body'
    : isRight
      ? 'border-[1.5px] border-correct-border bg-correct-bg text-correct-fg'
      : 'border-[1.5px] border-incorrect-border bg-incorrect-bg text-incorrect-fg'

  const optionLabel = (opt: LetteredOption) => {
    const text = opt.text ? `${opt.id}. ${opt.text}` : opt.id
    const usedHint = !allowReuse && usedIds.includes(opt.id) && opt.id !== value
    return usedHint ? `${text} (used)` : text
  }

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <span className="text-sky-text font-bold text-[15px] shrink-0 pt-1.5">{number}.</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-ink-black mb-1.5">{prompt}</p>
        <select
          aria-label={`Answer for ${number}`}
          disabled={checked}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full max-w-[260px] rounded-tile bg-white px-3 py-2 text-[14px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 transition-colors ${selectTone} ${
            checked ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          <option value="" disabled>
            Select…
          </option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {optionLabel(opt)}
            </option>
          ))}
        </select>
        {checked && (
          <div className="mt-1.5">
            <AnswerMark correct={isRight} detail={isRight ? undefined : `Correct: ${correct ?? '—'}`} />
          </div>
        )}
      </div>
    </div>
  )
}

export default LetterMatchRow
