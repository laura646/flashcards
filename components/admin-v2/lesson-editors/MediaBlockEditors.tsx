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
import { Button, InlineError, Spinner } from '@/components/student-ui'
import { legacyMcqToAttached, type AttachedExercise } from '@/lib/attached-exercise'
import { migrateBlockExercises } from '@/lib/block-exercise-migrate'
import type {
  ContentBlock,
  VideoContent,
  AudioContent,
  ArticleContent,
  Exercise,
} from '@/lib/lesson-editor/types'

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

  // Single write path for the follow-up list: persist full Exercise[] and
  // one-way clear the legacy MCQ array.
  const writeExercises = (exercises: Exercise[]) => {
    updateContent({ exercises, questions: [] })
  }

  // "Generate with AI" door: build exercises from the article text, then MERGE
  // the returned full Exercise[] onto the effective list (re-stamping
  // order_index so the merged tail stays ordered).
  const handleGenerate = async () => {
    if (!onGenerateExercisesFromText) return
    onClearExercisesError?.()
    const res = await onGenerateExercisesFromText(content.text)
    if (res.ok && res.exercises && res.exercises.length > 0) {
      const merged = [...effectiveExercises, ...res.exercises].map((ex, i) => ({
        ...ex,
        order_index: i,
      }))
      writeExercises(merged)
    }
  }

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

        {/* TWO-DOOR: build manually (always) + generate from the article text. */}
        {onGenerateExercisesFromText && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleGenerate()}
                disabled={!hasText || (generatingExercises ?? false)}
              >
                {generatingExercises ? 'Generating…' : '✨ Generate with AI'}
              </Button>
              {!hasText && (
                <span className="text-xs text-ink-muted">
                  Add article text above to generate exercises from it.
                </span>
              )}
            </div>
            {generatingExercises && (
              <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                <Spinner size={18} />
                Reading the article and writing exercises…
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
