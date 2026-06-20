'use client'

// 10B redesign — standalone MULTIPLE-CHOICE question editor (Phase 3).
//
// One reusable, controlled editor for the "classic" MCQ-shaped exercise
// question list. Extracted VERBATIM (behaviour-wise) from the legacy editor
// app/admin/lessons/page.tsx 2922-3028 — the inline question cards rendered
// for multiple_choice / fill_blank style exercises, including the
// per-question "Multiple correct" toggle (legacy toggleMultiMode 2931-2956).
//
// This component is fully controlled: it receives the complete questions
// array and, on every edit, calls onChange with a brand-new full array. It
// never mutates in place and never touches the editor store directly — the
// parent (the exercise editor shell) wires onChange to the hook.
//
// Chrome (the question Card, the prompt / hint / explanation fields, the
// "+ Add Question" footer) uses the 10B kit (@/components/student-ui) +
// tokens. The answer options themselves are delegated to the shared
// <McqOptionsList> VERBATIM — its own look is preserved.

import { Card, Button } from '@/components/student-ui'
import McqOptionsList from '@/components/McqOptionsList'
import type { ExerciseQuestion } from '@/lib/lesson-editor/types'

interface Props {
  questions: ExerciseQuestion[]
  onChange: (questions: ExerciseQuestion[]) => void
  allowMulti?: boolean
  radioNamePrefix: string
}

// ── Shared presentational helpers (10B tokens — mirror SimpleBlockEditors) ──

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
      {children}
    </span>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] focus:outline-none transition-colors border-[1.5px] border-[#e3e5e9] focus:border-sky ${className}`}
    />
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  heightClass = 'h-20',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  heightClass?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full ${heightClass} text-[15px] font-medium text-ink-body bg-white rounded-tile p-3.5 resize-none border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]`}
    />
  )
}

export default function McqEditor({
  questions,
  onChange,
  allowMulti = true,
  radioNamePrefix,
}: Props) {
  const list = Array.isArray(questions) ? questions : []

  // Build a new array with question qIdx replaced by the patched copy.
  const patchQuestion = (qIdx: number, patch: Partial<ExerciseQuestion>) => {
    onChange(list.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)))
  }

  const removeQuestion = (qIdx: number) => {
    onChange(list.filter((_, i) => i !== qIdx))
  }

  const addQuestion = () => {
    const blank: ExerciseQuestion = {
      id: crypto.randomUUID(),
      prompt: '',
      options: ['', ''],
      correctIndex: -1,
      hint: '',
    }
    onChange([...list, blank])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          {list.length} question{list.length !== 1 ? 's' : ''}
        </span>
      </div>

      {list.map((q, qIdx) => {
        const isMulti = Array.isArray(q.correctIndices)

        // Legacy toggleMultiMode (page.tsx 2934-2944): single→multi seeds
        // correctIndices = [correctIndex]; multi→single sets correctIndex to
        // correctIndices[0] (or 0) and drops correctIndices.
        const toggleMultiMode = () => {
          if (isMulti) {
            const first = (q.correctIndices && q.correctIndices.length > 0) ? q.correctIndices[0] : 0
            const { correctIndices: _drop, ...rest } = q
            void _drop
            onChange(list.map((item, i) => (i === qIdx ? { ...rest, correctIndex: first } : item)))
          } else {
            patchQuestion(qIdx, { correctIndices: [q.correctIndex] })
          }
        }

        return (
          <Card key={q.id || qIdx} padding="md" className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky-text">
                Q{qIdx + 1}
              </span>
              <div className="flex items-center gap-3">
                {allowMulti && (
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isMulti}
                      onChange={toggleMultiMode}
                      className="accent-sky"
                    />
                    Multiple correct
                  </label>
                )}
                <Button
                  variant="textLink"
                  size="sm"
                  onClick={() => removeQuestion(qIdx)}
                  className="!text-incorrect-fg"
                >
                  Remove
                </Button>
              </div>
            </div>

            <div>
              <FieldLabel>Prompt</FieldLabel>
              <TextInput
                value={q.prompt}
                onChange={(prompt) => patchQuestion(qIdx, { prompt })}
                placeholder="The question the student answers..."
                className="w-full"
              />
            </div>

            <div>
              <FieldLabel>
                Options
                {isMulti && allowMulti && (
                  <span className="ml-1 text-sky normal-case font-bold">
                    (tick all correct answers — student picks them all)
                  </span>
                )}
              </FieldLabel>
              {isMulti && allowMulti ? (
                <McqOptionsList
                  multi
                  options={q.options}
                  correctIndices={q.correctIndices || []}
                  onChange={({ options, correctIndices }) =>
                    patchQuestion(qIdx, { options, correctIndices })
                  }
                />
              ) : (
                <McqOptionsList
                  options={q.options}
                  correctIndex={q.correctIndex}
                  radioName={`${radioNamePrefix}-${qIdx}`}
                  onChange={({ options, correctIndex }) =>
                    patchQuestion(qIdx, { options, correctIndex })
                  }
                />
              )}
            </div>

            <div>
              <FieldLabel>Hint</FieldLabel>
              <TextInput
                value={q.hint}
                onChange={(hint) => patchQuestion(qIdx, { hint })}
                placeholder="Optional hint..."
                className="w-full"
              />
            </div>

            <div>
              <FieldLabel>
                Explanation
                <span className="ml-1 text-ink-muted normal-case font-normal">
                  (shown after the student answers)
                </span>
              </FieldLabel>
              <TextArea
                value={q.explanation || ''}
                onChange={(explanation) => patchQuestion(qIdx, { explanation })}
                placeholder="Why the correct answer is correct..."
              />
            </div>
          </Card>
        )
      })}

      <button
        onClick={addQuestion}
        className="w-full py-2.5 border-2 border-dashed border-sky-border rounded-tile text-xs font-extrabold text-ink-muted hover:border-sky hover:text-sky transition-colors"
      >
        + Add Question
      </button>
    </div>
  )
}
