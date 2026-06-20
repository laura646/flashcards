'use client'

// 10B redesign — IN-EDITOR SAVE-TO-BANK (Phase 7, "new beside old").
//
// SELF-CONTAINED modal. It owns its own POSTs + GETs to /api/content-bank and
// saves SELECTED content from the open lesson OUT to the Content Bank as a
// template (either a brand-new template or appended to an existing one). It does
// NOT mutate the editor's contentItems — it only reads the items handed in via
// props and writes them to the server.
//
// This MIRRORS the legacy Save-to-Bank wizard in app/admin/lessons/page.tsx
// (openSaveToBankModal ~L707, loadBankTemplatesForFolder ~L763,
// saveToBankConfirm ~L778), restyled with the 10B kit + tokens and the sibling
// ai/ modals (ContentBankPickerModal) for shell + z-index.
//
// API (POST /api/content-bank):
//   { action: 'create-template', title, template_category, template_level, folder_id }
//     -> { ok, template_id }
//   { action: 'add-content-to-template', template_id, exercises, flashcards, blocks }
//     -> { ok, added }
// GET ?action=list-folders -> { folders }
// GET ?action=list&folder_id=ID -> { templates: { id, title, summary }[] }

import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  EmptyState,
  InlineError,
  Pill,
  Skeleton,
  Spinner,
  TextField,
} from '@/components/student-ui'
import {
  CEFR_OPTIONS,
  EXERCISE_TYPE_LABELS,
  type ContentItem,
  type ContentBlock,
  type Exercise,
  type Flashcard,
} from '@/lib/lesson-editor/types'

// ── API row shapes (mirror the legacy declarations) ──

interface CbFolderNode {
  id: string
  name: string
  children?: CbFolderNode[]
}

interface CbFlatFolder {
  id: string
  name: string
}

interface CbTemplateRow {
  id: string
  title: string
  summary: string | null
}

// ── Mapped payload sent to add-content-to-template ──

interface CbBlockPayload {
  block_type: string
  title: string
  content: unknown
}

// Wizard steps.
type Step = 'select' | 'target' | 'confirm'

// Target mode within step 2.
type TargetMode = 'new' | 'existing'

interface Props {
  items: ContentItem[]
  onClose: () => void
  onSaved: (msg: string) => void
}

// Flatten the nested folder tree into "Parent / Child" labelled rows (mirrors
// the legacy flatten() in openSaveToBankModal).
function flattenFolders(folders: CbFolderNode[], prefix = ''): CbFlatFolder[] {
  const flat: CbFlatFolder[] = []
  for (const f of folders) {
    flat.push({ id: f.id, name: prefix + f.name })
    if (f.children?.length) flat.push(...flattenFolders(f.children, prefix + f.name + ' / '))
  }
  return flat
}

// Human label + sub-line for one content item in the select list.
function itemLabel(item: ContentItem, index: number): { icon: string; label: string; sub: string } {
  if (item.type === 'flashcards') {
    const cards = item.data as Flashcard[]
    return {
      icon: '📚',
      label: 'Vocabulary / Flashcards',
      sub: `${cards.length} flashcard${cards.length === 1 ? '' : 's'}`,
    }
  }
  if (item.type === 'exercise') {
    const ex = item.data as Exercise
    return {
      icon: '🎯',
      label: ex.title || `Exercise ${index + 1}`,
      sub: EXERCISE_TYPE_LABELS[ex.exercise_type] || ex.exercise_type,
    }
  }
  const block = item.data as ContentBlock
  return {
    icon: '🧱',
    label: block.title || (item.type.charAt(0).toUpperCase() + item.type.slice(1)),
    sub: item.type.charAt(0).toUpperCase() + item.type.slice(1),
  }
}

