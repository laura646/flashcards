'use client'

// Shared MCQ options editor: a list of answer-option rows with
// add / delete controls and a "correct answer" radio (or checkbox set
// when multi-select is on). Used by every MCQ-shaped editor in the
// app (standalone Exercise, content-bank, attached follow-up on
// media blocks, Grammar block questions, Mistakes practice).
//
// Contract:
//   - Floor: 2 options. Delete button disabled (with tooltip) at 2.
//   - Ceiling: 6 options. Add button hidden at 6.
//   - When the teacher deletes the row that's currently marked as the
//     correct answer, the pointer is cleared (single mode →
//     correctIndex = -1; multi mode → that index is dropped). Save
//     validation upstream catches the unset pointer.
//   - Per-row placeholder is "Option N" where N is 1-based.

interface SingleProps {
  multi?: false
  options: string[]
  correctIndex: number
  onChange: (opts: { options: string[]; correctIndex: number }) => void
  radioName: string
}

interface MultiProps {
  multi: true
  options: string[]
  correctIndices: number[]
  onChange: (opts: { options: string[]; correctIndices: number[] }) => void
  radioName?: string
}

type Props = SingleProps | MultiProps

export const MCQ_MIN_OPTIONS = 2
export const MCQ_MAX_OPTIONS = 6

export default function McqOptionsList(props: Props) {
  const { options } = props
  const canAdd = options.length < MCQ_MAX_OPTIONS
  const canDelete = options.length > MCQ_MIN_OPTIONS

  const updateOption = (oi: number, value: string) => {
    const next = [...options]
    next[oi] = value
    if (props.multi) {
      props.onChange({ options: next, correctIndices: props.correctIndices })
    } else {
      props.onChange({ options: next, correctIndex: props.correctIndex })
    }
  }

  const deleteOption = (oi: number) => {
    if (!canDelete) return
    const next = options.filter((_, i) => i !== oi)
    if (props.multi) {
      // Drop the deleted index, then shift every higher index down by 1.
      const nextCorrect = props.correctIndices
        .filter((i) => i !== oi)
        .map((i) => (i > oi ? i - 1 : i))
      props.onChange({ options: next, correctIndices: nextCorrect })
    } else {
      // Clear if the deleted row was the correct one; otherwise shift.
      let nextCorrect = props.correctIndex
      if (props.correctIndex === oi) nextCorrect = -1
      else if (props.correctIndex > oi) nextCorrect = props.correctIndex - 1
      props.onChange({ options: next, correctIndex: nextCorrect })
    }
  }

  const addOption = () => {
    if (!canAdd) return
    const next = [...options, '']
    if (props.multi) {
      props.onChange({ options: next, correctIndices: props.correctIndices })
    } else {
      props.onChange({ options: next, correctIndex: props.correctIndex })
    }
  }

  const isChecked = (oi: number) =>
    props.multi ? props.correctIndices.includes(oi) : props.correctIndex === oi

  const toggle = (oi: number) => {
    if (props.multi) {
      const current = props.correctIndices
      const next = current.includes(oi)
        ? current.filter((i) => i !== oi)
        : [...current, oi].sort((a, b) => a - b)
      props.onChange({ options, correctIndices: next })
    } else {
      props.onChange({ options, correctIndex: oi })
    }
  }

  return (
    <div className="space-y-1">
      {options.map((opt, oi) => (
        <div key={oi} className="flex items-center gap-2">
          <input
            type={props.multi ? 'checkbox' : 'radio'}
            name={props.radioName}
            checked={isChecked(oi)}
            onChange={() => toggle(oi)}
            className="accent-[#416ebe] shrink-0"
            aria-label={`Mark option ${oi + 1} as correct`}
          />
          <input
            type="text"
            value={opt}
            onChange={(e) => updateOption(oi, e.target.value)}
            placeholder={`Option ${oi + 1}`}
            className="flex-1 px-3 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
          />
          <button
            onClick={() => deleteOption(oi)}
            disabled={!canDelete}
            className="shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-red-50"
            title={canDelete ? 'Remove this option' : `Need at least ${MCQ_MIN_OPTIONS} options`}
            aria-label="Remove option"
          >
            ✕
          </button>
        </div>
      ))}
      {canAdd && (
        <button
          onClick={addOption}
          className="text-xs text-[#416ebe] font-bold hover:underline mt-1"
        >
          + Add answer
        </button>
      )}
    </div>
  )
}

// Validation helper used by save handlers. Returns a list of
// human-readable issues; empty array == OK to save.
export interface McqQuestionForValidation {
  prompt?: string
  options?: string[]
  correctIndex?: number
  correctIndices?: number[]
}

export function validateMcqQuestion(
  q: McqQuestionForValidation,
  qLabel: string,
): string[] {
  const issues: string[] = []
  const opts = q.options || []
  if (opts.length < MCQ_MIN_OPTIONS) {
    issues.push(`${qLabel}: needs at least ${MCQ_MIN_OPTIONS} options.`)
  }
  const blanks = opts.filter((o) => !o.trim()).length
  if (blanks > 0) {
    issues.push(`${qLabel}: ${blanks} option${blanks > 1 ? 's are' : ' is'} blank — fill in or remove.`)
  }
  const isMulti = Array.isArray(q.correctIndices)
  if (isMulti) {
    if (!q.correctIndices || q.correctIndices.length === 0) {
      issues.push(`${qLabel}: tick at least one correct answer.`)
    }
  } else {
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= opts.length) {
      issues.push(`${qLabel}: pick the correct answer.`)
    }
  }
  return issues
}
