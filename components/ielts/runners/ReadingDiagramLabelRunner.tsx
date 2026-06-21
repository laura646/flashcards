'use client'

// IELTS Reading runner — Diagram-label completion, AUTHENTIC version (Type 13).
//
// ADDITIVE: not imported by any live file. Self-contained student runner.
// A teacher-uploaded diagram image with numbered blanks PINNED at points on the
// image; the student types the label at each point. Each pin's (x, y) are
// PERCENTAGES (0–100) of the image width/height, so the pins reposition
// responsively regardless of the rendered image size (spec §13). Session-only
// in-memory state; NO server calls, NO progress recording.
//
// Checking (spec §13): per-label acceptedAnswers match + word limit, via the
// shared matcher. Over the limit is WRONG even if the words are right;
// misspelling is WRONG. We reuse checkAccepted (correctness) + checkGap /
// gapFeedback (the precise "why" + expected reveal) from lib/ielts/wordLimit so
// the rules match every other completion type exactly.
//
// We DON'T reuse the GapField primitive for the pin input: GapField is laid out
// for inline-in-a-sentence use (wide block, word-limit hint stacked beneath),
// which is wrong for a compact marker floating over an image. The pin below is
// purpose-built (small white input, number badge, readable over any image) but
// uses the SAME matcher helpers, so correctness/feedback are identical.

import { useMemo, useState } from 'react'
import type { DiagramLabelCompletionGroup } from '@/lib/ielts/types'
import { checkAccepted, checkGap, gapFeedback, countWords } from '@/lib/ielts/wordLimit'
import { AnswerMark } from '@/components/student-ui/AnswerMark'
import { EmptyState } from '@/components/student-ui'
import { RunnerShell } from './RunnerShell'

export interface ReadingDiagramLabelRunnerProps {
  group: DiagramLabelCompletionGroup
  /** Fired on Check with the session score. */
  onScore?: (correct: number, total: number) => void
  className?: string
}

/** One label pinned to the image. Local alias for the per-label shape. */
type Label = DiagramLabelCompletionGroup['labels'][number]

/** Clamp a percentage into the visible 0–100 range (defensive against bad data). */
const clampPct = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0))

