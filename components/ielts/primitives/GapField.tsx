'use client'

// IELTS primitive — GapField (inline text input for gap-fill / short-answer).
//
// ADDITIVE: not imported by any live file. Controlled. Renders inline so it
// reads as part of a sentence/note. Shows a live word-limit hint, and in review
// mode (`checked`) colours correct=green / incorrect=red and reveals the
// expected answer via <AnswerMark> + checkGap() (over-limit vs. wrong vs. blank).

import { useId } from 'react'
import { checkGap, gapFeedback, countWords } from '@/lib/ielts/wordLimit'
import { AnswerMark } from '@/components/student-ui/AnswerMark'

export interface GapFieldProps {
  number: number
  /** Controlled text value. */
  value: string
  onChange: (next: string) => void
  /** Accepted answer variants — drives review correctness + the expected hint. */
  acceptedAnswers: string[]
  /** Max words ("NO MORE THAN N WORDS"). Enforced in review + shown as a hint. */
  wordLimit?: number
  /** Review state — locks the input and shows correct/incorrect. */
  checked?: boolean
  /** Accessible label (e.g. the sentence text). Falls back to "Gap N". */
  ariaLabel?: string
  /** Optional placeholder. */
  placeholder?: string
  className?: string
}

export function GapField({
  number,
  value,
  onChange,
  acceptedAnswers,
  wordLimit,
  checked = false,
  ariaLabel,
  placeholder = '…',
  className = '',
}: GapFieldProps) {
  const hintId = useId()
  const result = checked ? checkGap(value, acceptedAnswers, wordLimit) : null
  const words = countWords(value)
  const over = wordLimit != null && words > wordLimit

  const tone = !checked
    ? over
      ? 'border-incorrect-border text-incorrect-fg focus:border-incorrect-fg'
      : 'border-[#e3e5e9] focus:border-sky text-ink-black'
    : result?.correct
      ? 'border-correct-border bg-correct-bg text-correct-fg'
      : 'border-incorrect-border bg-incorrect-bg text-incorrect-fg'

  return (
    <span className={`inline-flex flex-col align-baseline ${className}`}>
      <span className="inline-flex items-baseline gap-1.5">
        <span aria-hidden="true" className="text-sky-text font-bold text-[13px]">
          {number}
        </span>
        <input
          type="text"
          inputMode="text"
          aria-label={ariaLabel ?? `Gap ${number}`}
          aria-describedby={wordLimit != null ? hintId : undefined}
          disabled={checked}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`inline-block min-w-[120px] w-[160px] rounded-tile border-[1.5px] bg-white px-2.5 py-1.5 text-[14px] font-semibold placeholder:text-[#b6bac2] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 transition-colors ${tone}`}
        />
      </span>
      {wordLimit != null && !checked && (
        <span
          id={hintId}
          className={`text-[11px] mt-1 ${over ? 'text-incorrect-fg font-semibold' : 'text-ink-muted'}`}
        >
          {over
            ? `Over the ${wordLimit}-word limit (${words})`
            : `Max ${wordLimit} word${wordLimit === 1 ? '' : 's'}`}
        </span>
      )}
      {checked && result && (
        <span className="mt-1">
          <AnswerMark
            correct={result.correct}
            detail={result.correct ? undefined : gapFeedback(result, wordLimit)}
          />
        </span>
      )}
    </span>
  )
}

export default GapField
