'use client'

// 10B redesign — CALM BUILDER live student preview (clickable PROTOTYPE, additive).
//
// Renders the ACTIVE content item the way a STUDENT would see it, for the PREVIEW
// pane of CalmBuilderView. Phase 2: every CONTENT BLOCK now routes through the
// SHIPPED student renderer (BlockStudentView, preview mode) so Laura sees the
// REAL student experience — full fidelity, no lightweight placeholders:
//   • flashcards    -> FlipMode (the real flip-through review; no userEmail, so no
//                      progress/SRS writes — pure passive preview).
//   • exercise      -> ExercisePreview's runner switch (the real 14-type student
//                      runner) via a "Play as a student" launch, exactly like the
//                      live editor's preview button.
//   • every block   -> <BlockStudentView block preview onScore={no-op} /> — the
//     (mistakes /     SAME dispatcher the live student page renders through, so
//     video / audio / media blocks embed their real YouTube/audio/passage chrome AND
//     article /       their real follow-up exercise runners inline; grammar /
//     dialogue /      mistakes / pronunciation show their real student layout;
//     grammar /       writing is driven by local state (no progress writes);
//     writing /       dialogue shows the static preview scaffold (no live chat);
//     pronunciation / ielts_reading dispatches to the real split-screen reading
//     ielts_reading)  view. All callbacks are no-ops so the preview never writes
//                     progress.
//
// Additive only: imports shared pieces, mutates nothing. Lazy/interactive bits
// are wrapped in <Suspense>.

import { Suspense, lazy, useState } from 'react'
import { Button, Card, EmptyState, Spinner } from '@/components/student-ui'
import ExercisePreview from '@/components/ExercisePreview'
import { BlockStudentView } from '@/components/lesson-render/BlockStudentView'
import type { ContentBlock as RenderContentBlock } from '@/components/lesson-render/types'
import {
  BLOCK_CONFIG,
  type ContentItem,
  type ContentItemType,
  type Flashcard as EditorFlashcard,
  type Exercise,
  type ContentBlock,
} from '@/lib/lesson-editor/types'
import type { Flashcard as DeckFlashcard } from '@/data/flashcards'

// FlipMode is heavy/interactive, so we lazy-load it (matching how the live
// student page lazy-loads the same module).
const FlipMode = lazy(() => import('@/components/FlipMode'))

// ── Helpers ───────────────────────────────────────────────────────────────────

// FlipMode wants the deck Flashcard shape (id: number). The editor stores the
// lesson Flashcard shape (id?: string + order_index). Map across so the REAL
// FlipMode renders the teacher's in-progress cards without a type clash.
function toDeckCards(cards: EditorFlashcard[]): DeckFlashcard[] {
  return cards.map((c, i) => ({
    id: i,
    word: c.word,
    phonetic: c.phonetic,
    meaning: c.meaning,
    example: c.example,
    notes: c.notes,
    image_url: c.image_url,
  }))
}

// ── The preview ────────────────────────────────────────────────────────────────

export default function LessonLivePreview({
  items,
  activeIndex,
}: {
  items: ContentItem[]
  activeIndex: number
}) {
  // The real student exercise runner is a full-screen modal; open it on demand.
  const [playing, setPlaying] = useState<Exercise | null>(null)
  // Writing block is controlled by BlockStudentView; drive its text from local
  // state inside the preview so typing works, but never write progress.
  const [writingValue, setWritingValue] = useState('')

  const safeIndex = items.length === 0 ? -1 : Math.min(Math.max(activeIndex, 0), items.length - 1)
  const item = safeIndex >= 0 ? items[safeIndex] : null

  if (!item) {
    return (
      <EmptyState
        icon="👁"
        title="Live preview"
        hint="Select an item in the outline to see it exactly as a student would."
      />
    )
  }

  const cfg = BLOCK_CONFIG[item.type as ContentItemType]
  const icon = cfg?.icon || '📄'
  const label = cfg?.label || item.type

  const header = (titleText: string) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
      <h3 className="text-sm font-bold text-ink-black truncate">{titleText}</h3>
    </div>
  )

  let body: React.ReactNode

  switch (item.type) {
    // ── Flashcards → the REAL FlipMode student review ──
    case 'flashcards': {
      const cards = (item.data as EditorFlashcard[]) || []
      body = (
        <div>
          {header(`${cards.length} flashcard${cards.length !== 1 ? 's' : ''}`)}
          {cards.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No cards yet — add some in the editor.</p>
          ) : (
            <Suspense fallback={<Spinner label="Loading cards…" />}>
              <FlipMode cards={toDeckCards(cards)} onComplete={() => {}} />
            </Suspense>
          )}
        </div>
      )
      break
    }

    // ── Exercise → the REAL ExercisePreview runner (all 14 types) ──
    case 'exercise': {
      const exercise = item.data as Exercise
      const qCount = Array.isArray(exercise.questions) ? exercise.questions.length : 0
      body = (
        <div>
          {header(exercise.title || 'Exercise')}
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
    // Same dispatcher the live student page uses: media blocks embed their real
    // video/audio/passage chrome AND their real follow-up exercise runners
    // inline; mistakes / grammar / pronunciation render their real layouts;
    // writing is controlled by local state; dialogue shows the static preview
    // scaffold; ielts_reading dispatches to the real reading view. All callbacks
    // are no-ops so the preview never writes progress.
    case 'mistakes':
    case 'video':
    case 'audio':
    case 'article':
    case 'dialogue':
    case 'grammar':
    case 'writing':
    case 'pronunciation':
    case 'ielts_reading': {
      const block = item.data as ContentBlock
      body = (
        <div>
          {header(block.title || label)}
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
      break
    }

    default: {
      const block = item.data as ContentBlock
      body = (
        <div>
          {header(block.title || label)}
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
      {playing && <ExercisePreview exercise={playing} onClose={() => setPlaying(null)} />}
    </>
  )
}
