'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, EmptyState, Skeleton } from '@/components/student-ui'
import { isTestLessonType } from '@/lib/test-mode'

// ═══════════════════════════════════════════════════════════════════
// School Library ▸ Course Packs shelf.
//
// Ready-made curricula: About info (description, time-frame, audience,
// prerequisites, outcomes, materials) + an ordered mix of homework /
// live decks / tests. Teachers IMPORT a pack into a course — every
// chosen lesson is deep-copied as a DRAFT in pack order (the course
// Syllabus tab publishes them class by class). Pack authoring is
// superadmin/editor-only; every teacher can import and comment.
// ═══════════════════════════════════════════════════════════════════

interface Composition { homework: number; live: number; tests: number; total: number }

interface Pack {
  id: string
  name: string
  description: string | null
  time_frame: string | null
  level: string | null
  audience: string | null
  prerequisites: string | null
  outcomes: string | null
  materials: string | null
  created_by: string
  updated_at: string
  author_name: string
  composition: Composition
}

interface PackItem { lesson_id: string; title: string; shelf: 'homework' | 'live' | 'tests'; missing?: boolean }

interface LibraryLesson {
  id: string
  title: string
  lesson_type?: string | null
  block_counts?: Record<string, number>
  template_level?: string | null
}

interface PackComment { id: string; author_name: string; text: string; created_at: string; can_delete: boolean }

const SHELF_BADGE: Record<string, { label: string; cls: string }> = {
  homework: { label: '✏️ Homework', cls: 'bg-sky-wash text-sky-text' },
  live: { label: '🎬 Live deck', cls: 'bg-[#fdf0dd] text-[#b45309]' },
  tests: { label: '📝 Test', cls: 'bg-[#f1ecfe] text-[#6d28d9]' },
}

function shelfOfLesson(l: LibraryLesson): 'homework' | 'live' | 'tests' {
  if (isTestLessonType(l.lesson_type)) return 'tests'
  if ((l.block_counts?.presentation || 0) > 0) return 'live'
  return 'homework'
}

const ABOUT_FIELDS: { key: keyof Pack & string; label: string; placeholder: string; rows?: number }[] = [
  { key: 'description', label: 'Description', placeholder: 'What this course covers, in a paragraph…', rows: 3 },
  { key: 'time_frame', label: 'Suggested time-frame', placeholder: 'e.g. 12 weeks · 2 classes per week' },
  { key: 'audience', label: 'Target audience', placeholder: 'e.g. adults, teens, business…' },
  { key: 'prerequisites', label: 'Prerequisites', placeholder: 'e.g. completed Roadmap A1' },
  { key: 'outcomes', label: 'Learning outcomes', placeholder: 'By the end, students can…', rows: 2 },
  { key: 'materials', label: 'Materials needed', placeholder: 'e.g. coursebook, printouts' },
]

