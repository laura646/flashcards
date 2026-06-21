'use client'

// IELTS Reading — TEACHER authoring editor: Flow-chart completion (Type 12).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingFlowChartCompletionRunner consumes (see ReadingFlowChartCompletionRunner.tsx):
//   variant: 'passage' | 'word_bank'
//   wordLimit?  (group default)
//   wordBank?: LetteredOption[]              (word_bank variant only)
//   steps[]: { segments: FlowChartSegment[] }
//   FlowChartSegment = { type:'text', text }
//                    | { type:'gap', number, acceptedAnswers?, wordLimit?, correctOptionId? }
//
// The teacher builds an ordered list of step boxes (add/reorder/delete). Each
// step is composed of TEXT + GAP segments (the same segment builder as summary
// completion). A SegmentedControl toggles the variant:
//   • passage   — each gap edits acceptedAnswers (comma) + optional word limit,
//   • word_bank — edit the lettered word bank; each gap picks a correctOptionId.
// Gap numbers are re-sequenced (1, 2, 3 …) in document order — step by step,
// segment by segment — on every change, matching the order the runner flattens
// gaps for scoring.

import type {
  FlowChartCompletionGroup,
  FlowChartStep,
  FlowChartSegment,
  LetteredOption,
} from '@/lib/ielts/types'
import { Button, SegmentedControl } from '@/components/student-ui'
import {
  answersToInput,
  inputToAnswers,
  parseWordLimit,
} from './_acceptedAnswers'

type GapSegment = Extract<FlowChartSegment, { type: 'gap' }>

export interface FlowChartCompletionGroupEditorProps {
  group: FlowChartCompletionGroup
  onChange: (group: FlowChartCompletionGroup) => void
}

/** Lettered ids A, B, C … for the word bank, by position. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const letterAt = (i: number) => LETTERS[i] ?? `o${i + 1}`

/** Re-sequence gap numbers 1, 2, 3 … in document order across all steps. */
function renumber(steps: FlowChartStep[]): FlowChartStep[] {
  let n = 0
  return steps.map((step) => ({
    segments: step.segments.map((seg) =>
      seg.type === 'gap' ? { ...seg, number: ++n } : seg,
    ),
  }))
}

/** Re-sequence word-bank ids to A, B, C … in order, returning an id-remap. */
function resequenceBank(bank: LetteredOption[]): {
  bank: LetteredOption[]
  remap: Record<string, string>
} {
  const remap: Record<string, string> = {}
  const next = bank.map((o, i) => {
    const id = letterAt(i)
    remap[o.id] = id
    return { ...o, id }
  })
  return { bank: next, remap }
}

