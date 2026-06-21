'use client'

// 10B redesign — MEDIA BLOCK content editors (Phase 4, "new beside old").
//
// Three presentational editors for the media content blocks:
//   VideoEditor · AudioEditor · ArticleEditor
//
// Each is pure/presentational: it receives the current ContentBlock plus an
// onChange callback and never touches the editor store directly. Title edits
// go through onChange({ ...block, title }); content edits go through
// updateContent(partial), which spreads the partial over the existing content
// so clearing legacy `questions` never wipes youtube_url / text / source /
// audio_url.
//
// Behaviour is ported FAITHFULLY from the legacy editor
// app/admin/lessons/page.tsx (renderVideoEditor 3152-3197, renderAudioEditor
// 3201-3243, renderArticleEditor 3247-3304). Styling is the 10B kit
// (@/components/student-ui) + tokens; the legacy admin colours are not reused.
// The shared components AttachedExercisesEditor and AudioSourcePicker are
// reused VERBATIM by Video / Audio (not forked).
//
// Task B: the ARTICLE editor is unified onto the REAL standalone Exercise model.
// It renders BlockExercisesEditor (full 14-type ExerciseEditor per item) behind
// a two-door (build-it-myself + generate-from-text), reading effective exercises
// via migrateBlockExercises. The legacy AttachedExercisesEditor +
// SuggestExercisesModal path is removed FROM ARTICLE ONLY — Video / Audio still
// use the bare AttachedExercise shape and are intentionally left unchanged.

import { useState } from 'react'
import AttachedExercisesEditor from '@/components/AttachedExercisesEditor'
import AudioSourcePicker from '@/components/AudioSourcePicker'
import BlockExercisesEditor from './BlockExercisesEditor'
import { Button, InlineError, SegmentedControl, Spinner } from '@/components/student-ui'
import { isImageFile } from '@/lib/lesson-editor/fileToBase64'
import { legacyMcqToAttached, type AttachedExercise } from '@/lib/attached-exercise'
import { migrateBlockExercises } from '@/lib/block-exercise-migrate'
import {
  EXERCISE_TYPES,
  type ContentBlock,
  type VideoContent,
  type AudioContent,
  type ArticleContent,
  type Exercise,
} from '@/lib/lesson-editor/types'

// A "sensible mix" of comprehension / vocabulary follow-up types that read well
// for a general (non-IELTS) article. Used by the picker's "Sensible mix"
// shortcut. Kept to a subset of EXERCISE_TYPES (audio-dependent types like
// dictation / cloze_listening are excluded — they need an audio_url).
const SENSIBLE_MIX_TYPES = [
  'multiple_choice',
  'true_or_false',
  'type_answer',
  'match_halves',
]

// Where the AI reads its source material from. "text" steers off the pasted
// article; "upload" off DOCX/PDF documents; "image" off screenshots. The chosen
// type-picker + count apply identically to all three.
type AiSource = 'text' | 'upload' | 'image'