export function ReadingDiagramLabelRunner({
  group,
  onScore,
  className,
}: ReadingDiagramLabelRunnerProps) {
  const { imageUrl, labels, instruction, wordLimit: groupLimit } = group

  /** Labels rendered top-to-bottom in the list panel; stable order for keys. */
  const orderedLabels = useMemo<Label[]>(
    () => [...(labels ?? [])].sort((a, b) => a.number - b.number),
    [labels],
  )

  /** Effective word limit for a label: per-label overrides the group default. */
  const limitFor = (label: Label) => label.wordLimit ?? groupLimit

  const blank = useMemo<Record<number, string>>(
    () => Object.fromEntries(orderedLabels.map((l) => [l.number, ''])),
    [orderedLabels],
  )

  const [answers, setAnswers] = useState<Record<number, string>>(blank)
  const [checked, setChecked] = useState(false)
  const [focused, setFocused] = useState<number | null>(null)

  const setAnswer = (number: number, next: string) =>
    setAnswers((prev) => ({ ...prev, [number]: next }))

  const countCorrect = () =>
    orderedLabels.reduce(
      (n, l) =>
        checkAccepted(answers[l.number] ?? '', l.acceptedAnswers ?? [], limitFor(l))
          ? n + 1
          : n,
      0,
    )

  const score = useMemo(() => {
    if (!checked) return { correct: 0, total: orderedLabels.length }
    return { correct: countCorrect(), total: orderedLabels.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, answers, orderedLabels])

  const hasAnyAnswer = orderedLabels.some(
    (l) => (answers[l.number] ?? '').trim() !== '',
  )

  const handleCheck = () => {
    if (checked) return
    setChecked(true)
    setFocused(null)
    onScore?.(countCorrect(), orderedLabels.length)
  }

  const handleReset = () => {
    setAnswers(blank)
    setChecked(false)
    setFocused(null)
  }

  // ── Graceful empty states (no image / no labels) ──
  if (!imageUrl) {
    return (
      <section className={`font-rubik ${className ?? ''}`}>
        <EmptyState
          icon="🖼️"
          title="No diagram yet"
          hint="The teacher hasn't uploaded a diagram image for this question."
        />
      </section>
    )
  }
  if (orderedLabels.length === 0) {
    return (
      <section className={`font-rubik ${className ?? ''}`}>
        <EmptyState
          icon="📍"
          title="No labels yet"
          hint="This diagram has no numbered blanks to fill in."
        />
      </section>
    )
  }

  // ── One pinned input over the image ──
  const renderPin = (label: Label) => {
    const value = answers[label.number] ?? ''
    const limit = limitFor(label)
    const words = countWords(value)
    const over = limit != null && words > limit
    const result = checked ? checkGap(value, label.acceptedAnswers ?? [], limit) : null

    const inputTone = !checked
      ? over
        ? 'border-incorrect-border text-incorrect-fg focus:border-incorrect-fg'
        : focused === label.number
          ? 'border-sky text-ink-black'
          : 'border-[#e3e5e9] text-ink-black focus:border-sky'
      : result?.correct
        ? 'border-correct-border bg-correct-bg text-correct-fg'
        : 'border-incorrect-border bg-incorrect-bg text-incorrect-fg'

    const badgeTone = checked
      ? result?.correct
        ? 'bg-correct-fg text-white'
        : 'bg-incorrect-fg text-white'
      : 'bg-sky text-white'

    return (
      <div
        key={`pin-${label.number}`}
        className="absolute z-10"
        style={{
          left: `${clampPct(label.x)}%`,
          top: `${clampPct(label.y)}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="inline-flex items-center gap-1 rounded-tile bg-white border-[1.5px] border-[#e3e5e9] shadow-[0_2px_8px_rgba(15,22,40,0.18)] px-1.5 py-1">
            <span
              aria-hidden="true"
              className={`inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full text-[11px] font-extrabold ${badgeTone}`}
            >
              {label.number}
            </span>
            <input
              type="text"
              inputMode="text"
              aria-label={`Diagram label ${label.number}`}
              disabled={checked}
              value={value}
              onChange={(e) => setAnswer(label.number, e.target.value)}
              onFocus={() => setFocused(label.number)}
              onBlur={() => setFocused((f) => (f === label.number ? null : f))}
              placeholder="…"
              className={`w-[112px] rounded-[6px] border-[1.5px] bg-white px-2 py-1 text-[13px] font-semibold placeholder:text-[#b6bac2] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 transition-colors ${inputTone}`}
            />
          </div>

          {/* Live word-limit hint (pre-check), readable on its own white chip. */}
          {limit != null && !checked && (
            <span
              className={`rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm ${
                over ? 'text-incorrect-fg' : 'text-ink-muted'
              }`}
            >
              {over ? `Over ${limit}-word limit (${words})` : `Max ${limit} word${limit === 1 ? '' : 's'}`}
            </span>
          )}

          {/* Review mark + expected-answer reveal on wrong ones. */}
          {checked && result && (
            <span className="rounded-full bg-white/95 px-1.5 py-0.5 shadow-sm">
              <AnswerMark
                correct={result.correct}
                detail={result.correct ? undefined : gapFeedback(result, limit)}
              />
            </span>
          )}
        </div>
      </div>
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
      {/* Responsive image + absolutely-positioned pins. The container is the
          positioning context; pins use %-based left/top so they track the image
          at any rendered width. */}
      <div className="relative w-full overflow-hidden rounded-card border border-hairline bg-[#f7f8fa]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Diagram to label"
          className="block w-full h-auto select-none"
          draggable={false}
        />
        {orderedLabels.map(renderPin)}
      </div>
    </RunnerShell>
  )
}

export default ReadingDiagramLabelRunner
