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

// Stable per-item key for React keys AND collapse tracking. Prefer the
// crypto.randomUUID() id stamped on items added here; fall back to order_index
// (kept stable across reorder — move() splices without re-stamping) so
// AI-generated / legacy items (which arrive WITHOUT an id) still get a stable
// handle. The final positional fallback only bites a malformed item with
// neither id nor order_index.
function keyFor(ex: Exercise, i: number): string {
  if (ex.id) return ex.id
  if (ex.order_index != null) return `oi-${ex.order_index}`
  return `idx-${i}`
}

export default function BlockExercisesEditor({ exercises, onChange, onPreview }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [pickerType, setPickerType] = useState<string>('')

  // Collapse state keyed by the stable item key (keyFor). Membership = COLLAPSED;
  // absence = EXPANDED, so brand-new / freshly added / AI-generated items default
  // to expanded with no extra bookkeeping. Persists in local component state for
  // the editor session (not the saved Exercise shape — no DB change).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const allKeys = exercises.map((ex, i) => keyFor(ex, i))
  const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsed.has(k))
  const collapseAll = () => setCollapsed(new Set(allKeys))
  const expandAll = () => setCollapsed(new Set())

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
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Follow-up exercises{' '}
          <span className="text-ink-muted font-bold normal-case tracking-normal">
            ({exercises.length})
          </span>
        </p>
        {exercises.length > 1 && (
          <button
            type="button"
            onClick={allCollapsed ? expandAll : collapseAll}
            className="text-[11px] font-bold text-ink-muted hover:text-sky transition-colors"
            title={allCollapsed ? 'Expand all exercises' : 'Collapse all exercises'}
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        )}
      </div>

      {exercises.length === 0 && (
        <p className="text-xs text-ink-muted italic">
          No follow-up exercises yet. Use the picker below to add one.
        </p>
      )}

      {exercises.map((ex, i) => {
        const typeLabel = EXERCISE_TYPE_LABELS[ex.exercise_type] || ex.exercise_type || 'Exercise'
        const key = keyFor(ex, i)
        const isCollapsed = collapsed.has(key)
        // Collapsed header shows the authored title when present, else the type
        // label; the type label is always echoed alongside for orientation.
        const heading = ex.title && ex.title.trim() ? ex.title.trim() : typeLabel
        return (
          <div
            key={key}
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
            {/* Card header — clicking the title area toggles collapse. */}
            <div
              className={`flex items-center justify-between bg-sky-wash px-3 py-2 ${
                isCollapsed ? 'rounded-tile' : 'rounded-t-tile border-b border-hairline'
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleCollapse(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleCollapse(key)
                  }
                }}
                className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <span
                  className={`text-ink-muted inline-block transition-transform shrink-0 ${
                    isCollapsed ? '' : 'rotate-180'
                  }`}
                  aria-hidden="true"
                >
                  ⌄
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky truncate">
                  {ex.icon ? `${ex.icon} ` : ''}
                  {i + 1}. {heading}
                </span>
                <span className="text-[10px] font-bold text-ink-muted normal-case tracking-normal shrink-0">
                  {typeLabel}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
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

            {/* The REAL standalone exercise editor, embedded per item (expanded only). */}
            {!isCollapsed && (
              <div className="p-3">
                <ExerciseEditor
                  exercise={ex}
                  onChange={(next) => update(i, next)}
                  onPreview={onPreview}
                />
              </div>
            )}
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
