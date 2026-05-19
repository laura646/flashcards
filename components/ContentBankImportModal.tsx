'use client'

import { useEffect, useState, useCallback } from 'react'

// Two-step modal launched from a course's "+ Create Lesson":
//   Step 1 (choose): "Create your own" (delegates to parent) vs
//                     "From Content Bank" (opens the picker).
//   Step 2 (browse):  folder list + title search + multi-select of whole
//                      lesson plans; one publish/draft choice for the
//                      whole batch. Each pick is a full clone-lesson
//                      (title + flashcards + exercises + blocks), dated
//                      today, into the target course.

interface Folder {
  id: string
  name: string
  parent_id: string | null
  template_count: number
}

interface Template {
  id: string
  title: string
  template_level: string | null
  template_category: string | null
  flashcard_count: number
  exercise_count: number
  block_counts: Record<string, number>
}

interface Props {
  courseId: string
  onClose: () => void
  onCreateOwn: () => void
  onImported: (count: number) => void
}

export default function ContentBankImportModal({
  courseId,
  onClose,
  onCreateOwn,
  onImported,
}: Props) {
  const [step, setStep] = useState<'choose' | 'browse'>('choose')
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [publishMode, setPublishMode] = useState<'draft' | 'published'>('draft')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  const loadTemplates = useCallback(async (folderId: string) => {
    setLoading(true)
    try {
      const url = folderId
        ? `/api/content-bank?action=list&folder_id=${encodeURIComponent(folderId)}`
        : '/api/content-bank?action=list'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      setError('Could not load lessons from the content bank.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (step !== 'browse') return
    fetch('/api/content-bank?action=list-folders')
      .then((r) => (r.ok ? r.json() : { folders: [] }))
      .then((d) => setFolders(d.folders || []))
      .catch(() => { /* folders optional */ })
    loadTemplates('')
  }, [step, loadTemplates])

  const pickFolder = (id: string) => {
    setSelectedFolderId(id)
    loadTemplates(id)
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const q = search.trim().toLowerCase()
  const visibleTemplates = q
    ? templates.filter((t) => t.title.toLowerCase().includes(q))
    : templates

  // Flatten folders into an indented list (parent_id hierarchy).
  const folderRows: { id: string; name: string; depth: number; count: number }[] = []
  {
    const byParent = new Map<string | null, Folder[]>()
    folders.forEach((f) => {
      const k = f.parent_id
      if (!byParent.has(k)) byParent.set(k, [])
      byParent.get(k)!.push(f)
    })
    const walk = (parent: string | null, depth: number) => {
      ;(byParent.get(parent) || []).forEach((f) => {
        folderRows.push({ id: f.id, name: f.name, depth, count: f.template_count })
        walk(f.id, depth + 1)
      })
    }
    walk(null, 0)
  }

  const doImport = async () => {
    if (selected.size === 0) return
    setImporting(true)
    setError('')
    let ok = 0
    for (const id of Array.from(selected)) {
      try {
        const res = await fetch('/api/content-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clone-lesson',
            template_id: id,
            course_id: courseId,
            status: publishMode,
          }),
        })
        if (res.ok) ok += 1
      } catch {
        /* count only successes */
      }
    }
    setImporting(false)
    if (ok === 0) {
      setError('Import failed. Please try again.')
      return
    }
    onImported(ok)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e6f0fa] flex items-center justify-between shrink-0">
          <div>
            {step === 'browse' && (
              <button
                onClick={() => setStep('choose')}
                className="text-xs text-gray-400 hover:text-[#416ebe] mb-1"
              >
                &larr; Back
              </button>
            )}
            <h3 className="font-bold text-[#46464b]">
              {step === 'choose' ? 'Add a lesson' : 'Add from Content Bank'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg"
          >
            &times;
          </button>
        </div>

        {/* Step 1: choose */}
        {step === 'choose' ? (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={onCreateOwn}
              className="text-left p-5 rounded-xl border-2 border-[#cddcf0] hover:border-[#416ebe] hover:shadow-sm transition-all"
            >
              <div className="text-2xl mb-2">✏️</div>
              <p className="font-bold text-sm text-[#46464b]">Create your own</p>
              <p className="text-xs text-gray-400 mt-1">
                Start a blank lesson and build it from scratch.
              </p>
            </button>
            <button
              onClick={() => setStep('browse')}
              className="text-left p-5 rounded-xl border-2 border-[#cddcf0] hover:border-[#416ebe] hover:shadow-sm transition-all"
            >
              <div className="text-2xl mb-2">📚</div>
              <p className="font-bold text-sm text-[#46464b]">From Content Bank</p>
              <p className="text-xs text-gray-400 mt-1">
                Copy one or more ready-made lesson plans into this course.
              </p>
            </button>
          </div>
        ) : (
          <>
            {/* Step 2: browse */}
            <div className="px-6 py-3 border-b border-[#e6f0fa] shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search lessons by title…"
                  className="w-full pl-9 pr-9 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Folder list */}
              <div className="w-48 border-r border-[#e6f0fa] overflow-y-auto py-2 shrink-0">
                <button
                  onClick={() => pickFolder('')}
                  className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors ${
                    selectedFolderId === ''
                      ? 'text-[#416ebe] bg-[#e6f0fa]'
                      : 'text-gray-500 hover:bg-[#f7fafd]'
                  }`}
                >
                  All folders
                </button>
                {folderRows.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => pickFolder(f.id)}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                      selectedFolderId === f.id
                        ? 'text-[#416ebe] bg-[#e6f0fa] font-bold'
                        : 'text-gray-500 hover:bg-[#f7fafd]'
                    }`}
                    style={{ paddingLeft: 16 + f.depth * 12 }}
                  >
                    {f.name} <span className="text-gray-300">({f.count})</span>
                  </button>
                ))}
              </div>

              {/* Template list */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
                ) : visibleTemplates.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">
                    {search ? `No lessons match “${search}”` : 'No lessons in this folder.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visibleTemplates.map((t) => {
                      const isSel = selected.has(t.id)
                      const blocks = Object.values(t.block_counts || {}).reduce((a, b) => a + b, 0)
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggle(t.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                            isSel
                              ? 'border-[#416ebe] bg-[#f3f8ff]'
                              : 'border-[#cddcf0] hover:border-[#416ebe]'
                          }`}
                        >
                          <span
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${
                              isSel
                                ? 'bg-[#416ebe] border-[#416ebe] text-white'
                                : 'border-[#cddcf0] text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="min-w-0">
                            <span className="block font-bold text-sm text-[#46464b]">{t.title}</span>
                            <span className="flex flex-wrap gap-1.5 mt-1">
                              {t.template_level && (
                                <span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-[10px] rounded-full">{t.template_level}</span>
                              )}
                              {t.template_category && (
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded-full">{t.template_category}</span>
                              )}
                            </span>
                            <span className="block text-[11px] text-gray-400 mt-1">
                              {[
                                t.flashcard_count > 0 ? `${t.flashcard_count} flashcards` : '',
                                t.exercise_count > 0 ? `${t.exercise_count} exercises` : '',
                                blocks > 0 ? `${blocks} blocks` : '',
                              ].filter(Boolean).join(' · ') || 'Empty'}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e6f0fa] shrink-0">
              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                  {(['draft', 'published'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPublishMode(m)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                        publishMode === m
                          ? 'bg-[#416ebe] border-[#416ebe] text-white'
                          : 'bg-white border-[#cddcf0] text-[#46464b] hover:border-[#416ebe]'
                      }`}
                    >
                      {m === 'draft' ? 'Save as draft' : 'Publish now'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  {selected.size} selected · dated today
                </span>
                <button
                  onClick={doImport}
                  disabled={selected.size === 0 || importing}
                  className="ml-auto bg-[#416ebe] hover:bg-[#3560b0] text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {importing
                    ? 'Adding…'
                    : `Add ${selected.size || ''} lesson${selected.size === 1 ? '' : 's'}`.trim()}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
