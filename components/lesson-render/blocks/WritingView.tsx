'use client'

import type { WritingContent } from '../types'

// ── Writing Block (student view) ──
// Inner body lifted verbatim from app/lessons/[id]/page.tsx writing branch
// (prompt + guidelines + textarea + word count + submit). Controlled so the
// student page keeps owning writingText/writingSaved/handleWritingSubmit — pass
// value/onChange/saved/onSubmit through unchanged. In preview/no-progress mode
// the submit is a no-op: omit onSubmit (the button stays inert).
export function WritingView({
  content,
  value,
  onChange,
  saved = false,
  onSubmit,
}: {
  content: WritingContent
  value: string
  onChange: (value: string) => void
  saved?: boolean
  onSubmit?: () => void
}) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0

  return (
    <>
      {/* Prompt */}
      <div className="bg-white rounded-2xl border-[1.5px] border-sky-border p-6 mb-4">
        <h2 className="text-xs font-bold text-brandblue uppercase tracking-wider mb-2">
          Writing prompt
        </h2>
        <p className="text-sm text-ink-body leading-relaxed">{content.prompt}</p>
      </div>

      {/* Guidelines */}
      {content.guidelines && (
        <div className="bg-sky-wash rounded-xl p-4 mb-4">
          <h2 className="text-xs font-bold text-brandblue mb-1">Guidelines</h2>
          <p className="text-xs text-ink-body leading-relaxed whitespace-pre-wrap">
            {content.guidelines}
          </p>
        </div>
      )}

      {/* Textarea */}
      <div className="relative mb-2">
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          placeholder="Start writing here..."
          rows={10}
          className="w-full border-[1.5px] border-sky-border rounded-2xl p-4 text-sm text-ink-body leading-relaxed resize-y focus:outline-none focus:border-sky transition-colors"
        />
      </div>

      {/* Word count & submit */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold ${
              content.word_limit && wordCount > content.word_limit
                ? 'text-red-500'
                : 'text-ink-muted'
            }`}
          >
            {wordCount} {content.word_limit ? `/ ${content.word_limit}` : ''} words
          </span>
          {content.word_limit && (
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  wordCount > content.word_limit ? 'bg-red-400' : 'bg-sky'
                }`}
                style={{
                  width: `${Math.min((wordCount / content.word_limit) * 100, 100)}%`,
                }}
              />
            </div>
          )}
        </div>
        {saved && (
          <span className="text-xs text-green-500 font-bold">Saved!</span>
        )}
      </div>

      <button
        onClick={() => onSubmit?.()}
        disabled={!value.trim() || saved}
        className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saved ? 'Submitted' : 'Submit writing'}
      </button>
    </>
  )
}
