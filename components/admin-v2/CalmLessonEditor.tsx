'use client'

// 10B redesign — Lesson EDITOR, CALM 3-pane body (Phase 3).
//
// This is the REAL lesson editor for /admin-beta/lessons. It keeps EVERY piece
// of chrome the prior LessonEditorView had — the breadcrumb header, the lesson /
// template METADATA card (title / date / type / level / category / summary), the
// sticky SAVE / PUBLISH bar with the unsaved-changes indicator + error display,
// the two-door "+ Add content" flow, ALL AI modals (AiGenerateModal /
// GrammarAiForm / ReadingAiForm / ImportDocModal / VocabPickerModal), the
// Content-Bank picker + Save-to-Bank wizard, the ExercisePreview runner, and the
// ImagePicker — but REPLACES the single-column vertical ContentItemCard list with
// the calm 3-pane layout from the prototype CalmBuilderView:
//   (1) OUTLINE — selectable / reorderable / deletable list of content items +
//       the two-door "+ Add content" trigger + the direct "Add from Content Bank"
//       button.
//   (2) EDIT    — the SELECTED item rendered with its REAL ContentItemCard
//       (FlashcardsEditor / ExerciseEditor / block editors / RichText / Grammar /
//       IELTS), with a per-item "Edit | Preview" toggle.
//   (3) PREVIEW (in the same pane, on the toggle) — the SELECTED item rendered as
//       a real student via the Phase-2 LessonLivePreview (the shipped student
//       renderers).
//
// Prop contract is IDENTICAL to LessonEditorView, so the page wires it as a
// drop-in. The outline selection (activeIndex) is LOCAL to this editor.
//
// The legacy LessonEditorView is intentionally left UNTOUCHED for rollback (it
// remains in git history + the file is unchanged), and /admin/* does not import
// either component, so /admin/* behavior is unaffected.

import { useRef, useState } from 'react'
import { Button, Card, Pill, TextField, SegmentedControl, EmptyState, InlineError } from '@/components/student-ui'
import { PageHeader } from '@/components/student-ui/PageHeader'
import ContentItemCard from '@/components/admin-v2/lesson-editors/ContentItemCard'
import LessonLivePreview from '@/components/admin-v2/calm-builder/LessonLivePreview'
import ImagePickerModal from '@/components/ImagePickerModal'
import ExercisePreview from '@/components/ExercisePreview'
import AiGenerateModal, { type AiGenerateInput, type AiSource } from '@/components/admin-v2/lesson-editors/ai/AiGenerateModal'
import GrammarAiForm, { type GrammarAiFormValues } from '@/components/admin-v2/lesson-editors/ai/GrammarAiForm'
import ReadingAiForm, { type ReadingAiFormValues } from '@/components/admin-v2/lesson-editors/ai/ReadingAiForm'
import ImportDocModal, { type ImportApplyOptions } from '@/components/admin-v2/lesson-editors/ai/ImportDocModal'
import VocabPickerModal, { type VocabPickerLesson } from '@/components/admin-v2/lesson-editors/ai/VocabPickerModal'
import ContentBankPickerModal from '@/components/admin-v2/lesson-editors/ai/ContentBankPickerModal'
import SaveToBankModal from '@/components/admin-v2/lesson-editors/ai/SaveToBankModal'
import {
  BLOCK_CONFIG,
  EXERCISE_TYPES,
  CEFR_OPTIONS,
  getBlockSummary,
  type ContentItem,
  type ContentItemType,
  type BlockType,
  type Exercise,
  type Flashcard,
} from '@/lib/lesson-editor/types'
import { COURSE_CATEGORIES } from '@/lib/common-issues'
import type {
  AiResult,
  GenerateExercisesInput,
  GenerateBlockInput,
  GrammarForm,
  ReadingForm,
  ImportDocResult,
  CourseVocabResult,
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
const SOURCE_MODAL_SOURCES: Partial<Record<AddType, AiSource[]>> = {
  flashcards: ['paste'],
  exercise: ['paste', 'upload', 'image'],
  mistakes: ['paste', 'upload'],
  dialogue: ['paste', 'upload'],
  writing: ['paste', 'upload'],
  pronunciation: ['paste', 'upload'],
}

// Types that have an AI door. Others (video / audio) skip the chooser and add
// directly. grammar -> GrammarAiForm, article -> ReadingAiForm, rest ->
// AiGenerateModal.
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

// Human-facing label for a content type (drives the two-door chooser heading
// and the AI modal titles).
function typeLabel(type: AddType): string {
  return BLOCK_CONFIG[type]?.label ?? type
}

// Lesson-type options (mirrors legacy LESSON_TYPES).
const LESSON_TYPE_SEGMENTS: { value: string; label: string }[] = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'mid_course_test', label: 'Mid-Course Test' },
  { value: 'final_test', label: 'Final Test' },
  { value: 'review_test', label: 'Review Test' },
]

