'use client'

// IELTS Reading — TEACHER authoring editor: Matching information (Type 4).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingMatchingInformationRunner consumes (see
// components/ielts/runners/ReadingMatchingInformationRunner.tsx):
//   options[]: { id, text }                  (the reusable paragraph-letter bank)
//   items[]:   { number, text, correct }     (correct = an option id)
//
// Paragraph letters are REUSABLE: multiple statements may map to the same letter
// and some letters may stay unused (spec §4: "Allow reuse"). The bank is lettered
// A, B, C… and re-sequenced as options are added / removed so it always reads in
// order; each item's `correct` is kept valid against the bank.

import type { MatchingInformationGroup, LetteredOption } from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'

type Item = MatchingInformationGroup['items'][number]

export interface MatchingInformationGroupEditorProps {
  group: MatchingInformationGroup
  onChange: (group: MatchingInformationGroup) => void
}

/** Letters A, B, C … for option ids, by position. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const letterAt = (i: number) => LETTERS[i] ?? `Z${i}`

/** Re-sequence option ids to A, B, C in order, returning an id-remap. */
function resequence(options: LetteredOption[]): {
  options: LetteredOption[]
  remap: Record<string, string>
} {
  const remap: Record<string, string> = {}
  const next = options.map((o, i) => {
    const id = letterAt(i)
    remap[o.id] = id
    return { ...o, id }
  })
  return { options: next, remap }
}

export default function MatchingInformationGroupEditor({
  group,
  onChange,
}: MatchingInformationGroupEditorProps) {
  const { options, items } = group

  // ── Paragraph-letter bank ──
  const setOptionText = (idx: number, text: string) => {
    const next = options.map((o, i) => (i === idx ? { ...o, text } : o))
    onChange({ ...group, options: next })
  }

  const addOption = () => {
    const { options: resequenced } = resequence([
      ...options,
      { id: '', text: '' },
    ])
    onChange({ ...group, options: resequenced })
  }

  const removeOption = (idx: number) => {
    const removedId = options[idx]?.id
    const { options: resequenced, remap } = resequence(
      options.filter((_, i) => i !== idx),
    )
    const validIds = new Set(resequenced.map((o) => o.id))
    const nextItems = items.map((it) => {
      if (it.correct === removedId) return { ...it, correct: '' }
      const mapped = remap[it.correct]
      return { ...it, correct: mapped && validIds.has(mapped) ? mapped : '' }
    })
    onChange({ ...group, options: resequenced, items: nextItems })
  }

  const moveOption = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= options.length) return
    const swapped = [...options]
    ;[swapped[idx], swapped[target]] = [swapped[target], swapped[idx]]
    const { options: resequenced, remap } = resequence(swapped)
    const validIds = new Set(resequenced.map((o) => o.id))
    const nextItems = items.map((it) => {
      const mapped = remap[it.correct]
      return { ...it, correct: mapped && validIds.has(mapped) ? mapped : '' }
    })
    onChange({ ...group, options: resequenced, items: nextItems })
  }

  // ── Items (statements to locate) ──
  const patchItem = (idx: number, p: Partial<Item>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...p } : it))
    onChange({ ...group, items: next })
  }

  const addItem = () => {
    const nextNumber = items.reduce((max, it) => Math.max(max, it.number), 0) + 1
    const blank: Item = { number: nextNumber, text: '', correct: '' }
    onChange({ ...group, items: [...items, blank] })
  }

  const removeItem = (idx: number) => {
    onChange({ ...group, items: items.filter((_, i) => i !== idx) })
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange({ ...group, items: next })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Paragraph-letter bank */}
      <div className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          List of paragraphs
        </span>
        {options.map((o, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="shrink-0 inline-flex items-center justify-center min-w-[2rem] h-7 px-1.5 text-[12px] font-extrabold rounded-tile bg-sky-wash text-sky-dark">
              {o.id}
            </span>
            <input
              type="text"
              value={o.text}
              placeholder="Paragraph label / summary (optional)"
              onChange={(e) => setOptionText(idx, e.target.value)}
              className="flex-1 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveOption(idx, -1)}
              disabled={idx === 0}
              aria-label={`Move paragraph ${o.id} up`}
            >
              ↑
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveOption(idx, 1)}
              disabled={idx === options.length - 1}
              aria-label={`Move paragraph ${o.id} down`}
            >
              ↓
            </Button>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeOption(idx)}
              aria-label={`Delete paragraph ${o.id}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button variant="neutral" size="sm" onClick={addOption}>
            + Add paragraph
          </Button>
        </div>
        <p className="text-[12px] text-ink-muted">
          Letters are reusable — several statements can share one paragraph, and
          some paragraphs may never be used.
        </p>
      </div>

      {/* Items (statements) */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Statements to match
        </span>
        {items.map((it, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-end gap-2 rounded-tile border border-hairline bg-white p-3"
          >
            <label className="block flex-1 min-w-[14rem]">
              <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                Statement (Q{it.number})
              </span>
              <input
                type="text"
                value={it.text}
                placeholder="A statement found in one of the paragraphs"
                onChange={(e) => patchItem(idx, { text: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              />
            </label>
            <label className="block w-44">
              <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                Correct paragraph
              </span>
              <select
                value={it.correct}
                onChange={(e) => patchItem(idx, { correct: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              >
                <option value="">— Select —</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}
                    {o.text ? `. ${o.text}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveItem(idx, -1)}
              disabled={idx === 0}
              aria-label={`Move statement ${it.number} up`}
            >
              ↑
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveItem(idx, 1)}
              disabled={idx === items.length - 1}
              aria-label={`Move statement ${it.number} down`}
            >
              ↓
            </Button>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeItem(idx)}
              aria-label={`Delete statement ${it.number}`}
            >
              Delete
            </Button>
          </div>
        ))}
        <div>
          <Button variant="secondary" size="sm" onClick={addItem}>
            + Add statement
          </Button>
        </div>
      </div>
    </div>
  )
}
