'use client'

// IELTS Reading — TEACHER authoring editor: Matching sentence endings (Type 7).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingMatchingSentenceEndingsRunner consumes (see
// components/ielts/runners/ReadingMatchingSentenceEndingsRunner.tsx):
//   endings[]: { id, text }                   (the lettered endings bank)
//   items[]:   { number, beginning, correct } (NOTE: `beginning`, not `text`)
//
// One-to-one match (like matching headings): each ending is used at most once,
// and there are MORE endings than beginnings so the extras are distractors —
// the author is encouraged to add some. The bank is lettered A, B, C… and
// re-sequenced as endings are added / removed so it always reads in order; each
// item's `correct` is kept valid against the bank.

import type {
  MatchingSentenceEndingsGroup,
  LetteredOption,
} from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'

type Item = MatchingSentenceEndingsGroup['items'][number]

export interface MatchingSentenceEndingsGroupEditorProps {
  group: MatchingSentenceEndingsGroup
  onChange: (group: MatchingSentenceEndingsGroup) => void
}

/** Letters A, B, C … for ending ids, by position. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const letterAt = (i: number) => LETTERS[i] ?? `Z${i}`

/** Re-sequence ending ids to A, B, C in order, returning an id-remap. */
function resequence(endings: LetteredOption[]): {
  endings: LetteredOption[]
  remap: Record<string, string>
} {
  const remap: Record<string, string> = {}
  const next = endings.map((e, i) => {
    const id = letterAt(i)
    remap[e.id] = id
    return { ...e, id }
  })
  return { endings: next, remap }
}

export default function MatchingSentenceEndingsGroupEditor({
  group,
  onChange,
}: MatchingSentenceEndingsGroupEditorProps) {
  const { endings, items } = group

  // ── Endings bank ──
  const setEndingText = (idx: number, text: string) => {
    const next = endings.map((e, i) => (i === idx ? { ...e, text } : e))
    onChange({ ...group, endings: next })
  }

  const addEnding = () => {
    const { endings: resequenced } = resequence([
      ...endings,
      { id: '', text: '' },
    ])
    onChange({ ...group, endings: resequenced })
  }

  const removeEnding = (idx: number) => {
    const removedId = endings[idx]?.id
    const { endings: resequenced, remap } = resequence(
      endings.filter((_, i) => i !== idx),
    )
    const validIds = new Set(resequenced.map((e) => e.id))
    const nextItems = items.map((it) => {
      if (it.correct === removedId) return { ...it, correct: '' }
      const mapped = remap[it.correct]
      return { ...it, correct: mapped && validIds.has(mapped) ? mapped : '' }
    })
    onChange({ ...group, endings: resequenced, items: nextItems })
  }

  const moveEnding = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= endings.length) return
    const swapped = [...endings]
    ;[swapped[idx], swapped[target]] = [swapped[target], swapped[idx]]
    const { endings: resequenced, remap } = resequence(swapped)
    const validIds = new Set(resequenced.map((e) => e.id))
    const nextItems = items.map((it) => {
      const mapped = remap[it.correct]
      return { ...it, correct: mapped && validIds.has(mapped) ? mapped : '' }
    })
    onChange({ ...group, endings: resequenced, items: nextItems })
  }

  // ── Items (sentence beginnings) ──
  const patchItem = (idx: number, p: Partial<Item>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...p } : it))
    onChange({ ...group, items: next })
  }

  const addItem = () => {
    const nextNumber = items.reduce((max, it) => Math.max(max, it.number), 0) + 1
    const blank: Item = { number: nextNumber, beginning: '', correct: '' }
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
      {/* Endings bank */}
      <div className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          List of endings
        </span>
        {endings.map((e, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="shrink-0 inline-flex items-center justify-center min-w-[2rem] h-7 px-1.5 text-[12px] font-extrabold rounded-tile bg-sky-wash text-sky-dark">
              {e.id}
            </span>
            <input
              type="text"
              value={e.text}
              placeholder="Sentence ending"
              onChange={(ev) => setEndingText(idx, ev.target.value)}
              className="flex-1 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveEnding(idx, -1)}
              disabled={idx === 0}
              aria-label={`Move ending ${e.id} up`}
            >
              ↑
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveEnding(idx, 1)}
              disabled={idx === endings.length - 1}
              aria-label={`Move ending ${e.id} down`}
            >
              ↓
            </Button>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeEnding(idx)}
              aria-label={`Delete ending ${e.id}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button variant="neutral" size="sm" onClick={addEnding}>
            + Add ending
          </Button>
        </div>
        <p className="text-[12px] text-ink-muted">
          Include more endings than beginnings — each ending is used at most once,
          and the extras are distractors.
        </p>
      </div>

      {/* Items (sentence beginnings) */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Sentence beginnings
        </span>
        {items.map((it, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-end gap-2 rounded-tile border border-hairline bg-white p-3"
          >
            <label className="block flex-1 min-w-[14rem]">
              <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                Beginning (Q{it.number})
              </span>
              <input
                type="text"
                value={it.beginning}
                placeholder="The first half of the sentence…"
                onChange={(e) => patchItem(idx, { beginning: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              />
            </label>
            <label className="block w-44">
              <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                Correct ending
              </span>
              <select
                value={it.correct}
                onChange={(e) => patchItem(idx, { correct: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              >
                <option value="">— Select —</option>
                {endings.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id}
                    {e.text ? `. ${e.text}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveItem(idx, -1)}
              disabled={idx === 0}
              aria-label={`Move beginning ${it.number} up`}
            >
              ↑
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveItem(idx, 1)}
              disabled={idx === items.length - 1}
              aria-label={`Move beginning ${it.number} down`}
            >
              ↓
            </Button>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeItem(idx)}
              aria-label={`Delete beginning ${it.number}`}
            >
              Delete
            </Button>
          </div>
        ))}
        <div>
          <Button variant="secondary" size="sm" onClick={addItem}>
            + Add beginning
          </Button>
        </div>
      </div>
    </div>
  )
}
