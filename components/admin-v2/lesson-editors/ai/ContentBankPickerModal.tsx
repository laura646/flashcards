'use client'

// 10B redesign — IN-EDITOR CONTENT-BANK PICKER (Phase 7, "new beside old").
//
// SELF-FETCHING modal. It owns its own browse + detail fetches (read-only GETs
// to /api/content-bank) and cherry-picks a template's flashcards / exercises /
// blocks INTO THE OPEN LESSON. It does NOT mutate the server — the chosen items
// are handed back via onAdd and merged into the editor's contentItems by the
// caller (LessonEditorView), persisting on the normal lesson Save.
//
// This is DIFFERENT from components/ContentBankImportModal.tsx, which clones
// WHOLE lessons into a course. Do NOT confuse the two.
//
// Flow mirrors the legacy in-editor content-bank picker in
// app/admin/lessons/page.tsx (openCbTemplate ~L1107, cbCopySelected ~L1144),
// restyled with the 10B kit + tokens and the sibling ai/ modals
// (ImportDocModal, VocabPickerModal) for shell + z-index.

import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  EmptyState,
  InlineError,
  Pill,
  SegmentedControl,
  Skeleton,
  Spinner,
} from '@/components/student-ui'
import type { Flashcard, Exercise } from '@/lib/lesson-editor/types'
import { EXERCISE_TYPE_LABELS } from '@/lib/lesson-editor/types'

// ── API row shapes (read-only; mirror the legacy declarations) ──

interface CbFolder {
  id: string
  name: string
  parent_id: string | null
  template_count?: number
}

interface CbTemplate {
  id: string
  title: string
  template_level: string | null
  template_category: string | null
  flashcard_count: number
  exercise_count: number
  block_counts: Record<string, number>
  created_at: string
  author_name: string
}

// Detail rows carry an order_index plus an id we drop on pick.
interface CbDetailFlashcard extends Flashcard {
  id?: string
}

interface CbDetailExercise extends Exercise {
  id?: string
}

interface CbDetailBlock {
  id?: string
  block_type: string
  title: string
  content: unknown
  order_index: number
}

// ── Picked payload handed back to the caller ──

export interface PickedContent {
  flashcards: Flashcard[]
  exercises: Exercise[]
  blocks: { block_type: string; title: string; content: unknown }[]
}

interface Props {
  onClose: () => void
  onAdd: (picked: PickedContent) => void
}

// Library scope for the list fetch — appended as &scope= to /api/content-bank.
type LibraryScope = 'mine' | 'school' | 'all'

// Sums every block-type count into one number for the card meta line.
function totalBlocks(counts: Record<string, number>): number {
  return Object.values(counts || {}).reduce((a, b) => a + b, 0)
}

