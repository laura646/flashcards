'use client'

// IELTS Reading — TEACHER authoring editor: Matching headings (Type 5).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingMatchingHeadingsRunner consumes (see ReadingMatchingHeadingsRunner.tsx):
//   headings[]: { id, text }            (the lettered heading bank; roman numerals)
//   items[]:    { number, paragraphLabel, correct }   (correct = a heading id)
//
// Headings are conventionally lettered with roman numerals (i, ii, iii…). Ids
// are re-sequenced as headings are added / removed so the bank always reads
// i, ii, iii in order; each item's `correct` is kept valid against the bank.

import type { MatchingHeadingsGroup, LetteredOption } from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'

type Item = MatchingHeadingsGroup['items'][number]

export interface MatchingHeadingsGroupEditorProps {
  group: MatchingHeadingsGroup
  onChange: (group: MatchingHeadingsGroup) => void
}

/** Lower-case roman numerals i, ii, iii … for heading ids, by position. */
const ROMAN = [
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
]
const romanAt = (i: number) => ROMAN[i] ?? `h${i + 1}`

/** Re-sequence heading ids to i, ii, iii in order, returning an id-remap. */
function resequence(headings: LetteredOption[]): {
  headings: LetteredOption[]
  remap: Record<string, string>
} {
  const remap: Record<string, string> = {}
  const next = headings.map((h, i) => {
    const id = romanAt(i)
    remap[h.id] = id
    return { ...h, id }
  })
  return { headings: next, remap }
}

export default function MatchingHeadingsGroupEditor({
  group,
  onChange,
}: MatchingHeadingsGroupEditorProps) {
  const { headings, items } = group

  // ── Headings bank ──
  const setHeadingText = (idx: number, text: string) => {
    const next = headings.map((h, i) => (i === idx ? { ...h, text } : h))
    onChange({ ...group, headings: next })
  }

  const addHeading = () => {
    const next = [...headings, { id: '', text: '' }]
    const { headings: resequenced } = resequence(next)
    onChange({ ...group, headings: resequenced })
  }

  const removeHeading = (idx: number) => {
    const removedId = headings[idx]?.id
    const { headings: resequenced, remap } = resequence(
      headings.filter((_, i) => i !== idx),
    )
    // Remap each item's correct id; clear it if it pointed at the removed heading.
    const validIds = new Set(resequenced.map((h) => h.id))
    const nextItems = items.map((it) => {
      if (it.correct === removedId) return { ...it, correct: '' }
      const mapped = remap[it.correct]
      return { ...it, correct: mapped && validIds.has(mapped) ? mapped : '' }
    })
    onChange({ ...group, headings: resequenced, items: nextItems })
  }

  // ── Items (paragraphs to match) ──
  const patchItem = (idx: number, p: Partial<Item>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...p } : it))
    onChange({ ...group, items: next })
  }

  const addItem = () => {
    const nextNumber = items.reduce((max, it) => Math.max(max, it.number), 0) + 1
    const blank: Item = { number: nextNumber, paragraphLabel: '', correct: '' }
    onChange({ ...group, items: [...items, blank] })
  }

  const removeItem = (idx: number) => {
    onChange({ ...group, items: items.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Heading bank */}
      <div className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          List of headings
        </span>
        {headings.map((h, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="shrink-0 inline-flex items-center justify-center min-w-[2rem] h-7 px-1.5 text-[12px] font-extrabold rounded-tile bg-sky-wash text-sky-dark">
              {h.id}
            </span>
            <input
              type="text"
              value={h.text}
              placeholder="Heading text"
              onChange={(e) => setHeadingText(idx, e.target.value)}
              className="flex-1 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeHeading(idx)}
              aria-label={`Delete heading ${h.id}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button variant="neutral" size="sm" onClick={addHeading}>
            + Add heading
          </Button>
        </div>
        <p className="text-[12px] text-ink-muted">
          Include more headings than paragraphs — the extras are distractors.
        </p>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Paragraphs to match
        </span>
        {items.map((it, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-end gap-2 rounded-tile border border-hairline bg-white p-3"
          >
            <label className="block w-40">
              <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                Paragraph (Q{it.number})
              </span>
              <input
                type="text"
                value={it.paragraphLabel}
                placeholder="A"
                onChange={(e) => patchItem(idx, { paragraphLabel: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              />
            </label>
            <label className="block flex-1 min-w-[10rem]">
              <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                Correct heading
              </span>
              <select
                value={it.correct}
                onChange={(e) => patchItem(idx, { correct: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              >
                <option value="">— Select —</option>
                {headings.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.id}. {h.text || '(untitled)'}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeItem(idx)}
              aria-label={`Delete paragraph item ${it.number}`}
            >
              Delete
            </Button>
          </div>
        ))}
        <div>
          <Button variant="secondary" size="sm" onClick={addItem}>
            + Add paragraph
          </Button>
        </div>
      </div>
    </div>
  )
}
