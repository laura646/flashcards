'use client'

import { InlineQuiz } from '../InlineQuiz'
import type { MistakesContent } from '../types'

// ── Mistakes Block (student view) ──
// Inner body lifted verbatim from app/lessons/[id]/page.tsx mistakes branch.
// The page chrome (<main>, BackToLesson, header) stays in the page; this is the
// content below it. onScore is the same handleBlockComplete(blockId, s, t) wire.
export function MistakesView({
  content,
  onScore,
}: {
  content: MistakesContent
  onScore?: (score: number, total: number) => void
}) {
  return (
    <div className="space-y-4">
      {content.mistakes.map((m, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border-[1.5px] border-sky-border p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                  Incorrect
                </span>
              </div>
              <p className="text-sm bg-red-50 text-red-600 rounded-lg px-3 py-2 border border-red-200">
                {m.original}
              </p>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-green-500 uppercase tracking-wider">
                  Correct
                </span>
              </div>
              <p className="text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2 border border-green-200">
                {m.correction}
              </p>
            </div>
          </div>

          <div className="bg-sky-wash rounded-lg px-3 py-2">
            <p className="text-xs text-ink-body">
              <span className="font-bold text-brandblue">Why? </span>
              {m.explanation}
            </p>
          </div>

          {m.practice && m.practice.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-bold text-brandblue mb-2">Quick practice</p>
              <InlineQuiz questions={m.practice} onComplete={(s, t) => onScore?.(s, t)} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
