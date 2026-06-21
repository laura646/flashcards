'use client'

// IELTS Reading — TEACHER authoring editor: TRUE / FALSE / NOT GIVEN (Type 2).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingTfngRunner consumes (see ReadingTfngRunner.tsx):
//   statements[]: { number, text, correct: 'TRUE' | 'FALSE' | 'NOT GIVEN' }
//
// The correct-value picker uses the same three labels the runner shows.

import type { TfngGroup, TfngValue } from '@/lib/ielts/types'
import { Button, SegmentedControl } from '@/components/student-ui'

type TfngStatement = TfngGroup['statements'][number]

export interface TfngGroupEditorProps {
  group: TfngGroup
  onChange: (group: TfngGroup) => void
}

const VALUES: TfngValue[] = ['TRUE', 'FALSE', 'NOT GIVEN']

export default function TfngGroupEditor({ group, onChange }: TfngGroupEditorProps) {
  const statements = group.statements

  const patch = (idx: number, p: Partial<TfngStatement>) => {
    const next = statements.map((s, i) => (i === idx ? { ...s, ...p } : s))
    onChange({ ...group, statements: next })
  }

  const add = () => {
    const nextNumber =
      statements.reduce((max, s) => Math.max(max, s.number), 0) + 1
    const blank: TfngStatement = { number: nextNumber, text: '', correct: 'TRUE' }
    onChange({ ...group, statements: [...statements, blank] })
  }

  const remove = (idx: number) => {
    onChange({ ...group, statements: statements.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex flex-col gap-3">
      {statements.map((s, idx) => (
        <div
          key={idx}
          className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
              Statement {s.number}
            </span>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => remove(idx)}
              aria-label={`Delete statement ${s.number}`}
            >
              Delete
            </Button>
          </div>

          <textarea
            value={s.text}
            placeholder="A statement about a fact in the passage…"
            rows={2}
            onChange={(e) => patch(idx, { text: e.target.value })}
            className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2.5 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky resize-y"
          />

          <div>
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Correct answer
            </span>
            <SegmentedControl
              segments={VALUES.map((v) => ({ value: v, label: v }))}
              value={s.correct}
              onChange={(next) => patch(idx, { correct: next as TfngValue })}
            />
          </div>
        </div>
      ))}

      <div>
        <Button variant="secondary" size="sm" onClick={add}>
          + Add statement
        </Button>
      </div>
    </div>
  )
}
