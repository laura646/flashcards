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
// Task D (Phase 6): the Article "✨ Suggest exercises with AI" button + its
// modal (legacy 3282-3296) are now ported. The suggest fn is threaded in via
// the optional onSuggestExercises prop (page -> ContentItemCard -> ArticleEditor);
// when absent the editor renders exactly as it did in Phase 4.

import { useState } from 'react'
import AttachedExercisesEditor from '@/components/AttachedExercisesEditor'
import AudioSourcePicker from '@/components/AudioSourcePicker'
import { Button, InlineError, Spinner } from '@/components/student-ui'
import { legacyMcqToAttached, type AttachedExercise } from '@/lib/attached-exercise'
import type {
  ContentBlock,
  VideoContent,
  AudioContent,
  ArticleContent,
} from '@/lib/lesson-editor/types'
import type { SuggestExResult } from '@/lib/lesson-editor/useLessonAi'

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

// ── Suggest-exercises-from-reading (task D) ──
// The exercise types the server supports for reading follow-ups (route.ts
// L774 whitelist; matches legacy SUGGEST_EX_TYPES, page.tsx 348-355).
const SUGGEST_EX_TYPES: { value: string; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_or_false', label: 'True or False' },
  { value: 'type_answer', label: 'Type the Answer' },
  { value: 'group_sort', label: 'Group Sort' },
  { value: 'rank_order', label: 'Rank Order' },
  { value: 'anagram', label: 'Unjumble' },
]

const SUGGEST_COUNT_OPTIONS = [3, 5, 8]

// Small modal: pick exercise types + a per-type count, then generate. The
// caller (ArticleEditor) merges the returned AttachedExercise[] into the block.
function SuggestExercisesModal({
  generating,
  error,
  onClose,
  onGenerate,
}: {
  generating: boolean
  error?: string | null
  onClose: () => void
  onGenerate: (types: string[], count: number) => void
}) {
  const [types, setTypes] = useState<string[]>(['multiple_choice'])
  const [count, setCount] = useState(5)

  const toggle = (value: string) => {
    setTypes((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))
  }

  const canGenerate = types.length > 0

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-card shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Suggest exercises with AI"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              ✨ Generate with AI
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5">Suggest exercises from reading</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        <p className="text-[13px] text-ink-muted mb-4">
          The AI reads the article text and writes comprehension exercises tied to it.
        </p>

        <div className="space-y-4">
          <div>
            <FieldLabel>Exercise types</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {SUGGEST_EX_TYPES.map((t) => {
                const checked = types.includes(t.value)
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
                      onChange={() => toggle(t.value)}
                      disabled={generating}
                      className="accent-sky"
                    />
                    {t.label}
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <FieldLabel>Questions per type</FieldLabel>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={generating}
              className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
            >
              {SUGGEST_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </select>
          </div>

          {error && <InlineError message={error} />}

          {generating && (
            <div className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Spinner size={18} />
              Generating… this can take a few seconds.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-5">
          <Button variant="secondary" size="md" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => onGenerate(types, count)}
            disabled={generating || !canGenerate}
          >
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ArticleEditor (legacy renderArticleEditor, page.tsx 3247-3304)
//   content: { text, source, questions (legacy MCQ), exercises? }
//   Same migration idiom as Video (effective-read + questions:[] clear).
//   Task D: the "✨ Suggest exercises with AI" button + modal are now wired —
//   when onSuggestExercises is provided, the generated AttachedExercise[] is
//   MERGED into the block's effective exercises (questions cleared on write).
// ════════════════════════════════════════════════════════════════

export function ArticleEditor({
  block,
  onChange,
  onSuggestExercises,
  generatingSuggest,
  suggestError,
  onClearSuggestError,
}: Props & {
  // Task D: present only in the live editor (the page threads it from
  // useLessonAi). When omitted (e.g. the read-only harness paths), the suggest
  // button is hidden and the editor stays exactly as before.
  onSuggestExercises?: (articleText: string, types: string[], count: number) => Promise<SuggestExResult>
  generatingSuggest?: boolean
  suggestError?: string | null
  onClearSuggestError?: () => void
}) {
  const content = block.content as ArticleContent
  const [suggestOpen, setSuggestOpen] = useState(false)

  const updateContent = (partial: Partial<ArticleContent>) => {
    onChange({ ...block, content: { ...content, ...partial } })
  }

  const effectiveExercises: AttachedExercise[] =
    content.exercises && content.exercises.length > 0
      ? content.exercises
      : legacyMcqToAttached(content.questions)

  const hasText = !!content.text && content.text.trim().length > 0

  const openSuggest = () => {
    onClearSuggestError?.()
    setSuggestOpen(true)
  }

  const closeSuggest = () => {
    setSuggestOpen(false)
    onClearSuggestError?.()
  }

  // Generate, then MERGE the returned exercises onto the effective list and
  // persist via onChange (clearing legacy questions per the migration idiom).
  const handleGenerate = async (types: string[], count: number) => {
    if (!onSuggestExercises) return
    const res = await onSuggestExercises(content.text, types, count)
    if (res.ok && res.exercises) {
      const merged = [...effectiveExercises, ...res.exercises]
      updateContent({ exercises: merged, questions: [] })
      closeSuggest()
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

      <div className="pt-4 border-t border-hairline">
        {onSuggestExercises && (
          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
              Follow-up exercises
            </p>
            <Button variant="secondary" size="sm" onClick={openSuggest} disabled={!hasText}>
              ✨ Suggest exercises with AI
            </Button>
          </div>
        )}
        <AttachedExercisesEditor
          exercises={effectiveExercises}
          onChange={(exercises) => updateContent({ exercises, questions: [] })}
        />
      </div>

      {suggestOpen && onSuggestExercises && (
        <SuggestExercisesModal
          generating={generatingSuggest ?? false}
          error={suggestError}
          onClose={closeSuggest}
          onGenerate={(types, count) => {
            void handleGenerate(types, count)
          }}
        />
      )}
    </div>
  )
}
