'use client'

// 10B redesign — AI generation form for GRAMMAR blocks (Phase 6, "new beside
// old"). The grammar door of the two-door add flow.
//
// PRESENTATIONAL + CALLBACKS ONLY. Gathers the grammar brief and hands it to
// onSubmit. It does NOT fetch — the page maps this form onto useLessonAi's
// GrammarForm (splitting the comma `vocabulary` string into string[]) and calls
// generateGrammar.
//
// NOTE on shape: this component emits `vocabulary` as a raw comma string and
// `explanation_length` as "Short" | "Medium" | "Long" (the human-facing values).
// The wiring layer splits/normalises for the hook. DEFER (pass 2): the
// course-vocabulary picker — for now Target vocabulary is a plain comma textarea.
//
// Modal shell + tokens mirror LessonEditorView's confirm modal and the 10B kit.

import { useState } from 'react'
import { Button, InlineError, Spinner } from '@/components/student-ui'

export type ExplanationLength = 'Short' | 'Medium' | 'Long'

export interface GrammarAiFormValues {
  topic: string
  known_grammar: string
  num_exercises: number
  exercise_types: string[]
  /** Raw comma-separated string; the page splits it into string[] for the hook. */
  vocabulary: string
  explanation_length: ExplanationLength
  include_pitfalls: boolean
  level?: string
}

interface Props {
  generating: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (form: GrammarAiFormValues) => void
  // Task C: opens the course-vocabulary picker (owned by LessonEditorView) and
  // resolves the teacher's chosen words. The form merges them (deduped) into
  // the vocabulary string. Optional — omit to hide the picker button.
  onPickVocab?: () => Promise<string[]>
}

// Merge picked words into an existing comma string, trimming + de-duping
// case-sensitively (mirrors legacy applyVocabPicker, page.tsx L1429-1437).
function mergeVocab(existing: string, picked: string[]): string {
  const current = existing
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
  return Array.from(new Set([...current, ...picked])).join(', ')
}

const EXERCISE_TYPES: { value: string; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'true_or_false', label: 'True or false' },
  { value: 'type_answer', label: 'Type the answer' },
  { value: 'error_correction', label: 'Error correction' },
]

const NUM_OPTIONS = [3, 5, 8, 10]
const LENGTH_OPTIONS: ExplanationLength[] = ['Short', 'Medium', 'Long']

// ── Local presentational helpers (10B tokens) ──

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
      {children}
      {required && <span className="text-incorrect-fg ml-0.5">*</span>}
    </span>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] focus:outline-none transition-colors border-[1.5px] border-[#e3e5e9] focus:border-sky disabled:opacity-60"
    />
  )
}

export default function GrammarAiForm({ generating, error, onClose, onSubmit, onPickVocab }: Props) {
  const [topic, setTopic] = useState('')
  const [knownGrammar, setKnownGrammar] = useState('')
  const [vocabulary, setVocabulary] = useState('')
  const [exerciseTypes, setExerciseTypes] = useState<string[]>(['multiple_choice'])
  const [numExercises, setNumExercises] = useState(5)
  const [explanationLength, setExplanationLength] = useState<ExplanationLength>('Medium')
  const [includePitfalls, setIncludePitfalls] = useState(true)

  const toggleType = (value: string) => {
    setExerciseTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    )
  }

  const pickVocab = async () => {
    if (!onPickVocab) return
    const picked = await onPickVocab()
    if (picked.length > 0) setVocabulary((prev) => mergeVocab(prev, picked))
  }

  const canGenerate = topic.trim().length > 0 && exerciseTypes.length > 0

  const submit = () => {
    if (!canGenerate || generating) return
    onSubmit({
      topic: topic.trim(),
      known_grammar: knownGrammar.trim(),
      num_exercises: numExercises,
      exercise_types: exerciseTypes,
      vocabulary,
      explanation_length: explanationLength,
      include_pitfalls: includePitfalls,
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-card shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Generate grammar with AI"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              ✨ Generate with AI
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5">Grammar block</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Topic (required) */}
          <div>
            <FieldLabel required>Grammar topic</FieldLabel>
            <TextInput
              value={topic}
              onChange={setTopic}
              placeholder="e.g. Past Simple vs. Present Perfect"
              disabled={generating}
            />
          </div>

          {/* Already-known grammar */}
          <div>
            <FieldLabel>Already-known grammar (optional)</FieldLabel>
            <TextInput
              value={knownGrammar}
              onChange={setKnownGrammar}
              placeholder="e.g. Present Simple, Past Simple"
              disabled={generating}
            />
            <p className="text-xs text-ink-muted mt-1">
              What students already know, so the AI does not re-teach it.
            </p>
          </div>

          {/* Target vocabulary (comma textarea) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel>Target vocabulary (optional)</FieldLabel>
              {onPickVocab && (
                <button
                  type="button"
                  onClick={() => void pickVocab()}
                  disabled={generating}
                  className="text-[11px] font-bold text-sky hover:text-sky-text transition-colors disabled:opacity-60"
                >
                  + Pick from course vocabulary
                </button>
              )}
            </div>
            <textarea
              value={vocabulary}
              onChange={(e) => setVocabulary(e.target.value)}
              rows={2}
              placeholder="Comma-separated, e.g. already, yet, since, for"
              disabled={generating}
              className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile p-3.5 resize-y border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2] disabled:opacity-60"
            />
          </div>

          {/* Exercise-type checkboxes */}
          <div>
            <FieldLabel required>Exercise types</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {EXERCISE_TYPES.map((t) => {
                const checked = exerciseTypes.includes(t.value)
                return (
                  <label
                    key={t.value}
                    className={`flex items-center gap-2 text-[13px] font-medium rounded-tile px-3 py-2.5 border-[1.5px] cursor-pointer transition-colors ${
                      checked
                        ? 'border-sky bg-sky-wash text-sky-text'
                        : 'border-[#e3e5e9] text-ink-body hover:border-sky-border'
                    } ${generating ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(t.value)}
                      disabled={generating}
                      className="accent-sky"
                    />
                    {t.label}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Questions per type */}
          <div>
            <FieldLabel>Questions per type</FieldLabel>
            <select
              value={numExercises}
              onChange={(e) => setNumExercises(Number(e.target.value))}
              disabled={generating}
              className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
            >
              {NUM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </select>
          </div>

          {/* Explanation length */}
          <div>
            <FieldLabel>Explanation length</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {LENGTH_OPTIONS.map((len) => {
                const active = explanationLength === len
                return (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setExplanationLength(len)}
                    disabled={generating}
                    className={`py-2.5 rounded-tile border-[1.5px] text-[13px] font-bold transition-colors disabled:opacity-60 ${
                      active
                        ? 'border-sky bg-sky-wash text-sky-text'
                        : 'border-[#e3e5e9] text-ink-body hover:border-sky-border'
                    }`}
                  >
                    {len}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Include pitfalls */}
          <label
            className={`flex items-center gap-2.5 text-[13px] font-medium text-ink-body cursor-pointer ${
              generating ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={includePitfalls}
              onChange={(e) => setIncludePitfalls(e.target.checked)}
              disabled={generating}
              className="accent-sky"
            />
            Include common pitfalls
          </label>

          {/* Error */}
          {error && <InlineError message={error} />}

          {/* Generating state */}
          {generating && (
            <div className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Spinner size={18} />
              Generating… this can take a few seconds.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-5">
          <Button variant="secondary" size="md" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={generating || !canGenerate}
          >
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  )
}
