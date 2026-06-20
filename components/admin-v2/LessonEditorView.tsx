'use client'

// 10B redesign — Lesson EDITOR (Phase 2, "new beside old").
//
// Presentational only (state + callbacks in via props; the data contract lives
// in the useLessonEditor hook). The live editor app/admin/lessons/page.tsx is
// left 100% untouched.
//
// Phase 1 scope: edit METADATA (title / date / type / summary) and SAVE
// (draft / publish).
// Phase 2 scope (this file): the content-item list is now LIVE. Each item is a
// ContentItemCard that can move / delete / publish-toggle / collapse, and its
// body is editable for flashcards + the 4 simple blocks (writing / pronunciation
// / mistakes / dialogue). Other types stay read-only placeholders. New content
// is added via the "+ Add content" menu (Phase-2 types only). Delete is gated
// behind a local confirm modal; image picking is bridged through a single
// ImagePickerModal mounted here. AI generation is DEFERRED everywhere.

import { useState } from 'react'
import { Button, Card, TextField, SegmentedControl, EmptyState, InlineError } from '@/components/student-ui'
import { PageHeader } from '@/components/student-ui/PageHeader'
import ContentItemCard from '@/components/admin-v2/lesson-editors/ContentItemCard'
import ImagePickerModal from '@/components/ImagePickerModal'
import {
  BLOCK_CONFIG,
  type ContentItem,
  type BlockType,
} from '@/lib/lesson-editor/types'

// Lesson-type options (mirrors legacy LESSON_TYPES, page.tsx 140-145).
const LESSON_TYPE_SEGMENTS: { value: string; label: string }[] = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'mid_course_test', label: 'Mid-Course Test' },
  { value: 'final_test', label: 'Final Test' },
  { value: 'review_test', label: 'Review Test' },
]

// Phase-2 block adds (excludes flashcards, which is a special top-level add).
const ADDABLE_BLOCKS: BlockType[] = ['writing', 'pronunciation', 'mistakes', 'dialogue']

