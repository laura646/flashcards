'use client'

// 10B redesign — CALM BUILDER preview slot (clickable PROTOTYPE, additive).
//
// Renders the SELECTED content item the way a student would see it, for the
// PREVIEW pane of CalmBuilderView. There is no single shared "student lesson
// composer" component in the repo (the live student lesson rendering is not
// extracted), so this slot composes a faithful student-style view per type and,
// for exercises, hands off to the REAL student runner (ExercisePreview, which
// dispatches all 14 exercise types) via a "Play as a student" button.
//
// Additive only: imports shared pieces, mutates nothing.

import { useState } from 'react'
import { Button, Card, EmptyState, Pill } from '@/components/student-ui'
import ExercisePreview from '@/components/ExercisePreview'
import {
  BLOCK_CONFIG,
  type ContentItem,
  type ContentItemType,
  type Flashcard,
  type Exercise,
  type ContentBlock,
} from '@/lib/lesson-editor/types'

function PaneTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
      <h3 className="text-sm font-bold text-ink-black">{label}</h3>
    </div>
  )
}

// Reads the standalone exercises nested inside a media block (video / audio /
// article all keep an `exercises: Exercise[]` array in 10B).
function blockExercises(block: ContentBlock): Exercise[] {
  const content = block.content as { exercises?: Exercise[] } | undefined
  return Array.isArray(content?.exercises) ? content!.exercises! : []
}

export default function CalmPreviewSlot({ item }: { item: ContentItem | null }) {
  // The real student exercise runner is a full-screen modal; we open it on demand.
  const [playing, setPlaying] = useState<Exercise | null>(null)

  if (!item) {
    return (
      <EmptyState
        icon="👁"
        title="Live preview"
        hint="Select an item to see it exactly as a student would."
      />
    )
  }

  const cfg = BLOCK_CONFIG[item.type as ContentItemType]
  const icon = cfg?.icon || '📄'
  const label = cfg?.label || item.type

  // Small button that launches the REAL student runner for an exercise.
  const playButton = (exercise: Exercise, text = '▶ Play as a student') => (
    <Button variant="primary" size="sm" fullWidth onClick={() => setPlaying(exercise)}>
      {text}
    </Button>
  )

  let body: React.ReactNode

  switch (item.type) {
    case 'flashcards': {
      const cards = (item.data as Flashcard[]) || []
      body = (
        <div>
          <PaneTitle icon={icon} label={`${cards.length} flashcard${cards.length !== 1 ? 's' : ''}`} />
          {cards.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No cards yet — add some in the editor.</p>
          ) : (
            <div className="space-y-2">
              {cards.slice(0, 6).map((c, i) => (
                <div key={i} className="rounded-tile border border-hairline bg-surface px-3 py-2.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[15px] font-bold text-ink-black">{c.word || '—'}</span>
                    {c.phonetic && <span className="text-[12px] text-sky-text">{c.phonetic}</span>}
                  </div>
                  {c.meaning && <p className="text-[13px] text-ink-body mt-0.5">{c.meaning}</p>}
                  {c.example && <p className="text-[12px] text-ink-muted italic mt-0.5">“{c.example}”</p>}
                </div>
              ))}
              {cards.length > 6 && (
                <p className="text-[12px] text-ink-muted text-center pt-1">
                  + {cards.length - 6} more card{cards.length - 6 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      )
      break
    }

    case 'exercise': {
      const exercise = item.data as Exercise
      const qCount = Array.isArray(exercise.questions) ? exercise.questions.length : 0
      body = (
        <div>
          <PaneTitle icon={icon} label={exercise.title || 'Exercise'} />
          <div className="rounded-tile border border-hairline bg-surface px-3 py-3 mb-3">
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-1">
              {exercise.exercise_type || 'exercise'}
            </p>
            {exercise.instructions && (
              <p className="text-[13px] text-ink-body">{exercise.instructions}</p>
            )}
            <p className="text-[12px] text-ink-muted mt-1.5">
              {qCount} question{qCount !== 1 ? 's' : ''}
            </p>
          </div>
          {playButton(exercise)}
        </div>
      )
      break
    }

    case 'video':
    case 'audio':
    case 'article': {
      const block = item.data as ContentBlock
      const exercises = blockExercises(block)
      const content = block.content as { youtube_url?: string; audio_url?: string; text?: string }
      body = (
        <div>
          <PaneTitle icon={icon} label={block.title || label} />
          {item.type === 'video' && content.youtube_url && (
            <p className="text-[12px] text-sky-text break-all mb-2">{content.youtube_url}</p>
          )}
          {item.type === 'audio' && content.audio_url && (
            <p className="text-[12px] text-sky-text break-all mb-2">{content.audio_url}</p>
          )}
          {item.type === 'article' && content.text && (
            <p className="text-[13px] text-ink-body whitespace-pre-wrap line-clamp-[12] mb-3">
              {content.text}
            </p>
          )}
          {exercises.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                Follow-up exercises
              </p>
              {exercises.map((ex, i) => (
                <div key={i} className="rounded-tile border border-hairline bg-surface px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[13px] font-bold text-ink-black truncate">
                      {ex.title || `Exercise ${i + 1}`}
                    </span>
                    <Pill variant="wash">{ex.exercise_type}</Pill>
                  </div>
                  {playButton(ex, '▶ Play')}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">No follow-up exercises yet.</p>
          )}
        </div>
      )
      break
    }

    default: {
      // mistakes / dialogue / grammar / writing / pronunciation / ielts_reading
      const block = item.data as ContentBlock
      body = (
        <div>
          <PaneTitle icon={icon} label={block.title || label} />
          <p className="text-[13px] text-ink-muted">
            This block renders for students in the live lesson. Edit it in the middle pane;
            the student-facing layout for <span className="font-bold">{label}</span> appears here in
            the live app.
          </p>
        </div>
      )
    }
  }

  return (
    <>
      <Card padding="md">{body}</Card>
      {playing && (
        <ExercisePreview exercise={playing} onClose={() => setPlaying(null)} />
      )}
    </>
  )
}
