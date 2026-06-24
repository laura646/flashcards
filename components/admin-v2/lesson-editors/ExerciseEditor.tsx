'use client'

// 10B redesign — standalone EXERCISE editor shell + per-type registry (Phase 3).
//
// Ports the legacy renderExerciseEditor (app/admin/lessons/page.tsx 2581-3032):
//   1. METADATA SHELL — title / subtitle / icon / type / instructions / points /
//      completion bonus / skills / CEFR / test_type / mandatory toggle.
//   2. TYPE CHANGE — reseeds questions/groupData for the new type (with a
//      window.confirm guard when the exercise already has real content). The
//      legacy AI-conversion path (pendingConversion / executeConversion / the
//      converting spinner) is DEFERRED and intentionally NOT ported.
//   3. REGISTRY DISPATCH — a map from exercise_type to the matching per-type
//      editor component (each imported VERBATIM from @/components/<Name> and
//      restyled in NO way). multiple_choice and any unmatched type fall through
//      to McqEditor.
//
// Fully controlled: every edit builds a brand-new Exercise object and calls
// onChange. Nothing mutates in place; the store lives in the useLessonEditor
// hook (the parent wires onChange to updateContentItem).
//
// Chrome (the metadata shell, the field labels/inputs) uses the 10B kit
// (@/components/student-ui) + tokens — the same FieldLabel / TextInput /
// TextArea token patterns established in SimpleBlockEditors.tsx and McqEditor.

import { Card, Button } from '@/components/student-ui'
import {
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABELS,
  SKILL_OPTIONS,
  CEFR_OPTIONS,
  TEST_TYPE_OPTIONS,
  defaultDataForType,
  type Exercise,
  type ExerciseQuestion,
} from '@/lib/lesson-editor/types'

// Per-type editor components — imported as defaults, VERBATIM, restyled in no way.
import McqEditor from './McqEditor'
import MatchHalvesEditor from '@/components/MatchHalvesEditor'
import TrueFalseEditor from '@/components/TrueFalseEditor'
import HangmanEditor from '@/components/HangmanEditor'
import TypeAnswerEditor from '@/components/TypeAnswerEditor'
import GroupSortEditor from '@/components/GroupSortEditor'
import DictationEditor from '@/components/DictationEditor'
import ErrorCorrectionEditor from '@/components/ErrorCorrectionEditor'
import RankOrderEditor from '@/components/RankOrderEditor'
import TextSequencingEditor from '@/components/TextSequencingEditor'
import UnjumbleEditor from '@/components/UnjumbleEditor'
import GapFillBuilder from '@/components/GapFillBuilder'
import OddOneOutEditor from '@/components/OddOneOutEditor'
import GapFillEditor from '@/components/GapFillEditor'

interface Props {
  exercise: Exercise
  onChange: (exercise: Exercise) => void
  onPreview: (exercise: Exercise) => void
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
  type = 'text',
  min,
  className = '',
}: {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  min?: number
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
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

// 10B-styled native <select> (matches the input chrome above).
function SelectInput({
  value,
  onChange,
  className = '',
  title,
  children,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      className={`text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 focus:outline-none transition-colors border-[1.5px] border-[#e3e5e9] focus:border-sky ${className}`}
    >
      {children}
    </select>
  )
}

// ── Type-change "has real content" detection (legacy 2649-2657) ──
//
// Returns true when the exercise carries meaningful authored content, so the
// type switch should confirm before clearing it.
function exerciseHasRealContent(exercise: Exercise): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gd = exercise.groupData as any
  if (gd && Array.isArray(gd.groups)) {
    const hasGroupContent = gd.groups.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (g: any) => (g?.name && String(g.name).trim().length > 0) || (Array.isArray(g?.items) && g.items.length > 0),
    )
    if (hasGroupContent) return true
  } else if (exercise.groupData) {
    return true
  }
  if (!exercise.questions || !Array.isArray(exercise.questions) || exercise.questions.length === 0) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return exercise.questions.some((q: any) => {
    const prompt = (q?.prompt || q?.statement || q?.text || q?.word || q?.left || q?.incorrect || '') as string
    return String(prompt).trim().length > 0
  })
}

// ════════════════════════════════════════════════════════════════
// Per-type registry
// ════════════════════════════════════════════════════════════════
//
// Each entry resolves to a per-type editor. `dataKey` says which Exercise field
// the editor reads/writes: 'questions' (the default) or 'groupData' (group_sort).
// multiple_choice + any UNMATCHED type fall through to McqEditor (handled in
// the dispatch below, not via the map).

type DataKey = 'questions' | 'groupData'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = (props: any) => React.JSX.Element

