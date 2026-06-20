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
// reused VERBATIM (not forked).
//
// DEFERRED (per Phase 4 scope): the Article "✨ Suggest exercises with AI"
// button + its modal (legacy 3282-3296) are intentionally not ported.

import AttachedExercisesEditor from '@/components/AttachedExercisesEditor'
import AudioSourcePicker from '@/components/AudioSourcePicker'
import { legacyMcqToAttached, type AttachedExercise } from '@/lib/attached-exercise'
import type {
  ContentBlock,
  VideoContent,
  AudioContent,
  ArticleContent,
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
//   content: { text, source, questions (legacy MCQ), exercises? }
//   Same migration idiom as Video (effective-read + questions:[] clear).
//   The "✨ Suggest exercises with AI" button + modal are DEFERRED, so the
//   AttachedExercisesEditor is rendered directly with no spacer wrapper.
// ════════════════════════════════════════════════════════════════

export function ArticleEditor({ block, onChange }: Props) {
  const content = block.content as ArticleContent

  const updateContent = (partial: Partial<ArticleContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  const effectiveExercises: AttachedExercise[] =
    content.exercises && content.exercises.length > 0
      ? content.exercises
      : legacyMcqToAttached(content.questions)

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

      <div className="pt-4 border-t border-hairline">
        <AttachedExercisesEditor
          exercises={effectiveExercises}
          onChange={(exercises) => updateContent({ exercises, questions: [] })}
        />
      </div>
    </div>
  )
}
