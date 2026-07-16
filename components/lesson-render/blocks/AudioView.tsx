'use client'

import type { Exercise } from '@/lib/lesson-editor/types'
import { migrateBlockExercises } from '@/lib/block-exercise-migrate'
import LessonAudioPlayer from '@/components/student-ui/LessonAudioPlayer'
import { BlockExercisesRunner } from '../exerciseRunner'
import type { AudioContent } from '../types'

// ── Audio Block (student view) ──
// Inner body lifted verbatim from app/lessons/[id]/page.tsx audio branch
// (LessonAudioPlayer + comprehension exercises). onScore is the same
// handleBlockComplete(blockId, s, t) wire.
export function AudioView({
  content,
  onScore,
  testMode = false,
}: {
  content: AudioContent
  onScore?: (score: number, total: number) => void
  // Exam mode: follow-ups run without feedback (see BlockExercisesRunner).
  testMode?: boolean
}) {
  return (
    <>
      {content.audio_url ? (
        <div className="mb-6">
          <LessonAudioPlayer src={content.audio_url} />
        </div>
      ) : (
        <div className="bg-surface rounded-card p-8 text-center mb-6">
          <p className="text-sm text-ink-muted">Audio not available</p>
        </div>
      )}

      {(() => {
        // Migrated in at load (setBlocks mapper), so content.exercises is
        // already full Exercise[]. Fall back to runtime migration to stay
        // robust if a block ever reaches here unmigrated.
        const effective: Exercise[] =
          content.exercises && content.exercises.length > 0
            ? content.exercises
            : migrateBlockExercises(content.exercises, undefined)
        if (effective.length === 0) return null
        return (
          <div>
            <h2 className="text-sm font-bold text-brandblue mb-3">Comprehension exercises</h2>
            <BlockExercisesRunner
              exercises={effective}
              onScore={(s, t) => onScore?.(s, t)}
              testMode={testMode}
            />
          </div>
        )
      })()}
    </>
  )
}
