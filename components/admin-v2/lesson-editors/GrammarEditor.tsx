'use client'

// 10B redesign — GRAMMAR BLOCK content editor (Phase 5, "new beside old").
//
// One presentational editor for the grammar content block:
//   GrammarEditor
//
// Pure/presentational: it receives the current ContentBlock plus an onChange
// callback and never touches the editor store directly. Title edits go through
// onChange({ ...block, title }); content edits go through updateContent(partial),
// which spreads the partial over the existing content so clearing the legacy
// `exercises` MCQ array never wipes explanation / examples / pitfalls.
//
// Behaviour is ported FAITHFULLY from the legacy editor
// app/admin/lessons/page.tsx (renderGrammarEditor 3372-3544). Styling is the
// 10B kit (@/components/student-ui) + tokens; the legacy admin colours are not
// reused. AudioButton and AttachedExercisesEditor are reused VERBATIM (not
// forked).
//
// FIELD-NAME TRAP: grammar's LEGACY practice field is content.exercises
// (MCQuestion[]); the NEW unified field is content.practice_exercises
// (AttachedExercise[]).
//
// Two intentional improvements over the legacy editor:
//   1. Pitfalls are ALWAYS rendered with a "+ Add Pitfall" button so they are
//      manually addable (legacy had no manual add — AI grammar generation, the
//      only previous source of pitfalls, is DEFERRED in this phase).
//   2. Practice exercises are UNIFIED to AttachedExercisesEditor (same idiom as
//      the media blocks). The legacy editor's MCQ-only Branch B is intentionally
//      not replicated; the effective-read + one-way migration is what the runner
//      already supports.
//
// DEFERRED (per Phase 5 scope): AI grammar generation.

import AttachedExercisesEditor from '@/components/AttachedExercisesEditor'
import AudioButton from '@/components/AudioButton'
import { legacyMcqToAttached, type AttachedExercise } from '@/lib/attached-exercise'
import type {
  ContentBlock,
  GrammarContent,
  GrammarPitfall,
} from '@/lib/lesson-editor/types'

// ── Shared props ──

interface Props {
  block: ContentBlock
  onChange: (block: ContentBlock) => void
}

// ── Shared presentational helpers (10B tokens) ──
// Duplicated locally from the Simple/Media editors so the files stay independent.

// Uppercase eyebrow label above a field (mirrors legacy 10px bold uppercase).
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
      {children}
    </span>
  )
}

// 10B-styled text input. Width is controlled by the caller via className.
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

// 10B-styled textarea (mirrors the LessonEditorView summary textarea).
function TextArea({
  value,
  onChange,
  placeholder,
  heightClass = 'h-24',
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
      className={`w-full ${heightClass} text-[15px] font-medium text-ink-body bg-white rounded-tile p-3.5 resize-y border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]`}
    />
  )
}

// ════════════════════════════════════════════════════════════════
// GrammarEditor (legacy renderGrammarEditor, page.tsx 3372-3544)
//   content: {
//     explanation, examples (string[]), exercises (legacy MCQ),
//     target_structure?, example_highlights?, practice_exercises? (NEW),
//     pitfalls?
//   }
//   Practice migration idiom: effective-read prefers `practice_exercises`, else
//   migrates the legacy MCQ `exercises`; on write we persist `practice_exercises`
//   and CLEAR `exercises: []` so the one-way migration completes. Do NOT omit
//   the clear.
// ════════════════════════════════════════════════════════════════

