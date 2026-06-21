'use client'

// 10B redesign — CONTENT ITEM CARD shell (Phase 2, "new beside old").
//
// Presentational only. Wraps a single ContentItem in a 10B Card with a header
// row (icon + label + summary, collapse chevron, move up/down, publish-eye,
// delete) and a collapsible body that dispatches to the right editor by type.
//
// Phase 2 editable types: flashcards + the 4 simple blocks (writing /
// pronunciation / mistakes / dialogue). Phase 4 adds the 3 media blocks
// (video / audio / article). Phase 5 adds grammar. Every block type now has a
// real editor — no read-only placeholders remain.
//
// All mutations flow OUT via the callback props — this component owns no editor
// state. The parent (LessonEditorView) owns the delete-confirm modal and the
// ImagePickerModal; here onRemove just asks the parent to confirm, and
// onPickImage just bridges to the parent's picker.

import { Button, Card, Pill } from '@/components/student-ui'
import {
  BLOCK_CONFIG,
  getBlockSummary,
  type ContentItem,
  type ContentItemType,
  type Flashcard,
  type ContentBlock,
  type Exercise,
} from '@/lib/lesson-editor/types'
import FlashcardsEditor from './FlashcardsEditor'
import ExerciseEditor from './ExerciseEditor'
import {
  WritingEditor,
  PronunciationEditor,
  MistakesEditor,
  DialogueEditor,
} from './SimpleBlockEditors'
import {
  VideoEditor,
  AudioEditor,
  ArticleEditor,
} from './MediaBlockEditors'
import GrammarEditor from './GrammarEditor'
import IeltsReadingEditor, { type IeltsReadingBlock } from '@/components/ielts/editors/IeltsReadingEditor'

interface Props {
  item: ContentItem
  index: number
  total: number
  published: boolean
  collapsed: boolean
  lessonType: string
  onUpdate: (data: ContentItem['data']) => void
  onMove: (dir: 'up' | 'down') => void
  onRemove: () => void
  onTogglePublished: () => void
  onToggleCollapse: () => void
  onPickImage: (word: string, apply: (url: string) => void) => void
  onPreview: (exercise: Exercise) => void
  // Task B: generate-exercises-from-text for the Article editor's "Generate with
  // AI" door. Threaded from the page (useLessonAi). Optional — omitted in
  // read-only harness paths, where the AI door is hidden.
  onGenerateExercisesFromText?: (
    text: string,
  ) => Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }>
  generatingExercises?: boolean
  exercisesError?: string | null
  onClearExercisesError?: () => void
}

// Small square icon button for the header controls.
function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="inline-flex items-center justify-center w-7 h-7 rounded-tile text-ink-muted hover:text-sky hover:bg-sky-wash transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

export default function ContentItemCard({
  item,
  index,
  total,
  published,
  collapsed,
  lessonType,
  onUpdate,
  onMove,
  onRemove,
  onTogglePublished,
  onToggleCollapse,
  onPickImage,
  onPreview,
  onGenerateExercisesFromText,
  generatingExercises,
  exercisesError,
  onClearExercisesError,
}: Props) {
  const cfg = BLOCK_CONFIG[item.type as ContentItemType]
  const icon = cfg?.icon || '📄'
  const label = cfg?.label || item.type
  const summary = getBlockSummary(item)

  const isFirst = index === 0
  const isLast = index === total - 1

  return (
    <Card
      padding="md"
      className={
        published
          ? ''
          : 'border-2 border-dashed border-sky-border opacity-60'
      }
    >
      {/* ── Header (clickable -> collapse) ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleCollapse}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleCollapse()
          }
        }}
        className="flex items-center gap-3 cursor-pointer select-none"
      >
        <div className="text-2xl leading-none shrink-0" aria-hidden="true">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-ink-black truncate">{label}</p>
            {!published && <Pill variant="wash">Hidden</Pill>}
          </div>
          <p className="text-xs text-sky-text mt-0.5 truncate">{summary}</p>
        </div>

        {/* Controls — stopPropagation so they don't toggle collapse */}
        <div className="flex items-center gap-0.5 shrink-0">
          <IconBtn label="Move up" disabled={isFirst} onClick={() => onMove('up')}>
            ▲
          </IconBtn>
          <IconBtn label="Move down" disabled={isLast} onClick={() => onMove('down')}>
            ▼
          </IconBtn>
          <IconBtn
            label={published ? 'Hide from students' : 'Show to students'}
            onClick={onTogglePublished}
          >
            {published ? '👁' : '🚫'}
          </IconBtn>
          <IconBtn label="Delete" onClick={onRemove}>
            🗑
          </IconBtn>
          <IconBtn
            label={collapsed ? 'Expand' : 'Collapse'}
            onClick={onToggleCollapse}
          >
            <span
              className={`inline-block transition-transform ${collapsed ? '' : 'rotate-180'}`}
            >
              ⌄
            </span>
          </IconBtn>
        </div>
      </div>

      {/* ── Body (only when expanded) ── */}
      {!collapsed && (
        <div className="mt-4 pt-4 border-t border-hairline">
          {renderBody()}
        </div>
      )}
    </Card>
  )

  function renderBody() {
    switch (item.type) {
      case 'flashcards':
        return (
          <FlashcardsEditor
            cards={item.data as Flashcard[]}
            onChange={(cards) => onUpdate(cards)}
            onPickImage={onPickImage}
          />
        )
      case 'writing':
        return (
          <WritingEditor
            block={item.data as ContentBlock}
            onChange={(block) => onUpdate(block)}
          />
        )
      case 'pronunciation':
        return (
          <PronunciationEditor
            block={item.data as ContentBlock}
            onChange={(block) => onUpdate(block)}
          />
        )
      case 'mistakes':
        return (
          <MistakesEditor
            block={item.data as ContentBlock}
            onChange={(block) => onUpdate(block)}
          />
        )
      case 'dialogue':
        return (
          <DialogueEditor
            block={item.data as ContentBlock}
            onChange={(block) => onUpdate(block)}
          />
        )
      case 'video':
        return (
          <VideoEditor
            block={item.data as ContentBlock}
            onChange={(block) => onUpdate(block)}
          />
        )
      case 'audio':
        return (
          <AudioEditor
            block={item.data as ContentBlock}
            onChange={(block) => onUpdate(block)}
          />
        )
      case 'article':
        return (
          <ArticleEditor
            block={item.data as ContentBlock}
            onChange={(block) => onUpdate(block)}
            onPreview={onPreview}
            onGenerateExercisesFromText={onGenerateExercisesFromText}
            generatingExercises={generatingExercises}
            exercisesError={exercisesError}
            onClearExercisesError={onClearExercisesError}
          />
        )
      case 'grammar':
        return (
          <GrammarEditor
            block={item.data as ContentBlock}
            onChange={(block) => onUpdate(block)}
          />
        )
      case 'ielts_reading':
        return (
          <IeltsReadingEditor
            block={item.data as unknown as IeltsReadingBlock}
            onChange={(block) => onUpdate(block as unknown as ContentBlock)}
          />
        )
      case 'exercise':
        return (
          <ExerciseEditor
            exercise={item.data as Exercise}
            onChange={onUpdate}
            onPreview={onPreview}
          />
        )
      default:
        return null
    }
  }
}
