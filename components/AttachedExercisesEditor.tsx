'use client'

import { useState } from 'react'
import TrueFalseEditor from './TrueFalseEditor'
import TypeAnswerEditor from './TypeAnswerEditor'
import GroupSortEditor from './GroupSortEditor'
import RankOrderEditor from './RankOrderEditor'
import UnjumbleEditor from './UnjumbleEditor'
import {
  AttachedExercise,
  AttachedExerciseType,
  ATTACHED_TYPE_ICONS,
  ATTACHED_TYPE_LABELS,
  newAttachedExercise,
} from '@/lib/attached-exercise'

// Teacher-side editor for the list of follow-up exercises attached to a
// media content block (Audio / Video / Reading). Each entry is a card
// with a drag handle, a type label, ✕ remove, and the matching visual
// exercise editor embedded inline. Adding a new exercise is a dropdown
// of the 6 supported types.

interface Props {
  exercises: AttachedExercise[]
  onChange: (exercises: AttachedExercise[]) => void
}

export default function AttachedExercisesEditor({ exercises, onChange }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [pickerType, setPickerType] = useState<AttachedExerciseType | ''>('')

  const update = (i: number, patch: Partial<AttachedExercise>) => {
    const next = [...exercises]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const remove = (i: number) => onChange(exercises.filter((_, idx) => idx !== i))

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= exercises.length) return
    const next = [...exercises]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const add = (type: AttachedExerciseType) => {
    onChange([...exercises, newAttachedExercise(type)])
    setPickerType('')
  }

  return (
    <div className="space-y-3">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#46464b]">
          Follow-up exercises{' '}
          <span className="text-gray-400 font-normal">
            ({exercises.length})
          </span>
        </p>
      </div>

      {exercises.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          No follow-up exercises yet. Use the dropdown below to add one.
        </p>
      )}

      {exercises.map((ex, i) => (
        <div
          key={ex.id}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIdx !== null) move(dragIdx, i)
            setDragIdx(null)
          }}
          onDragEnd={() => setDragIdx(null)}
          className={`bg-[#f7fafd] border-2 rounded-xl p-3 ${
            dragIdx !== null && dragIdx !== i ? 'border-[#416ebe]' : 'border-[#e6f0fa]'
          }`}
        >
          {/* Card header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="text-gray-300 cursor-grab active:cursor-grabbing select-none"
                title="Drag to reorder"
              >
                ☰
              </span>
              <span className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider">
                {ATTACHED_TYPE_ICONS[ex.type]} {ATTACHED_TYPE_LABELS[ex.type]} {i + 1}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="text-gray-400 hover:text-[#416ebe] disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-[#e6f0fa]"
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, i + 1)}
                disabled={i === exercises.length - 1}
                className="text-gray-400 hover:text-[#416ebe] disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-[#e6f0fa]"
                title="Move down"
              >
                ↓
              </button>
              <button
                onClick={() => remove(i)}
                className="text-[10px] text-gray-300 hover:text-red-400 transition-colors ml-2"
                title="Delete this follow-up exercise"
              >
                ✕ Remove
              </button>
            </div>
          </div>

          {/* Per-type embedded editor */}
          <AttachedExerciseEditor
            exercise={ex}
            onChange={(patch) => update(i, patch)}
          />
        </div>
      ))}

      {/* Type-picker dropdown */}
      <div className="flex items-center gap-2 pt-1">
        <select
          value={pickerType}
          onChange={(e) => {
            const v = e.target.value as AttachedExerciseType
            if (v) add(v)
          }}
          className="flex-1 px-3 py-2 text-sm text-[#46464b] border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors bg-white"
        >
          <option value="">+ Add follow-up exercise…</option>
          {(Object.keys(ATTACHED_TYPE_LABELS) as AttachedExerciseType[]).map((t) => (
            <option key={t} value={t}>
              {ATTACHED_TYPE_ICONS[t]} {ATTACHED_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// Dispatches the right visual editor based on type. Wraps existing
// components so we don't duplicate authoring UI.
function AttachedExerciseEditor({
  exercise,
  onChange,
}: {
  exercise: AttachedExercise
  onChange: (patch: Partial<AttachedExercise>) => void
}) {
  const setQuestions = (questions: unknown[]) => onChange({ questions })

  if (exercise.type === 'true_or_false') {
    return (
      <TrueFalseEditor
        // Shape matches what the editor expects.
        questions={(exercise.questions || []) as Parameters<typeof TrueFalseEditor>[0]['questions']}
        onChange={(qs) => setQuestions(qs)}
      />
    )
  }
  if (exercise.type === 'type_answer') {
    return (
      <TypeAnswerEditor
        questions={(exercise.questions || []) as Parameters<typeof TypeAnswerEditor>[0]['questions']}
        onChange={(qs) => setQuestions(qs)}
      />
    )
  }
  if (exercise.type === 'rank_order') {
    return (
      <RankOrderEditor
        questions={(exercise.questions || []) as Parameters<typeof RankOrderEditor>[0]['questions']}
        onChange={(qs) => setQuestions(qs)}
      />
    )
  }
  if (exercise.type === 'anagram') {
    return (
      <UnjumbleEditor
        questions={(exercise.questions || []) as Parameters<typeof UnjumbleEditor>[0]['questions']}
        onChange={(qs) => setQuestions(qs)}
      />
    )
  }
  if (exercise.type === 'group_sort') {
    return (
      <GroupSortEditor
        groupData={exercise.groupData as Parameters<typeof GroupSortEditor>[0]['groupData']}
        onChange={(gd) => onChange({ groupData: gd })}
      />
    )
  }
  // multiple_choice — small inline editor (the standalone one is inline
  // in admin/lessons and not yet extracted into a component).
  return <InlineMcqEditor exercise={exercise} onChange={onChange} />
}

// Compact MCQ editor for follow-up exercises. Mirrors the shape used
// by ExerciseRunner: questions = [{prompt, options, correctIndex, hint, explanation}].
interface McqQuestion {
  id: number | string
  prompt: string
  options: string[]
  correctIndex: number
  hint?: string
  explanation?: string
}

function InlineMcqEditor({
  exercise,
  onChange,
}: {
  exercise: AttachedExercise
  onChange: (patch: Partial<AttachedExercise>) => void
}) {
  const questions = (exercise.questions || []) as McqQuestion[]

  const update = (qi: number, patch: Partial<McqQuestion>) => {
    const next = [...questions]
    next[qi] = { ...next[qi], ...patch }
    onChange({ questions: next })
  }
  const add = () =>
    onChange({
      questions: [
        ...questions,
        {
          id: crypto.randomUUID(),
          prompt: '',
          options: ['', '', '', ''],
          correctIndex: 0,
          hint: '',
          explanation: '',
        },
      ],
    })
  const remove = (qi: number) =>
    onChange({ questions: questions.filter((_, i) => i !== qi) })

  return (
    <div className="space-y-2">
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 italic">No questions yet.</p>
      )}
      {questions.map((q, qi) => (
        <div
          key={String(q.id) || qi}
          className="bg-white border border-[#cddcf0] rounded-lg p-2.5 space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Question {qi + 1}</p>
            <button
              onClick={() => remove(qi)}
              className="text-[10px] text-gray-300 hover:text-red-400"
              title="Delete this question"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            value={q.prompt}
            onChange={(e) => update(qi, { prompt: e.target.value })}
            placeholder="Question prompt"
            className="w-full px-2 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe]"
          />
          <div className="space-y-1">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`mcq-correct-${q.id}`}
                  checked={q.correctIndex === oi}
                  onChange={() => update(qi, { correctIndex: oi })}
                  className="accent-[#416ebe]"
                />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const opts = [...q.options]
                    opts[oi] = e.target.value
                    update(qi, { options: opts })
                  }}
                  placeholder={`Option ${oi + 1}`}
                  className="flex-1 px-2 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe]"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={q.hint || ''}
              onChange={(e) => update(qi, { hint: e.target.value })}
              placeholder="Hint (optional)"
              className="px-2 py-1.5 text-xs text-[#46464b] border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe]"
            />
            <input
              type="text"
              value={q.explanation || ''}
              onChange={(e) => update(qi, { explanation: e.target.value })}
              placeholder="Explanation (optional, shown after answer)"
              className="px-2 py-1.5 text-xs text-[#46464b] border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe]"
            />
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full text-[11px] font-bold text-[#416ebe] hover:text-[#3560b0] py-1.5 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded transition-colors"
      >
        + Add question
      </button>
    </div>
  )
}
