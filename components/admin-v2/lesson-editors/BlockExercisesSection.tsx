'use client'

// 10B redesign — SHARED follow-up-exercises section for media content blocks
// (Reading / Video / Audio). Extracted VERBATIM from the inline exercises UI
// that used to live in ArticleEditor (MediaBlockEditors.tsx) so Video and Audio
// can reuse the exact same surface without forking.
//
// What it owns:
//   • the "Exercises" section heading
//   • the TWO-DOOR: "Build it myself" (BlockExercisesEditor — the real 14-type
//     ExerciseEditor per item, collapsible) + "Generate with AI"
//   • the AI panel: a SOURCE selector (the passed sourceText / upload a document
//     / upload screenshots) + a TYPE-PICKER (all picker types + count_per_type,
//     with sensible-mix / select-all / clear shortcuts) + spinner + InlineError
//   • MERGING the generated full Exercise[] into the existing list (re-stamping
//     order_index so the merged tail stays ordered)
//
// What it does NOT own: reading/writing the block content, or the legacy-MCQ
// clear. The caller migrates legacy follow-ups into `exercises` on read and
// persists `onChange(exercises)` (+ its own legacy clear) on write. That keeps
// the per-block content idioms (Reading clears `questions: []`; Video/Audio
// keep their own source field) out of this shared component.
//
// AI source semantics:
//   • The "generate from this <sourceLabel>" door uses `sourceText` (the article
//     text for Reading; the transcript for Video / Audio) and is disabled when
//     `sourceText` is empty.
//   • The "Upload a document" / "Upload screenshots" doors call
//     `onGenerateFromUpload`; they only appear when that callback is wired.
//   • The same type-picker + count apply to all three sources.

import { useState } from 'react'
import BlockExercisesEditor from './BlockExercisesEditor'
import { Button, InlineError, SegmentedControl, Spinner } from '@/components/student-ui'
import { isImageFile } from '@/lib/lesson-editor/fileToBase64'
import { EXERCISE_TYPES, type Exercise } from '@/lib/lesson-editor/types'

// A "sensible mix" of comprehension / vocabulary follow-up types that read well
// for a general (non-IELTS) passage. Used by the picker's "Sensible mix"
// shortcut. Kept to a subset of EXERCISE_TYPES (audio-dependent types like
// dictation / cloze_listening are excluded — they need an audio_url).
const SENSIBLE_MIX_TYPES = [
  'multiple_choice',
  'true_or_false',
  'type_answer',
  'match_halves',
]

// Where the AI reads its source material from. "text" steers off the passed
// sourceText; "upload" off DOCX/PDF documents; "image" off screenshots. The
// chosen type-picker + count apply identically to all three.
type AiSource = 'text' | 'upload' | 'image'

