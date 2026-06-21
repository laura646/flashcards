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
// AudioSourcePicker is reused VERBATIM by Audio (not forked).
//
// 10B: ALL THREE media editors (Reading / Video / Audio) are unified onto the
// REAL standalone Exercise model. Their exercises surface (two-door
// build-it-myself + generate-with-AI panel + full 14-type ExerciseEditor per
// item) is the SHARED BlockExercisesSection; effective exercises are read via
// migrateBlockExercises. Reading feeds sourceText={content.text}
// sourceLabel="article"; Video / Audio gain a TRANSCRIPT textarea (teacher aid
// for AI — not shown to students) and feed sourceText={content.transcript}
// sourceLabel="transcript". The legacy AttachedExercisesEditor +
// SuggestExercisesModal path is removed from all three.

import AudioSourcePicker from '@/components/AudioSourcePicker'
import BlockExercisesSection from './BlockExercisesSection'
import RichTextEditor from './RichTextEditor'
import { migrateBlockExercises } from '@/lib/block-exercise-migrate'
import {
  type ContentBlock,
  type VideoContent,
  type AudioContent,
  type ArticleContent,
  type Exercise,
} from '@/lib/lesson-editor/types'

// Shared AI-prop bundle threaded into each media editor's follow-up exercises
// surface (BlockExercisesSection). Identical to the Article callbacks; Video and
// Audio receive them from ContentItemCard exactly the same way. Optional so the
// read-only preview harness can omit them (the AI door hides itself).
type MediaExerciseAiProps = {
  // Routes a generated/edited exercise to the page-level ExercisePreview modal.
  onPreview?: (ex: Exercise) => void
  // AI-from-text generation (the article text / the transcript). When omitted,
  // the "Generate with AI" door is hidden and only the manual editor shows.
  onGenerateExercisesFromText?: (
    text: string,
    opts?: { types?: string[]; countPerType?: number },
  ) => Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }>
  // AI-from-UPLOAD generation (DOCX / PDF / screenshots). When omitted, the
  // upload source options are hidden and the panel falls back to text-only.
  onGenerateExercisesFromUpload?: (
    files: File[],
    opts?: { types?: string[]; countPerType?: number },
  ) => Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }>
  generatingExercises?: boolean
  exercisesError?: string | null
  onClearExercisesError?: () => void
}

// Adapt the optional-opts AI callbacks (useLessonAi) to the required-opts shape
// BlockExercisesSection expects. Returns undefined when the callback is absent
// so the matching door stays hidden. Shared by all three media editors.
function adaptFromText(
  fn: MediaExerciseAiProps['onGenerateExercisesFromText'],
) {
  return fn
    ? (text: string, opts: { types: string[]; countPerType: number }) => fn(text, opts)
    : undefined
}
function adaptFromUpload(
  fn: MediaExerciseAiProps['onGenerateExercisesFromUpload'],
) {
  return fn
    ? (files: File[], opts: { types: string[]; countPerType: number }) => fn(files, opts)
    : undefined
}

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
//   content: { youtube_url, questions (legacy MCQ), exercises? (full Exercise[]),
//              transcript? }
//
// 10B — Video is unified onto the REAL standalone Exercise model, mirroring
// Reading:
//   • Effective exercises are read via migrateBlockExercises(content.exercises,
//     content.questions) -> full Exercise[] (legacy MCQ / bare AttachedExercise
//     are upgraded in-memory on load).
//   • The shared BlockExercisesSection owns the two-door + AI panel + per-item
//     ExerciseEditor + merge. Video keeps youtube_url and gains a TRANSCRIPT
//     textarea (teacher aid for AI — NOT shown to students); the transcript is
//     the AI "generate from this" source (sourceLabel="transcript").
//   • On write we persist Exercise[] and CLEAR the legacy MCQ array
//     (questions: []) so the one-way migration completes. Do NOT omit the clear.
//   The old AttachedExercisesEditor path is removed.
// ════════════════════════════════════════════════════════════════

