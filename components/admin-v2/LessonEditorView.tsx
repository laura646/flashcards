'use client'

// 10B redesign — Lesson EDITOR (Phase 1 skeleton, "new beside old").
//
// Presentational only (state + callbacks in via props; the data contract lives
// in the useLessonEditor hook). The live editor app/admin/lessons/page.tsx is
// left 100% untouched.
//
// Phase 1 scope: edit METADATA (title / date / type / summary) and SAVE
// (draft / publish). The lesson content items render as READ-ONLY PLACEHOLDER
// cards — type icon + label + a tiny summary + a muted "editing coming soon"
// note. No block / exercise / AI editing yet.

import { Button, Card, TextField, SegmentedControl, EmptyState, InlineError } from '@/components/student-ui'
import { PageHeader } from '@/components/student-ui/PageHeader'
import {
  BLOCK_CONFIG,
  type ContentItem,
  type ContentItemType,
  type Flashcard,
  type Exercise,
  type ContentBlock,
} from '@/lib/lesson-editor/types'

// Lesson-type options (mirrors legacy LESSON_TYPES, page.tsx 140-145).
const LESSON_TYPE_SEGMENTS: { value: string; label: string }[] = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'mid_course_test', label: 'Mid-Course Test' },
  { value: 'final_test', label: 'Final Test' },
  { value: 'review_test', label: 'Review Test' },
]

// Formats a full ISO timestamp like "Mar 12, 2025" (legacy formatAddedDate,
// page.tsx 488-494).
function formatAddedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

// Per-item placeholder label/summary. Mirrors legacy getBlockLabel
// (page.tsx 749-761) but read-only: flashcards -> "N cards"; exercise -> its
// title + type; block -> its title (falling back to the block config label).
function itemSummary(item: ContentItem): { icon: string; label: string; sub: string } {
  const cfg = BLOCK_CONFIG[item.type as ContentItemType]
  if (item.type === 'flashcards') {
    const cards = item.data as Flashcard[]
    return {
      icon: cfg?.icon || '📚',
      label: cfg?.label || 'Vocabulary / Flashcards',
      sub: `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`,
    }
  }
  if (item.type === 'exercise') {
    const ex = item.data as Exercise
    return {
      icon: cfg?.icon || '🎯',
      label: ex.title || 'Exercise',
      sub: ex.exercise_type || 'Exercise',
    }
  }
  const b = item.data as ContentBlock
  return {
    icon: cfg?.icon || '📄',
    label: b.title || cfg?.label || item.type,
    sub: cfg?.label || item.type,
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
  saving,
  publishing,
  error,
  onSave,
  onBack,
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
  saving: boolean
  publishing: boolean
  error: string | null
  onSave: (status: 'draft' | 'published') => void
  onBack: () => void
}) {
  const inFlight = saving || publishing
  const isNew = !editingLessonId
  const headingTitle = title.trim() || (isNew ? 'New Lesson' : 'Untitled lesson')

  return (
    <div className="font-rubik min-h-screen bg-surface pb-28">
      <div className="max-w-3xl mx-auto px-4 py-6">
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

        {/* ── Lesson content (read-only placeholders) ── */}
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
              hint="Flashcards, exercises and blocks will appear here. Adding content here is coming soon — use the current editor for now."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {contentItems.map((item, idx) => {
              const { icon, label, sub } = itemSummary(item)
              return (
                <Card key={idx} className="opacity-95">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl leading-none shrink-0" aria-hidden="true">
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink-black truncate">{label}</p>
                      {sub && <p className="text-xs text-sky-text mt-0.5">{sub}</p>}
                      <p className="text-[11px] text-ink-muted mt-2 italic">
                        Editing this here is coming soon — use the current editor for now.
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Sticky save bar ── */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-hairline">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
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
    </div>
  )
}

export default LessonEditorView
