'use client'

// IELTS Reading — TEACHER authoring editor: Matching features (Type 6).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingMatchingFeaturesRunner consumes (see
// components/ielts/runners/ReadingMatchingFeaturesRunner.tsx):
//   features[]: { id, text }                 (the lettered features bank)
//   items[]:    { number, text, correct }    (correct = a feature id)
//
// Features (people / things / dates / places) are REUSABLE: the same letter may
// answer many statements and some features may stay unused (spec §6: "You may
// use any letter more than once."). The bank is lettered A, B, C… and
// re-sequenced as features are added / removed so it always reads in order;
// each item's `correct` is kept valid against the bank.

import type { MatchingFeaturesGroup, LetteredOption } from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'

type Item = MatchingFeaturesGroup['items'][number]

export interface MatchingFeaturesGroupEditorProps {
  group: MatchingFeaturesGroup
  onChange: (group: MatchingFeaturesGroup) => void
}

/** Letters A, B, C … for feature ids, by position. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const letterAt = (i: number) => LETTERS[i] ?? `Z${i}`

/** Re-sequence feature ids to A, B, C in order, returning an id-remap. */
function resequence(features: LetteredOption[]): {
  features: LetteredOption[]
  remap: Record<string, string>
} {
  const remap: Record<string, string> = {}
  const next = features.map((f, i) => {
    const id = letterAt(i)
    remap[f.id] = id
    return { ...f, id }
  })
  return { features: next, remap }
}

export default function MatchingFeaturesGroupEditor({
  group,
  onChange,
}: MatchingFeaturesGroupEditorProps) {
  const { features, items } = group

  // ── Features bank ──
  const setFeatureText = (idx: number, text: string) => {
    const next = features.map((f, i) => (i === idx ? { ...f, text } : f))
    onChange({ ...group, features: next })
  }

  const addFeature = () => {
    const { features: resequenced } = resequence([
      ...features,
      { id: '', text: '' },
    ])
    onChange({ ...group, features: resequenced })
  }

  const removeFeature = (idx: number) => {
    const removedId = features[idx]?.id
    const { features: resequenced, remap } = resequence(
      features.filter((_, i) => i !== idx),
    )
    const validIds = new Set(resequenced.map((f) => f.id))
    const nextItems = items.map((it) => {
      if (it.correct === removedId) return { ...it, correct: '' }
      const mapped = remap[it.correct]
      return { ...it, correct: mapped && validIds.has(mapped) ? mapped : '' }
    })
    onChange({ ...group, features: resequenced, items: nextItems })
  }

  const moveFeature = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= features.length) return
    const swapped = [...features]
    ;[swapped[idx], swapped[target]] = [swapped[target], swapped[idx]]
    const { features: resequenced, remap } = resequence(swapped)
    const validIds = new Set(resequenced.map((f) => f.id))
    const nextItems = items.map((it) => {
      const mapped = remap[it.correct]
      return { ...it, correct: mapped && validIds.has(mapped) ? mapped : '' }
    })
    onChange({ ...group, features: resequenced, items: nextItems })
  }

  // ── Items (statements to attribute) ──
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
      {/* Features bank */}
      <div className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          List of features
        </span>
        {features.map((f, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="shrink-0 inline-flex items-center justify-center min-w-[2rem] h-7 px-1.5 text-[12px] font-extrabold rounded-tile bg-sky-wash text-sky-dark">
              {f.id}
            </span>
            <input
              type="text"
              value={f.text}
              placeholder="Feature (a person, thing, date or place)"
              onChange={(e) => setFeatureText(idx, e.target.value)}
              className="flex-1 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveFeature(idx, -1)}
              disabled={idx === 0}
              aria-label={`Move feature ${f.id} up`}
            >
              ↑
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => moveFeature(idx, 1)}
              disabled={idx === features.length - 1}
              aria-label={`Move feature ${f.id} down`}
            >
              ↓
            </Button>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeFeature(idx)}
              aria-label={`Delete feature ${f.id}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button variant="neutral" size="sm" onClick={addFeature}>
            + Add feature
          </Button>
        </div>
        <p className="text-[12px] text-ink-muted">
          Letters are reusable — a feature can answer several statements, and
          some features may never be used.
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
                placeholder="A statement to attribute to a feature"
                onChange={(e) => patchItem(idx, { text: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              />
            </label>
            <label className="block w-44">
              <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                Correct feature
              </span>
              <select
                value={it.correct}
                onChange={(e) => patchItem(idx, { correct: e.target.value })}
                className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
              >
                <option value="">— Select —</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id}
                    {f.text ? `. ${f.text}` : ''}
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
