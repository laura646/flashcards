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
import CreateChooser from '@/components/student-ui/CreateChooser'
import ContentItemCard from '@/components/admin-v2/lesson-editors/ContentItemCard'
import ImagePickerModal from '@/components/ImagePickerModal'
import ExercisePreview from '@/components/ExercisePreview'
import AiGenerateModal, { type AiGenerateInput, type AiSource } from '@/components/admin-v2/lesson-editors/ai/AiGenerateModal'
import GrammarAiForm, { type GrammarAiFormValues } from '@/components/admin-v2/lesson-editors/ai/GrammarAiForm'
import ReadingAiForm, { type ReadingAiFormValues } from '@/components/admin-v2/lesson-editors/ai/ReadingAiForm'
import {
  BLOCK_CONFIG,
  EXERCISE_TYPES,
  type ContentItem,
  type BlockType,
  type Exercise,
} from '@/lib/lesson-editor/types'
import type {
  AiResult,
  GenerateExercisesInput,
  GenerateBlockInput,
  GrammarForm,
  ReadingForm,
} from '@/lib/lesson-editor/useLessonAi'

// The set of content types the two-door add flow can create. Mirrors the
// add-menu entries: flashcards, a standalone exercise, or any addable block.
type AddType = 'flashcards' | 'exercise' | BlockType

// Comma textarea -> string[] (the AI forms emit raw comma strings per the
// pass-1 contract; the hook wants a pre-split array).
function splitVocab(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// Exercise-type options for the AiGenerateModal preferred-type select.
const EXERCISE_TYPE_OPTIONS = EXERCISE_TYPES.map((t) => ({ value: t.value, label: t.label }))

// Which AiGenerateModal sources each source-based type offers.
//  - flashcards: paste only (the summary / pasted text).
//  - exercise:   paste / upload / image (+ preferred-type select).
//  - the 4 simple blocks: paste / upload (server skips non-image files, so
//    paste is the reliable path, but uploads are still forwarded).
const SOURCE_MODAL_SOURCES: Partial<Record<AddType, AiSource[]>> = {
  flashcards: ['paste'],
  exercise: ['paste', 'upload', 'image'],
  mistakes: ['paste', 'upload'],
  dialogue: ['paste', 'upload'],
  writing: ['paste', 'upload'],
  pronunciation: ['paste', 'upload'],
}

// Types that have an AI door (a generate fn wired through useLessonAi). Other
// types (video / audio) have no AI path in this pass, so they skip the chooser
// and add directly. grammar -> GrammarAiForm, article -> ReadingAiForm, the
// rest -> AiGenerateModal.
const AI_ENABLED_TYPES = new Set<AddType>([
  'flashcards',
  'exercise',
  'mistakes',
  'dialogue',
  'writing',
  'pronunciation',
  'grammar',
  'article',
])

// Human-facing label for a content type (drives CreateChooser's itemLabel).
function typeLabel(type: AddType): string {
  return BLOCK_CONFIG[type]?.label ?? type
}

// Lesson-type options (mirrors legacy LESSON_TYPES, page.tsx 140-145).
const LESSON_TYPE_SEGMENTS: { value: string; label: string }[] = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'mid_course_test', label: 'Mid-Course Test' },
  { value: 'final_test', label: 'Final Test' },
  { value: 'review_test', label: 'Review Test' },
]