// Formats a full ISO timestamp like "Mar 12, 2025" (legacy formatAddedDate,
// page.tsx 488-494).
function formatAddedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function LessonEditorView({
  title,
  lessonDate,
  lessonType,
  summary,
  onTitleChange,
  onDateChange,
  onTypeChange,
  onSummaryChange,
  currentLessonStatus,
  editingLessonId,
  editingAuthorName,
  editingCreatedAt,
  contentItems,
  isItemPublished,
  flashcardsPublished,
  saving,
  publishing,
  error,
  onSave,
  onBack,
  onAddFlashcards,
  onAddBlock,
  onUpdateItem,
  onMoveItem,
  onRemoveItem,
  onTogglePublished,
  onToggleFlashcardsPublished,
  onToggleCollapse,
}: {
  title: string
  lessonDate: string
  lessonType: string
  summary: string
  onTitleChange: (v: string) => void
  onDateChange: (v: string) => void
  onTypeChange: (v: string) => void
  onSummaryChange: (v: string) => void
  currentLessonStatus: 'draft' | 'published'
  editingLessonId: string | null
  editingAuthorName: string | null
  editingCreatedAt: string | null
  contentItems: ContentItem[]
  isItemPublished: (item: ContentItem) => boolean
  flashcardsPublished: boolean
  saving: boolean
  publishing: boolean
  error: string | null
  onSave: (status: 'draft' | 'published') => void
  onBack: () => void
  onAddFlashcards: () => void
  onAddBlock: (type: BlockType) => void
  onUpdateItem: (index: number, data: ContentItem['data']) => void
  onMoveItem: (index: number, dir: 'up' | 'down') => void
  onRemoveItem: (index: number) => void
  onTogglePublished: (index: number) => void
  onToggleFlashcardsPublished: () => void
  onToggleCollapse: (index: number) => void
}) {
  const inFlight = saving || publishing
  const isNew = !editingLessonId
  const headingTitle = title.trim() || (isNew ? 'New Lesson' : 'Untitled lesson')

  // Local UI state — not part of the editor data contract.
  const [showDeleteIndex, setShowDeleteIndex] = useState<number | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [imagePickerState, setImagePickerState] = useState<{
    word: string
    apply: (url: string) => void
  } | null>(null)

  const hasFlashcards = contentItems.some((i) => i.type === 'flashcards')
  const canAddFlashcards = lessonType === 'lesson' && !hasFlashcards

  const handlePickImage = (word: string, apply: (url: string) => void) => {
    setImagePickerState({ word, apply })
  }

  // The publish-eye on a flashcards item toggles the top-level boolean; for any
  // other item it flips that item's own published flag.
  const handleTogglePublished = (index: number) => {
    if (contentItems[index]?.type === 'flashcards') {
      onToggleFlashcardsPublished()
    } else {
      onTogglePublished(index)
    }
  }

  return (
    <div className="font-rubik min-h-screen bg-surface pb-28">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <PageHeader
          className="mb-5"
          crumbs={[{ label: 'Lessons', onClick: onBack }, { label: headingTitle }]}
        />

        {/* ── Metadata card ── */}
        <Card padding="lg" className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-bold text-ink-black">Lesson details</h2>
            {!isNew && (editingAuthorName || editingCreatedAt) && (
              <p className="text-xs text-ink-muted">
                Created by {editingAuthorName || 'Unknown'}
                {editingCreatedAt && ` · Added ${formatAddedDate(editingCreatedAt)}`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="Title"
              required
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g. Week 5 - Travel Vocabulary"
            />
            <TextField
              label="Date"
              type="date"
              value={lessonDate}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Lesson type
            </span>
            <SegmentedControl
              segments={LESSON_TYPE_SEGMENTS}
              value={lessonType}
              onChange={onTypeChange}
              className="flex-wrap"
            />
          </div>

          <label className="block mt-4">
            <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
              Summary / Class notes
            </span>
            <textarea
              value={summary}
              onChange={(e) => onSummaryChange(e.target.value)}
              placeholder="Paste class summary here (used for AI flashcard generation)…"
              className="w-full h-24 text-[15px] font-medium text-ink-body bg-white rounded-tile p-3.5 resize-none border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]"
            />
          </label>
        </Card>

        {/* ── Lesson content (live) ── */}
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink-black">Lesson content</h2>
          {contentItems.length > 0 && (
            <span className="text-xs text-ink-muted">
              {contentItems.length} {contentItems.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {contentItems.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon="🧱"
              title="No content yet"
              hint="Add flashcards or a content block to get started."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {contentItems.map((item, idx) => (
              <ContentItemCard
                key={idx}
                item={item}
                index={idx}
                total={contentItems.length}
                published={isItemPublished(item)}
                collapsed={item.collapsed}
                lessonType={lessonType}
                onUpdate={(data) => onUpdateItem(idx, data)}
                onMove={(dir) => onMoveItem(idx, dir)}
                onRemove={() => setShowDeleteIndex(idx)}
                onTogglePublished={() => handleTogglePublished(idx)}
                onToggleCollapse={() => onToggleCollapse(idx)}
                onPickImage={handlePickImage}
              />
            ))}
          </div>
        )}

        {/* ── + Add content menu ── */}
        <div className="relative mt-4">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setAddMenuOpen((v) => !v)}
            aria-expanded={addMenuOpen}
          >
            + Add content
          </Button>

          {addMenuOpen && (
            <>
              {/* Click-away backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setAddMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute left-0 mt-2 z-20 w-64 bg-white rounded-card border border-hairline shadow-lg overflow-hidden">
                {canAddFlashcards && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddFlashcards()
                      setAddMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm font-bold text-ink-body hover:bg-sky-wash transition-colors"
                  >
                    <span aria-hidden="true">{BLOCK_CONFIG.flashcards.icon}</span>
                    <span>{BLOCK_CONFIG.flashcards.label}</span>
                  </button>
                )}
                {ADDABLE_BLOCKS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onAddBlock(type)
                      setAddMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm font-bold text-ink-body hover:bg-sky-wash transition-colors"
                  >
                    <span aria-hidden="true">{BLOCK_CONFIG[type].icon}</span>
                    <span>{BLOCK_CONFIG[type].label}</span>
                  </button>
                ))}
                <p className="px-4 py-2.5 text-[11px] text-ink-muted italic border-t border-hairline bg-surface">
                  More content types coming soon
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Sticky save bar ── */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-hairline">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          {error && <InlineError message={error} className="flex-1 min-w-[200px]" />}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="secondary" size="md" disabled={inFlight} onClick={() => onSave('draft')}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            <Button variant="primary" size="md" disabled={inFlight} onClick={() => onSave('published')}>
              {publishing ? 'Publishing…' : currentLessonStatus === 'published' ? 'Update' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Delete-confirm modal ── */}
      {showDeleteIndex !== null && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteIndex(null)}
        >
          <div
            className="bg-white rounded-card shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-ink-black mb-1.5">Delete this content?</h3>
            <p className="text-sm text-ink-muted mb-5">
              This removes the block from the lesson. It is only saved once you save the lesson.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => setShowDeleteIndex(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="!bg-incorrect-fg hover:!bg-incorrect-fg"
                onClick={() => {
                  onRemoveItem(showDeleteIndex)
                  setShowDeleteIndex(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image picker (single instance, bridged via onPickImage) ── */}
      {imagePickerState && (
        <ImagePickerModal
          word={imagePickerState.word}
          onClose={() => setImagePickerState(null)}
          onPick={(url) => {
            imagePickerState.apply(url)
            setImagePickerState(null)
          }}
        />
      )}
    </div>
  )
}

export default LessonEditorView
