'use client'

// 10B redesign — Google-Doc import modal (Phase 6, pass 2, "new beside old").
//
// PRESENTATIONAL + CALLBACKS ONLY. This component collects a Google-Doc URL and
// hands it to onImport; the page owns the API via useLessonAi.importGoogleDoc.
// Once a parsed result arrives (passed back in via the `result` prop), it shows
// a PREVIEW of the suggested title / summary snippet / vocabulary chips /
// mistakes count, and lets the teacher pick which sections to apply via
// checkboxes + an "Add everything" button. onApply hands the chosen sections
// back; the page applies them through the editor hook (setTitle / setSummary /
// appendGeneratedFlashcards / appendGeneratedBlock).
//
// Modal shell + tokens mirror the sibling AiGenerateModal (fixed inset-0
// bg-black/40 backdrop -> white rounded-card panel) and the 10B kit
// (@/components/student-ui).

import { useState } from 'react'
import {
  Button,
  InlineError,
  Pill,
  Spinner,
} from '@/components/student-ui'
import type { ImportDocResult } from '@/lib/lesson-editor/useLessonAi'

export interface ImportApplyOptions {
  title: boolean
  summary: boolean
  flashcards: boolean
  mistakes: boolean
}

interface Props {
  generating: boolean
  error?: string | null
  result?: ImportDocResult | null
  onImport: (url: string) => void
  onApply: (opts: ImportApplyOptions) => void
  onClose: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
      {children}
    </span>
  )
}

export default function ImportDocModal({
  generating,
  error,
  result,
  onImport,
  onApply,
  onClose,
}: Props) {
  const [url, setUrl] = useState('')

  // Per-section apply checkboxes. Only meaningful once a result is present; each
  // defaults to on when its section actually has content.
  const [applyTitle, setApplyTitle] = useState(true)
  const [applySummary, setApplySummary] = useState(true)
  const [applyFlashcards, setApplyFlashcards] = useState(true)
  const [applyMistakes, setApplyMistakes] = useState(true)

  const hasResult = result != null
  const hasTitle = !!result?.suggestedTitle
  const hasSummary = !!result?.summary?.trim()
  const flashcardCount = result?.flashcards.length ?? 0
  const mistakesCount = result?.mistakes.length ?? 0

  // The summary preview is just the first slice — keep the modal compact.
  const summarySnippet = (result?.summary || '').trim().slice(0, 220)
  const summaryTruncated = (result?.summary || '').trim().length > 220

  const canImport = url.trim().length > 0 && !generating

  const submitUrl = () => {
    if (!canImport) return
    onImport(url)
  }

  // "Add everything" applies every section that actually has content, regardless
  // of the individual checkboxes.
  const applyEverything = () => {
    onApply({
      title: hasTitle,
      summary: hasSummary,
      flashcards: flashcardCount > 0,
      mistakes: mistakesCount > 0,
    })
  }

  // "Add selected" honours the checkboxes, gated by whether the section exists.
  const applySelected = () => {
    onApply({
      title: applyTitle && hasTitle,
      summary: applySummary && hasSummary,
      flashcards: applyFlashcards && flashcardCount > 0,
      mistakes: applyMistakes && mistakesCount > 0,
    })
  }

  const nothingSelected =
    !(applyTitle && hasTitle) &&
    !(applySummary && hasSummary) &&
    !(applyFlashcards && flashcardCount > 0) &&
    !(applyMistakes && mistakesCount > 0)

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
        aria-label="Import from Google Doc"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              📄 Import from Google Doc
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5">
              Build a lesson from your class notes
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        {/* URL input */}
        <div className="mb-4">
          <FieldLabel>Google Doc link</FieldLabel>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/…"
            disabled={generating}
            className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2] disabled:opacity-60"
          />
          <p className="mt-1.5 text-[12px] text-ink-muted leading-relaxed">
            The doc must be shared so anyone can view it: open it → <span className="font-bold">Share</span> → change
            to <span className="font-bold">“Anyone with the link”</span> → Viewer.
          </p>
        </div>

        {/* Import button */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="primary" size="md" onClick={submitUrl} disabled={!canImport}>
            {generating ? 'Importing…' : hasResult ? 'Re-import' : 'Import'}
          </Button>
          {generating && (
            <span className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Spinner size={18} />
              Reading the doc…
            </span>
          )}
        </div>

        {/* Error */}
        {error && <InlineError message={error} className="mb-4" />}

        {/* Preview + apply controls */}
        {hasResult && !generating && (
          <div className="border-t border-hairline pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-3">
              What we found
            </p>

            <div className="space-y-3">
              {/* Title */}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyTitle && hasTitle}
                  disabled={!hasTitle}
                  onChange={(e) => setApplyTitle(e.target.checked)}
                  className="mt-1 accent-sky"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink-black">Suggested title</span>
                  <span className="block text-[13px] text-ink-body truncate">
                    {hasTitle ? result!.suggestedTitle : 'None suggested'}
                  </span>
                </span>
              </label>

              {/* Summary */}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={applySummary && hasSummary}
                  disabled={!hasSummary}
                  onChange={(e) => setApplySummary(e.target.checked)}
                  className="mt-1 accent-sky"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink-black">Summary / class notes</span>
                  <span className="block text-[13px] text-ink-body leading-relaxed">
                    {hasSummary
                      ? `${summarySnippet}${summaryTruncated ? '…' : ''}`
                      : 'No summary found'}
                  </span>
                </span>
              </label>

              {/* Flashcards */}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyFlashcards && flashcardCount > 0}
                  disabled={flashcardCount === 0}
                  onChange={(e) => setApplyFlashcards(e.target.checked)}
                  className="mt-1 accent-sky"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink-black">
                    Vocabulary{' '}
                    <span className="font-medium text-ink-muted">
                      ({flashcardCount} {flashcardCount === 1 ? 'word' : 'words'})
                    </span>
                  </span>
                  {flashcardCount > 0 ? (
                    <span className="flex flex-wrap gap-1.5 mt-1.5">
                      {result!.flashcards.slice(0, 12).map((fc, i) => (
                        <Pill key={i} variant="wash">
                          {fc.word || '—'}
                        </Pill>
                      ))}
                      {flashcardCount > 12 && (
                        <span className="text-[12px] text-ink-muted self-center">
                          +{flashcardCount - 12} more
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="block text-[13px] text-ink-muted">No vocabulary found</span>
                  )}
                </span>
              </label>

              {/* Mistakes */}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyMistakes && mistakesCount > 0}
                  disabled={mistakesCount === 0}
                  onChange={(e) => setApplyMistakes(e.target.checked)}
                  className="mt-1 accent-sky"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink-black">
                    Common mistakes{' '}
                    <span className="font-medium text-ink-muted">
                      ({mistakesCount} {mistakesCount === 1 ? 'correction' : 'corrections'})
                    </span>
                  </span>
                  <span className="block text-[13px] text-ink-body">
                    {mistakesCount > 0
                      ? 'Added as a Common Mistakes block.'
                      : 'No mistakes found'}
                  </span>
                </span>
              </label>
            </div>

            {/* Apply footer */}
            <div className="flex items-center justify-end gap-3 pt-5">
              <Button variant="secondary" size="md" onClick={applySelected} disabled={nothingSelected}>
                Add selected
              </Button>
              <Button variant="primary" size="md" onClick={applyEverything}>
                Add everything
              </Button>
            </div>
          </div>
        )}

        {/* When there is no result yet, a plain Cancel keeps the modal escapable. */}
        {!hasResult && !generating && (
          <div className="flex items-center justify-end pt-1">
            <Button variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
