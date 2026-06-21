'use client'

import type { ReactNode } from 'react'
import type { DialogueContent } from '../types'

// ── Dialogue Block (student view) ──
// The student page keeps using the live DialogueChat (fetch + LLM + mic + TTS),
// which is NOT moved here — pass it as `children` for the non-preview path so
// the live experience is untouched.
//
// In `preview` mode we render a STATIC scaffold only: scenario + target-word
// pills + the starter line. No fetch, no LLM, no mic — safe for the editor
// live preview where there's no student/session/progress wiring.
export function DialogueView({
  content,
  preview = false,
  children,
}: {
  content: DialogueContent
  preview?: boolean
  children?: ReactNode
}) {
  if (!preview) {
    // Live mode: the page supplies <DialogueChat ... /> as children.
    return <>{children}</>
  }

  // ── Static preview scaffold ──
  return (
    <div className="space-y-4">
      {content.scenario && (
        <div className="bg-white rounded-2xl border-[1.5px] border-sky-border p-5">
          <h2 className="text-xs font-bold text-brandblue uppercase tracking-wider mb-2">
            Scenario
          </h2>
          <p className="text-sm text-ink-body leading-relaxed whitespace-pre-wrap">
            {content.scenario}
          </p>
        </div>
      )}

      {content.target_words && content.target_words.length > 0 && (
        <div className="bg-sky-wash rounded-2xl p-5">
          <h2 className="text-xs font-bold text-sky-dark uppercase tracking-wider mb-3">
            Target words
          </h2>
          <div className="flex flex-wrap gap-2">
            {content.target_words.map((w, i) => (
              <span
                key={i}
                className="text-xs font-bold text-brandblue bg-white rounded-full px-3 py-1 border border-sky-border"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {content.starter_message && (
        <div className="bg-white rounded-2xl border-[1.5px] border-sky-border p-5">
          <h2 className="text-xs font-bold text-brandblue uppercase tracking-wider mb-2">
            Starter
          </h2>
          <div className="bg-sky-wash rounded-2xl rounded-tl-sm px-4 py-3 inline-block">
            <p className="text-sm text-ink-body leading-relaxed whitespace-pre-wrap">
              {content.starter_message}
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink-muted text-center">
        Live conversation (AI + mic) is disabled in preview.
      </p>
    </div>
  )
}
