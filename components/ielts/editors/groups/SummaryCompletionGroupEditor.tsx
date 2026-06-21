'use client'

// IELTS Reading — TEACHER authoring editor: Summary completion (Type 9).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingSummaryCompletionRunner consumes (see ReadingSummaryCompletionRunner.tsx):
//   variant: 'passage' | 'word_bank'
//   wordLimit?  (group default)
//   wordBank?: LetteredOption[]              (word_bank variant only)
//   segments[]: { type:'text', text }
//             | { type:'gap', number, acceptedAnswers?, wordLimit?, correctOptionId? }
//
// The teacher composes the summary as an ordered list of TEXT + GAP segments
// (add either kind, edit, reorder up/down, delete). A SegmentedControl toggles
// the variant:
//   • passage   — each gap edits acceptedAnswers (comma) + optional word limit,
//   • word_bank — edit the lettered word bank; each gap picks a correctOptionId.
// Gap numbers are re-sequenced (1, 2, 3 …) in document order on every change so
// the numbers always match what the runner renders.

import type {
  SummaryCompletionGroup,
  SummarySegment,
  LetteredOption,
} from '@/lib/ielts/types'
import { Button, SegmentedControl } from '@/components/student-ui'
import {
  answersToInput,
  inputToAnswers,
  parseWordLimit,
} from './_acceptedAnswers'

type GapSegment = Extract<SummarySegment, { type: 'gap' }>

export interface SummaryCompletionGroupEditorProps {
  group: SummaryCompletionGroup
  onChange: (group: SummaryCompletionGroup) => void
}

/** Lettered ids A, B, C … for the word bank, by position. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const letterAt = (i: number) => LETTERS[i] ?? `o${i + 1}`

/** Re-sequence gap numbers 1, 2, 3 … in document order, leaving text alone. */
function renumber(segments: SummarySegment[]): SummarySegment[] {
  let n = 0
  return segments.map((seg) =>
    seg.type === 'gap' ? { ...seg, number: ++n } : seg,
  )
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

export default function SummaryCompletionGroupEditor({
  group,
  onChange,
}: SummaryCompletionGroupEditorProps) {
  const { segments, variant } = group
  const isBank = variant === 'word_bank'
  const wordBank = group.wordBank ?? []

  const setSegments = (next: SummarySegment[]) =>
    onChange({ ...group, segments: renumber(next) })

  const patchSegment = (idx: number, seg: SummarySegment) =>
    setSegments(segments.map((s, i) => (i === idx ? seg : s)))

  const patchGap = (idx: number, p: Partial<GapSegment>) => {
    const seg = segments[idx]
    if (seg.type !== 'gap') return
    patchSegment(idx, { ...seg, ...p })
  }

  const addTextSegment = () =>
    setSegments([...segments, { type: 'text', text: '' }])

  const addGapSegment = () =>
    setSegments([
      ...segments,
      isBank
        ? { type: 'gap', number: 0, correctOptionId: '' }
        : { type: 'gap', number: 0, acceptedAnswers: [''] },
    ])

  const removeSegment = (idx: number) =>
    setSegments(segments.filter((_, i) => i !== idx))

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= segments.length) return
    const next = [...segments]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setSegments(next)
  }

  // ── Variant toggle: clear the now-irrelevant per-gap fields on switch ──
  const setVariant = (next: 'passage' | 'word_bank') => {
    if (next === variant) return
    const nextSegments = segments.map((seg) => {
      if (seg.type !== 'gap') return seg
      return next === 'word_bank'
        ? { type: 'gap' as const, number: seg.number, correctOptionId: '' }
        : { type: 'gap' as const, number: seg.number, acceptedAnswers: [''] }
    })
    onChange({
      ...group,
      variant: next,
      wordBank: next === 'word_bank' ? (group.wordBank ?? []) : undefined,
      segments: nextSegments,
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
    const nextSegments = segments.map((seg) => {
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
    })
    onChange({ ...group, wordBank: bank, segments: nextSegments })
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

      {/* Segment builder */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Summary text + gaps (in order)
        </span>
        {segments.length === 0 && (
          <p className="text-[13px] text-ink-muted">
            Add text and gap segments to compose the summary.
          </p>
        )}
        {segments.map((seg, idx) => {
          const isGap = seg.type === 'gap'
          return (
            <div
              key={idx}
              className="rounded-tile border border-hairline bg-surface p-3 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  {isGap ? `Gap (Q${seg.number})` : 'Text'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Move segment up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => move(idx, 1)}
                    disabled={idx === segments.length - 1}
                    aria-label="Move segment down"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="textLink"
                    size="sm"
                    onClick={() => removeSegment(idx)}
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
                  placeholder="Prose between the gaps"
                  onChange={(e) =>
                    patchSegment(idx, { type: 'text', text: e.target.value })
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
                      patchGap(idx, { correctOptionId: e.target.value })
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
                      patchGap(idx, {
                        acceptedAnswers: inputToAnswers(e.target.value),
                      })
                    }
                    className="flex-1 min-w-[12rem] text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                  />
                  <input
                    type="number"
                    min={1}
                    value={seg.wordLimit ?? ''}
                    placeholder="Limit"
                    aria-label="Word limit for this gap"
                    onChange={(e) =>
                      patchGap(idx, { wordLimit: parseWordLimit(e.target.value) })
                    }
                    className="w-24 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={addTextSegment}>
          + Add text
        </Button>
        <Button variant="secondary" size="sm" onClick={addGapSegment}>
          + Add gap
        </Button>
      </div>
    </div>
  )
}