// accept strings for the two file pickers (model: ai/AiGenerateModal.tsx).
const DOC_ACCEPT = '.pdf,.doc,.docx'
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,image/*'

// ── Shared props ──

interface Props {
  block: ContentBlock
  onChange: (block: ContentBlock) => void
}

// ── Shared presentational helpers (10B tokens) ──
// Duplicated locally from SimpleBlockEditors so the two files stay independent.

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
  type = 'text',
  className = '',
}: {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  className?: string
}) {
  return (
    <input
      type={type}
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

// The block-title field, shared by every editor. Edits flow through
// onChange({ ...block, title }).
function TitleField({
  block,
  onChange,
  placeholder,
}: Props & { placeholder: string }) {
  return (
    <div>
      <FieldLabel>Block title</FieldLabel>
      <TextInput
        value={block.title}
        onChange={(title) => onChange({ ...block, title })}
        placeholder={placeholder}
        className="w-full"
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// VideoEditor (legacy renderVideoEditor, page.tsx 3152-3197)
//   content: { youtube_url, questions (legacy MCQ), exercises? }
//   Migration idiom: effective-read prefers `exercises`, else migrates the
//   legacy MCQ `questions`; on write we persist `exercises` and CLEAR
//   `questions: []` so the one-way migration completes. Do NOT omit the clear.
// ════════════════════════════════════════════════════════════════

export function VideoEditor({ block, onChange }: Props) {
  const content = block.content as VideoContent

  const updateContent = (partial: Partial<VideoContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  // Live "Video ID" helper — only shown when the URL matches a YouTube id.
  const idMatch = content.youtube_url
    ? content.youtube_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    : null

  // Effective follow-up exercises: prefer the new shape; if the block only
  // has the legacy MCQ-only `questions` array, migrate on the fly.
  const effectiveExercises: AttachedExercise[] =
    content.exercises && content.exercises.length > 0
      ? content.exercises
      : legacyMcqToAttached(content.questions)

  return (
    <div className="space-y-4">
      <TitleField
        block={block}
        onChange={onChange}
        placeholder="e.g. Watch: TED Talk on Communication"
      />

      <div>
        <FieldLabel>YouTube URL</FieldLabel>
        <TextInput
          value={content.youtube_url}
          onChange={(youtube_url) => updateContent({ youtube_url })}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full"
        />
        {idMatch && (
          <p className="text-xs text-ink-muted mt-1">Video ID: {idMatch[1]}</p>
        )}
      </div>

      <div className="pt-4 border-t border-hairline">
        <AttachedExercisesEditor
          exercises={effectiveExercises}
          onChange={(exercises) => updateContent({ exercises, questions: [] })}
        />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// AudioEditor (legacy renderAudioEditor, page.tsx 3201-3243)
//   content: { audio_url, exercises }
//   Audio has no legacy MCQ questions, so no migration / clearing is needed.
//   The AudioSourcePicker is reused verbatim (allowAi=false, empty getText).
// ════════════════════════════════════════════════════════════════

export function AudioEditor({ block, onChange }: Props) {
  const content = block.content as AudioContent

  const updateContent = (partial: Partial<AudioContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  return (
    <div className="space-y-4">
      <TitleField
        block={block}
        onChange={onChange}
        placeholder="e.g. Listen: Podcast clip on travel"
      />

      <div>
        <FieldLabel>Audio</FieldLabel>
        <AudioSourcePicker
          value={content.audio_url}
          onChange={(url) => updateContent({ audio_url: url })}
          getText={() => ''}
          allowAi={false}
        />
        <p className="text-xs text-ink-muted mt-1.5">
          Paste a URL (Google Drive share links auto-converted) or upload an audio file (MP3, WAV, M4A, OGG — max 10 MB).
        </p>
      </div>

      <div className="pt-4 border-t border-hairline">
        <AttachedExercisesEditor
          exercises={content.exercises || []}
          onChange={(exercises) => updateContent({ exercises })}
        />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ArticleEditor (legacy renderArticleEditor, page.tsx 3247-3304)
//   content: { text, source, questions (legacy MCQ), exercises? (full Exercise[]) }
//
// Task B — Reading is now unified onto the REAL standalone Exercise model:
//   • Effective exercises are read via migrateBlockExercises(content.exercises,
//     content.questions) -> full Exercise[] (legacy MCQ / bare AttachedExercise
//     are upgraded in-memory on load).
//   • Follow-ups are edited by BlockExercisesEditor (the real ExerciseEditor per
//     item, all 14 types), threaded through to the page-level ExercisePreview
//     modal via onPreview.
//   • A TWO-DOOR sits above the list: "Build it myself" (the editor) and
//     "Generate with AI", which calls generateExercisesFromText(content.text)
//     and MERGES the returned full Exercise[] into the list.
//   • On any exercise change we persist { ...content, exercises, questions: [] }
//     — a one-way clear of the legacy MCQ array.
//   The old AttachedExercisesEditor + SuggestExercisesModal path is removed FROM
//   ARTICLE ONLY (Video / Audio still use them, unchanged).
// ════════════════════════════════════════════════════════════════

export function ArticleEditor({
  block,
  onChange,
  onPreview,
  onGenerateExercisesFromText,
  onGenerateExercisesFromUpload,
  generatingExercises,
  exercisesError,
  onClearExercisesError,
}: Props & {
  // Routes a generated/edited exercise to the page-level ExercisePreview modal.
  // ContentItemCard threads it from the page.
  onPreview?: (ex: Exercise) => void
  // Task B: AI-from-text generation. Present only in the live editor (threaded
  // from useLessonAi). When omitted (read-only harness paths), the "Generate
  // with AI" door is hidden and only the manual editor shows.
  onGenerateExercisesFromText?: (
    text: string,
    opts?: { types?: string[]; countPerType?: number },
  ) => Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }>
  // AI-from-UPLOAD generation: the teacher's own DOCX/PDF/screenshots become the
  // source instead of the pasted article text. Returns full Exercise[] (same
  // shape as -fromText). Present only in the live editor; when omitted the
  // "Upload a document" / "Upload screenshots" source options are hidden and the
  // panel falls back to text-only.
  onGenerateExercisesFromUpload?: (
    files: File[],
    opts?: { types?: string[]; countPerType?: number },
  ) => Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }>
  generatingExercises?: boolean
  exercisesError?: string | null
  onClearExercisesError?: () => void
}) {
  const content = block.content as ArticleContent

  const updateContent = (partial: Partial<ArticleContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  // Effective exercises: full standalone Exercise[]. Legacy MCQ `questions` and
  // any bare AttachedExercise entries are upgraded in-memory on read.
  const effectiveExercises: Exercise[] = migrateBlockExercises(
    content.exercises,
    content.questions,
  )

  const hasText = !!content.text && content.text.trim().length > 0

  // ── AI type-picker panel state ──
  // The "Generate with AI" button no longer fires immediately; it opens a panel
  // where the teacher chooses WHICH of the 13 exercise types to generate and how
  // many of EACH. Selection seeds with the sensible mix so one click + Generate
  // is the fast path.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(SENSIBLE_MIX_TYPES)
  const [countPerType, setCountPerType] = useState(1)
  // SOURCE: where AI reads from. Defaults to the article text. Upload sources
  // hold their own File[].
  const [source, setSource] = useState<AiSource>('text')
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])

  // The upload doors only appear when the page wired the upload callback.
  const canUpload = !!onGenerateExercisesFromUpload
  const sourceSegments: { value: AiSource; label: string }[] = [
    { value: 'text', label: "This article's text" },
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

  // Single write path for the follow-up list: persist full Exercise[] and
  // one-way clear the legacy MCQ array.
  const writeExercises = (exercises: Exercise[]) => {
    updateContent({ exercises, questions: [] })
  }

  // Files for the active upload source ([] for the text source).
  const sourceFiles = source === 'upload' ? docFiles : source === 'image' ? imageFiles : []

  // Is the active source ready to generate from?
  const sourceReady =
    source === 'text' ? hasText : sourceFiles.length > 0

  // "Generate" inside the picker: build exercises constrained to the chosen
  // types (countPerType each) FROM the active source, then MERGE the returned
  // full Exercise[] onto the effective list (re-stamping order_index so the
  // merged tail stays ordered). The type-picker + count apply to all sources.
  const handleGenerate = async () => {
    if (selectedTypes.length === 0 || !sourceReady) return
    onClearExercisesError?.()
    const opts = { types: selectedTypes, countPerType }
    let res: { ok: boolean; exercises?: Exercise[]; error?: string }
    if (source === 'text') {
      if (!onGenerateExercisesFromText) return
      res = await onGenerateExercisesFromText(content.text, opts)
    } else {
      if (!onGenerateExercisesFromUpload) return
      res = await onGenerateExercisesFromUpload(sourceFiles, opts)
    }
    if (res.ok && res.exercises && res.exercises.length > 0) {
      const merged = [...effectiveExercises, ...res.exercises].map((ex, i) => ({
        ...ex,
        order_index: i,
      }))
      writeExercises(merged)
      setDocFiles([])
      setImageFiles([])
      setPickerOpen(false)
    }
  }

  const estimatedCount = selectedTypes.length * countPerType

  return (
    <div className="space-y-4">
      <TitleField
        block={block}
        onChange={onChange}
        placeholder="e.g. Reading: Climate Change Article"
      />

      <div>
        <FieldLabel>Article text</FieldLabel>
        <TextArea
          value={content.text}
          onChange={(text) => updateContent({ text })}
          placeholder="Paste the article text here..."
          heightClass="h-40"
        />
      </div>

      <div>
        <FieldLabel>Source (optional)</FieldLabel>
        <TextInput
          value={content.source}
          onChange={(source) => updateContent({ source })}
          placeholder="e.g. BBC News"
          className="w-full"
        />
      </div>

      <div className="pt-4 border-t border-hairline space-y-3">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
          Exercises
        </p>

        {/* TWO-DOOR: build manually (always) + generate with AI. "Generate with
            AI" opens a panel where the teacher first picks a SOURCE (this
            article's text, an uploaded DOCX/PDF, or screenshots) and then which
            of the 13 types to make — the type-picker + count apply to all three
            sources. */}
        {onGenerateExercisesFromText && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClearExercisesError?.()
                  setPickerOpen((o) => !o)
                }}
                disabled={generatingExercises ?? false}
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
                        onClearExercisesError?.()
                        setSource(next)
                      }}
                      className="max-w-full overflow-x-auto"
                    />

                    {/* This article's text */}
                    {source === 'text' && !hasText && (
                      <p className="text-xs text-ink-muted">
                        Add article text above to generate exercises from it.
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
                            disabled={generatingExercises ?? false}
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
                            disabled={generatingExercises ?? false}
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
                    Add article text above to generate exercises from it.
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

                {/* Type checkboxes (all 13 types, label + icon) */}
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
                    disabled={
                      selectedTypes.length === 0 ||
                      !sourceReady ||
                      (generatingExercises ?? false)
                    }
                  >
                    {generatingExercises
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

            {generatingExercises && (
              <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                <Spinner size={18} />
                {source === 'text'
                  ? 'Reading the article and writing exercises…'
                  : 'Reading your upload and writing exercises…'}
              </div>
            )}
            {exercisesError && <InlineError message={exercisesError} />}
          </div>
        )}

        {/* Build it myself — the real 14-type ExerciseEditor per item. */}
        <BlockExercisesEditor
          exercises={effectiveExercises}
          onChange={writeExercises}
          onPreview={onPreview ?? (() => {})}
        />
      </div>
    </div>
  )
}