// Block adds (excludes flashcards, which is a special top-level add).
// Phase 2: writing / pronunciation / mistakes / dialogue.
// Phase 4: video / audio / article.
// Phase 5: grammar.
const ADDABLE_BLOCKS: BlockType[] = ['writing', 'pronunciation', 'mistakes', 'dialogue', 'grammar', 'video', 'audio', 'article']

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
  onAddExercise,
  onAddBlock,
  onGenerateFlashcards,
  onGenerateExercises,
  onGenerateBlock,
  onGenerateGrammar,
  onGenerateReading,
  aiError,
  onClearAiError,
  generatingFlashcards,
  generatingExercises,
  generatingBlock,
  generatingGrammar,
  generatingReading,
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
  onAddExercise: () => void
  onAddBlock: (type: BlockType) => void
  // AI generate actions (from useLessonAi). Each resolves to { ok, error? };
  // the view closes the relevant modal only on ok.
  onGenerateFlashcards: (text: string) => Promise<AiResult>
  onGenerateExercises: (input: GenerateExercisesInput) => Promise<AiResult>
  onGenerateBlock: (blockType: BlockType, input: GenerateBlockInput) => Promise<AiResult>
  onGenerateGrammar: (form: GrammarForm) => Promise<AiResult>
  onGenerateReading: (form: ReadingForm) => Promise<AiResult>
  aiError: string | null
  onClearAiError: () => void
  generatingFlashcards: boolean
  generatingExercises: boolean
  generatingBlock: boolean
  generatingGrammar: boolean
  generatingReading: boolean
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
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)
  const [imagePickerState, setImagePickerState] = useState<{
    word: string
    apply: (url: string) => void
  } | null>(null)

  // ── Two-door add flow ──
  // Step 1: chooserType set -> CreateChooser modal open for that content type.
  // Step 2 (AI door): aiFlow set -> the right AI UI open for that type.
  const [chooserType, setChooserType] = useState<AddType | null>(null)
  const [aiFlow, setAiFlow] = useState<AddType | null>(null)

  const hasFlashcards = contentItems.some((i) => i.type === 'flashcards')
  const canAddFlashcards = lessonType === 'lesson' && !hasFlashcards

  const handlePickImage = (word: string, apply: (url: string) => void) => {
    setImagePickerState({ word, apply })
  }

  // Open the two-door chooser for a content type (replaces the old direct add).
  // Types with no AI door (video / audio) skip the chooser and add directly.
  const openChooser = (type: AddType) => {
    setAddMenuOpen(false)
    onClearAiError()
    if (!AI_ENABLED_TYPES.has(type)) {
      handleManual(type)
      return
    }
    setChooserType(type)
  }

  const closeChooser = () => {
    setChooserType(null)
  }

  const closeAi = () => {
    setAiFlow(null)
    onClearAiError()
  }

  // Manual door — run the existing add for the chosen type, then close.
  const handleManual = (type: AddType) => {
    if (type === 'flashcards') onAddFlashcards()
    else if (type === 'exercise') onAddExercise()
    else onAddBlock(type)
    closeChooser()
  }

  // AI door — swap the chooser for the right AI UI for the chosen type.
  const handleGenerateDoor = (type: AddType) => {
    onClearAiError()
    setChooserType(null)
    setAiFlow(type)
  }

  // Per-type generating flag for the open AI UI.
  const aiGenerating =
    aiFlow === 'flashcards'
      ? generatingFlashcards
      : aiFlow === 'exercise'
        ? generatingExercises
        : aiFlow === 'grammar'
          ? generatingGrammar
          : aiFlow === 'article'
            ? generatingReading
            : generatingBlock

  // Source-modal submit (flashcards / exercise / the 4 simple blocks).
  const handleSourceSubmit = async (type: AddType, input: AiGenerateInput) => {
    let result: AiResult
    if (type === 'flashcards') {
      result = await onGenerateFlashcards(input.text || '')
    } else if (type === 'exercise') {
      result = await onGenerateExercises({
        text: input.text,
        file: input.file,
        files: input.files,
        preferredType: input.preferredType,
      })
    } else {
      // mistakes / dialogue / writing / pronunciation
      result = await onGenerateBlock(type as BlockType, {
        text: input.text,
        files: input.files,
      })
    }
    if (result.ok) closeAi()
  }

  const handleGrammarSubmit = async (form: GrammarAiFormValues) => {
    const result = await onGenerateGrammar({
      topic: form.topic,
      level: form.level,
      known_grammar: form.known_grammar,
      num_exercises: form.num_exercises,
      exercise_types: form.exercise_types,
      vocabulary: splitVocab(form.vocabulary),
      explanation_length: form.explanation_length,
      include_pitfalls: form.include_pitfalls,
    })
    if (result.ok) closeAi()
  }

  const handleReadingSubmit = async (form: ReadingAiFormValues) => {
    const result = await onGenerateReading({
      mode: form.mode,
      level: form.level,
      length_words: form.length_words,
      style: form.style,
      source_text: form.source_text,
      source_url: form.source_url,
      source_image: form.source_image,
      reading_type: form.reading_type,
      plot: form.plot,
      vocabulary: splitVocab(form.vocabulary),
      narrator_pov: form.narrator_pov,
      characters: form.characters,
      grammar_focus: form.grammar_focus,
    })
    if (result.ok) closeAi()
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

        {/* ── Lesson content (live) — header with the Add-content menu on the right ── */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h2 className="font-bold text-ink-black">Lesson content</h2>
            {contentItems.length > 0 && (
              <span className="text-xs text-ink-muted">
                {contentItems.length} {contentItems.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>

          {/* + Add content menu (top-right) */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddMenuOpen((v) => !v)}
              aria-expanded={addMenuOpen}
            >
              + Add content
            </Button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 mt-2 z-20 w-64 bg-white rounded-card border border-hairline shadow-lg overflow-hidden">
                  {canAddFlashcards && (
                    <button
                      type="button"
                      onClick={() => openChooser('flashcards')}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm font-bold text-ink-body hover:bg-sky-wash transition-colors"
                    >
                      <span aria-hidden="true">{BLOCK_CONFIG.flashcards.icon}</span>
                      <span>{BLOCK_CONFIG.flashcards.label}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openChooser('exercise')}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm font-bold text-ink-body hover:bg-sky-wash transition-colors"
                  >
                    <span aria-hidden="true">{BLOCK_CONFIG.exercise.icon}</span>
                    <span>{BLOCK_CONFIG.exercise.label}</span>
                  </button>
                  {ADDABLE_BLOCKS.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => openChooser(type)}
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
                onPreview={setPreviewExercise}
              />
            ))}
          </div>
        )}

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

      {/* ── Exercise preview (student-facing runner) ── */}
      {previewExercise && (
        <ExercisePreview
          exercise={previewExercise}
          onClose={() => setPreviewExercise(null)}
        />
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

      {/* ── Two-door create chooser (Manual vs. Generate with AI) ── */}
      {chooserType && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeChooser}
          role="presentation"
        >
          <div
            className="bg-white rounded-card shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Add ${typeLabel(chooserType)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-extrabold text-ink-black">
                Add {typeLabel(chooserType)}
              </h3>
              <button
                onClick={closeChooser}
                aria-label="Close"
                className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
              >
                ✕
              </button>
            </div>
            <CreateChooser
              itemLabel={typeLabel(chooserType)}
              onManual={() => handleManual(chooserType)}
              onGenerate={() => handleGenerateDoor(chooserType)}
            />
          </div>
        </div>
      )}

      {/* ── AI: source-based modal (flashcards / exercise / simple blocks) ── */}
      {aiFlow && aiFlow !== 'grammar' && aiFlow !== 'article' && (
        <AiGenerateModal
          title={typeLabel(aiFlow)}
          sources={SOURCE_MODAL_SOURCES[aiFlow] ?? ['paste']}
          preferredTypeOptions={aiFlow === 'exercise' ? EXERCISE_TYPE_OPTIONS : undefined}
          generating={aiGenerating}
          error={aiError}
          onClose={closeAi}
          onSubmit={(input) => {
            void handleSourceSubmit(aiFlow, input)
          }}
        />
      )}

      {/* ── AI: grammar form ── */}
      {aiFlow === 'grammar' && (
        <GrammarAiForm
          generating={generatingGrammar}
          error={aiError}
          onClose={closeAi}
          onSubmit={(form) => {
            void handleGrammarSubmit(form)
          }}
        />
      )}

      {/* ── AI: reading / article form ── */}
      {aiFlow === 'article' && (
        <ReadingAiForm
          generating={generatingReading}
          error={aiError}
          onClose={closeAi}
          onSubmit={(form) => {
            void handleReadingSubmit(form)
          }}
        />
      )}
    </div>
  )
}

export default LessonEditorView