export default function GrammarEditor({ block, onChange }: Props) {
  const content = block.content as GrammarContent

  const updateContent = (partial: Partial<GrammarContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  // ── Examples (string[]) ──
  const examples = content.examples || []

  const addExample = () => {
    updateContent({ examples: [...examples, ''] })
  }

  const updateExample = (idx: number, value: string) => {
    const next = [...examples]
    next[idx] = value
    updateContent({ examples: next })
  }

  const removeExample = (idx: number) => {
    updateContent({ examples: examples.filter((_, i) => i !== idx) })
  }

  // ── Pitfalls (GrammarPitfall[]) — always rendered, manually addable ──
  const pitfalls = content.pitfalls || []

  const addPitfall = () => {
    updateContent({ pitfalls: [...pitfalls, { mistake: '', correct: '', tip: '' }] })
  }

  const updatePitfall = (idx: number, field: keyof GrammarPitfall, value: string) => {
    const next = [...pitfalls]
    next[idx] = { ...next[idx], [field]: value }
    updateContent({ pitfalls: next })
  }

  const removePitfall = (idx: number) => {
    updateContent({ pitfalls: pitfalls.filter((_, i) => i !== idx) })
  }

  // ── Practice exercises — unified AttachedExercise[] with on-the-fly migration ──
  // Prefer the new shape; if the block only has the legacy MCQ-only `exercises`
  // array, migrate on read. On write we persist `practice_exercises` and clear
  // the legacy `exercises` so the one-way migration completes.
  const effectiveExercises: AttachedExercise[] =
    content.practice_exercises && content.practice_exercises.length > 0
      ? content.practice_exercises
      : legacyMcqToAttached(content.exercises)

  return (
    <div className="space-y-4">
      {/* Block title */}
      <div>
        <FieldLabel>Block title</FieldLabel>
        <TextInput
          value={block.title}
          onChange={(title) => onChange({ ...block, title })}
          placeholder="e.g. Grammar: Past Simple vs. Present Perfect"
          className="w-full"
        />
      </div>

      {/* Explanation */}
      <div>
        <FieldLabel>Explanation</FieldLabel>
        <TextArea
          value={content.explanation}
          onChange={(explanation) => updateContent({ explanation })}
          placeholder="Explain the grammar rule..."
          heightClass="h-32"
        />
      </div>

      {/* Examples repeater */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>
            {examples.length} example{examples.length !== 1 ? 's' : ''}
          </FieldLabel>
          <button
            onClick={addExample}
            className="text-xs font-extrabold text-sky hover:underline"
          >
            + Add Example
          </button>
        </div>
        <div className="space-y-2">
          {examples.map((ex, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <TextInput
                value={ex}
                onChange={(v) => updateExample(idx, v)}
                placeholder="e.g. I walked to school yesterday."
                className="flex-1"
              />
              {ex.trim() && <AudioButton text={ex} />}
              <button
                onClick={() => removeExample(idx)}
                aria-label="Remove example"
                className="text-ink-muted hover:text-incorrect-fg transition-colors shrink-0 px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Target structure */}
      <div>
        <FieldLabel>Target structure to highlight (optional)</FieldLabel>
        <TextInput
          value={content.target_structure || ''}
          onChange={(target_structure) => updateContent({ target_structure })}
          placeholder="e.g. these / those"
          className="w-full"
        />
        <p className="text-xs text-ink-muted mt-1">
          Bolded in examples when shown to students.
        </p>
      </div>

      {/* Pitfalls repeater — ALWAYS rendered + manually addable */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Common pitfalls</FieldLabel>
          <button
            onClick={addPitfall}
            className="text-xs font-extrabold text-sky hover:underline"
          >
            + Add Pitfall
          </button>
        </div>
        <div className="space-y-2">
          {pitfalls.map((p, idx) => (
            <div key={idx} className="bg-sky-wash rounded-tile p-4 border border-hairline">
              <div className="grid grid-cols-1 gap-2">
                <TextInput
                  value={p.mistake}
                  onChange={(v) => updatePitfall(idx, 'mistake', v)}
                  placeholder="What students say wrong"
                  className="w-full"
                />
                <TextInput
                  value={p.correct}
                  onChange={(v) => updatePitfall(idx, 'correct', v)}
                  placeholder="The correct form"
                  className="w-full"
                />
                <TextInput
                  value={p.tip}
                  onChange={(v) => updatePitfall(idx, 'tip', v)}
                  placeholder="1-sentence tip / why"
                  className="w-full"
                />
              </div>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => removePitfall(idx)}
                  className="text-xs text-ink-muted hover:text-incorrect-fg transition-colors"
                >
                  ✕ Remove pitfall
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Practice exercises — unified AttachedExercisesEditor + one-way migration */}
      <div className="pt-4 border-t border-hairline">
        <AttachedExercisesEditor
          exercises={effectiveExercises}
          onChange={(practice_exercises) =>
            updateContent({ practice_exercises, exercises: [] })
          }
        />
      </div>
    </div>
  )
}
