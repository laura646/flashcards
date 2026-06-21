'use client'

import { lazy, Suspense, type ReactNode } from 'react'
import type { ReadingExercise } from '@/lib/ielts/types'
import { ExerciseLoadingFallback } from './exerciseRunner'
import { MistakesView } from './blocks/MistakesView'
import { VideoView } from './blocks/VideoView'
import { AudioView } from './blocks/AudioView'
import { ArticleView } from './blocks/ArticleView'
import { GrammarView } from './blocks/GrammarView'
import { WritingView } from './blocks/WritingView'
import { PronunciationView } from './blocks/PronunciationView'
import { DialogueView } from './blocks/DialogueView'
import type {
  ContentBlock,
  MistakesContent,
  VideoContent,
  AudioContent,
  ArticleContent,
  GrammarContent,
  WritingContent,
  PronunciationContent,
  DialogueContent,
} from './types'

const IeltsReadingBlockView = lazy(() => import('@/components/ielts/IeltsReadingBlockView'))

// ── Block dispatcher (student view) ──
// Single import that renders the inner body of ANY content block by switching
// on block_type. Renders EXACTLY the inline JSX the student page used; the page
// chrome (<main>, BackToLesson, header) stays in the caller.
//
// Score wiring is unchanged: pass onScore (-> handleBlockComplete(blockId,s,t))
// for mistakes/video/audio/article/grammar; onComplete for ielts_reading.
//
// Writing is controlled — the caller owns the text/saved state (writingValue,
// onWritingChange, writingSaved, onWritingSubmit) so student behaviour is
// identical. In preview/no-progress mode, omit onWritingSubmit (inert button).
//
// Dialogue: pass `preview` for the static scaffold, or supply the live
// <DialogueChat /> as `dialogueLive` for the student page (live chat untouched).
export function BlockStudentView({
  block,
  preview = false,
  onScore,
  onComplete,
  writingValue = '',
  onWritingChange,
  writingSaved = false,
  onWritingSubmit,
  dialogueLive,
}: {
  block: ContentBlock
  preview?: boolean
  onScore?: (score: number, total: number) => void
  onComplete?: (score: number, total: number) => void
  writingValue?: string
  onWritingChange?: (value: string) => void
  writingSaved?: boolean
  onWritingSubmit?: () => void
  dialogueLive?: ReactNode
}) {
  switch (block.block_type) {
    case 'mistakes':
      return <MistakesView content={block.content as MistakesContent} onScore={onScore} />
    case 'video':
      return <VideoView content={block.content as VideoContent} onScore={onScore} />
    case 'audio':
      return <AudioView content={block.content as AudioContent} onScore={onScore} />
    case 'article':
      return <ArticleView content={block.content as ArticleContent} onScore={onScore} />
    case 'grammar':
      return <GrammarView content={block.content as GrammarContent} onScore={onScore} />
    case 'writing':
      return (
        <WritingView
          content={block.content as WritingContent}
          value={writingValue}
          onChange={onWritingChange ?? (() => {})}
          saved={writingSaved}
          onSubmit={onWritingSubmit}
        />
      )
    case 'pronunciation':
      return <PronunciationView content={block.content as PronunciationContent} />
    case 'dialogue':
      return (
        <DialogueView content={block.content as DialogueContent} preview={preview}>
          {dialogueLive}
        </DialogueView>
      )
    case 'ielts_reading':
      return (
        <Suspense fallback={<ExerciseLoadingFallback />}>
          <IeltsReadingBlockView
            exercise={block.content as ReadingExercise}
            onComplete={onComplete}
          />
        </Suspense>
      )
    default:
      // ── Fallback for unknown block types ──
      return (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-sm text-ink-muted">
            This content type is not yet supported.
          </p>
        </div>
      )
  }
}