// Block adds (excludes flashcards, which is a special top-level add). Mirrors
// LessonEditorView's ADDABLE_BLOCKS incl. the gated ielts_reading.
const ADDABLE_BLOCKS: BlockType[] = ['writing', 'pronunciation', 'mistakes', 'dialogue', 'grammar', 'video', 'audio', 'article', ...(process.env.NEXT_PUBLIC_IELTS === '1' ? (['ielts_reading'] as BlockType[]) : [])]

// Formats a full ISO timestamp like "Mar 12, 2025".
function formatAddedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function CalmLessonEditor({
  title,
  lessonDate,
  lessonType,
  summary,
  onTitleChange,
  onDateChange,
  onTypeChange,
  onSummaryChange,
  isTemplate,
  contentBankMode,
  templateCategory,
  templateLevel,
  onCategoryChange,
  onLevelChange,
  currentLessonStatus,
  editingLessonId,
  editingAuthorName,
  editingCreatedAt,
  contentItems,
  isItemPublished,
  flashcardsPublished,
  saving,
  publishing,
  dirty,
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
  onImportGoogleDoc,
  onApplyImport,
  onAddFromBank,
  onNotify,
  onFetchCourseVocabulary,
  onGenerateExercisesFromText,
  onGenerateExercisesFromUpload,
  aiError,
  onClearAiError,
  generatingFlashcards,
  generatingExercises,
  generatingBlock,
  generatingGrammar,
  generatingReading,
  generatingImport,
  generatingVocab,
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
  // Level + Category are surfaced for ALL lessons (bound to the existing
  // template_level / template_category columns) so every lesson is filterable in
  // My Library. They're optional for normal lessons; for content-bank templates
  // (contentBankMode || isTemplate) they're flagged required and the saveLesson
  // guard blocks the save until both are set. All optional props so the preview
  // harness can omit the handlers.
  isTemplate?: boolean
  contentBankMode?: boolean
  templateCategory?: string
  templateLevel?: string
  onCategoryChange?: (v: string) => void
  onLevelChange?: (v: string) => void
  currentLessonStatus: 'draft' | 'published'
  editingLessonId: string | null
  editingAuthorName: string | null
  editingCreatedAt: string | null
  contentItems: ContentItem[]
  isItemPublished: (item: ContentItem) => boolean
  flashcardsPublished: boolean
  saving: boolean
  publishing: boolean
  dirty?: boolean
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
  // Google-Doc import. onImportGoogleDoc fetches + parses the doc and returns
  // the parsed result (or an error); the view holds it in local state to drive
  // the ImportDocModal preview. onApplyImport applies the chosen sections.
  onImportGoogleDoc: (url: string) => Promise<{ ok: boolean; error?: string; data?: ImportDocResult }>
  onApplyImport: (result: ImportDocResult, opts: ImportApplyOptions) => void
  // Cherry-pick a content-bank template's items INTO the open lesson.
  onAddFromBank: (picked: {
    flashcards: Flashcard[]
    exercises: Exercise[]
    blocks: { block_type: string; title: string; content: unknown }[]
  }) => void
  // Surface a transient toast (e.g. after Save-to-Bank). Optional so the preview
  // harness can omit it.
  onNotify?: (msg: string) => void
  // Lazy-loads the course's saved flashcard words for the vocab picker.
  onFetchCourseVocabulary: () => Promise<CourseVocabResult>
  // Generate full Exercise[] from the article text / uploads — threaded into each
  // Article editor card's "Generate with AI" door.
  onGenerateExercisesFromText: (
    text: string,
    opts?: { types?: string[]; countPerType?: number },
  ) => Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }>
  onGenerateExercisesFromUpload: (
    files: File[],
    opts?: { types?: string[]; countPerType?: number },
  ) => Promise<{ ok: boolean; exercises?: Exercise[]; error?: string }>
  aiError: string | null
  onClearAiError: () => void
  generatingFlashcards: boolean
  generatingExercises: boolean
  generatingBlock: boolean
  generatingGrammar: boolean
  generatingReading: boolean
  generatingImport: boolean
  generatingVocab: boolean
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

  // Content-bank template mode — drives the required Category + Level panel.
  const templateMode = Boolean(contentBankMode || isTemplate)

  // ── Outline selection + per-item Edit/Preview toggle (LOCAL to this editor) ──
  const [activeIndex, setActiveIndex] = useState(0)
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit')

  // Lesson-details disclosure — collapsed by default to keep the top slim (the
  // builder is the focus); open for templates since Level + Category are required.
  const [detailsOpen, setDetailsOpen] = useState(templateMode)

  // Local UI state — not part of the editor data contract.
  const [showDeleteIndex, setShowDeleteIndex] = useState<number | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)
  const [imagePickerState, setImagePickerState] = useState<{
    word: string
    apply: (url: string) => void
  } | null>(null)

  // ── Two-door add flow ──
  const [chooserType, setChooserType] = useState<AddType | null>(null)
  const [aiFlow, setAiFlow] = useState<AddType | null>(null)

  // ── Google-Doc import ──
  const [importOpen, setImportOpen] = useState(false)
  const [importResult, setImportResult] = useState<ImportDocResult | null>(null)

  // ── Content-bank picker + Save-to-bank wizard ──
  const [bankOpen, setBankOpen] = useState(false)
  const [saveBankOpen, setSaveBankOpen] = useState(false)

  // ── Course-vocabulary picker ──
  const [vocabOpen, setVocabOpen] = useState(false)
  const [vocabLessons, setVocabLessons] = useState<VocabPickerLesson[] | null>(null)
  const [vocabLoading, setVocabLoading] = useState(false)
  const vocabResolverRef = useRef<((words: string[]) => void) | null>(null)

  const hasFlashcards = contentItems.some((i) => i.type === 'flashcards')
  const canAddFlashcards = lessonType === 'lesson' && !hasFlashcards

  // Clamp the selection so it always points at a real item.
  const safeIndex = contentItems.length === 0 ? -1 : Math.min(activeIndex, contentItems.length - 1)
  const activeItem = safeIndex >= 0 ? contentItems[safeIndex] : null

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

  const closeChooser = () => setChooserType(null)

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

  // ── Google-Doc import handlers ──
  const openImport = () => {
    setAddMenuOpen(false)
    onClearAiError()
    setImportResult(null)
    setImportOpen(true)
  }

  const closeImport = () => {
    setImportOpen(false)
    setImportResult(null)
    onClearAiError()
  }

  const handleImport = async (url: string) => {
    const res = await onImportGoogleDoc(url)
    if (res.ok && res.data) setImportResult(res.data)
  }

  const handleApplyImport = (opts: ImportApplyOptions) => {
    if (!importResult) return
    onApplyImport(importResult, opts)
    closeImport()
  }

  // ── Content-bank picker handlers ──
  const openBank = () => {
    setAddMenuOpen(false)
    onClearAiError()
    setBankOpen(true)
  }

  // ── Course-vocabulary picker handlers ──
  // Opens the picker and returns a promise that resolves with the chosen words
  // (or [] if cancelled). Lazy-loads the lessons on first open + caches them.
  const openVocabPicker = (): Promise<string[]> => {
    onClearAiError()
    setVocabOpen(true)
    if (vocabLessons === null) {
      setVocabLoading(true)
      void onFetchCourseVocabulary().then((res) => {
        setVocabLessons(res.ok && res.data ? res.data.lessons : [])
        setVocabLoading(false)
      })
    }
    return new Promise<string[]>((resolve) => {
      vocabResolverRef.current = resolve
    })
  }

  // Resolve the pending promise exactly once, then close.
  const settleVocab = (words: string[]) => {
    vocabResolverRef.current?.(words)
    vocabResolverRef.current = null
    setVocabOpen(false)
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

  // ── Outline row ──
  function OutlineRow({ item, idx }: { item: ContentItem; idx: number }) {
    const cfg = BLOCK_CONFIG[item.type as ContentItemType]
    const active = idx === safeIndex
    const isFirst = idx === 0
    const isLast = idx === contentItems.length - 1
    const published = isItemPublished(item)
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveIndex(idx)
          setEditMode('edit')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setActiveIndex(idx)
            setEditMode('edit')
          }
        }}
        className={`group flex items-center gap-2.5 rounded-tile px-2.5 py-2 cursor-pointer select-none transition-colors ${
          active ? 'bg-sky-wash border-[1.5px] border-sky-border' : 'border-[1.5px] border-transparent hover:bg-surface'
        }`}
      >
        <span className="text-lg leading-none shrink-0" aria-hidden="true">
          {cfg?.icon || '📄'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-[13px] font-bold truncate ${active ? 'text-brandblue' : 'text-ink-black'}`}>
              {cfg?.label || item.type}
            </p>
            {!published && <Pill variant="wash">Hidden</Pill>}
          </div>
          <p className="text-[11px] text-sky-text truncate mt-0.5">{getBlockSummary(item)}</p>
        </div>
        {/* Reorder + delete (stopPropagation so they don't change selection) */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            aria-label="Move up"
            title="Move up"
            disabled={isFirst}
            onClick={(e) => {
              e.stopPropagation()
              onMoveItem(idx, 'up')
            }}
            className="inline-flex items-center justify-center w-6 h-6 rounded-tile text-ink-muted hover:text-sky hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Move down"
            title="Move down"
            disabled={isLast}
            onClick={(e) => {
              e.stopPropagation()
              onMoveItem(idx, 'down')
            }}
            className="inline-flex items-center justify-center w-6 h-6 rounded-tile text-ink-muted hover:text-sky hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ▼
          </button>
          <button
            type="button"
            aria-label="Delete"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation()
              setShowDeleteIndex(idx)
            }}
            className="inline-flex items-center justify-center w-6 h-6 rounded-tile text-ink-muted hover:text-incorrect-fg hover:bg-white transition-colors"
          >
            🗑
          </button>
        </div>
      </div>
    )
  }

  // ── EDIT pane: the SELECTED item via the REAL ContentItemCard ──
  const editPane =
    activeItem === null ? (
      <Card padding="lg">
        <EmptyState
          icon="🧱"
          title={contentItems.length === 0 ? 'No content yet' : 'Nothing selected'}
          hint={
            contentItems.length === 0
              ? 'Add flashcards or a content block from the outline to get started.'
              : 'Pick an item in the outline to edit it here.'
          }
        />
      </Card>
    ) : (
      <ContentItemCard
        key={safeIndex}
        item={activeItem}
        index={safeIndex}
        total={contentItems.length}
        published={isItemPublished(activeItem)}
        // Always expanded in the EDIT pane — the outline owns collapse/selection.
        collapsed={false}
        lessonType={lessonType}
        onUpdate={(data) => onUpdateItem(safeIndex, data)}
        onMove={(dir) => onMoveItem(safeIndex, dir)}
        onRemove={() => setShowDeleteIndex(safeIndex)}
        onTogglePublished={() => handleTogglePublished(safeIndex)}
        onToggleCollapse={() => onToggleCollapse(safeIndex)}
        onPickImage={handlePickImage}
        onPreview={setPreviewExercise}
        onGenerateExercisesFromText={onGenerateExercisesFromText}
        onGenerateExercisesFromUpload={onGenerateExercisesFromUpload}
        generatingExercises={generatingExercises}
        exercisesError={aiError}
        onClearExercisesError={onClearAiError}
      />
    )

  // ── PREVIEW (in-pane): the ACTIVE item alone, rendered as a real student ──
  const previewPane =
    activeItem === null ? (
      <Card padding="lg">
        <EmptyState
          icon="👁"
          title="Nothing to preview"
          hint="Pick an item in the outline to see it exactly as a student would."
        />
      </Card>
    ) : (
      <LessonLivePreview items={contentItems} activeIndex={safeIndex} />
    )

  // ── Add-content menu (outline header trigger) ──
  const addMenu = (
    <div className="relative">
      <Button
        variant="primary"
        size="sm"
        fullWidth
        onClick={() => setAddMenuOpen((v) => !v)}
        aria-expanded={addMenuOpen}
      >
        + Add content
      </Button>
      {addMenuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 right-0 mt-2 z-20 bg-white rounded-card border border-hairline shadow-lg overflow-hidden">
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
            <div className="border-t border-hairline">
              <button
                type="button"
                onClick={openBank}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-bold text-ink-body hover:bg-sky-wash transition-colors"
              >
                <span aria-hidden="true">📚</span>
                <span>Add from Content Bank</span>
              </button>
              <button
                type="button"
                onClick={openImport}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-bold text-ink-body hover:bg-sky-wash transition-colors"
              >
                <span aria-hidden="true">📄</span>
                <span>Import from Google Doc</span>
              </button>
            </div>
            <p className="px-4 py-2.5 text-[11px] text-ink-muted italic border-t border-hairline bg-surface">
              More content types coming soon
            </p>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="font-rubik min-h-screen bg-surface pb-28">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <PageHeader
          className="mb-5"
          crumbs={[{ label: 'Lessons', onClick: onBack }, { label: headingTitle }]}
        />

        {/* ── Lesson details (slim, collapsible) — title always visible, the
            rest tucked behind a toggle so the builder stays the focus ── */}
        <Card padding="md" className="mb-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <TextField
                label="Title"
                required
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g. Week 5 - Travel Vocabulary"
              />
            </div>
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              className="h-[46px] px-3.5 shrink-0 rounded-tile border-[1.5px] border-[#e3e5e9] bg-white text-[13px] font-bold text-ink-body hover:bg-surface transition-colors flex items-center gap-1.5"
            >
              {detailsOpen ? 'Hide details' : 'Lesson details'}
              <span aria-hidden="true" className={`text-[10px] transition-transform ${detailsOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
          </div>

          {/* Collapsed summary — what's set at a glance */}
          {!detailsOpen && (
            <p className="text-xs text-ink-muted mt-2.5 flex items-center gap-2 flex-wrap">
              {templateMode && <Pill variant="status">📚 Template</Pill>}
              <span>{LESSON_TYPE_SEGMENTS.find((s) => s.value === lessonType)?.label || 'Lesson'}</span>
              {templateLevel && <span>· {templateLevel}</span>}
              {templateCategory && (
                <span>· {COURSE_CATEGORIES.find((c) => c.value === templateCategory)?.label || templateCategory}</span>
              )}
              {lessonDate && <span>· {lessonDate}</span>}
              {templateMode && (!templateLevel || !templateCategory) && (
                <span className="text-incorrect-fg font-bold">· Level + Category required to save</span>
              )}
            </p>
          )}

          {/* Expanded details */}
          {detailsOpen && (
            <div className="mt-4 space-y-4">
              {!isNew && (editingAuthorName || editingCreatedAt) && (
                <p className="text-xs text-ink-muted">
                  Created by {editingAuthorName || 'Unknown'}
                  {editingCreatedAt && ` · Added ${formatAddedDate(editingCreatedAt)}`}
                </p>
              )}

              <div>
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

              {/* Date + Level + Category — Level/Category shown for EVERY lesson so
                  course-free drafts stay filterable in My Library; required only
                  for content-bank templates (enforced in the save guard). */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <TextField
                  label="Date"
                  type="date"
                  value={lessonDate}
                  onChange={(e) => onDateChange(e.target.value)}
                />
                <div>
                  <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                    Level{templateMode && <span className="text-incorrect-fg ml-0.5">*</span>}
                  </span>
                  <select
                    value={templateLevel ?? ''}
                    onChange={(e) => onLevelChange?.(e.target.value)}
                    className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 h-[46px] border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors"
                  >
                    <option value="">Not set</option>
                    {CEFR_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                    Category{templateMode && <span className="text-incorrect-fg ml-0.5">*</span>}
                  </span>
                  <select
                    value={templateCategory ?? ''}
                    onChange={(e) => onCategoryChange?.(e.target.value)}
                    className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 h-[46px] border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors"
                  >
                    <option value="">Not set</option>
                    {COURSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="block">
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

              {templateMode && (
                <p className="text-[12px] text-sky-text flex items-center gap-1.5">
                  <span aria-hidden="true">📚</span>
                  Both Level and Category are required before this template can be saved.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* ── Lesson content header (item count + Save-to-Bank) ── */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h2 className="font-bold text-ink-black">Lesson content</h2>
            {contentItems.length > 0 && (
              <span className="text-xs text-ink-muted">
                {contentItems.length} {contentItems.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={contentItems.length === 0}
            onClick={() => {
              setAddMenuOpen(false)
              setSaveBankOpen(true)
            }}
          >
            💾 Save to Content Bank
          </Button>
        </div>

        {/* ── Calm 3-pane body: OUTLINE | EDIT (with per-item Edit/Preview toggle) ── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* (1) OUTLINE pane */}
          <aside className="w-full lg:w-[340px] lg:shrink-0">
            <Card padding="md">
              <div className="mb-2">
                <h2 className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                  Outline
                </h2>
              </div>
              {contentItems.length === 0 ? (
                <p className="text-[12px] text-ink-muted py-3 text-center">
                  No content yet. Add your first item below.
                </p>
              ) : (
                <div className="space-y-1 mb-3">
                  {contentItems.map((item, idx) => (
                    <OutlineRow key={idx} item={item} idx={idx} />
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {addMenu}
                {/* Direct Content-Bank entry — opens the picker WITHOUT going
                    through the "+ Add content" two-door first. */}
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={openBank}
                >
                  📚 Add from Content Bank
                </Button>
              </div>
            </Card>
          </aside>

          {/* (2) EDIT pane — per-item Edit | Preview toggle (flex, takes the rest) */}
          <section className="w-full lg:flex-1 lg:min-w-0">
            <div className="mb-2 lg:mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
                {editMode === 'edit' ? 'Edit' : 'Preview'}
              </h2>
              {activeItem !== null && (
                <SegmentedControl<'edit' | 'preview'>
                  segments={[
                    { value: 'edit', label: 'Edit' },
                    { value: 'preview', label: '👁 Preview' },
                  ]}
                  value={editMode}
                  onChange={setEditMode}
                />
              )}
            </div>
            {editMode === 'edit' ? editPane : previewPane}
          </section>
        </div>
      </div>

      {/* ── Sticky save bar ── */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-hairline">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          {error && <InlineError message={error} className="flex-1 min-w-[200px]" />}
          {dirty && !error && (
            <span className="text-xs font-medium text-[#b45309] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] inline-block" aria-hidden="true" /> Unsaved changes
            </span>
          )}
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

      {/* ── Two-door create chooser (Build it myself vs. Generate with AI) ── */}
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
            <p className="text-[13px] text-ink-muted mb-3">
              How do you want to create {typeLabel(chooserType)}?
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => handleManual(chooserType)}
                className="flex-1 min-w-[180px] text-left border border-hairline rounded-card p-4 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
              >
                <div className="text-2xl mb-1.5" aria-hidden="true">✍️</div>
                <div className="text-sm font-bold text-ink-black">Build it myself</div>
                <div className="text-[12px] text-ink-muted mt-0.5 leading-relaxed">
                  Start with a blank editor. Full control.
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDoor(chooserType)}
                className="flex-1 min-w-[180px] text-left border-[1.5px] border-sky-border bg-sky-wash rounded-card p-4 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
              >
                <div className="text-2xl mb-1.5" aria-hidden="true">✨</div>
                <div className="text-sm font-bold text-sky-text">Generate with AI</div>
                <div className="text-[12px] text-ink-body mt-0.5 leading-relaxed">
                  From material you already have. Drafts it for you to tweak.
                </div>
              </button>
            </div>
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
          onPickVocab={openVocabPicker}
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
          onPickVocab={openVocabPicker}
        />
      )}

      {/* ── Course-vocabulary picker (overlays the AI forms) ── */}
      {vocabOpen && (
        <VocabPickerModal
          lessons={vocabLessons ?? []}
          loading={vocabLoading || generatingVocab}
          onClose={() => settleVocab([])}
          onAdd={(words) => settleVocab(words)}
        />
      )}

      {/* ── Google-Doc import ── */}
      {importOpen && (
        <ImportDocModal
          generating={generatingImport}
          error={aiError}
          result={importResult}
          onImport={(url) => {
            void handleImport(url)
          }}
          onApply={handleApplyImport}
          onClose={closeImport}
        />
      )}

      {/* ── Content-bank picker — cherry-pick a template's items into the lesson ── */}
      {bankOpen && (
        <ContentBankPickerModal
          onClose={() => setBankOpen(false)}
          onAdd={(picked) => {
            onAddFromBank(picked)
            setBankOpen(false)
          }}
        />
      )}

      {/* ── Save-to-bank wizard — save selected lesson content OUT to the bank ── */}
      {saveBankOpen && (
        <SaveToBankModal
          items={contentItems}
          onClose={() => setSaveBankOpen(false)}
          onSaved={(msg) => onNotify?.(msg)}
        />
      )}
    </div>
  )
}

export default CalmLessonEditor
