'use client'

// IELTS Reading runner — Summary completion (Type 9).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// A paragraph-length summary rendered as inline prose with gaps. Two variants
// (spec §9), both handled here:
//   • 'passage'   — type words from the passage into each gap (GapField + word
//                   limit; misspelling / over-limit = wrong).
//   • 'word_bank' — choose from a provided box of words (more words than gaps).
//                   WordBank is presentational, so THIS runner owns the
//                   gap→chip assignment and passes usedIds / per-gap review.
// Session-only in-memory state; NO server calls, NO progress recording.
//
// Checking (spec §9): 'passage' → checkAccepted per gap; 'word_bank' →
// checkLetter(assignedOptionId, gap.correctOptionId).

import { useMemo, useState } from 'react'
import type { SummaryCompletionGroup, SummarySegment } from '@/lib/ielts/types'
import { GapField, WordBank } from '@/components/ielts/primitives'
import { checkAccepted, checkLetter } from '@/lib/ielts/wordLimit'
import { AnswerMark } from '@/components/student-ui/AnswerMark'
import { RunnerShell } from './RunnerShell'

export interface ReadingSummaryCompletionRunnerProps {
  group: SummaryCompletionGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

/** Narrow a segment to a gap segment. */
type GapSegment = Extract<SummarySegment, { type: 'gap' }>
const isGap = (s: SummarySegment): s is GapSegment => s.type === 'gap'

export function ReadingSummaryCompletionRunner({
  group,
  onScore,
  className,
}: ReadingSummaryCompletionRunnerProps) {
  const { segments, instruction, variant, wordBank, wordLimit: groupLimit } = group
  const isBank = variant === 'word_bank'

  const gaps = useMemo<GapSegment[]>(() => segments.filter(isGap), [segments])

  /** Effective word limit for a gap (passage variant only). */
  const limitFor = (gap: GapSegment) => gap.wordLimit ?? groupLimit

  // ── State: passage variant types into gaps; word-bank variant assigns chips ──
  const blankTyped = useMemo<Record<number, string>>(
    () => Object.fromEntries(gaps.map((g) => [g.number, ''])),
    [gaps],
  )
  const blankAssigned = useMemo<Record<number, string | null>>(
    () => Object.fromEntries(gaps.map((g) => [g.number, null])),
    [gaps],
  )

  const [typed, setTyped] = useState<Record<number, string>>(blankTyped)
  const [assigned, setAssigned] = useState<Record<number, string | null>>(blankAssigned)
  const [focusedGap, setFocusedGap] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)

  // ── Word-bank assignment (runner owns gap→chip; WordBank is presentational) ──
  const usedIds = useMemo(
    () => Object.values(assigned).filter((v): v is string => v != null),
    [assigned],
  )

  /** Place a chip into the focused gap (or the first empty gap as a fallback). */
  const placeChip = (optionId: string) => {
    if (checked) return
    const targetGap =
      focusedGap ?? gaps.find((g) => assigned[g.number] == null)?.number ?? null
    if (targetGap == null) return
    setAssigned((prev) => {
      // If this chip already sits in another gap, vacate that one first (each
      // word from the bank is used at most once).
      const next: Record<number, string | null> = { ...prev }
      for (const key of Object.keys(next)) {
        if (next[Number(key)] === optionId) next[Number(key)] = null
      }
      next[targetGap] = optionId
      return next
    })
    setFocusedGap(null)
  }

  /** Clear a word-bank gap (returns its chip to the bank). */
  const clearGap = (number: number) => {
    if (checked) return
    setAssigned((prev) => ({ ...prev, [number]: null }))
    setFocusedGap(number)
  }

  const setTypedAnswer = (number: number, next: string) =>
    setTyped((prev) => ({ ...prev, [number]: next }))

  // ── Scoring ──
  const isGapCorrect = (gap: GapSegment): boolean => {
    if (isBank) {
      return checkLetter(assigned[gap.number] ?? null, gap.correctOptionId ?? '')
    }
    return checkAccepted(typed[gap.number] ?? '', gap.acceptedAnswers ?? [], limitFor(gap))
  }