export default function FlowChartCompletionGroupEditor({
  group,
  onChange,
}: FlowChartCompletionGroupEditorProps) {
  const { steps, variant } = group
  const isBank = variant === 'word_bank'
  const wordBank = group.wordBank ?? []

  const setSteps = (next: FlowChartStep[]) =>
    onChange({ ...group, steps: renumber(next) })

  const setStepSegments = (si: number, segments: FlowChartSegment[]) =>
    setSteps(steps.map((s, i) => (i === si ? { segments } : s)))

  const patchSegment = (si: number, gi: number, seg: FlowChartSegment) =>
    setStepSegments(
      si,
      steps[si].segments.map((s, i) => (i === gi ? seg : s)),
    )

  const patchGap = (si: number, gi: number, p: Partial<GapSegment>) => {
    const seg = steps[si]?.segments[gi]
    if (!seg || seg.type !== 'gap') return
    patchSegment(si, gi, { ...seg, ...p })
  }

  // ── Steps ──
  const addStep = () => setSteps([...steps, { segments: [] }])

  const removeStep = (si: number) =>
    setSteps(steps.filter((_, i) => i !== si))

  const moveStep = (si: number, dir: -1 | 1) => {
    const target = si + dir
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[si], next[target]] = [next[target], next[si]]
    setSteps(next)
  }

  // ── Segments within a step ──
  const addTextSegment = (si: number) =>
    setStepSegments(si, [...steps[si].segments, { type: 'text', text: '' }])

  const addGapSegment = (si: number) =>
    setStepSegments(si, [
      ...steps[si].segments,
      isBank
        ? { type: 'gap', number: 0, correctOptionId: '' }
        : { type: 'gap', number: 0, acceptedAnswers: [''] },
    ])

  const removeSegment = (si: number, gi: number) =>
    setStepSegments(
      si,
      steps[si].segments.filter((_, i) => i !== gi),
    )

  const moveSegment = (si: number, gi: number, dir: -1 | 1) => {
    const segs = steps[si].segments
    const target = gi + dir
    if (target < 0 || target >= segs.length) return
    const next = [...segs]
    ;[next[gi], next[target]] = [next[target], next[gi]]
    setStepSegments(si, next)
  }

  // ── Variant toggle: clear the now-irrelevant per-gap fields on switch ──
  const setVariant = (next: 'passage' | 'word_bank') => {
    if (next === variant) return
    const nextSteps = steps.map((step) => ({
      segments: step.segments.map((seg) => {
        if (seg.type !== 'gap') return seg
        return next === 'word_bank'
          ? { type: 'gap' as const, number: seg.number, correctOptionId: '' }
          : { type: 'gap' as const, number: seg.number, acceptedAnswers: [''] }
      }),
    }))
    onChange({
      ...group,
      variant: next,
      wordBank: next === 'word_bank' ? (group.wordBank ?? []) : undefined,
      steps: nextSteps,
    })
  }

  // ── Word bank (word_bank variant) ──
  const setBankText = (idx: number, text: string) => {
    const next = wordBank.map((o, i) => (i === idx ? { ...o, text } : o))
    onChange({ ...group, wordBank: next })
  }

  const addBankOption = () => {
    const { bank } = resequenceBank([...wordBank, { id: '', text: '' }])
    onChange({ ...group, wordBank: bank })
  }

  const removeBankOption = (idx: number) => {
    const removedId = wordBank[idx]?.id
    const { bank, remap } = resequenceBank(wordBank.filter((_, i) => i !== idx))
    const validIds = new Set(bank.map((o) => o.id))
    const nextSteps = steps.map((step) => ({
      segments: step.segments.map((seg) => {
        if (seg.type !== 'gap') return seg
        if (seg.correctOptionId === removedId)
          return { ...seg, correctOptionId: '' }
        const mapped = seg.correctOptionId
          ? remap[seg.correctOptionId]
          : undefined
        return {
          ...seg,
          correctOptionId: mapped && validIds.has(mapped) ? mapped : '',
        }
      }),
    }))
    onChange({ ...group, wordBank: bank, steps: nextSteps })
  }

  // ── Render the segment editor for one step ──
  const renderSegments = (si: number) => {
    const segments = steps[si].segments
    return (
      <div className="flex flex-col gap-2">
        {segments.length === 0 && (
          <p className="text-[13px] text-ink-muted">
            Add text and gap segments to compose this step.
          </p>
        )}
        {segments.map((seg, gi) => {
          const isGap = seg.type === 'gap'
          return (
            <div
              key={gi}
              className="rounded-tile border border-hairline bg-white p-2.5 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  {isGap ? `Gap (Q${seg.number})` : 'Text'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => moveSegment(si, gi, -1)}
                    disabled={gi === 0}
                    aria-label="Move segment up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => moveSegment(si, gi, 1)}
                    disabled={gi === segments.length - 1}
                    aria-label="Move segment down"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="textLink"
                    size="sm"
                    onClick={() => removeSegment(si, gi)}
                    aria-label="Delete segment"
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {seg.type === 'text' ? (
                <input
                  type="text"
                  value={seg.text}
                  placeholder="Prose in this step"
                  onChange={(e) =>
                    patchSegment(si, gi, { type: 'text', text: e.target.value })
                  }
                  className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                />
              ) : isBank ? (
                <label className="block">
                  <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                    Correct word
                  </span>
                  <select
                    value={seg.correctOptionId ?? ''}
                    onChange={(e) =>
                      patchGap(si, gi, { correctOptionId: e.target.value })
                    }
                    className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                  >
                    <option value="">— Select —</option>
                    {wordBank.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id}. {o.text || '(untitled)'}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={answersToInput(seg.acceptedAnswers ?? [])}
                    placeholder="Accepted answers (comma-separated)"
                    onChange={(e) =>
                      patchGap(si, gi, {
                        acceptedAnswers: inputToAnswers(e.target.value),
                      })
                    }
                    className="flex-1 min-w-[10rem] text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                  />
                  <input
                    type="number"
                    min={1}
                    value={seg.wordLimit ?? ''}
                    placeholder="Limit"
                    aria-label="Word limit for this gap"
                    onChange={(e) =>
                      patchGap(si, gi, {
                        wordLimit: parseWordLimit(e.target.value),
                      })
                    }
                    className="w-24 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                  />
                </div>
              )}
            </div>
          )
        })}
        <div className="flex gap-2">
          <Button variant="neutral" size="sm" onClick={() => addTextSegment(si)}>
            + Add text
          </Button>
          <Button variant="neutral" size="sm" onClick={() => addGapSegment(si)}>
            + Add gap
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Variant + group word limit */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
            Answer source
          </span>
          <SegmentedControl<'passage' | 'word_bank'>
            segments={[
              { value: 'passage', label: 'From passage' },
              { value: 'word_bank', label: 'Word bank' },
            ]}
            value={variant}
            onChange={setVariant}
          />
        </div>
        {!isBank && (
          <label className="block w-44">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Word limit (all gaps)
            </span>
            <input
              type="number"
              min={1}
              value={group.wordLimit ?? ''}
              placeholder="e.g. 2"
              onChange={(e) =>
                onChange({ ...group, wordLimit: parseWordLimit(e.target.value) })
              }
              className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
          </label>
        )}
      </div>

      {/* Word bank (word_bank variant only) */}
      {isBank && (
        <div className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
            Word list
          </span>
          {wordBank.map((o, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="shrink-0 inline-flex items-center justify-center min-w-[2rem] h-7 px-1.5 text-[12px] font-extrabold rounded-tile bg-sky-wash text-sky-dark">
                {o.id}
              </span>
              <input
                type="text"
                value={o.text}
                placeholder="Word or phrase"
                onChange={(e) => setBankText(idx, e.target.value)}
                className="flex-1 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              />
              <Button
                variant="textLink"
                size="sm"
                onClick={() => removeBankOption(idx)}
                aria-label={`Remove word ${o.id}`}
              >
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button variant="neutral" size="sm" onClick={addBankOption}>
              + Add word
            </Button>
          </div>
          <p className="text-[12px] text-ink-muted">
            Include more words than gaps — the extras are distractors.
          </p>
        </div>
      )}

      {/* Steps */}
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Flow-chart steps (top to bottom)
        </span>
        {steps.length === 0 && (
          <p className="text-[13px] text-ink-muted">
            Add step boxes to build the flow chart.
          </p>
        )}
        {steps.map((_, si) => (
          <div
            key={si}
            className="rounded-tile border border-hairline bg-surface p-3 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                Step {si + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={() => moveStep(si, -1)}
                  disabled={si === 0}
                  aria-label="Move step up"
                >
                  ↑
                </Button>
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={() => moveStep(si, 1)}
                  disabled={si === steps.length - 1}
                  aria-label="Move step down"
                >
                  ↓
                </Button>
                <Button
                  variant="textLink"
                  size="sm"
                  onClick={() => removeStep(si)}
                  aria-label={`Delete step ${si + 1}`}
                >
                  Delete step
                </Button>
              </div>
            </div>
            {renderSegments(si)}
          </div>
        ))}
        <div>
          <Button variant="secondary" size="sm" onClick={addStep}>
            + Add step
          </Button>
        </div>
      </div>
    </div>
  )
}
