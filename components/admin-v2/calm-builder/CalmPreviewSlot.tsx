'use client'

// 10B redesign — CALM BUILDER preview slot (clickable PROTOTYPE, additive).
//
// Renders the SELECTED content item the way a student would see it. Phase 2:
// every CONTENT BLOCK routes through the SHIPPED student renderer
// (BlockStudentView, preview mode) — the SAME dispatcher the live student page
// uses — so the preview is full fidelity for every type, not a mock:
//   • flashcards -> read-only card list (passive preview).
//   • exercise   -> the REAL student runner (ExercisePreview, all 14 types) via a
//                   "Play as a student" button.
//   • every block (mistakes / video / audio / article / dialogue / grammar /
//     writing / pronunciation / ielts_reading) -> <BlockStudentView block preview
//     onScore={no-op} /> so each block shows its real student layout (media
//     blocks embed their real player + inline follow-up runners; writing is
//     driven by local state; dialogue shows the static scaffold). All callbacks
//     are no-ops so the preview never writes progress.
//
// Additive only: imports shared pieces, mutates nothing.

import { Suspense, useState } from 'react'
import { Button, Card, EmptyState, Spinner } from '@/components/student-ui'
import ExercisePreview from '@/components/ExercisePreview'
import { BlockStudentView } from '@/components/lesson-render/BlockStudentView'
import type { ContentBlock as RenderContentBlock } from '@/components/lesson-render/types'
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

export default function CalmPreviewSlot({ item }: { item: ContentItem | null }) {
  // The real student exercise runner is a full-screen modal; we open it on demand.
  const [playing, setPlaying] = useState<Exercise | null>(null)
  // Writing block is controlled by BlockStudentView; drive its text from local
  // state inside the preview so typing works, but never write progress.
  const [writingValue, setWritingValue] = useState('')

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
          <Button variant="primary" size="sm" fullWidth onClick={() => setPlaying(exercise)}>
            ▶ Play as a student
          </Button>
        </div>
      )
      break
    }

    // ── Every content block → the REAL student renderer (preview mode) ──
    case 'mistakes':
    case 'video':
    case 'audio':
    case 'article':
    case 'dialogue':
    case 'grammar':
    case 'writing':
    case 'pronunciation':
    case 'ielts_reading':
    default: {
      const block = item.data as ContentBlock
      body = (
        <div>
          <PaneTitle icon={icon} label={block.title || label} />
          <Suspense fallback={<Spinner label="Loading preview…" />}>
            <BlockStudentView
              block={block as RenderContentBlock}
              preview
              onScore={() => {}}
              onComplete={() => {}}
              writingValue={writingValue}
              onWritingChange={setWritingValue}
            />
          </Suspense>
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
