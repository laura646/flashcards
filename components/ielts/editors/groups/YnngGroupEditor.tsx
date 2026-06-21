'use client'

// IELTS Reading — TEACHER authoring editor: YES / NO / NOT GIVEN (Type 3).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingYnngRunner consumes (see ReadingYnngRunner.tsx):
//   statements[]: { number, text, correct: 'YES' | 'NO' | 'NOT GIVEN' }
//
// Mechanically identical to the T/F/NG editor with the YES/NO/NOT GIVEN value
// set (kept a separate file so each Reading type maps to its own editor).

import type { YnngGroup, YnngValue } from '@/lib/ielts/types'
import { Button, SegmentedControl } from '@/components/student-ui'

type YnngStatement = YnngGroup['statements'][number]

export interface YnngGroupEditorProps {
  group: YnngGroup
  onChange: (group: YnngGroup) => void
}

const VALUES: YnngValue[] = ['YES', 'NO', 'NOT GIVEN']

export default function YnngGroupEditor({ group, onChange }: YnngGroupEditorProps) {
  const statements = group.statements

  const patch = (idx: number, p: Partial<YnngStatement>) => {
    const next = statements.map((s, i) => (i === idx ? { ...s, ...p } : s))
    onChange({ ...group, statements: next })
  }

  const add = () => {
    const nextNumber =
      statements.reduce((max, s) => Math.max(max, s.number), 0) + 1
    const blank: YnngStatement = { number: nextNumber, text: '', correct: 'YES' }
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
            placeholder="A claim or opinion attributed to the writer…"
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
              onChange={(next) => patch(idx, { correct: next as YnngValue })}
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