  const countCorrect = () => gaps.reduce((n, g) => (isGapCorrect(g) ? n + 1 : n), 0)

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: gaps.length }
    return { correct: countCorrect(), total: gaps.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, typed, assigned, gaps])

  const hasAnyAnswer = isBank
    ? usedIds.length > 0
    : gaps.some((g) => (typed[g.number] ?? '').trim() !== '')

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    setFocusedGap(null)
    onScore?.(countCorrect(), gaps.length)
  }

  const handleReset = () => {
    setTyped(blankTyped)
    setAssigned(blankAssigned)
    setFocusedGap(null)
    setChecked(false)
  }

  /** The label shown inside a word-bank slot for an assigned option. */
  const optionLabel = (optionId: string): string => {
    const opt = wordBank?.find((o) => o.id === optionId)
    return opt ? `${opt.id} — ${opt.text}` : optionId
  }

  // ── Render one word-bank gap slot (clickable; review-coloured) ──
  const renderBankSlot = (gap: GapSegment) => {
    const value = assigned[gap.number] ?? null
    const correct = checked ? isGapCorrect(gap) : null
    const focused = focusedGap === gap.number

    const tone = !checked
      ? focused
        ? 'border-sky bg-sky-wash text-sky-text'
        : value
          ? 'border-sky-border bg-white text-ink-black hover:border-sky'
          : 'border-[#e3e5e9] bg-white text-ink-muted hover:border-sky'
      : correct
        ? 'border-correct-border bg-correct-bg text-correct-fg'
        : 'border-incorrect-border bg-incorrect-bg text-incorrect-fg'

    const correctLabel =
      gap.correctOptionId != null ? optionLabel(gap.correctOptionId) : undefined

    return (
      <span key={`gap-${gap.number}`} className="inline-flex flex-col align-baseline">
        <button
          type="button"
          disabled={checked}
          onClick={() => (value ? clearGap(gap.number) : setFocusedGap(gap.number))}
          aria-label={`Gap ${gap.number}${value ? `, filled with ${optionLabel(value)}` : ', empty'}`}
          className={`inline-flex items-baseline gap-1.5 rounded-tile border-[1.5px] px-2.5 py-1.5 text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${tone}`}
        >
          <span aria-hidden="true" className="text-sky-text font-bold text-[13px]">
            {gap.number}
          </span>
          <span>{value ? optionLabel(value) : 'tap to fill'}</span>
        </button>
        {checked && correct === false && (
          <span className="mt-1">
            <AnswerMark
              correct={false}
              detail={correctLabel ? `Expected: ${correctLabel}` : 'Incorrect'}
            />
          </span>
        )}
        {checked && correct === true && (
          <span className="mt-1">
            <AnswerMark correct />
          </span>
        )}
      </span>
    )
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
      {/* Word bank (word-list variant only), shown above the summary prose. */}
      {isBank && wordBank && wordBank.length > 0 && (
        <WordBank
          options={wordBank}
          usedIds={usedIds}
          onSelect={placeChip}
          checked={checked}
          title="Word list"
        />
      )}

      {/* The summary as inline prose with gaps interleaved in order. */}
      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-3 text-[15px] leading-loose text-ink-black">
        {segments.map((seg, i) =>
          seg.type === 'text' ? (
            <span key={`t-${i}`}>{seg.text}</span>
          ) : isBank ? (
            renderBankSlot(seg)
          ) : (
            <GapField
              key={`g-${seg.number}`}
              number={seg.number}
              value={typed[seg.number] ?? ''}
              onChange={(next) => setTypedAnswer(seg.number, next)}
              acceptedAnswers={seg.acceptedAnswers ?? []}
              wordLimit={limitFor(seg)}
              checked={checked}
              ariaLabel={`Summary gap ${seg.number}`}
            />
          ),
        )}
      </p>
    </RunnerShell>
  )
}

export default ReadingSummaryCompletionRunner
