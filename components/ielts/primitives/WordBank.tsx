'use client'

// IELTS primitive — WordBank (selectable chips for the word-list variant of
// summary / flow-chart completion).
//
// ADDITIVE: not imported by any live file. Controlled. Presentational only —
// it does NOT own which chip fills which gap; the parent runner tracks
// gap→chip assignment and passes `usedIds` so used chips render muted/marked.
// Clicking a chip emits onSelect(id); the parent decides what to do with it
// (e.g. drop into the focused gap). There is no per-gap review here — the
// GapField / selector at each gap shows correct/incorrect; the bank only marks
// which chips are spent.

import type { LetteredOption } from '@/lib/ielts/types'

export interface WordBankProps {
  /** The provided words (lettered), more words than gaps. */
  options: LetteredOption[]
  /** Ids already placed into a gap — rendered muted + struck, not clickable. */
  usedIds?: string[]
  /** Fired when an available chip is chosen. */
  onSelect: (id: string) => void
  /** When true (review), the whole bank is inert. */
  checked?: boolean
  /** Optional heading shown above the chips. */
  title?: string
  className?: string
}

export function WordBank({
  options,
  usedIds = [],
  onSelect,
  checked = false,
  title = 'Word list',
  className = '',
}: WordBankProps) {
  return (
    <div
      className={`rounded-card border border-sky-border bg-sky-wash p-3.5 ${className}`}
      role="group"
      aria-label={title}
    >
      {title && (
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky-text mb-2.5">
          {title}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const used = usedIds.includes(opt.id)
          const disabled = used || checked
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              aria-pressed={used}
              onClick={() => onSelect(opt.id)}
              className={`rounded-tile border-[1.5px] px-3 py-1.5 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${
                used
                  ? 'border-hairline bg-white/60 text-ink-muted line-through cursor-not-allowed'
                  : checked
                    ? 'border-hairline bg-white text-ink-muted cursor-default'
                    : 'border-sky-border bg-white text-ink-black hover:border-sky cursor-pointer'
              }`}
            >
              <span className="font-extrabold mr-1 text-sky-text">{opt.id}</span>
              {opt.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default WordBank