export default function SaveToBankModal({ items, onClose, onSaved }: Props) {
  // ── Step ──
  const [step, setStep] = useState<Step>('select')

  // ── Step 1: selection (set of contentItems indices) ──
  const [selected, setSelected] = useState<Set<number>>(() => new Set(items.map((_, i) => i)))

  // ── Step 2: folders + target ──
  const [folders, setFolders] = useState<CbFlatFolder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(true)
  const [foldersError, setFoldersError] = useState<string | null>(null)

  const [targetMode, setTargetMode] = useState<TargetMode>('new')

  // New-template fields.
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newLevel, setNewLevel] = useState('')
  const [newFolderId, setNewFolderId] = useState('')

  // Existing-template fields.
  const [existingFolderId, setExistingFolderId] = useState('')
  const [templates, setTemplates] = useState<CbTemplateRow[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [targetTemplateId, setTargetTemplateId] = useState('')

  // ── Step 3: save ──
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Load folders once on open (mirror legacy openSaveToBankModal) ──
  useEffect(() => {
    let cancelled = false
    setFoldersLoading(true)
    setFoldersError(null)
    fetch('/api/content-bank?action=list-folders')
      .then((r) => {
        if (!r.ok) throw new Error('folders')
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        setFolders(flattenFolders(data.folders || []))
      })
      .catch(() => {
        if (cancelled) return
        setFoldersError('Could not load folders. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setFoldersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Load templates for the chosen existing folder (mirror legacy
  // loadBankTemplatesForFolder) ──
  const loadTemplatesForFolder = async (folderId: string) => {
    setExistingFolderId(folderId)
    setTargetTemplateId('')
    setTemplatesError(null)
    if (!folderId) {
      setTemplates([])
      return
    }
    setTemplatesLoading(true)
    try {
      const res = await fetch(`/api/content-bank?action=list&folder_id=${encodeURIComponent(folderId)}`)
      if (!res.ok) throw new Error('templates')
      const data = await res.json()
      setTemplates(
        (data.templates || []).map((t: { id: string; title: string; summary: string | null }) => ({
          id: t.id,
          title: t.title,
          summary: t.summary,
        })),
      )
    } catch {
      setTemplates([])
      setTemplatesError('Could not load templates for this folder.')
    }
    setTemplatesLoading(false)
  }

  // ── Selection toggles ──
  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const allSelected = selected.size === items.length && items.length > 0
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((_, i) => i)))
  }

  // ── Map the selected ContentItems to the add-content-to-template payload.
  // flashcards item -> flashcards[]; exercise items -> exercises[] with the
  // group_sort normalization (questions = groupData || questions for group_sort);
  // block items -> blocks[{ block_type, title, content }]. ──
  const buildPayload = (): { flashcards: Flashcard[]; exercises: Exercise[]; blocks: CbBlockPayload[] } => {
    let flashcards: Flashcard[] = []
    const exercises: Exercise[] = []
    const blocks: CbBlockPayload[] = []

    for (const idx of Array.from(selected).sort((a, b) => a - b)) {
      const item = items[idx]
      if (!item) continue
      if (item.type === 'flashcards') {
        flashcards = item.data as Flashcard[]
      } else if (item.type === 'exercise') {
        const ex = item.data as Exercise
        exercises.push({
          ...ex,
          questions: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.questions,
        })
      } else {
        const block = item.data as ContentBlock
        blocks.push({
          block_type: item.type,
          title: block.title || '',
          content: block.content || {},
        })
      }
    }
    return { flashcards, exercises, blocks }
  }

  // ── Step gating ──
  const canLeaveSelect = selected.size > 0
  const canLeaveTarget =
    targetMode === 'new' ? newTitle.trim().length > 0 : targetTemplateId.length > 0

  // ── Confirm: create (if new) then add content ──
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      let templateId = targetMode === 'existing' ? targetTemplateId : ''

      if (targetMode === 'new') {
        const createRes = await fetch('/api/content-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-template',
            title: newTitle.trim(),
            template_category: newCategory || null,
            template_level: newLevel || null,
            folder_id: newFolderId || null,
          }),
        })
        const createData = await createRes.json()
        if (!createRes.ok || !createData.template_id) {
          setSaveError(createData.error || 'Failed to create the template.')
          setSaving(false)
          return
        }
        templateId = createData.template_id
      }

      const { flashcards, exercises, blocks } = buildPayload()
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-content-to-template',
          template_id: templateId,
          exercises,
          flashcards,
          blocks,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save to the Content Bank.')
        setSaving(false)
        return
      }
      onSaved('Saved to Content Bank')
      onClose()
    } catch {
      setSaveError('Failed to save to the Content Bank. Please try again.')
      setSaving(false)
    }
  }

  // ── Confirm summary counts ──
  const summary = useMemo(() => {
    const { flashcards, exercises, blocks } = buildPayload()
    const parts: string[] = []
    if (flashcards.length > 0)
      parts.push(`${flashcards.length} vocab card${flashcards.length === 1 ? '' : 's'}`)
    if (exercises.length > 0)
      parts.push(`${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`)
    if (blocks.length > 0) parts.push(`${blocks.length} block${blocks.length === 1 ? '' : 's'}`)
    return parts
    // buildPayload reads `selected` + `items`; recompute when selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, items])

  const targetTemplateTitle = templates.find((t) => t.id === targetTemplateId)?.title

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
        aria-label="Save to content bank"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              🏦 Content bank
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5 truncate">
              {step === 'select'
                ? 'Choose content to save'
                : step === 'target'
                  ? 'Choose where to save'
                  : 'Review and save'}
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

        {/* Step indicator */}
        <div className="px-6 pb-3 shrink-0 flex items-center gap-1.5">
          {(['select', 'target', 'confirm'] as Step[]).map((s, i) => {
            const active = s === step
            const stepIndex = ['select', 'target', 'confirm'].indexOf(step)
            const done = i < stepIndex
            return (
              <span
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  active ? 'bg-sky' : done ? 'bg-sky/50' : 'bg-hairline'
                }`}
              />
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {/* ════════════════ STEP 1 — SELECT ════════════════ */}
          {step === 'select' && (
            <>
              {items.length === 0 ? (
                <EmptyState
                  icon="🧱"
                  title="Nothing to save"
                  hint="Add content to this lesson first."
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[13px] font-bold text-sky hover:underline focus:outline-none mb-2.5"
                  >
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                  <div className="space-y-2.5">
                    {items.map((item, i) => {
                      const meta = itemLabel(item, i)
                      return (
                        <label
                          key={i}
                          className="flex items-start gap-3 rounded-tile border border-hairline px-3.5 py-3 cursor-pointer hover:border-sky-border transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            onChange={() => toggle(i)}
                            className="mt-0.5 accent-sky"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-ink-black truncate">
                              {meta.icon} {meta.label}
                            </span>
                            {meta.sub && (
                              <span className="block text-[12px] text-ink-muted mt-0.5">
                                {meta.sub}
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ════════════════ STEP 2 — PICK TARGET ════════════════ */}
          {step === 'target' && (
            <>
              {/* New vs. existing toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setTargetMode('new')}
                  className={`flex-1 text-left border rounded-card p-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${
                    targetMode === 'new'
                      ? 'border-[1.5px] border-sky bg-sky-wash'
                      : 'border-hairline hover:border-sky-border'
                  }`}
                >
                  <span className="block text-sm font-bold text-ink-black">New template</span>
                  <span className="block text-[12px] text-ink-muted mt-0.5">
                    Create a fresh template in the bank.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('existing')}
                  className={`flex-1 text-left border rounded-card p-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${
                    targetMode === 'existing'
                      ? 'border-[1.5px] border-sky bg-sky-wash'
                      : 'border-hairline hover:border-sky-border'
                  }`}
                >
                  <span className="block text-sm font-bold text-ink-black">Add to existing</span>
                  <span className="block text-[12px] text-ink-muted mt-0.5">
                    Append to a template you already have.
                  </span>
                </button>
              </div>

              {foldersError && (
                <InlineError
                  message={foldersError}
                  className="mb-3"
                />
              )}

              {targetMode === 'new' ? (
                <div className="space-y-4">
                  <TextField
                    label="Template title"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Travel Vocabulary Pack"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                        Category
                      </span>
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="e.g. Grammar"
                        className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                        Level
                      </span>
                      <select
                        value={newLevel}
                        onChange={(e) => setNewLevel(e.target.value)}
                        className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors"
                      >
                        <option value="">Any level</option>
                        {CEFR_OPTIONS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                      Folder
                    </span>
                    <select
                      value={newFolderId}
                      onChange={(e) => setNewFolderId(e.target.value)}
                      disabled={foldersLoading}
                      className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
                    >
                      <option value="">No folder</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block">
                    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                      Folder
                    </span>
                    <select
                      value={existingFolderId}
                      onChange={(e) => loadTemplatesForFolder(e.target.value)}
                      disabled={foldersLoading}
                      className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
                    >
                      <option value="">Choose a folder…</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {templatesError && (
                    <InlineError
                      message={templatesError}
                      onRetry={() => loadTemplatesForFolder(existingFolderId)}
                    />
                  )}

                  {existingFolderId && (
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                        Template
                      </span>
                      {templatesLoading ? (
                        <div className="space-y-2.5">
                          <Skeleton className="h-14 w-full" />
                          <Skeleton className="h-14 w-full" />
                        </div>
                      ) : templates.length === 0 ? (
                        <EmptyState
                          icon="🏦"
                          title="No templates in this folder"
                          hint="Pick another folder or create a new template instead."
                        />
                      ) : (
                        <div className="space-y-2.5">
                          {templates.map((t) => (
                            <label
                              key={t.id}
                              className="flex items-start gap-3 rounded-tile border border-hairline px-3.5 py-3 cursor-pointer hover:border-sky-border transition-colors"
                            >
                              <input
                                type="radio"
                                name="cb-target-template"
                                checked={targetTemplateId === t.id}
                                onChange={() => setTargetTemplateId(t.id)}
                                className="mt-0.5 accent-sky"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-bold text-ink-black truncate">
                                  {t.title || 'Untitled template'}
                                </span>
                                {t.summary && (
                                  <span className="block text-[12px] text-ink-muted mt-0.5 truncate">
                                    {t.summary}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ════════════════ STEP 3 — CONFIRM ════════════════ */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {saveError && <InlineError message={saveError} onRetry={() => void handleSave()} />}

              <div className="rounded-tile border border-hairline px-4 py-3.5">
                <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-1">
                  Saving to
                </span>
                {targetMode === 'new' ? (
                  <>
                    <span className="block text-sm font-bold text-ink-black">
                      {newTitle.trim() || 'Untitled template'} <span className="text-ink-muted font-medium">(new)</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 mt-2">
                      {newLevel && <Pill variant="level">{newLevel}</Pill>}
                      {newCategory && <Pill variant="wash">{newCategory}</Pill>}
                      {newFolderId && (
                        <Pill variant="wash">
                          {folders.find((f) => f.id === newFolderId)?.name || 'Folder'}
                        </Pill>
                      )}
                    </span>
                  </>
                ) : (
                  <span className="block text-sm font-bold text-ink-black">
                    {targetTemplateTitle || 'Selected template'}
                  </span>
                )}
              </div>

              <div className="rounded-tile border border-hairline px-4 py-3.5">
                <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-1">
                  Content
                </span>
                <span className="block text-sm font-bold text-ink-black">
                  {summary.length > 0 ? summary.join(' · ') : 'Nothing selected'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-hairline shrink-0">
          <span className="text-[12px] text-ink-muted">
            {step === 'select'
              ? `${selected.size} selected`
              : step === 'confirm' && saving
                ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={14} /> Saving…
                  </span>
                )
                : ''}
          </span>
          <div className="flex items-center gap-2.5">
            {step === 'select' ? (
              <Button variant="secondary" size="md" onClick={onClose}>
                Cancel
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                disabled={saving}
                onClick={() => setStep(step === 'confirm' ? 'target' : 'select')}
              >
                Back
              </Button>
            )}

            {step === 'select' && (
              <Button
                variant="primary"
                size="md"
                disabled={!canLeaveSelect}
                onClick={() => setStep('target')}
              >
                Next
              </Button>
            )}
            {step === 'target' && (
              <Button
                variant="primary"
                size="md"
                disabled={!canLeaveTarget}
                onClick={() => setStep('confirm')}
              >
                Next
              </Button>
            )}
            {step === 'confirm' && (
              <Button
                variant="primary"
                size="md"
                disabled={saving || summary.length === 0}
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Save to bank'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