interface RegistryEntry {
  Component: AnyEditor
  dataKey: DataKey
  // Extra static props forwarded to the editor (e.g. GapFillBuilder mode).
  extraProps?: Record<string, unknown>
}

function buildRegistry(exerciseType: string): Record<string, RegistryEntry> {
  return {
    match_halves: { Component: MatchHalvesEditor as AnyEditor, dataKey: 'questions' },
    true_or_false: { Component: TrueFalseEditor as AnyEditor, dataKey: 'questions' },
    hangman: { Component: HangmanEditor as AnyEditor, dataKey: 'questions' },
    type_answer: { Component: TypeAnswerEditor as AnyEditor, dataKey: 'questions' },
    group_sort: { Component: GroupSortEditor as AnyEditor, dataKey: 'groupData' },
    dictation: { Component: DictationEditor as AnyEditor, dataKey: 'questions' },
    error_correction: { Component: ErrorCorrectionEditor as AnyEditor, dataKey: 'questions' },
    rank_order: { Component: RankOrderEditor as AnyEditor, dataKey: 'questions' },
    text_sequencing: { Component: TextSequencingEditor as AnyEditor, dataKey: 'questions' },
    anagram: { Component: UnjumbleEditor as AnyEditor, dataKey: 'questions' },
    unjumble: { Component: UnjumbleEditor as AnyEditor, dataKey: 'questions' },
    cloze_listening: {
      Component: GapFillBuilder as AnyEditor,
      dataKey: 'questions',
      extraProps: { mode: exerciseType },
    },
    complete_sentence: {
      Component: GapFillBuilder as AnyEditor,
      dataKey: 'questions',
      extraProps: { mode: exerciseType },
    },
    odd_one_out: { Component: OddOneOutEditor as AnyEditor, dataKey: 'questions' },
    gap_fill: { Component: GapFillEditor as AnyEditor, dataKey: 'questions' },
  }
}

// The registry keys (the types that resolve to a dedicated editor). Exported for
// reference / tests; multiple_choice and any other type fall through to McqEditor.
export const EXERCISE_EDITOR_REGISTRY_KEYS = [
  'match_halves',
  'true_or_false',
  'hangman',
  'type_answer',
  'group_sort',
  'dictation',
  'error_correction',
  'rank_order',
  'text_sequencing',
  'anagram',
  'unjumble',
  'cloze_listening',
  'complete_sentence',
  'odd_one_out',
  'gap_fill',
] as const

