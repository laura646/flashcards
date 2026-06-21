'use client'

// IELTS Reading — TEACHER authoring editor: Note completion (Type 10).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingNoteCompletionRunner consumes (see ReadingNoteCompletionRunner.tsx):
//   wordLimit?  (group default)
//   title?      (note-block title)
//   lines[]: either a heading line { heading } OR a gapped line
//            { gap: { number, before, after?, acceptedAnswers[], wordLimit? } }
//
// The teacher builds the note block line by line, choosing heading vs gap,
// editing each, reordering up/down and deleting. Gap numbers are assigned from
// the running max so each gap keeps a stable question number.

import type { NoteCompletionGroup } from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'
import {
  answersToInput,
  inputToAnswers,
  parseWordLimit,
} from './_acceptedAnswers'

type Line = NoteCompletionGroup['lines'][number]
type Gap = NonNullable<Line['gap']>

export interface NoteCompletionGroupEditorProps {
  group: NoteCompletionGroup
  onChange: (group: NoteCompletionGroup) => void
}

export default function NoteCompletionGroupEditor({
  group,
  onChange,
}: NoteCompletionGroupEditorProps) {
  const lines = group.lines

  const setLines = (next: Line[]) => onChange({ ...group, lines: next })

  const patchLine = (idx: number, line: Line) => {
    setLines(lines.map((ln, i) => (i === idx ? line : ln)))
  }

  const patchGap = (idx: number, p: Partial<Gap>) => {
    const ln = lines[idx]
    if (!ln.gap) return
    patchLine(idx, { gap: { ...ln.gap, ...p } })
  }

  const nextGapNumber = () =>
    lines.reduce((max, ln) => (ln.gap ? Math.max(max, ln.gap.number) : max), 0) + 1

  const addHeadingLine = () => setLines([...lines, { heading: '' }])

  const addGapLine = () =>
    setLines([
      ...lines,
      {
        gap: {
          number: nextGapNumber(),
          before: '',
          after: '',
          acceptedAnswers: [''],
        },
      },
    ])

  const removeLine = (idx: number) =>
    setLines(lines.filter((_, i) => i !== idx))

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= lines.length) return
    const next = [...lines]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setLines(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Group-level fields */}
      <div className="flex flex-wrap gap-3">
        <label className="block flex-1 min-w-[12rem]">
          <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
            Note title (optional)
          </span>
          <input
            type="text"
            value={group.title ?? ''}
            placeholder="Why cities suit wild bees"
            onChange={(e) => onChange({ ...group, title: e.target.value })}
            className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
          />
        </label>
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
      </div>

      {/* Lines */}
      <div className="flex flex-col gap-2">
        {lines.map((ln, idx) => {
          const isGap = !!ln.gap
          return (
            <div
              key={idx}
              className="rounded-tile border border-hairline bg-surface p-3 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  {isGap ? `Gap line (Q${ln.gap!.number})` : 'Heading line'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Move line up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="neutral"
                    size="sm"
                    onClick={() => move(idx, 1)}
                    disabled={idx === lines.length - 1}
                    aria-label="Move line down"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="textLink"
                    size="sm"
                    onClick={() => removeLine(idx)}
                    aria-label="Delete line"
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {isGap ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={ln.gap!.before}
                      placeholder="Text before the gap"
                      onChange={(e) => patchGap(idx, { before: e.target.value })}
                      className="flex-1 min-w-[10rem] text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                    />
                    <input
                      type="text"
                      value={ln.gap!.after ?? ''}
                      placeholder="Text after (optional)"
                      onChange={(e) => patchGap(idx, { after: e.target.value })}
                      className="flex-1 min-w-[10rem] text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={answersToInput(ln.gap!.acceptedAnswers)}
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
                      value={ln.gap!.wordLimit ?? ''}
                      placeholder="Limit"
                      aria-label="Word limit for this gap"
                      onChange={(e) =>
                        patchGap(idx, { wordLimit: parseWordLimit(e.target.value) })
                      }
                      className="w-24 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                    />
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  value={ln.heading ?? ''}
                  placeholder="Sub-heading (no gap)"
                  onChange={(e) => patchLine(idx, { heading: e.target.value })}
                  className="w-full text-[14px] font-extrabold text-ink-black bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={addHeadingLine}>
          + Add heading line
        </Button>
        <Button variant="secondary" size="sm" onClick={addGapLine}>
          + Add gap line
        </Button>
      </div>
    </div>
  )
}
