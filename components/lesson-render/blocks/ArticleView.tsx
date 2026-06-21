'use client'

import type { Exercise } from '@/lib/lesson-editor/types'
import { migrateBlockExercises } from '@/lib/block-exercise-migrate'
import { sanitizeRichText, looksLikeHtml } from '@/lib/html'
import { BlockExercisesRunner } from '../exerciseRunner'
import type { ArticleContent } from '../types'

// ── Article Block (student view) ──
// Inner body lifted verbatim from app/lessons/[id]/page.tsx article branch
// (sanitized rich-text passage + source + comprehension exercises). onScore is
// the same handleBlockComplete(blockId, s, t) wire.
export function ArticleView({
  content,
  onScore,
}: {
  content: ArticleContent
  onScore?: (score: number, total: number) => void
}) {
  return (
    <>
      <div className="bg-white rounded-2xl border-[1.5px] border-sky-border p-6 mb-6">
        {/* Passage is stored as rich-text HTML (content.text). Render it
            sanitized at NORMAL weight (bold only where the teacher applied
            it — fixes the old always-bold render). Legacy PLAIN-TEXT
            passages have no tags, so we keep their literal line breaks with
            whitespace-pre-wrap instead of HTML rendering. */}
        {looksLikeHtml(content.text || '') ? (
          <div
            className="rte-prose text-sm font-normal text-ink-body leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: sanitizeRichText(content.text || ''),
            }}
          />
        ) : (
          <div className="text-sm font-normal text-ink-body leading-relaxed whitespace-pre-wrap">
            {content.text}
          </div>
        )}
        {content.source && (
          <p className="text-xs text-ink-muted mt-4 pt-3 border-t border-gray-100 italic">
            Source: {content.source}
          </p>
        )}
      </div>

      {(() => {
        // Migrated in at load (setBlocks mapper), so content.exercises is
        // already full Exercise[]. Fall back to runtime migration to stay
        // robust if a block ever reaches here unmigrated.
        const effective: Exercise[] =
          content.exercises && content.exercises.length > 0
            ? content.exercises
            : migrateBlockExercises(content.exercises, content.questions)
        if (effective.length === 0) return null
        return (
          <div>
            <h2 className="text-sm font-bold text-brandblue mb-3">Comprehension exercises</h2>
            <BlockExercisesRunner
              exercises={effective}
              onScore={(s, t) => onScore?.(s, t)}
            />
          </div>
        )
      })()}
    </>
  )
}