export default function CoursePacksShelf({
  canEdit,
  isSuperadmin,
  showToast,
}: {
  canEdit: boolean
  isSuperadmin: boolean
  showToast: (m: string) => void
}) {
  const [packs, setPacks] = useState<Pack[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Editor modal
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [items, setItems] = useState<PackItem[]>([])
  const [library, setLibrary] = useState<LibraryLesson[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [busy, setBusy] = useState(false)

  // Import modal
  const [importing, setImporting] = useState<Pack | null>(null)
  const [importItems, setImportItems] = useState<(PackItem & { checked: boolean })[]>([])
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([])
  const [importCourse, setImportCourse] = useState('')
  const [importBusy, setImportBusy] = useState(false)

  // Comments modal
  const [commentsFor, setCommentsFor] = useState<Pack | null>(null)
  const [comments, setComments] = useState<PackComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)

  const loadPacks = useCallback(async () => {
    try {
      const res = await fetch('/api/course-packs')
      const d = await res.json()
      setPacks(res.ok ? d.packs || [] : [])
      if (!res.ok && d.error) showToast(d.error)
    } catch {
      setPacks([])
    }
  }, [showToast])

  useEffect(() => { loadPacks() }, [loadPacks])

  // ── editor ──
  const openEditor = async (pack: Pack | null) => {
    setForm({
      name: pack?.name || '',
      description: pack?.description || '',
      time_frame: pack?.time_frame || '',
      level: pack?.level || '',
      audience: pack?.audience || '',
      prerequisites: pack?.prerequisites || '',
      outcomes: pack?.outcomes || '',
      materials: pack?.materials || '',
    })
    setPickerSearch('')
    setEditing({ id: pack?.id || null })
    setItems([])
    if (pack) {
      try {
        const res = await fetch(`/api/course-packs?id=${encodeURIComponent(pack.id)}`)
        const d = await res.json()
        if (res.ok) setItems(d.items || [])
      } catch { /* start empty */ }
    }
    if (library.length === 0) {
      try {
        const res = await fetch('/api/content-bank?action=list&scope=school')
        const d = await res.json()
        if (res.ok) setLibrary(d.templates || [])
      } catch { /* picker just stays empty */ }
    }
  }

  const savePack = async () => {
    if (!editing || !form.name.trim()) return
    setBusy(true)
    try {
      let packId = editing.id
      const metaBody = { ...form, name: form.name.trim() }
      if (!packId) {
        const res = await fetch('/api/course-packs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create-pack', ...metaBody }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || 'Could not create the pack')
        packId = d.pack_id
      } else {
        const res = await fetch('/api/course-packs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update-pack', pack_id: packId, ...metaBody }),
        })
        if (!res.ok) throw new Error('Could not save the pack')
      }
      const res2 = await fetch('/api/course-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-items', pack_id: packId, lesson_ids: items.map((i) => i.lesson_id) }),
      })
      if (!res2.ok) throw new Error('Pack saved, but its lesson list could not be stored')
      showToast('Course Pack saved')
      setEditing(null)
      loadPacks()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the pack')
    }
    setBusy(false)
  }

  const deletePack = async () => {
    if (!editing?.id) return
    if (!confirm('Delete this Course Pack? Courses that already imported it keep their copies.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/course-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-pack', pack_id: editing.id }),
      })
      if (res.ok) { showToast('Course Pack deleted'); setEditing(null); loadPacks() }
      else showToast('Could not delete the pack')
    } catch { showToast('Could not delete the pack') }
    setBusy(false)
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  // ── import ──
  const openImport = async (pack: Pack) => {
    setImporting(pack)
    setImportItems([])
    setImportCourse('')
    try {
      const [dRes, cRes] = await Promise.all([
        fetch(`/api/course-packs?id=${encodeURIComponent(pack.id)}`),
        fetch('/api/course-packs?view=courses'),
      ])
      const d = await dRes.json()
      const c = await cRes.json()
      if (dRes.ok) setImportItems((d.items || []).filter((i: PackItem) => !i.missing).map((i: PackItem) => ({ ...i, checked: true })))
      if (cRes.ok) {
        setCourses(c.courses || [])
        if ((c.courses || []).length === 1) setImportCourse(c.courses[0].id)
      }
    } catch { showToast('Could not load the pack') }
  }

  const runImport = async () => {
    if (!importing || !importCourse) return
    const chosen = importItems.filter((i) => i.checked).map((i) => i.lesson_id)
    if (chosen.length === 0) return
    setImportBusy(true)
    try {
      const res = await fetch('/api/course-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', pack_id: importing.id, course_id: importCourse, lesson_ids: chosen }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Import failed')
      const courseName = courses.find((c) => c.id === importCourse)?.name || 'the course'
      showToast(`${d.imported} lesson${d.imported === 1 ? '' : 's'} imported as drafts to ${courseName}${d.failed ? ` (${d.failed} failed)` : ''}`)
      setImporting(null)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Import failed')
    }
    setImportBusy(false)
  }

  // ── comments ──
  const openComments = async (pack: Pack) => {
    setCommentsFor(pack)
    setComments([])
    setCommentText('')
    try {
      const res = await fetch(`/api/pack-comments?pack_id=${encodeURIComponent(pack.id)}`)
      const d = await res.json()
      if (res.ok) setComments(d.comments || [])
    } catch { /* shows none */ }
  }

  const postComment = async () => {
    if (!commentsFor || !commentText.trim()) return
    setCommentBusy(true)
    try {
      const res = await fetch('/api/pack-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: commentsFor.id, text: commentText.trim() }),
      })
      if (res.ok) { setCommentText(''); await openComments(commentsFor) }
      else {
        const d = await res.json().catch(() => ({}))
        showToast(d.error || 'Could not save the comment')
      }
    } catch { showToast('Network error — comment not saved') }
    setCommentBusy(false)
  }

  const deleteComment = async (id: string) => {
    if (!commentsFor) return
    try {
      const res = await fetch('/api/pack-comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) await openComments(commentsFor)
    } catch { /* leave as is */ }
  }

  // ─────────────────────────── render ───────────────────────────

  if (packs === null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-card border border-hairline p-4">
            <Skeleton className="h-4 w-40 mb-2" />
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {canEdit && (
        <div className="flex justify-end mb-3">
          <Button variant="primary" size="sm" onClick={() => openEditor(null)}>＋ New Course Pack</Button>
        </div>
      )}

      {packs.length === 0 ? (
        <div className="bg-white rounded-card border border-hairline">
          <EmptyState
            icon="📦"
            title="No Course Packs yet."
            hint={canEdit
              ? 'Create one: pick lessons from any shelf, put them in teaching order, add the About info — teachers then import it into their courses in one go.'
              : 'Course Packs are ready-made curricula assembled by the school — once one exists, you can import it into your course from here.'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {packs.map((p) => {
            const open = expanded === p.id
            return (
              <div key={p.id} className="rounded-card border-[1.5px] border-correct-border bg-gradient-to-b from-[#f3fbf6] to-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-extrabold text-ink-black">📦 {p.name}</h3>
                  {p.level && <span className="shrink-0 text-[10px] font-extrabold bg-white border border-correct-border text-correct-fg px-2 py-0.5 rounded-full">{p.level}</span>}
                </div>
                <p className="text-xs text-ink-muted mt-0.5 mb-2">
                  {p.composition.total} lesson{p.composition.total === 1 ? '' : 's'}
                  {p.time_frame ? ` · ${p.time_frame}` : ''}
                </p>
                {p.description && <p className={`text-[12.5px] text-ink-body leading-relaxed mb-2 ${open ? '' : 'line-clamp-2'}`}>{p.description}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.composition.homework > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SHELF_BADGE.homework.cls}`}>✏️ {p.composition.homework} homework</span>}
                  {p.composition.live > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SHELF_BADGE.live.cls}`}>🎬 {p.composition.live} decks</span>}
                  {p.composition.tests > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SHELF_BADGE.tests.cls}`}>📝 {p.composition.tests} tests</span>}
                </div>

                {open && (
                  <div className="bg-white/70 rounded-tile border border-correct-border/60 p-3 mb-3 space-y-1.5">
                    {([
                      ['Audience', p.audience],
                      ['Prerequisites', p.prerequisites],
                      ['Outcomes', p.outcomes],
                      ['Materials', p.materials],
                    ] as [string, string | null][]).filter(([, v]) => v).map(([label, v]) => (
                      <p key={label} className="text-[11.5px] text-ink-body leading-relaxed"><span className="font-bold">{label}:</span> {v}</p>
                    ))}
                    <p className="text-[10.5px] text-ink-muted">By {p.author_name} · updated {new Date(p.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openImport(p)}
                    className="text-xs font-extrabold text-white bg-correct-fg px-3 py-1.5 rounded-tile hover:brightness-110 transition-all"
                  >
                    Import into a course
                  </button>
                  <button
                    onClick={() => setExpanded(open ? null : p.id)}
                    className="text-xs font-bold text-ink-muted border border-hairline px-2.5 py-1.5 rounded-tile hover:text-ink-body transition-colors"
                  >
                    {open ? 'Less' : 'About'}
                  </button>
                  <button
                    onClick={() => openComments(p)}
                    className="text-xs font-bold text-ink-muted border border-hairline px-2.5 py-1.5 rounded-tile hover:text-sky-text hover:border-sky-border transition-colors"
                  >
                    💬 Comments
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => openEditor(p)}
                      className="text-xs font-bold text-ink-muted border border-hairline px-2.5 py-1.5 rounded-tile hover:text-ink-body transition-colors"
                    >
                      ✎ Edit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pack editor modal ── */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && setEditing(null)}>
          <div className="bg-white rounded-card p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-ink-black mb-4">{editing.id ? 'Edit Course Pack' : 'New Course Pack'}</h3>

            <label className="block text-xs font-bold text-ink-body mb-1">Pack name *</label>
            <input
              value={form.name || ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Roadmap A2 Pack"
              className="w-full px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm mb-3 focus:outline-none focus:border-sky"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {ABOUT_FIELDS.map(({ key, label, placeholder, rows }) => (
                <div key={key} className={rows ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-ink-body mb-1">{label}</label>
                  {rows ? (
                    <textarea
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      rows={rows}
                      className="w-full px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm focus:outline-none focus:border-sky resize-none"
                    />
                  ) : (
                    <input
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm focus:outline-none focus:border-sky"
                    />
                  )}
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-ink-body mb-1">Level</label>
                <select
                  value={form.level || ''}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  className="w-full px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm bg-white focus:outline-none focus:border-sky"
                >
                  <option value="">— optional —</option>
                  {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Items manager */}
            <p className="text-xs font-bold text-ink-body mb-1">Lessons in this pack — in teaching order</p>
            <p className="text-[11px] text-ink-muted mb-2">Mix any shelf: homework, live decks, tests. Importing copies them in this order.</p>
            {items.length > 0 && (
              <div className="border border-hairline rounded-tile divide-y divide-hairline mb-3">
                {items.map((it, idx) => (
                  <div key={it.lesson_id} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-6 h-6 rounded-md bg-surface text-ink-muted text-[11px] font-extrabold grid place-items-center shrink-0">{idx + 1}</span>
                    <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${SHELF_BADGE[it.shelf].cls}`}>{SHELF_BADGE[it.shelf].label}</span>
                    <span className="text-[13px] font-semibold text-ink-body flex-1 min-w-0 truncate">{it.title}{it.missing ? ' (deleted)' : ''}</span>
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-ink-muted hover:text-ink-body disabled:opacity-30 text-sm px-1">↑</button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="text-ink-muted hover:text-ink-body disabled:opacity-30 text-sm px-1">↓</button>
                    <button onClick={() => setItems((prev) => prev.filter((x) => x.lesson_id !== it.lesson_id))} className="text-ink-muted hover:text-incorrect-fg text-sm px-1">✕</button>
                  </div>
                ))}
              </div>
            )}

            <input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search the library to add lessons…"
              className="w-full px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm mb-2 focus:outline-none focus:border-sky"
            />
            <div className="border border-hairline rounded-tile divide-y divide-hairline max-h-48 overflow-y-auto mb-4">
              {library
                .filter((l) => !items.some((i) => i.lesson_id === l.id))
                .filter((l) => !pickerSearch.trim() || l.title.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
                .slice(0, 40)
                .map((l) => {
                  const shelf = shelfOfLesson(l)
                  return (
                    <button
                      key={l.id}
                      onClick={() => setItems((prev) => [...prev, { lesson_id: l.id, title: l.title, shelf }])}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors"
                    >
                      <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${SHELF_BADGE[shelf].cls}`}>{SHELF_BADGE[shelf].label}</span>
                      <span className="text-[13px] text-ink-body flex-1 min-w-0 truncate">{l.title}</span>
                      {l.template_level && <span className="text-[10px] text-ink-muted shrink-0">{l.template_level}</span>}
                      <span className="text-xs font-bold text-sky-text shrink-0">＋ Add</span>
                    </button>
                  )
                })}
              {library.length === 0 && <p className="text-xs text-ink-muted italic px-3 py-3">Loading the library…</p>}
            </div>

            <div className="flex items-center gap-2">
              {editing.id && isSuperadmin && (
                <button onClick={deletePack} disabled={busy} className="text-xs font-bold text-incorrect-fg hover:underline disabled:opacity-50 mr-auto">
                  Delete pack
                </button>
              )}
              <span className="flex-1" />
              <button onClick={() => setEditing(null)} disabled={busy} className="px-4 py-2 text-sm text-ink-muted hover:text-ink-body disabled:opacity-50">Cancel</button>
              <button
                onClick={savePack}
                disabled={busy || !form.name?.trim()}
                className="px-4 py-2 bg-sky text-white text-sm font-extrabold rounded-tile disabled:opacity-50 hover:bg-[#0099d6] transition-colors"
              >
                {busy ? 'Saving…' : 'Save pack'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import modal ── */}
      {importing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !importBusy && setImporting(null)}>
          <div className="bg-white rounded-card p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-ink-black mb-1">Import: {importing.name}</h3>
            <p className="text-xs text-ink-muted mb-3">
              Everything lands in the course as <b>drafts</b>, in this order — students see nothing until you publish each lesson.
            </p>
            {(importing.description || importing.time_frame) && (
              <div className="bg-surface rounded-tile px-3 py-2.5 mb-3">
                {importing.description && <p className="text-[12px] text-ink-body leading-relaxed mb-1">{importing.description}</p>}
                {importing.time_frame && <p className="text-[11px] text-ink-muted">⏱ {importing.time_frame}</p>}
              </div>
            )}

            <label className="block text-xs font-bold text-ink-body mb-1">Into course</label>
            <select
              value={importCourse}
              onChange={(e) => setImportCourse(e.target.value)}
              className="w-full px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm bg-white mb-3 focus:outline-none focus:border-sky"
            >
              <option value="">— choose a course —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div className="border border-hairline rounded-tile divide-y divide-hairline max-h-64 overflow-y-auto mb-3">
              {importItems.map((it, idx) => (
                <label key={it.lesson_id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={() => setImportItems((prev) => prev.map((x) => x.lesson_id === it.lesson_id ? { ...x, checked: !x.checked } : x))}
                    className="w-4 h-4 accent-[#37a3df] shrink-0"
                  />
                  <span className="w-6 h-6 rounded-md bg-surface text-ink-muted text-[11px] font-extrabold grid place-items-center shrink-0">{idx + 1}</span>
                  <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${SHELF_BADGE[it.shelf].cls}`}>{SHELF_BADGE[it.shelf].label}</span>
                  <span className="text-[13px] text-ink-body min-w-0 truncate">{it.title}</span>
                </label>
              ))}
              {importItems.length === 0 && <p className="text-xs text-ink-muted italic px-3 py-3">Loading pack lessons…</p>}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted mr-auto">{importItems.filter((i) => i.checked).length} selected</span>
              <button onClick={() => setImporting(null)} disabled={importBusy} className="px-4 py-2 text-sm text-ink-muted hover:text-ink-body disabled:opacity-50">Cancel</button>
              <button
                onClick={runImport}
                disabled={importBusy || !importCourse || importItems.every((i) => !i.checked)}
                className="px-4 py-2 bg-correct-fg text-white text-sm font-extrabold rounded-tile disabled:opacity-50 hover:brightness-110 transition-all"
              >
                {importBusy ? 'Importing…' : `Import ${importItems.filter((i) => i.checked).length} as drafts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Comments modal ── */}
      {commentsFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCommentsFor(null)}>
          <div className="bg-white rounded-card p-5 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-base text-ink-black">💬 Comments</h3>
              <button onClick={() => setCommentsFor(null)} aria-label="Close" className="text-ink-muted hover:text-ink-body text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-ink-muted mb-4 truncate">📦 {commentsFor.name}</p>

            {comments.length === 0 ? (
              <p className="text-xs text-ink-muted italic mb-4">No comments yet — tips for teaching this pack, or something to fix? Leave a note.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className="bg-surface rounded-tile px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold text-ink-body">{c.author_name}</span>
                      <span className="text-[10.5px] text-ink-muted flex items-center gap-2">
                        {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {c.can_delete && (
                          <button onClick={() => deleteComment(c.id)} className="text-ink-muted hover:text-incorrect-fg font-bold" title="Delete comment">✕</button>
                        )}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-body leading-relaxed whitespace-pre-wrap">{c.text}</p>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              placeholder="e.g. Works great for teens — I skip Unit 8 with adults"
              className="w-full px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm mb-2 focus:outline-none focus:border-sky resize-none"
            />
            <button
              onClick={postComment}
              disabled={commentBusy || !commentText.trim()}
              className="w-full py-2 bg-sky text-white text-sm font-extrabold rounded-tile disabled:opacity-50 hover:bg-[#0099d6] transition-colors"
            >
              {commentBusy ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
