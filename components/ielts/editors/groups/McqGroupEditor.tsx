'use client'

// IELTS Reading — TEACHER authoring editor: Multiple choice (Type 1).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// ReadingMcqRunner consumes (see components/ielts/runners/ReadingMcqRunner.tsx):
//   questions[]: { number, stem, options: { id, text }[], selectCount?, correct[] }
//
// selectCount === 1  → "correct" holds ONE option id (radio marks the answer).
// selectCount  >  1  → "correct" holds N option ids (checkbox marks the answers).
// Option ids are the displayed letters (A, B, C…), kept in sync as options are
// added / removed so the bank always reads A, B, C in order.

import type { McqGroup } from '@/lib/ielts/types'
import { Button, TextField } from '@/components/student-ui'

type McqQuestion = McqGroup['questions'][number]

export interface McqGroupEditorProps {
  group: McqGroup
  onChange: (group: McqGroup) => void
}

/** Letters A, B, C … for option ids, by position. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const letterAt = (i: number) => LETTERS[i] ?? `Z${i}`

/** Re-letter a list of options so ids are always A, B, C in order. */
function reletter(options: McqQuestion['options']) {
  return options.map((o, i) => ({ ...o, id: letterAt(i) }))
}

export default function McqGroupEditor({ group, onChange }: McqGroupEditorProps) {
  const questions = group.questions

  const patchQuestion = (idx: number, patch: Partial<McqQuestion>) => {
    const next = questions.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    onChange({ ...group, questions: next })
  }

  const addQuestion = () => {
    const nextNumber =
      questions.reduce((max, q) => Math.max(max, q.number), 0) + 1
    const blank: McqQuestion = {
      number: nextNumber,
      stem: '',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ],
      selectCount: 1,
      correct: [],
    }
    onChange({ ...group, questions: [...questions, blank] })
  }

  const removeQuestion = (idx: number) => {
    onChange({ ...group, questions: questions.filter((_, i) => i !== idx) })
  }

  const addOption = (qIdx: number) => {
    const q = questions[qIdx]
    const next = reletter([...q.options, { id: '', text: '' }])
    patchQuestion(qIdx, { options: next })
  }

  const removeOption = (qIdx: number, oIdx: number) => {
    const q = questions[qIdx]
    const removedId = q.options[oIdx]?.id
    const next = reletter(q.options.filter((_, i) => i !== oIdx))
    // Drop the removed id from the correct set (and any now-invalid id).
    const validIds = new Set(next.map((o) => o.id))
    const correct = q.correct.filter((id) => id !== removedId && validIds.has(id))
    patchQuestion(qIdx, { options: next, correct })
  }

  const setOptionText = (qIdx: number, oIdx: number, text: string) => {
    const q = questions[qIdx]
    const next = q.options.map((o, i) => (i === oIdx ? { ...o, text } : o))
    patchQuestion(qIdx, { options: next })
  }

  const setSelectCount = (qIdx: number, raw: string) => {
    const q = questions[qIdx]
    const parsed = Number.parseInt(raw, 10)
    const selectCount = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
    // If narrowing to single-select, keep at most one correct id.
    const correct = selectCount === 1 ? q.correct.slice(0, 1) : q.correct
    patchQuestion(qIdx, { selectCount, correct })
  }

  const toggleCorrect = (qIdx: number, optionId: string) => {
    const q = questions[qIdx]
    const selectCount = q.selectCount ?? 1
    if (selectCount === 1) {
      patchQuestion(qIdx, { correct: [optionId] })
      return
    }
    const has = q.correct.includes(optionId)
    const correct = has
      ? q.correct.filter((id) => id !== optionId)
      : [...q.correct, optionId]
    patchQuestion(qIdx, { correct })
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, qIdx) => {
        const selectCount = q.selectCount ?? 1
        const multi = selectCount > 1
        return (
          <div
            key={qIdx}
            className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                Question {q.number}
              </span>
              <Button
                variant="textLink"
                size="sm"
                onClick={() => removeQuestion(qIdx)}
                aria-label={`Delete question ${q.number}`}
              >
                Delete
              </Button>
            </div>

            <TextField
              label="Question stem"
              value={q.stem}
              placeholder="What does the writer say about…?"
              onChange={(e) => patchQuestion(qIdx, { stem: e.target.value })}
            />

            <div className="flex flex-wrap items-end gap-3">
              <label className="block w-28">
                <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                  Choose how many
                </span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, q.options.length)}
                  value={selectCount}
                  onChange={(e) => setSelectCount(qIdx, e.target.value)}
                  className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                />
              </label>
              <p className="text-[12px] text-ink-muted pb-3">
                {multi
                  ? `Mark ${selectCount} correct options (checkboxes).`
                  : 'Mark the one correct option (radio).'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                Options
              </span>
              {q.options.map((opt, oIdx) => {
                const isCorrect = q.correct.includes(opt.id)
                return (
                  <div key={oIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(qIdx, opt.id)}
                      aria-pressed={isCorrect}
                      aria-label={`Mark option ${opt.id} correct`}
                      className={`shrink-0 inline-flex items-center justify-center w-7 h-7 text-[12px] font-extrabold border-[1.5px] transition-colors ${
                        multi ? 'rounded-tile' : 'rounded-full'
                      } ${
                        isCorrect
                          ? 'bg-correct-bg border-correct-border text-correct-fg'
                          : 'bg-white border-sky-border text-ink-muted hover:border-sky'
                      }`}
                    >
                      {opt.id}
                    </button>
                    <input
                      type="text"
                      value={opt.text}
                      placeholder={`Option ${opt.id}`}
                      onChange={(e) => setOptionText(qIdx, oIdx, e.target.value)}
                      className="flex-1 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
                    />
                    <Button
                      variant="textLink"
                      size="sm"
                      onClick={() => removeOption(qIdx, oIdx)}
                      aria-label={`Delete option ${opt.id}`}
                    >
                      Remove
                    </Button>
                  </div>
                )
              })}
              <div>
                <Button variant="neutral" size="sm" onClick={() => addOption(qIdx)}>
                  + Add option
                </Button>
              </div>
            </div>
          </div>
        )
      })}

      <div>
        <Button variant="secondary" size="sm" onClick={addQuestion}>
          + Add question
        </Button>
      </div>
    </div>
  )
}
