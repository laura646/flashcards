'use client'

// 10B redesign — AI generation modal for SOURCE-BASED content (Phase 6, "new
// beside old"). Used by the two-door add flow for flashcards, exercises, and the
// generic blocks (mistakes / dialogue / writing / pronunciation).
//
// PRESENTATIONAL + CALLBACKS ONLY. This component gathers paste-text / uploaded
// file(s) / a single image, plus an optional preferred exercise type, and hands
// them to onSubmit. It does NOT fetch, does NOT call fileToBase64 — the page
// owns the API via useLessonAi (onSubmit -> generateFlashcards/generateExercises/
// generateBlock). The shape of `input` matches GenerateExercisesInput /
// GenerateBlockInput in lib/lesson-editor/useLessonAi.ts.
//
// Modal shell + tokens mirror LessonEditorView's delete confirm
// (fixed inset-0 bg-black/40 backdrop -> white rounded-card panel) and the 10B
// kit (@/components/student-ui). DEFER (pass 2): Google-Doc import, the
// course-vocabulary picker, suggest-from-reading, convert-type.

import { useMemo, useState } from 'react'
import {
  Button,
  InlineError,
  SegmentedControl,
  Spinner,
} from '@/components/student-ui'

export type AiSource = 'paste' | 'upload' | 'image'

export interface AiGenerateInput {
  text?: string
  file?: File
  files?: File[]
  preferredType?: string
}

interface Props {
  title: string
  /** Which source tabs to show, in order. First is selected by default. */
  sources: AiSource[]
  /** When given, renders an exercise-type <select> mapped to input.preferredType. */
  preferredTypeOptions?: { value: string; label: string }[]
  generating: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (input: AiGenerateInput) => void
}

const SOURCE_LABELS: Record<AiSource, string> = {
  paste: 'Paste text',
  upload: 'Upload file',
  image: 'Image',
}

const UPLOAD_ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png'
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,image/*'

// ── Local presentational helpers (10B tokens). Duplicated from the sibling
// editors so this file stays independent. ──

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
      {children}
    </span>
  )
}

export default function AiGenerateModal({
  title,
  sources,
  preferredTypeOptions,
  generating,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [source, setSource] = useState<AiSource>(sources[0] ?? 'paste')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [image, setImage] = useState<File | null>(null)
  const [preferredType, setPreferredType] = useState('')

  const segments = useMemo(
    () => sources.map((s) => ({ value: s, label: SOURCE_LABELS[s] })),
    [sources],
  )

  // Generate is enabled only when the active source has content.
  const hasContent =
    (source === 'paste' && text.trim().length > 0) ||
    (source === 'upload' && files.length > 0) ||
    (source === 'image' && image != null)

  const buildInput = (): AiGenerateInput => {
    const preferred = preferredType || undefined
    if (source === 'paste') return { text: text.trim(), preferredType: preferred }
    if (source === 'image') return { file: image ?? undefined, preferredType: preferred }
    return { files, preferredType: preferred }
  }

  const submit = () => {
    if (!hasContent || generating) return
    onSubmit(buildInput())
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
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              ✨ Generate with AI
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        {/* Source tabs */}
        {segments.length > 1 && (
          <SegmentedControl
            segments={segments}
            value={source}
            onChange={(next) => setSource(next)}
            className="mb-4"
          />
        )}

        {/* Paste */}
        {source === 'paste' && (
          <div className="mb-4">
            <FieldLabel>Paste your text</FieldLabel>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste the material to generate from…"
              disabled={generating}
              className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile p-3.5 resize-y border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2] disabled:opacity-60"
            />
          </div>
        )}

        {/* Upload (multiple) */}
        {source === 'upload' && (
          <div className="mb-4">
            <FieldLabel>Upload file(s)</FieldLabel>
            <label className="flex items-center justify-center gap-2 border border-dashed border-sky-border rounded-tile py-5 text-[13px] text-sky-text cursor-pointer hover:bg-sky-wash transition-colors">
              <span aria-hidden="true">⬆️</span> Choose PDF, Word, or image files
              <input
                type="file"
                accept={UPLOAD_ACCEPT}
                multiple
                disabled={generating}
                className="sr-only"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="text-[12px] text-ink-muted truncate">
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Single image */}
        {source === 'image' && (
          <div className="mb-4">
            <FieldLabel>Upload an image</FieldLabel>
            <label className="flex items-center justify-center gap-2 border border-dashed border-sky-border rounded-tile py-5 text-[13px] text-sky-text cursor-pointer hover:bg-sky-wash transition-colors">
              <span aria-hidden="true">🖼️</span> Choose an image
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                disabled={generating}
                className="sr-only"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
            </label>
            {image && <p className="mt-2 text-[12px] text-ink-muted truncate">{image.name}</p>}
          </div>
        )}

        {/* Optional exercise-type select */}
        {preferredTypeOptions && preferredTypeOptions.length > 0 && (
          <div className="mb-4">
            <FieldLabel>Exercise type (optional)</FieldLabel>
            <select
              value={preferredType}
              onChange={(e) => setPreferredType(e.target.value)}
              disabled={generating}
              className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
            >
              <option value="">Let AI choose</option>
              {preferredTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {error && <InlineError message={error} className="mb-4" />}

        {/* Generating state */}
        {generating && (
          <div className="flex items-center gap-2 mb-4 text-[13px] text-ink-muted">
            <Spinner size={18} />
            Generating… this can take a few seconds.
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="secondary" size="md" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={generating || !hasContent}
          >
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  )
}
