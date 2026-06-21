'use client'

// IELTS Reading — TEACHER authoring editor: Sentence completion (Type 8).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingSentenceCompletionRunner consumes (see ReadingSentenceCompletionRunner.tsx):
//   wordLimit?  (group default)
//   items[]: { number, before, after?, acceptedAnswers[], wordLimit? }
//
// The runner renders `before  [gap]  after`, so the teacher edits the text on
// each side of the gap, the accepted answers (comma-separated), and an optional
// per-item word limit that overrides the group default.

import type { SentenceCompletionGroup } from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'
import {
  answersToInput,
  inputToAnswers,
  parseWordLimit,
} from './_acceptedAnswers'

type Item = SentenceCompletionGroup['items'][number]

export interface SentenceCompletionGroupEditorProps {
  group: SentenceCompletionGroup
  onChange: (group: SentenceCompletionGroup) => void
}

export default function SentenceCompletionGroupEditor({
  group,
  onChange,
}: SentenceCompletionGroupEditorProps) {
  const items = group.items

  const patchItem = (idx: number, p: Partial<Item>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...p } : it))
    onChange({ ...group, items: next })
  }

  const addItem = () => {
    const nextNumber = items.reduce((max, it) => Math.max(max, it.number), 0) + 1
    const blank: Item = {
      number: nextNumber,
      before: '',
      after: '',
      acceptedAnswers: [''],
    }
    onChange({ ...group, items: [...items, blank] })
  }

  const removeItem = (idx: number) => {
    onChange({ ...group, items: items.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Group-level word limit */}
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

      {items.map((it, idx) => (
        <div
          key={idx}
          className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
              Sentence {it.number}
            </span>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeItem(idx)}
              aria-label={`Delete sentence ${it.number}`}
            >
              Delete
            </Button>
          </div>

          <label className="block">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Text before the gap
            </span>
            <input
              type="text"
              value={it.before}
              placeholder="The city traps heat, producing the urban"
              onChange={(e) => patchItem(idx, { before: e.target.value })}
              className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Text after the gap (optional)
            </span>
            <input
              type="text"
              value={it.after ?? ''}
              placeholder="effect."
              onChange={(e) => patchItem(idx, { after: e.target.value })}
              className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Accepted answers (comma-separated)
            </span>
            <input
              type="text"
              value={answersToInput(it.acceptedAnswers)}
              placeholder="heat island, heat-island"
              onChange={(e) =>
                patchItem(idx, { acceptedAnswers: inputToAnswers(e.target.value) })
              }
              className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
          </label>

          <label className="block w-44">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Word limit (this gap)
            </span>
            <input
              type="number"
              min={1}
              value={it.wordLimit ?? ''}
              placeholder="(uses group)"
              onChange={(e) =>
                patchItem(idx, { wordLimit: parseWordLimit(e.target.value) })
              }
              className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
          </label>
        </div>
      ))}

      <div>
        <Button variant="secondary" size="sm" onClick={addItem}>
          + Add sentence
        </Button>
      </div>
    </div>
  )
}
