'use client'

// IELTS Reading — TEACHER authoring editor: Short-answer questions (Type 14).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingShortAnswerRunner consumes (see ReadingShortAnswerRunner.tsx):
//   wordLimit?  (group default)
//   questions[]: { number, text, acceptedAnswers[], wordLimit? }
//
// Each question is a single prompt with a one-line answer field at runtime, so
// the teacher edits the question text, accepted answers (comma-separated), and
// an optional per-question word limit overriding the group default.

import type { ShortAnswerGroup } from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'
import {
  answersToInput,
  inputToAnswers,
  parseWordLimit,
} from './_acceptedAnswers'

type Question = ShortAnswerGroup['questions'][number]

export interface ShortAnswerGroupEditorProps {
  group: ShortAnswerGroup
  onChange: (group: ShortAnswerGroup) => void
}

export default function ShortAnswerGroupEditor({
  group,
  onChange,
}: ShortAnswerGroupEditorProps) {
  const questions = group.questions

  const patchQuestion = (idx: number, p: Partial<Question>) => {
    const next = questions.map((q, i) => (i === idx ? { ...q, ...p } : q))
    onChange({ ...group, questions: next })
  }

  const addQuestion = () => {
    const nextNumber =
      questions.reduce((max, q) => Math.max(max, q.number), 0) + 1
    const blank: Question = { number: nextNumber, text: '', acceptedAnswers: [''] }
    onChange({ ...group, questions: [...questions, blank] })
  }

  const removeQuestion = (idx: number) => {
    onChange({ ...group, questions: questions.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Group-level word limit */}
      <label className="block w-44">
        <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
          Word limit (all answers)
        </span>
        <input
          type="number"
          min={1}
          value={group.wordLimit ?? ''}
          placeholder="e.g. 3"
          onChange={(e) =>
            onChange({ ...group, wordLimit: parseWordLimit(e.target.value) })
          }
          className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
        />
      </label>

      {questions.map((q, idx) => (
        <div
          key={idx}
          className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
              Question {q.number}
            </span>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeQuestion(idx)}
              aria-label={`Delete question ${q.number}`}
            >
              Delete
            </Button>
          </div>

          <label className="block">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Question text
            </span>
            <textarea
              value={q.text}
              rows={2}
              placeholder="What effect makes cities warmer than the countryside?"
              onChange={(e) => patchQuestion(idx, { text: e.target.value })}
              className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2.5 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky resize-y"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Accepted answers (comma-separated)
            </span>
            <input
              type="text"
              value={answersToInput(q.acceptedAnswers)}
              placeholder="urban heat island, heat island effect"
              onChange={(e) =>
                patchQuestion(idx, { acceptedAnswers: inputToAnswers(e.target.value) })
              }
              className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
          </label>

          <label className="block w-44">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Word limit (this answer)
            </span>
            <input
              type="number"
              min={1}
              value={q.wordLimit ?? ''}
              placeholder="(uses group)"
              onChange={(e) =>
                patchQuestion(idx, { wordLimit: parseWordLimit(e.target.value) })
              }
              className="w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
            />
          </label>
        </div>
      ))}

      <div>
        <Button variant="secondary" size="sm" onClick={addQuestion}>
          + Add question
        </Button>
      </div>
    </div>
  )
}
