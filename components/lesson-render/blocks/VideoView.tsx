'use client'

import type { Exercise } from '@/lib/lesson-editor/types'
import { migrateBlockExercises } from '@/lib/block-exercise-migrate'
import { BlockExercisesRunner } from '../exerciseRunner'
import { getYouTubeId } from '../youtube'
import type { VideoContent } from '../types'

// ── Video Block (student view) ──
// Inner body lifted verbatim from app/lessons/[id]/page.tsx video branch
// (YouTube embed + comprehension exercises). onScore is the same
// handleBlockComplete(blockId, s, t) wire.
export function VideoView({
  content,
  onScore,
  testMode = false,
}: {
  content: VideoContent
  onScore?: (score: number, total: number) => void
  // Exam mode: follow-ups run without feedback (see BlockExercisesRunner).
  testMode?: boolean
}) {
  const videoId = getYouTubeId(content.youtube_url)

  return (
    <>
      {videoId ? (
        <div className="relative w-full pb-[56.25%] mb-6 rounded-2xl overflow-hidden bg-black">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="bg-gray-100 rounded-2xl p-8 text-center mb-6">
          <p className="text-sm text-ink-muted">Video not available</p>
        </div>
      )}

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
              testMode={testMode}
            />
          </div>
        )
      })()}
    </>
  )
}