export default function ExerciseEditor({ exercise, onChange, onPreview }: Props) {
  const set = (patch: Partial<Exercise>) => onChange({ ...exercise, ...patch })

  // Type <select> change → reseed questions/groupData for the new type.
  const handleTypeChange = (newType: string) => {
    if (!newType || newType === exercise.exercise_type) return
    if (exerciseHasRealContent(exercise)) {
      const ok = window.confirm('Changing the type will clear the current questions. Continue?')
      if (!ok) return
    }
    const seed = defaultDataForType(newType)
    onChange({ ...exercise, exercise_type: newType, ...seed })
  }

  const toggleSkill = (value: string) => {
    const current = exercise.skills || []
    const active = current.includes(value)
    const next = active ? current.filter((x) => x !== value) : [...current, value]
    set({ skills: next })
  }

  const isMandatory = exercise.is_mandatory !== false // undefined / true → Mandatory

  // ── Registry dispatch ──
  const questions: ExerciseQuestion[] = Array.isArray(exercise.questions) ? exercise.questions : []
  const registry = buildRegistry(exercise.exercise_type)
  const entry = registry[exercise.exercise_type]
  // Unique radio-name prefix per exercise (id when persisted, else order_index).
  const radioNamePrefix = `correct-${exercise.id || exercise.order_index}`

  let typeEditor: React.ReactNode
  if (!entry) {
    // multiple_choice + any UNMATCHED type → McqEditor.
    typeEditor = (
      <McqEditor
        questions={questions}
        onChange={(next) => onChange({ ...exercise, questions: next })}
        allowMulti
        radioNamePrefix={radioNamePrefix}
      />
    )
  } else if (entry.dataKey === 'groupData') {
    const { Component } = entry
    typeEditor = (
      <Component
        groupData={exercise.groupData || exercise.questions}
        onChange={(data: unknown) => onChange({ ...exercise, groupData: data })}
        {...(entry.extraProps || {})}
      />
    )
  } else {
    const { Component } = entry
    typeEditor = (
      <Component
        questions={questions}
        onChange={(next: unknown) => onChange({ ...exercise, questions: next })}
        {...(entry.extraProps || {})}
      />
    )
  }

  // Legacy fallback <option>: the saved type isn't in the picker list.
  const isLegacyType = exercise.exercise_type
    ? !EXERCISE_TYPES.some((t) => t.value === exercise.exercise_type)
    : false

  return (
    <div className="space-y-4">
      {/* Preview as student */}
      <Button variant="secondary" size="md" fullWidth onClick={() => onPreview(exercise)}>
        ▶ Preview as student
      </Button>

      {/* Title / Subtitle */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Title</FieldLabel>
          <TextInput
            value={exercise.title}
            onChange={(title) => set({ title })}
            className="w-full"
          />
        </div>
        <div>
          <FieldLabel>Subtitle</FieldLabel>
          <TextInput
            value={exercise.subtitle}
            onChange={(subtitle) => set({ subtitle })}
            className="w-full"
          />
        </div>
      </div>

      {/* Icon / Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Icon (emoji)</FieldLabel>
          <TextInput
            value={exercise.icon}
            onChange={(icon) => set({ icon })}
            className="w-full"
          />
        </div>
        <div>
          <FieldLabel>Exercise type</FieldLabel>
          <SelectInput
            value={exercise.exercise_type || ''}
            onChange={handleTypeChange}
            className="w-full"
          >
            <option value="">Select type...</option>
            {EXERCISE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
            {isLegacyType && (
              <option value={exercise.exercise_type}>
                {EXERCISE_TYPE_LABELS[exercise.exercise_type] || exercise.exercise_type} (legacy — pick a new type)
              </option>
            )}
          </SelectInput>
        </div>
      </div>

      {/* Instructions */}
      <div>
        <FieldLabel>Instructions</FieldLabel>
        <TextArea
          value={exercise.instructions}
          onChange={(instructions) => set({ instructions })}
          heightClass="h-16"
        />
      </div>

      {/* Points / Completion bonus */}
      <div className="flex gap-3">
        <div className="flex-1">
          <FieldLabel>Points per answer</FieldLabel>
          <TextInput
            type="number"
            min={0}
            value={exercise.points_per_answer ?? 10}
            onChange={(v) => set({ points_per_answer: parseInt(v) || 0 })}
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <FieldLabel>Completion bonus</FieldLabel>
          <TextInput
            type="number"
            min={0}
            value={exercise.completion_bonus ?? 0}
            onChange={(v) => set({ completion_bonus: parseInt(v) || 0 })}
            className="w-full"
          />
        </div>
      </div>

      {/* Skills / CEFR / Test type */}
      <div className="flex gap-3 items-start flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <FieldLabel>Skills this exercise develops</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_OPTIONS.map((s) => {
              const active = (exercise.skills || []).includes(s.value)
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleSkill(s.value)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors ${
                    active
                      ? 'bg-sky text-white border-sky'
                      : 'bg-white text-ink-muted border-sky-border hover:border-sky hover:text-sky'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-ink-muted mt-1">Tap to toggle. Multiple skills allowed.</p>
        </div>
        <div className="w-28">
          <FieldLabel>CEFR level</FieldLabel>
          <SelectInput
            value={exercise.cefr_level || ''}
            onChange={(v) => set({ cefr_level: v || null })}
            className="w-full"
          >
            <option value="">—</option>
            {CEFR_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="w-44">
          <FieldLabel>Test type</FieldLabel>
          <SelectInput
            value={exercise.test_type || ''}
            onChange={(v) => set({ test_type: v || null })}
            title="Mark as a test so the report uses the first-attempt score (the 'real grade') and shows it in the Tests section"
            className="w-full"
          >
            {TEST_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectInput>
        </div>
      </div>

      {/* Mandatory / Bonus toggle */}
      <div className="flex items-center justify-between bg-sky-wash rounded-tile px-3 py-2.5 border border-hairline">
        <div>
          <p className="text-xs font-bold text-ink-body">
            {isMandatory ? 'Mandatory exercise' : 'Bonus exercise'}
          </p>
          <p className="text-[10px] text-ink-muted">
            {isMandatory
              ? 'Required — shown in main Exercises section'
              : 'Optional — shown in Bonus section'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => set({ is_mandatory: exercise.is_mandatory === false ? true : false })}
          className={`relative w-10 h-5 rounded-full transition-colors ${isMandatory ? 'bg-sky' : 'bg-[#d0d3d8]'}`}
          aria-pressed={isMandatory}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isMandatory ? 'left-5' : 'left-0.5'}`}
          />
        </button>
      </div>

      {/* ── Per-type questions / data editor ── */}
      <Card padding="md">{typeEditor}</Card>
    </div>
  )
}