// accept strings for the two file pickers (model: ai/AiGenerateModal.tsx).
const DOC_ACCEPT = '.pdf,.doc,.docx'
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,image/*'

// Shape returned by both AI generators. Mirrors useLessonAi's
// generateExercisesFromText / generateExercisesFromFiles.
type GenerateResult = { ok: boolean; exercises?: Exercise[]; error?: string }
type GenerateOpts = { types: string[]; countPerType: number }

interface Props {
  // The effective follow-up list (full standalone Exercise[]). The caller is
  // responsible for migrating legacy shapes into this on read.
  exercises: Exercise[]
  // Persist the next full Exercise[]. The caller layers any legacy clear (e.g.
  // Reading's `questions: []`) on top of this.
  onChange: (exercises: Exercise[]) => void
  // Routes a generated/edited exercise to the page-level ExercisePreview modal.
  onPreview: (ex: Exercise) => void

  // The text the "generate from this <sourceLabel>" door reads from — the
  // article text for Reading, the transcript for Video / Audio. The door is
  // disabled when this is empty/whitespace.
  sourceText: string
  // Human label for the text source, e.g. "article" | "transcript". Used in the
  // segment label ("This article's text") and the empty-source hint.
  sourceLabel: string

  // AI-from-text generation. Present only in the live editor (threaded from
  // useLessonAi). When omitted, the whole "Generate with AI" door is hidden and
  // only the manual editor shows.
  onGenerateFromText?: (text: string, opts: GenerateOpts) => Promise<GenerateResult>
  // AI-from-UPLOAD generation (DOCX/PDF/screenshots). When omitted, the upload
  // source options are hidden and the panel falls back to text-only.
  onGenerateFromUpload?: (files: File[], opts: GenerateOpts) => Promise<GenerateResult>

  // Live "generating" flag (shared spinner + disabled controls).
  generating: boolean
  // Last AI error to surface inline (cleared via onClearError).
  error?: string | null
  onClearError?: () => void
}

export default function BlockExercisesSection({
  exercises,
  onChange,
  onPreview,
  sourceText,
  sourceLabel,
  onGenerateFromText,
  onGenerateFromUpload,
  generating,
  error,
  onClearError,
}: Props) {
  const hasText = !!sourceText && sourceText.trim().length > 0

  // ── AI type-picker panel state ──
  // The "Generate with AI" button no longer fires immediately; it opens a panel
  // where the teacher chooses WHICH exercise types to generate and how many of
  // EACH. Selection seeds with the sensible mix so one click + Generate is the
  // fast path.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(SENSIBLE_MIX_TYPES)
  const [countPerType, setCountPerType] = useState(1)
  // SOURCE: where AI reads from. Defaults to the passed text. Upload sources
  // hold their own File[].
  const [source, setSource] = useState<AiSource>('text')
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])

  // The upload doors only appear when the caller wired the upload callback.
  const canUpload = !!onGenerateFromUpload
  const sourceSegments: { value: AiSource; label: string }[] = [
    { value: 'text', label: `This ${sourceLabel}'s text` },
    ...(canUpload
      ? ([
          { value: 'upload', label: 'Upload a document' },
          { value: 'image', label: 'Upload screenshots' },
        ] as { value: AiSource; label: string }[])
      : []),
  ]

  const toggleType = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    )
  }
  const selectAll = () => setSelectedTypes(EXERCISE_TYPES.map((t) => t.value))
  const selectMix = () => setSelectedTypes(SENSIBLE_MIX_TYPES)
  const clearTypes = () => setSelectedTypes([])

  // Files for the active upload source ([] for the text source).
  const sourceFiles = source === 'upload' ? docFiles : source === 'image' ? imageFiles : []

  // Is the active source ready to generate from?
  const sourceReady = source === 'text' ? hasText : sourceFiles.length > 0

  // "Generate" inside the picker: build exercises constrained to the chosen
  // types (countPerType each) FROM the active source, then MERGE the returned
  // full Exercise[] onto the effective list (re-stamping order_index so the
  // merged tail stays ordered). The type-picker + count apply to all sources.
  const handleGenerate = async () => {
    if (selectedTypes.length === 0 || !sourceReady) return
    onClearError?.()
    const opts: GenerateOpts = { types: selectedTypes, countPerType }
    let res: GenerateResult
    if (source === 'text') {
      if (!onGenerateFromText) return
      res = await onGenerateFromText(sourceText, opts)
    } else {
      if (!onGenerateFromUpload) return
      res = await onGenerateFromUpload(sourceFiles, opts)
    }
    if (res.ok && res.exercises && res.exercises.length > 0) {
      const merged = [...exercises, ...res.exercises].map((ex, i) => ({
        ...ex,
        order_index: i,
      }))
      onChange(merged)
      setDocFiles([])
      setImageFiles([])
      setPickerOpen(false)
    }
  }

  const estimatedCount = selectedTypes.length * countPerType

  return (
    <div className="pt-4 border-t border-hairline space-y-3">
      <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
        Exercises
      </p>

      {/* TWO-DOOR: build manually (always) + generate with AI. "Generate with
          AI" opens a panel where the teacher first picks a SOURCE (this
          {sourceLabel}'s text, an uploaded DOCX/PDF, or screenshots) and then
          which types to make — the type-picker + count apply to all three
          sources. */}
      {onGenerateFromText && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClearError?.()
                setPickerOpen((o) => !o)
              }}
              disabled={generating}
            >
              {pickerOpen ? '✕ Close picker' : '✨ Generate with AI'}
            </Button>
          </div>

          {pickerOpen && (
            <div className="rounded-tile border-[1.5px] border-hairline bg-sky-wash p-3.5 space-y-3">
              {/* SOURCE selector — only shown when uploads are wired (otherwise
                  text is the only source and the segmented control is noise). */}
              {sourceSegments.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                    Source material
                  </p>
                  <SegmentedControl
                    segments={sourceSegments}
                    value={source}
                    onChange={(next) => {
                      onClearError?.()
                      setSource(next)
                    }}
                    className="max-w-full overflow-x-auto"
                  />

                  {/* This <sourceLabel>'s text */}
                  {source === 'text' && !hasText && (
                    <p className="text-xs text-ink-muted">
                      Add {sourceLabel} text above to generate exercises from it.
                    </p>
                  )}

                  {/* Upload a document (DOCX / PDF, single or multiple) */}
                  {source === 'upload' && (
                    <div>
                      <label className="flex items-center justify-center gap-2 border border-dashed border-sky-border rounded-tile py-4 text-[13px] text-sky-text cursor-pointer hover:bg-white/60 transition-colors">
                        <span aria-hidden="true">⬆️</span> Choose PDF or Word file(s)
                        <input
                          type="file"
                          accept={DOC_ACCEPT}
                          multiple
                          disabled={generating}
                          className="sr-only"
                          onChange={(e) =>
                            setDocFiles(Array.from(e.target.files ?? []))
                          }
                        />
                      </label>
                      {docFiles.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {docFiles.map((f, i) => (
                            <li
                              key={i}
                              className="text-[12px] text-ink-muted truncate"
                            >
                              {f.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Upload screenshots (images, single or multiple) */}
                  {source === 'image' && (
                    <div>
                      <label className="flex items-center justify-center gap-2 border border-dashed border-sky-border rounded-tile py-4 text-[13px] text-sky-text cursor-pointer hover:bg-white/60 transition-colors">
                        <span aria-hidden="true">🖼️</span> Choose screenshot(s)
                        <input
                          type="file"
                          accept={IMAGE_ACCEPT}
                          multiple
                          disabled={generating}
                          className="sr-only"
                          onChange={(e) =>
                            setImageFiles(
                              Array.from(e.target.files ?? []).filter(isImageFile),
                            )
                          }
                        />
                      </label>
                      {imageFiles.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {imageFiles.map((f, i) => (
                            <li
                              key={i}
                              className="text-[12px] text-ink-muted truncate"
                            >
                              {f.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Text-only fallback hint when uploads aren't wired. */}
              {sourceSegments.length === 1 && !hasText && (
                <p className="text-xs text-ink-muted">
                  Add {sourceLabel} text above to generate exercises from it.
                </p>
              )}

              {/* Header + convenience selectors */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  Which exercises should AI write?
                </p>
                <div className="flex items-center gap-1.5 text-[12px] font-bold">
                  <button
                    type="button"
                    onClick={selectMix}
                    className="text-sky hover:underline"
                  >
                    Sensible mix
                  </button>
                  <span className="text-ink-muted">·</span>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sky hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-ink-muted">·</span>
                  <button
                    type="button"
                    onClick={clearTypes}
                    className="text-ink-muted hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Type checkboxes (all picker types, label + icon) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {EXERCISE_TYPES.map((t) => {
                  const checked = selectedTypes.includes(t.value)
                  return (
                    <label
                      key={t.value}
                      className={`flex items-center gap-2 rounded-tile border-[1.5px] px-2.5 py-2 cursor-pointer transition-colors ${
                        checked
                          ? 'border-sky bg-white'
                          : 'border-hairline bg-white/60 hover:border-sky'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleType(t.value)}
                        className="accent-sky w-4 h-4 shrink-0"
                      />
                      <span className="text-[13px] font-semibold text-ink-body leading-tight">
                        {t.icon} {t.label}
                      </span>
                    </label>
                  )
                })}
              </div>

              {/* How many of each + Generate */}
              <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-body">
                  How many of each?
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={countPerType}
                    onChange={(e) =>
                      setCountPerType(
                        Math.max(1, Math.min(5, Number(e.target.value) || 1)),
                      )
                    }
                    className="w-16 text-[14px] font-medium text-ink-body bg-white rounded-tile px-2.5 py-1.5 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors"
                  />
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleGenerate()}
                  disabled={selectedTypes.length === 0 || !sourceReady || generating}
                >
                  {generating
                    ? 'Generating…'
                    : `Generate ${estimatedCount} exercise${estimatedCount === 1 ? '' : 's'}`}
                </Button>
              </div>
              {selectedTypes.length === 0 && (
                <p className="text-xs text-ink-muted">
                  Pick at least one exercise type.
                </p>
              )}
            </div>
          )}

          {generating && (
            <div className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Spinner size={18} />
              {source === 'text'
                ? `Reading the ${sourceLabel} and writing exercises…`
                : 'Reading your upload and writing exercises…'}
            </div>
          )}
          {error && <InlineError message={error} />}
        </div>
      )}

      {/* Build it myself — the real 14-type ExerciseEditor per item. */}
      <BlockExercisesEditor
        exercises={exercises}
        onChange={onChange}
        onPreview={onPreview}
      />
    </div>
  )
}
