'use client'

// 10B redesign — unified list editor for the follow-up exercises attached to a
// media content block (Reading / Article first; Audio / Video to follow).
//
// Replaces the legacy AttachedExercisesEditor for blocks. The crucial change:
// each item is a FULL standalone Exercise (the same 14-type shape used by the
// standalone exercise editor), NOT the bare 6-type AttachedExercise. That lets
// every block reuse the REAL ExerciseEditor (full metadata shell + per-type
// registry dispatch + preview), so block-attached exercises and standalone
// exercises share one authoring surface.
//
// The list scaffold (add / remove / reorder, drag handle, empty state, type
// picker) is modelled on components/AttachedExercisesEditor.tsx but restyled
// with the 10B kit (@/components/student-ui + tokens) to match ExerciseEditor.

import { useState } from 'react'
import { Card, Button } from '@/components/student-ui'
import ExerciseEditor from './ExerciseEditor'
import {
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABELS,
  createDefaultExercise,
  defaultDataForType,
  type Exercise,
} from '@/lib/lesson-editor/types'

interface Props {
  exercises: Exercise[]
  onChange: (exercises: Exercise[]) => void
  onPreview: (ex: Exercise) => void
}

export default function BlockExercisesEditor({ exercises, onChange, onPreview }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [pickerType, setPickerType] = useState<string>('')

  // Replace the exercise at index i with the next full object.
  const update = (i: number, next: Exercise) => {
    const out = [...exercises]
    out[i] = next
    onChange(out)
  }

  const remove = (i: number) => onChange(exercises.filter((_, idx) => idx !== i))

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= exercises.length) return
    const next = [...exercises]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  // Seed a new full Exercise: createDefaultExercise gives the MCQ baseline (with
  // an order_index); for any non-MCQ type we overlay exercise_type +
  // defaultDataForType so the per-type editor renders the right schema. Every
  // item gets a fresh crypto.randomUUID() id so ExerciseEditor's radio-name
  // prefixes and our React keys stay unique across instances.
  const add = (type: string) => {
    const base = createDefaultExercise(exercises.length)
    const seeded: Exercise =
      type && type !== 'multiple_choice'
        ? { ...base, id: crypto.randomUUID(), exercise_type: type, ...defaultDataForType(type) }
        : { ...base, id: crypto.randomUUID() }
    onChange([...exercises, seeded])
    setPickerType('')
  }

  return (
    <div className="space-y-3">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Follow-up exercises{' '}
          <span className="text-ink-muted font-bold normal-case tracking-normal">
            ({exercises.length})
          </span>
        </p>
      </div>

      {exercises.length === 0 && (
        <p className="text-xs text-ink-muted italic">
          No follow-up exercises yet. Use the picker below to add one.
        </p>
      )}

      {exercises.map((ex, i) => {
        const typeLabel = EXERCISE_TYPE_LABELS[ex.exercise_type] || ex.exercise_type || 'Exercise'
        return (
          <div
            key={ex.id || i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null) move(dragIdx, i)
              setDragIdx(null)
            }}
            onDragEnd={() => setDragIdx(null)}
            className={`rounded-tile border-[1.5px] transition-colors ${
              dragIdx !== null && dragIdx !== i ? 'border-sky' : 'border-hairline'
            }`}
          >
            {/* Card header */}
            <div className="flex items-center justify-between bg-sky-wash rounded-t-tile px-3 py-2 border-b border-hairline">
              <div className="flex items-center gap-2">
                <span
                  className="text-ink-muted cursor-grab active:cursor-grabbing select-none"
                  title="Drag to reorder"
                >
                  ☰
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
                  {ex.icon ? `${ex.icon} ` : ''}
                  {typeLabel} {i + 1}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="text-ink-muted hover:text-sky disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-white"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === exercises.length - 1}
                  className="text-ink-muted hover:text-sky disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-white"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-[11px] font-bold text-ink-muted hover:text-red-500 transition-colors ml-2"
                  title="Delete this follow-up exercise"
                >
                  ✕ Remove
                </button>
              </div>
            </div>

            {/* The REAL standalone exercise editor, embedded per item. */}
            <div className="p-3">
              <ExerciseEditor
                exercise={ex}
                onChange={(next) => update(i, next)}
                onPreview={onPreview}
              />
            </div>
          </div>
        )
      })}

      {/* Type-picker — iterates all 14 standalone exercise types. */}
      <Card padding="sm">
        <div className="flex items-center gap-2">
          <select
            value={pickerType}
            onChange={(e) => {
              const v = e.target.value
              if (v) add(v)
            }}
            className="flex-1 text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-dashed border-[#cddcf0] hover:border-sky focus:outline-none focus:border-sky transition-colors"
          >
            <option value="">+ Add exercise…</option>
            {EXERCISE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="md"
            onClick={() => add('multiple_choice')}
            title="Add a Multiple Choice exercise"
          >
            + Add exercise
          </Button>
        </div>
      </Card>
    </div>
  )
}
