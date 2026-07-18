'use client'

import { useState, useEffect, useCallback } from 'react'
import { EmptyState, Skeleton } from '@/components/student-ui'

// ═══════════════════════════════════════════════════════════════════
// Course ▸ Syllabus — the teacher-only cockpit for an imported Course
// Pack. Pack lessons sit here in teaching order as DRAFTS; the teacher
// publishes one per class and the "what students see" panel updates.
//
// Live decks are never published: they stay teacher-side and are opened
// with ▶ Present (new tab). Homework and tests get Publish / Unpublish.
// ═══════════════════════════════════════════════════════════════════

interface SyllabusItem {
  id: string
  title: string
  status: 'draft' | 'published'
  shelf: 'homework' | 'live' | 'tests'
  order: number
}

const SHELF: Record<string, { label: string; cls: string }> = {
  homework: { label: '✏️ Homework', cls: 'bg-sky-wash text-sky-text' },
  live: { label: '🎬 Live deck', cls: 'bg-[#fdf0dd] text-[#b45309]' },
  tests: { label: '📝 Test', cls: 'bg-[#f1ecfe] text-[#6d28d9]' },
}

export default function CourseSyllabusTab({
  courseId,
  canEdit,
}: {
  courseId: string
  canEdit: boolean
}) {
  const [items, setItems] = useState<SyllabusItem[] | null>(null)
  const [packName, setPackName] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/course-packs?view=syllabus&course_id=${encodeURIComponent(courseId)}`)
      const d = await res.json()
      if (!res.ok) { setItems([]); return }
      setItems(d.items || [])
      setPackName(d.pack_name || null)
    } catch {
      setItems([])
    }
  }, [courseId])

  useEffect(() => { load() }, [load])

  const setStatus = async (item: SyllabusItem, status: 'draft' | 'published') => {
    setBusyId(item.id)
    setError(null)
    // Optimistic — the row flips immediately, reload confirms.
    setItems((prev) => prev?.map((x) => (x.id === item.id ? { ...x, status } : x)) ?? prev)
    try {
      const res = await fetch('/api/course-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-lesson-status', lesson_id: item.id, status }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Could not change the lesson status.')
      }
      await load()
    } catch {
      setError('Network error — the lesson status may not have changed.')
      await load()
    }
    setBusyId(null)
  }

  const publishable = (items || []).filter((i) => i.shelf !== 'live')
  const publishedCount = publishable.filter((i) => i.status === 'published').length
  const next = publishable.find((i) => i.status === 'draft')
  const pct = publishable.length > 0 ? Math.round((publishedCount / publishable.length) * 100) : 0
  // Decks stay teacher-side, so the student list is published non-deck lessons.
  const studentVisible = (items || []).filter((i) => i.status === 'published' && i.shelf !== 'live')

  if (items === null) {
    return (
      <div className="bg-white rounded-card border border-hairline p-4">
        <Skeleton className="h-4 w-48 mb-3" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-card border border-hairline">
        <EmptyState
          icon="📦"
          title="No Course Pack imported yet."
          hint="Open School Library → Course Packs and import one into this course. Its lessons appear here as drafts, in teaching order, for you to publish class by class."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 items-start bg-surface border border-hairline rounded-card px-4 py-3">
        <span className="text-base leading-none mt-0.5">🔒</span>
        <p className="text-[12px] text-ink-body leading-relaxed">
          <b>Only teachers see this tab.</b> Draft lessons are invisible to students — each appears on their home page the moment you publish it.
          Live decks stay teacher-side: open them with ▶ Present in class.
        </p>
      </div>

      {error && (
        <div className="bg-incorrect-bg border border-incorrect-border rounded-card px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-incorrect-fg">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-bold text-incorrect-fg">✕</button>
        </div>
      )}

      {/* Progress + publish next */}
      <div className="bg-white rounded-card border border-hairline p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {packName && <p className="text-[10.5px] font-extrabold uppercase tracking-eyebrow text-correct-fg">Course Pack · {packName}</p>}
          <p className="text-sm font-extrabold text-ink-black mt-0.5">
            {publishedCount} of {publishable.length} lesson{publishable.length === 1 ? '' : 's'} published
          </p>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden mt-2 w-[230px] max-w-[60vw]">
            <div className="h-full bg-brandblue rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => next && setStatus(next, 'published')}
            disabled={!next || !!busyId}
            className="shrink-0 bg-brandblue text-white font-extrabold text-[13px] px-4 py-2.5 rounded-tile hover:brightness-110 transition-all disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {next ? `Publish next: ${next.title}` : 'All lessons published ✓'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4 items-start">
        {/* Ordered lessons */}
        <div className="space-y-2">
          {items.map((it) => {
            const isLive = it.shelf === 'live'
            const published = it.status === 'published'
            return (
              <div
                key={it.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-card border ${
                  published ? 'bg-[#fbfefc] border-correct-border' : 'bg-white border-hairline'
                }`}
              >
                <span className="w-6 h-6 rounded-md bg-surface text-ink-muted text-[11px] font-extrabold grid place-items-center shrink-0">
                  {it.order || '·'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${SHELF[it.shelf].cls}`}>
                      {SHELF[it.shelf].label}
                    </span>
                    <span className="text-[13.5px] font-bold text-ink-black truncate">{it.title}</span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {isLive ? 'Teacher-side — present in class' : it.shelf === 'tests' ? 'Timed exam' : 'Auto-graded homework'}
                  </p>
                </div>

                {isLive ? (
                  <a
                    href={`/present/${it.id}?t=${encodeURIComponent(it.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[11.5px] font-extrabold text-[#b45309] border-[1.5px] border-[#f0d9b5] px-2.5 py-1.5 rounded-tile hover:bg-[#fdf0dd] transition-colors"
                  >
                    ▶ Present
                  </a>
                ) : (
                  <>
                    <span className={`shrink-0 text-[9.5px] font-extrabold px-2.5 py-1 rounded-full ${
                      published ? 'bg-correct-bg text-correct-fg' : 'bg-surface text-ink-muted'
                    }`}>
                      {published ? 'Published' : 'Draft'}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => setStatus(it, published ? 'draft' : 'published')}
                        disabled={busyId === it.id}
                        className={`shrink-0 text-[11.5px] font-extrabold px-2.5 py-1.5 rounded-tile border-[1.5px] transition-colors disabled:opacity-50 ${
                          published
                            ? 'border-hairline text-ink-muted hover:text-ink-body'
                            : 'border-brandblue text-brandblue hover:bg-sky-wash'
                        }`}
                      >
                        {busyId === it.id ? '…' : published ? 'Unpublish' : 'Publish'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* What students see */}
        <div className="bg-gradient-to-b from-[#f5fbff] to-white border border-sky-border rounded-card p-4 lg:sticky lg:top-4">
          <h4 className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky-text flex items-center gap-1.5">
            👁 What students see
          </h4>
          <p className="text-[11px] text-ink-muted mt-1 mb-3">
            Their home page for this course — published lessons only.
          </p>
          {studentVisible.length === 0 ? (
            <p className="text-[12px] text-ink-muted italic text-center py-4">
              Nothing published yet — this course is empty for students.
            </p>
          ) : (
            <div className="space-y-2">
              {studentVisible.map((it) => (
                <div key={it.id} className="bg-white border border-sky-border rounded-tile px-3 py-2">
                  <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${SHELF[it.shelf].cls}`}>
                    {SHELF[it.shelf].label}
                  </span>
                  <p className="text-[12.5px] font-bold text-ink-black mt-1.5">{it.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
