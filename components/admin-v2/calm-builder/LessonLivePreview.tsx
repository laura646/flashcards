'use client'

// 10B redesign — CALM BUILDER live student preview (clickable PROTOTYPE, additive).
//
// Renders the ACTIVE content item the way a STUDENT would see it, for the PREVIEW
// pane of CalmBuilderView. This reuses the REAL student-facing renderers wherever
// they are cleanly importable, so Laura sees the actual student experience, not a
// mock:
//   • flashcards    -> FlipMode (the real flip-through review; no userEmail, so no
//                      progress/SRS writes — pure passive preview).
//   • exercise      -> ExercisePreview's runner switch (the real 14-type student
//                      runner) via a "Play as a student" launch, exactly like the
//                      live editor's preview button.
//   • video/audio/  -> the real student chrome (YouTube embed / LessonAudioPlayer /
//     article          sanitized rich-text passage) + each follow-up exercise
//                      launched through the real ExercisePreview runner.
//   • ielts_reading -> IeltsReadingBlockView (the real split-screen student view
//                      that dispatches every reading group to its runner).
//
// For block layouts that are still INLINE-ONLY in the live student page
// (mistakes / dialogue / grammar / writing / pronunciation), there is no
// extracted shared component to import. Rather than copy the live student page
// (the brief forbids extracting from it in this prototype), we render a clean,
// read-only approximation of the key content with a small note that the full
// student render arrives once that block is extracted.
//
// Additive only: imports shared pieces, mutates nothing. Lazy/interactive bits
// are wrapped in <Suspense>.

import { Suspense, lazy, useState } from 'react'
import { Button, Card, EmptyState, Pill, Spinner } from '@/components/student-ui'
import LessonAudioPlayer from '@/components/student-ui/LessonAudioPlayer'
import ExercisePreview from '@/components/ExercisePreview'
import { sanitizeRichText, looksLikeHtml } from '@/lib/html'
import {
  BLOCK_CONFIG,
  type ContentItem,
  type ContentItemType,
  type Flashcard as EditorFlashcard,
  type Exercise,
  type ContentBlock,
  type VideoContent,
  type AudioContent,
  type ArticleContent,
  type MistakesContent,
  type DialogueContent,
  type GrammarContent,
  type WritingContent,
  type PronunciationContent,
} from '@/lib/lesson-editor/types'
import type { Flashcard as DeckFlashcard } from '@/data/flashcards'
import type { ReadingExercise } from '@/lib/ielts/types'

// FlipMode + the IELTS reading view are heavy/interactive, so we lazy-load them
// (matching how the live student page lazy-loads the same modules).
const FlipMode = lazy(() => import('@/components/FlipMode'))
const IeltsReadingBlockView = lazy(() => import('@/components/ielts/IeltsReadingBlockView'))

// ── Helpers ───────────────────────────────────────────────────────────────────

// YouTube id extractor (copied from the live student page so the embed matches).
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)
  return match ? match[1] : null
}

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

// Reads the standalone follow-up exercises nested inside a media block.
function blockExercises(block: ContentBlock): Exercise[] {
  const content = block.content as { exercises?: Exercise[] } | undefined
  return Array.isArray(content?.exercises) ? content!.exercises! : []
}