// Human label for a block type — falls back to a Title-Cased version.
function blockTypeLabel(type: string): string {
  if (!type) return 'Block'
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function ContentBankPickerModal({ onClose, onAdd }: Props) {
  // ── Browse state ──
  const [folders, setFolders] = useState<CbFolder[]>([])
  const [templates, setTemplates] = useState<CbTemplate[]>([])
  const [browseLoading, setBrowseLoading] = useState(true)
  const [browseError, setBrowseError] = useState<string | null>(null)

  const [folderId, setFolderId] = useState<string>('') // '' = all folders
  const [search, setSearch] = useState('')
  // Library scope for the list fetch. Defaults to the School Library.
  const [scope, setScope] = useState<LibraryScope>('school')

  // ── Detail state ──
  const [selectedTemplate, setSelectedTemplate] = useState<CbTemplate | null>(null)
  const [detailFlashcards, setDetailFlashcards] = useState<CbDetailFlashcard[]>([])
  const [detailExercises, setDetailExercises] = useState<CbDetailExercise[]>([])
  const [detailBlocks, setDetailBlocks] = useState<CbDetailBlock[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // ── Picks (detail view) ──
  const [pickFlashcards, setPickFlashcards] = useState(false)
  const [pickExerciseIds, setPickExerciseIds] = useState<Set<string>>(new Set())
  const [pickBlockIds, setPickBlockIds] = useState<Set<string>>(new Set())

  // ── Browse fetch: folders + templates (all) on open and on folder change ──
  useEffect(() => {
    let cancelled = false
    setBrowseLoading(true)
    setBrowseError(null)

    const listUrl =
      `/api/content-bank?action=list&scope=${scope}` +
      (folderId ? `&folder_id=${encodeURIComponent(folderId)}` : '')

    Promise.all([
      fetch('/api/content-bank?action=list-folders').then((r) => {
        if (!r.ok) throw new Error('folders')
        return r.json()
      }),
      fetch(listUrl).then((r) => {
        if (!r.ok) throw new Error('templates')
        return r.json()
      }),
    ])
      .then(([folderData, templateData]) => {
        if (cancelled) return
        setFolders(folderData.folders || [])
        setTemplates(templateData.templates || [])
      })
      .catch(() => {
        if (cancelled) return
        setBrowseError('Could not load the content bank. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setBrowseLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [folderId, scope])

  // ── Detail fetch (mirror legacy openCbTemplate) ──
  const openTemplate = async (tpl: CbTemplate) => {
    setSelectedTemplate(tpl)
    setPickFlashcards(false)
    setPickExerciseIds(new Set())
    setPickBlockIds(new Set())
    setDetailFlashcards([])
    setDetailExercises([])
    setDetailBlocks([])
    setDetailError(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/content-bank?action=detail&id=${encodeURIComponent(tpl.id)}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setDetailFlashcards(data.flashcards || [])
      setDetailExercises(data.exercises || [])
      setDetailBlocks(data.blocks || [])
    } catch {
      setDetailError('Could not load this template. Please try again.')
    }
    setDetailLoading(false)
  }

  const backToBrowse = () => {
    setSelectedTemplate(null)
    setDetailError(null)
  }

  // ── Pick toggles ──
  const toggleExercise = (id: string) => {
    setPickExerciseIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleBlock = (id: string) => {
    setPickBlockIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Filtered template list (title contains) ──
  const q = search.trim().toLowerCase()
  const filteredTemplates = useMemo(() => {
    if (!q) return templates
    return templates.filter((t) => (t.title || '').toLowerCase().includes(q))
  }, [templates, q])

  // ── Selection count (detail footer) ──
  const selectedCount =
    (pickFlashcards ? 1 : 0) + pickExerciseIds.size + pickBlockIds.size

  // ── Map picks -> PickedContent (mirror legacy cbCopySelected field mapping).
  // order_index is a running index; the editor hook restamps on insert. ids are
  // dropped so the inserted items are treated as new.
  const commitSelection = () => {
    if (selectedCount === 0) return

    const flashcards: Flashcard[] = pickFlashcards
      ? detailFlashcards.map((fc, i) => ({
          word: fc.word,
          phonetic: fc.phonetic,
          meaning: fc.meaning,
          example: fc.example,
          notes: fc.notes,
          order_index: i,
        }))
      : []

    const exercises: Exercise[] = []
    detailExercises.forEach((ex) => {
      if (ex.id && pickExerciseIds.has(ex.id)) {
        exercises.push({
          title: ex.title,
          subtitle: ex.subtitle,
          icon: ex.icon,
          instructions: ex.instructions,
          exercise_type: ex.exercise_type,
          questions: ex.questions,
          order_index: exercises.length,
        })
      }
    })

    const blocks: { block_type: string; title: string; content: unknown }[] = []
    detailBlocks.forEach((b) => {
      if (b.id && pickBlockIds.has(b.id)) {
        blocks.push({
          block_type: b.block_type,
          title: b.title,
          content: b.content,
        })
      }
    })

    onAdd({ flashcards, exercises, blocks })
    onClose()
  }

  const inDetail = selectedTemplate != null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-card shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add from library"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              📚 Library
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5 truncate">
              {inDetail ? selectedTemplate!.title || 'Untitled template' : 'Add from library'}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        {inDetail ? (
          // ════════════════════ DETAIL VIEW ════════════════════
          <>
            {/* Back + meta */}
            <div className="px-6 pb-3 shrink-0">
              <button
                onClick={backToBrowse}
                className="text-[13px] font-bold text-sky hover:underline focus:outline-none"
              >
                ← Back to templates
              </button>
              {(selectedTemplate!.template_level || selectedTemplate!.template_category) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedTemplate!.template_level && (
                    <Pill variant="level">{selectedTemplate!.template_level}</Pill>
                  )}
                  {selectedTemplate!.template_category && (
                    <Pill variant="wash">{selectedTemplate!.template_category}</Pill>
                  )}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              {detailError && (
                <InlineError
                  message={detailError}
                  onRetry={() => openTemplate(selectedTemplate!)}
                  className="mb-4"
                />
              )}

              {detailLoading ? (
                <div className="space-y-2.5 py-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : detailFlashcards.length === 0 &&
                detailExercises.length === 0 &&
                detailBlocks.length === 0 &&
                !detailError ? (
                <EmptyState
                  icon="🗂️"
                  title="This template is empty"
                  hint="There's no content to pick from here."
                />
              ) : (
                <div className="space-y-2.5">
                  {/* Flashcards — one toggle for all cards */}
                  {detailFlashcards.length > 0 && (
                    <label className="flex items-start gap-3 rounded-tile border border-hairline px-3.5 py-3 cursor-pointer hover:border-sky-border transition-colors">
                      <input
                        type="checkbox"
                        checked={pickFlashcards}
                        onChange={(e) => setPickFlashcards(e.target.checked)}
                        className="mt-0.5 accent-sky"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink-black">
                          All {detailFlashcards.length} vocabulary card
                          {detailFlashcards.length === 1 ? '' : 's'}
                        </span>
                        <span className="flex flex-wrap gap-1.5 mt-1.5">
                          {detailFlashcards.slice(0, 10).map((fc, i) => (
                            <Pill key={i} variant="wash">
                              {fc.word || '—'}
                            </Pill>
                          ))}
                          {detailFlashcards.length > 10 && (
                            <span className="text-[12px] text-ink-muted self-center">
                              +{detailFlashcards.length - 10} more
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  )}

                  {/* Exercises — one checkbox each */}
                  {detailExercises.map((ex, i) => {
                    const id = ex.id || ''
                    const typeLabel = EXERCISE_TYPE_LABELS[ex.exercise_type] || ex.exercise_type
                    return (
                      <label
                        key={id || i}
                        className="flex items-start gap-3 rounded-tile border border-hairline px-3.5 py-3 cursor-pointer hover:border-sky-border transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!id && pickExerciseIds.has(id)}
                          disabled={!id}
                          onChange={() => id && toggleExercise(id)}
                          className="mt-0.5 accent-sky"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-ink-black truncate">
                            🎯 {ex.title || 'Untitled exercise'}
                          </span>
                          {typeLabel && (
                            <span className="block text-[12px] text-ink-muted mt-0.5">
                              {typeLabel}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}

                  {/* Blocks — one checkbox each */}
                  {detailBlocks.map((b, i) => {
                    const id = b.id || ''
                    return (
                      <label
                        key={id || i}
                        className="flex items-start gap-3 rounded-tile border border-hairline px-3.5 py-3 cursor-pointer hover:border-sky-border transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!id && pickBlockIds.has(id)}
                          disabled={!id}
                          onChange={() => id && toggleBlock(id)}
                          className="mt-0.5 accent-sky"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-ink-black truncate">
                            {b.title || blockTypeLabel(b.block_type)}
                          </span>
                          <span className="block text-[12px] text-ink-muted mt-0.5">
                            {blockTypeLabel(b.block_type)}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-hairline shrink-0">
              <Button variant="secondary" size="md" onClick={backToBrowse}>
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={commitSelection}
                disabled={selectedCount === 0}
              >
                {selectedCount > 0
                  ? `Add to lesson (${selectedCount} selected)`
                  : 'Add to lesson'}
              </Button>
            </div>
          </>
        ) : (
          // ════════════════════ BROWSE VIEW ════════════════════
          <>
            {/* Scope switch — which library to browse */}
            <div className="px-6 pb-3 shrink-0">
              <SegmentedControl<LibraryScope>
                segments={[
                  { value: 'mine', label: 'My Library' },
                  { value: 'school', label: 'School Library' },
                  { value: 'all', label: 'All' },
                ]}
                value={scope}
                onChange={(v) => {
                  setScope(v)
                  setFolderId('')
                }}
              />
            </div>

            {/* Filters */}
            <div className="px-6 pb-3 shrink-0 flex flex-col sm:flex-row gap-2.5">
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                disabled={browseLoading && folders.length === 0}
                className="text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2.5 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors disabled:opacity-60 sm:w-56 shrink-0"
              >
                <option value="">All folders</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {typeof f.template_count === 'number' ? ` (${f.template_count})` : ''}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates…"
                className="flex-1 text-[14px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-2.5 placeholder:text-[#b6bac2] border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors"
              />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              {browseError ? (
                <InlineError
                  message={browseError}
                  onRetry={() => setFolderId((prev) => prev)}
                  className="my-4"
                />
              ) : browseLoading ? (
                <div className="space-y-2.5 py-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <EmptyState
                  icon="🏦"
                  title={q ? 'No templates match your search' : 'No templates here yet'}
                  hint={
                    q
                      ? 'Try a different word or clear the search.'
                      : 'Save a lesson as a template to see it here.'
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredTemplates.map((t) => {
                    const blocks = totalBlocks(t.block_counts)
                    const metaParts: string[] = []
                    if (t.flashcard_count > 0)
                      metaParts.push(
                        `${t.flashcard_count} vocab card${t.flashcard_count === 1 ? '' : 's'}`,
                      )
                    if (t.exercise_count > 0)
                      metaParts.push(
                        `${t.exercise_count} exercise${t.exercise_count === 1 ? '' : 's'}`,
                      )
                    if (blocks > 0)
                      metaParts.push(`${blocks} block${blocks === 1 ? '' : 's'}`)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openTemplate(t)}
                        className="w-full text-left rounded-tile border border-hairline px-4 py-3 hover:border-sky-border hover:bg-sky-wash/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-ink-black truncate">
                              {t.title || 'Untitled template'}
                            </p>
                            <p className="text-[12px] text-ink-muted mt-0.5 truncate">
                              {metaParts.length > 0 ? metaParts.join(' · ') : 'Empty template'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {t.template_level && (
                              <Pill variant="level">{t.template_level}</Pill>
                            )}
                            {t.template_category && (
                              <Pill variant="wash">{t.template_category}</Pill>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-hairline shrink-0">
              <span className="text-[12px] text-ink-muted">
                {browseLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={14} /> Loading templates…
                  </span>
                ) : (
                  `${filteredTemplates.length} template${filteredTemplates.length === 1 ? '' : 's'}`
                )}
              </span>
              <Button variant="secondary" size="md" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
