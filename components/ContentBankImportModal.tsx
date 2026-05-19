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
  existingTitles: string[]
  onClose: () => void
  onCreateOwn: () => void
  onImported: (count: number) => void
}

const norm = (s: string) => s.trim().toLowerCase()

// Common IANA zones for the scheduler picker. The teacher's detected
// zone is always prepended so it's selectable even if not in this list.
const COMMON_TZS = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Tehran',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
]

// Offset (ms) of `tz` at the instant `date`.
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  dtf.formatToParts(date).forEach((p) => {
    if (p.type !== 'literal') map[p.type] = p.value
  })
  const asUtc = Date.UTC(
    +map.year,
    +map.month - 1,
    +map.day,
    +map.hour,
    +map.minute,
    +map.second
  )
  return asUtc - date.getTime()
}

// Convert a wall-clock date+time in `tz` to a UTC ISO instant.
// Two-pass to stay correct across DST boundaries.
function wallTimeToUtcIso(dateStr: string, timeStr: string, tz: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0)
  let utc = naive
  for (let i = 0; i < 2; i++) {
    utc = naive - tzOffsetMs(new Date(utc), tz)
  }
  return new Date(utc).toISOString()
}

export default function ContentBankImportModal({
  courseId,
  existingTitles,
  onClose,
  onCreateOwn,
  onImported,
}: Props) {
  const [step, setStep] = useState<'choose' | 'browse' | 'schedule'>('choose')
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  // Scheduler form (step === 'schedule')
  const detectedTz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  })()
  const today = new Date().toISOString().split('T')[0]
  const [schedDate, setSchedDate] = useState(today)
  const [schedTime, setSchedTime] = useState('09:00')
  const [schedTz, setSchedTz] = useState(detectedTz)

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

  const doImport = async (
    status: 'draft' | 'published',
    publishAtIso?: string,
    lessonDate?: string
  ) => {
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
            status,
            ...(publishAtIso ? { publish_at: publishAtIso } : {}),
            ...(lessonDate ? { lesson_date: lessonDate } : {}),
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

  const confirmSchedule = () => {
    if (!schedDate || !schedTime) {
      setError('Pick a date and time to schedule.')
      return
    }
    const iso = wallTimeToUtcIso(schedDate, schedTime, schedTz)
    if (new Date(iso).getTime() <= Date.now()) {
      setError('Scheduled time must be in the future.')
      return
    }
    // Scheduled lessons import as draft + publish_at; cron publishes them
    // at that time, and we date the lesson to its scheduled day.
    doImport('draft', iso, schedDate)
  }

  // ── Clone / duplicate detection ──
  const existingSet = new Set(existingTitles.map(norm))
  const bankCount: Record<string, number> = {}
  templates.forEach((t) => {
    const k = norm(t.title)
    bankCount[k] = (bankCount[k] || 0) + 1
  })
  const cloneInfo = (title: string): string | null => {
    const k = norm(title)
    if (existingSet.has(k)) return 'Already a lesson in this course — adding it will create a duplicate.'
    if (bankCount[k] > 1) return 'This title appears more than once in the content bank — may be a duplicate.'
    return null
  }

  const tzOptions = Array.from(new Set([detectedTz, ...COMMON_TZS]))

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
        ) : step === 'browse' ? (
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
                      const warn = cloneInfo(t.title)
                      return (
                        <div
                          key={t.id}
                          className={`rounded-xl border transition-all ${
                            isSel
                              ? 'border-[#416ebe] bg-[#f3f8ff]'
                              : warn
                              ? 'border-red-200'
                              : 'border-[#cddcf0]'
                          }`}
                        >
                          <button
                            onClick={() => toggle(t.id)}
                            className="w-full text-left p-3 flex items-start gap-3"
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
                          {warn && (
                            <div className="px-3 pb-2.5 -mt-1 flex items-start gap-2">
                              <p className="text-[11px] text-red-500 flex-1">⚠ {warn}</p>
                              {isSel && (
                                <button
                                  onClick={() => toggle(t.id)}
                                  className="text-[11px] font-bold text-red-500 hover:underline shrink-0"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          )}
                        </div>
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
                <span className="text-xs text-gray-400">
                  {selected.size} selected · dated today
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => doImport('published')}
                    disabled={selected.size === 0 || importing}
                    className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {importing ? 'Adding…' : 'Publish now'}
                  </button>
                  <button
                    onClick={() => doImport('draft')}
                    disabled={selected.size === 0 || importing}
                    className="bg-white border border-[#cddcf0] hover:border-[#416ebe] text-[#46464b] text-sm font-bold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Save as draft
                  </button>
                  <button
                    onClick={() => { setError(''); setStep('schedule') }}
                    disabled={selected.size === 0 || importing}
                    className="bg-white border border-[#cddcf0] hover:border-[#416ebe] text-[#46464b] text-sm font-bold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Schedule…
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : step === 'schedule' ? (
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm text-[#46464b]">
              Schedule <span className="font-bold">{selected.size}</span> lesson
              {selected.size === 1 ? '' : 's'} to publish automatically. They stay
              hidden from students until the chosen time.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <span className="text-amber-500 shrink-0">ⓘ</span>
              <p className="text-[12px] text-amber-700 leading-relaxed">
                Lessons go live at the next 15-minute mark after your chosen time
                (e.g. a lesson set for 3:07 publishes at 3:15), not the exact
                minute. Until then it stays a hidden draft — so set the time a
                little earlier if it must be live by a specific moment.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date</label>
                <input
                  type="date"
                  value={schedDate}
                  min={today}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Time</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Timezone</label>
                <select
                  value={schedTz}
                  onChange={(e) => setSchedTz(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] bg-white"
                >
                  {tzOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz === detectedTz ? `${tz} (yours)` : tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={confirmSchedule}
                disabled={importing}
                className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {importing ? 'Scheduling…' : `Schedule ${selected.size} lesson${selected.size === 1 ? '' : 's'}`}
              </button>
              <button
                onClick={() => { setError(''); setStep('browse') }}
                disabled={importing}
                className="text-sm font-bold text-gray-400 hover:text-[#46464b] px-3"
              >
                Back
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