function ExtractedNote({ label }: { label: string }) {
  return (
    <p className="mt-3 text-[11px] text-ink-muted italic">
      Showing the key content read-only — full student render of{' '}
      <span className="font-bold not-italic">{label}</span> once extracted.
    </p>
  )
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

  const playButton = (exercise: Exercise, text = '▶ Play as a student') => (
    <Button variant="primary" size="sm" fullWidth onClick={() => setPlaying(exercise)}>
      {text}
    </Button>
  )

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
          {playButton(exercise)}
        </div>
      )
      break
    }

    // ── Video → real YouTube embed + real runner for each follow-up ──
    case 'video': {
      const block = item.data as ContentBlock
      const content = block.content as VideoContent
      const videoId = content.youtube_url ? getYouTubeId(content.youtube_url) : null
      const exercises = blockExercises(block)
      body = (
        <div>
          {header(block.title || label)}
          {videoId ? (
            <div className="relative w-full pb-[56.25%] mb-3 rounded-card overflow-hidden bg-black">
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="bg-surface rounded-card p-6 text-center mb-3">
              <p className="text-[13px] text-ink-muted">Add a YouTube URL in the editor to preview the video.</p>
            </div>
          )}
          <FollowUps exercises={exercises} onPlay={setPlaying} />
        </div>
      )
      break
    }

    // ── Audio → the REAL LessonAudioPlayer + real runner for each follow-up ──
    case 'audio': {
      const block = item.data as ContentBlock
      const content = block.content as AudioContent
      const exercises = blockExercises(block)
      body = (
        <div>
          {header(block.title || label)}
          {content.audio_url ? (
            <div className="mb-3">
              <LessonAudioPlayer src={content.audio_url} />
            </div>
          ) : (
            <div className="bg-surface rounded-card p-6 text-center mb-3">
              <p className="text-[13px] text-ink-muted">Add an audio URL in the editor to preview the player.</p>
            </div>
          )}
          <FollowUps exercises={exercises} onPlay={setPlaying} />
        </div>
      )
      break
    }

    // ── Article → the REAL sanitized rich-text passage + real follow-up runner ──
    case 'article': {
      const block = item.data as ContentBlock
      const content = block.content as ArticleContent
      const exercises = blockExercises(block)
      body = (
        <div>
          {header(block.title || label)}
          {content.text ? (
            <div className="bg-white rounded-card border-[1.5px] border-sky-border p-4 mb-3">
              {looksLikeHtml(content.text) ? (
                <div
                  className="rte-prose text-[13px] font-normal text-ink-body leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(content.text) }}
                />
              ) : (
                <div className="text-[13px] font-normal text-ink-body leading-relaxed whitespace-pre-wrap">
                  {content.text}
                </div>
              )}
              {content.source && (
                <p className="text-[11px] text-ink-muted mt-3 pt-2 border-t border-hairline italic">
                  Source: {content.source}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted mb-3">Write or generate a passage in the editor to preview it here.</p>
          )}
          <FollowUps exercises={exercises} onPlay={setPlaying} />
        </div>
      )
      break
    }

    // ── IELTS reading → the REAL split-screen student block view ──
    case 'ielts_reading': {
      const block = item.data as ContentBlock
      const exercise = block.content as ReadingExercise
      const hasContent =
        (exercise.passage?.paragraphs?.length ?? 0) > 0 ||
        (exercise.questionGroups?.length ?? 0) > 0
      body = (
        <div>
          {header(block.title || label)}
          {hasContent ? (
            <Suspense fallback={<Spinner label="Loading reading…" />}>
              <IeltsReadingBlockView exercise={exercise} onComplete={() => {}} />
            </Suspense>
          ) : (
            <p className="text-[13px] text-ink-muted">
              Generate or build the passage + question groups in the editor to preview the full student reading view.
            </p>
          )}
        </div>
      )
      break
    }

    // ── Error corrections (mistakes) → read-only key content ──
    case 'mistakes': {
      const block = item.data as ContentBlock
      const content = block.content as MistakesContent
      body = (
        <div>
          {header(block.title || label)}
          <div className="space-y-2.5">
            {(content.mistakes || []).map((m, i) => (
              <div key={i} className="rounded-card border border-hairline bg-white p-3 space-y-1.5">
                <p className="text-[12px] rounded-tile px-2.5 py-1.5 bg-incorrect-bg text-incorrect-fg border border-incorrect-fg/20">
                  {m.original || '—'}
                </p>
                <p className="text-[12px] rounded-tile px-2.5 py-1.5 bg-correct-bg text-correct-fg border border-correct-fg/20">
                  {m.correction || '—'}
                </p>
                {m.explanation && (
                  <p className="text-[11px] text-ink-body bg-sky-wash rounded-tile px-2.5 py-1.5">
                    <span className="font-bold text-brandblue">Why? </span>
                    {m.explanation}
                  </p>
                )}
              </div>
            ))}
            {(content.mistakes || []).length === 0 && (
              <p className="text-[13px] text-ink-muted">No corrections yet — add some in the editor.</p>
            )}
          </div>
          <ExtractedNote label={label} />
        </div>
      )
      break
    }

    // ── AI Dialogue → read-only scenario + target words ──
    case 'dialogue': {
      const block = item.data as ContentBlock
      const content = block.content as DialogueContent
      body = (
        <div>
          {header(block.title || label)}
          {content.scenario && (
            <div className="rounded-card border border-hairline bg-white p-3 mb-2">
              <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-1">Scenario</p>
              <p className="text-[13px] text-ink-body whitespace-pre-wrap">{content.scenario}</p>
            </div>
          )}
          {content.starter_message && (
            <div className="rounded-card bg-sky-wash p-3 mb-2">
              <p className="text-[13px] text-ink-body">{content.starter_message}</p>
            </div>
          )}
          {content.target_words && content.target_words.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {content.target_words.map((w, i) => (
                <Pill key={i} variant="wash">{w}</Pill>
              ))}
            </div>
          )}
          <ExtractedNote label={label} />
        </div>
      )
      break
    }

    // ── Grammar → read-only rule + examples ──
    case 'grammar': {
      const block = item.data as ContentBlock
      const content = block.content as GrammarContent
      body = (
        <div>
          {header(block.title || label)}
          {content.explanation && (
            <div className="rounded-card border-[1.5px] border-sky-border bg-white p-3 mb-2">
              <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-brandblue mb-1">Rule</p>
              <p className="text-[13px] text-ink-body leading-relaxed whitespace-pre-wrap">{content.explanation}</p>
            </div>
          )}
          {content.examples && content.examples.filter(Boolean).length > 0 && (
            <div className="rounded-card bg-sky-wash p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky-text mb-1.5">Examples</p>
              <ul className="space-y-1 list-disc list-inside">
                {content.examples.filter(Boolean).map((ex, i) => (
                  <li key={i} className="text-[13px] text-ink-body">{ex}</li>
                ))}
              </ul>
            </div>
          )}
          <ExtractedNote label={label} />
        </div>
      )
      break
    }

    // ── Writing → read-only prompt + guidelines ──
    case 'writing': {
      const block = item.data as ContentBlock
      const content = block.content as WritingContent
      body = (
        <div>
          {header(block.title || label)}
          {content.prompt && (
            <div className="rounded-card border border-hairline bg-white p-3 mb-2">
              <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-1">Prompt</p>
              <p className="text-[13px] text-ink-body whitespace-pre-wrap">{content.prompt}</p>
            </div>
          )}
          {content.guidelines && (
            <p className="text-[12px] text-ink-muted whitespace-pre-wrap mb-1">{content.guidelines}</p>
          )}
          {!!content.word_limit && (
            <Pill variant="wash">{content.word_limit} words</Pill>
          )}
          <ExtractedNote label={label} />
        </div>
      )
      break
    }

    // ── Pronunciation → read-only word/phonetic/tips ──
    case 'pronunciation': {
      const block = item.data as ContentBlock
      const content = block.content as PronunciationContent
      body = (
        <div>
          {header(block.title || label)}
          <div className="space-y-2">
            {(content.words || []).filter((w) => w.word).map((w, i) => (
              <div key={i} className="rounded-card border border-hairline bg-white p-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[15px] font-bold text-ink-black">{w.word}</span>
                  {w.phonetic && <span className="text-[12px] text-sky-text">{w.phonetic}</span>}
                </div>
                {w.tips && <p className="text-[12px] text-ink-muted mt-0.5">{w.tips}</p>}
              </div>
            ))}
            {(content.words || []).filter((w) => w.word).length === 0 && (
              <p className="text-[13px] text-ink-muted">No words yet — add some in the editor.</p>
            )}
          </div>
          <ExtractedNote label={label} />
        </div>
      )
      break
    }

    default: {
      const block = item.data as ContentBlock
      body = (
        <div>
          {header(block.title || label)}
          <p className="text-[13px] text-ink-muted">
            Edit this block in the middle pane; its student layout appears here in the live app.
          </p>
          <ExtractedNote label={label} />
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

// Follow-up exercises for media blocks — each launches the REAL student runner.
function FollowUps({
  exercises,
  onPlay,
}: {
  exercises: Exercise[]
  onPlay: (ex: Exercise) => void
}) {
  if (exercises.length === 0) {
    return <p className="text-[13px] text-ink-muted">No follow-up exercises yet.</p>
  }
  return (
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
          <Button variant="primary" size="sm" fullWidth onClick={() => onPlay(ex)}>
            ▶ Play
          </Button>
        </div>
      ))}
    </div>
  )
}