export function VideoEditor({
  block,
  onChange,
  onPreview,
  onGenerateExercisesFromText,
  onGenerateExercisesFromUpload,
  generatingExercises,
  exercisesError,
  onClearExercisesError,
}: Props & MediaExerciseAiProps) {
  const content = block.content as VideoContent

  const updateContent = (partial: Partial<VideoContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  // Live "Video ID" helper — only shown when the URL matches a YouTube id.
  const idMatch = content.youtube_url
    ? content.youtube_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    : null

  // Effective exercises: full standalone Exercise[]. Legacy MCQ `questions` and
  // any bare AttachedExercise entries are upgraded in-memory on read.
  const effectiveExercises: Exercise[] = migrateBlockExercises(
    content.exercises,
    content.questions,
  )

  // Single write path: persist full Exercise[] and one-way clear the legacy MCQ
  // array. Layered on top of BlockExercisesSection's onChange so the legacy-clear
  // idiom stays a Video concern.
  const writeExercises = (exercises: Exercise[]) => {
    updateContent({ exercises, questions: [] })
  }

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

      <div>
        <FieldLabel>Transcript / script (for AI — not shown to students)</FieldLabel>
        <TextArea
          value={content.transcript || ''}
          onChange={(transcript) => updateContent({ transcript })}
          placeholder="Paste the video transcript or script here. AI uses it to write exercises; students never see it."
        />
      </div>

      {/* Shared follow-up exercises surface (heading + two-door + AI panel +
          per-item ExerciseEditor + merge). Video feeds the transcript as the AI
          source and writes Exercise[] while clearing the legacy MCQ array. */}
      <BlockExercisesSection
        exercises={effectiveExercises}
        onChange={writeExercises}
        onPreview={onPreview ?? (() => {})}
        sourceText={content.transcript || ''}
        sourceLabel="transcript"
        onGenerateFromText={adaptFromText(onGenerateExercisesFromText)}
        onGenerateFromUpload={adaptFromUpload(onGenerateExercisesFromUpload)}
        generating={generatingExercises ?? false}
        error={exercisesError}
        onClearError={onClearExercisesError}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// AudioEditor (legacy renderAudioEditor, page.tsx 3201-3243)
//   content: { audio_url, exercises (full Exercise[]), transcript? }
//
// 10B — Audio is unified onto the REAL standalone Exercise model, mirroring
// Reading / Video:
//   • Audio has no legacy MCQ `questions`, so the effective read passes
//     `undefined` as the legacy arg to migrateBlockExercises and there is no
//     legacy-clear on write.
//   • The shared BlockExercisesSection owns the two-door + AI panel + per-item
//     ExerciseEditor + merge. Audio keeps its source picker and gains a
//     TRANSCRIPT textarea (teacher aid for AI — NOT shown to students); the
//     transcript is the AI "generate from this" source (sourceLabel="transcript").
//   The AudioSourcePicker is reused verbatim (allowAi=false, empty getText).
//   The old AttachedExercisesEditor path is removed.
// ════════════════════════════════════════════════════════════════

export function AudioEditor({
  block,
  onChange,
  onPreview,
  onGenerateExercisesFromText,
  onGenerateExercisesFromUpload,
  generatingExercises,
  exercisesError,
  onClearExercisesError,
}: Props & MediaExerciseAiProps) {
  const content = block.content as AudioContent

  const updateContent = (partial: Partial<AudioContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  // Effective exercises: full standalone Exercise[]. Audio carries no legacy MCQ
  // array, but any bare AttachedExercise entries are upgraded in-memory on read.
  const effectiveExercises: Exercise[] = migrateBlockExercises(
    content.exercises,
    undefined,
  )

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

      <div>
        <FieldLabel>Transcript / script (for AI — not shown to students)</FieldLabel>
        <TextArea
          value={content.transcript || ''}
          onChange={(transcript) => updateContent({ transcript })}
          placeholder="Paste the audio transcript or script here. AI uses it to write exercises; students never see it."
        />
      </div>

      {/* Shared follow-up exercises surface (heading + two-door + AI panel +
          per-item ExerciseEditor + merge). Audio feeds the transcript as the AI
          source and writes Exercise[] (no legacy MCQ array to clear). */}
      <BlockExercisesSection
        exercises={effectiveExercises}
        onChange={(exercises) => updateContent({ exercises })}
        onPreview={onPreview ?? (() => {})}
        sourceText={content.transcript || ''}
        sourceLabel="transcript"
        onGenerateFromText={adaptFromText(onGenerateExercisesFromText)}
        onGenerateFromUpload={adaptFromUpload(onGenerateExercisesFromUpload)}
        generating={generatingExercises ?? false}
        error={exercisesError}
        onClearError={onClearExercisesError}
      />
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
//   • The whole exercises surface (section heading + two-door + AI panel +
//     BlockExercisesEditor + merge logic) lives in the SHARED
//     BlockExercisesSection, now reused verbatim by Video / Audio too.
//     ArticleEditor just feeds it sourceText={content.text} sourceLabel="article"
//     and the AI callbacks, reads via migrateBlockExercises, and writes
//     Exercise[] while clearing the legacy MCQ array (questions: []) on change.
//   The old AttachedExercisesEditor + SuggestExercisesModal path is removed.
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
}: Props & MediaExerciseAiProps) {
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

  // Single write path for the follow-up list: persist full Exercise[] and
  // one-way clear the legacy MCQ array. Layered on top of BlockExercisesSection's
  // onChange so the legacy-clear idiom stays a Reading concern (Video keeps its
  // own questions; Audio has none).
  const writeExercises = (exercises: Exercise[]) => {
    updateContent({ exercises, questions: [] })
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
        {/* Rich-text passage: stored as HTML in content.text, rendered sanitized
            for students. Plain-text passages still render (plain text is valid
            HTML). The toolbar gives bold/italic/underline/highlight/colour. */}
        <RichTextEditor
          value={content.text || ''}
          onChange={(html) => updateContent({ text: html })}
          placeholder="Paste or write the reading passage…"
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

      {/* Shared follow-up exercises surface (heading + two-door + AI panel +
          per-item ExerciseEditor + merge). Reading feeds the article text as the
          AI source and writes Exercise[] while clearing the legacy MCQ array. */}
      <BlockExercisesSection
        exercises={effectiveExercises}
        onChange={writeExercises}
        onPreview={onPreview ?? (() => {})}
        sourceText={content.text || ''}
        sourceLabel="article"
        onGenerateFromText={adaptFromText(onGenerateExercisesFromText)}
        onGenerateFromUpload={adaptFromUpload(onGenerateExercisesFromUpload)}
        generating={generatingExercises ?? false}
        error={exercisesError}
        onClearError={onClearExercisesError}
      />
    </div>
  )
}
