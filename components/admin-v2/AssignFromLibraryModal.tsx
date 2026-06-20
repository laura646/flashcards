'use client'

// 10B redesign — ASSIGN-FROM-LIBRARY MODAL (Phase 3 of the locked model).
//
// SELF-FETCHING modal opened from inside a COURSE. It lists the teacher's
// UNASSIGNED My-Library drafts and lets them assign one straight into this
// course in a single POST. It mutates the server (the assign-course action
// sets ONLY course_id) and then asks the caller to reload via onAssigned.
//
// "My unassigned drafts" = GET /api/lessons?include_all=true rows where
//   created_by === me  &&  !course_id  &&  !is_template  &&  status === 'draft'
// (same predicate MyLibraryView uses for its assignable drafts).
//
// Shell + z-index mirror the sibling ai/ pickers (ContentBankPickerModal):
// fixed inset-0, z-50, 10B kit primitives + tokens. Once assigned, the draft
// gains a course_id so it drops out of My Library and appears in this course's
// Lessons tab on the caller's reload().

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  EmptyState,
  InlineError,
  Pill,
  Skeleton,
  Spinner,
} from '@/components/student-ui'

// ── API row shape (subset of /api/lessons?include_all=true we use here) ──
interface DraftRow {
  id: string
  title: string | null
  lesson_date: string | null
  updated_at: string | null
  created_by: string | null
  course_id: string | null
  is_template: boolean | null
  status: string | null
  template_level: string | null
  template_category: string | null
  flashcard_count: number
  exercise_count: number
  block_counts: Record<string, number>
}

interface Props {
  courseId: string
  courseName: string
  currentUserEmail: string
  onClose: () => void
  onAssigned: () => void
}

// Sums every block-type count into one number for the card meta line.
function totalBlocks(counts: Record<string, number> | undefined): number {
  return Object.values(counts || {}).reduce((a, b) => a + b, 0)
}

// Sort key: newest activity first, falling back to lesson_date.
function sortKey(d: DraftRow): number {
  const raw = d.updated_at || d.lesson_date || ''
  const t = raw ? new Date(raw).getTime() : 0
  return Number.isNaN(t) ? 0 : t
}

export default function AssignFromLibraryModal({
  courseId,
  courseName,
  currentUserEmail,
  onClose,
  onAssigned,
}: Props) {
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Id of the row currently being assigned (in-flight spinner).
  const [assigningId, setAssigningId] = useState<string | null>(null)
  // Inline per-row assign error keyed by lesson id.
  const [assignError, setAssignError] = useState<{ id: string; message: string } | null>(null)

  // ── Fetch + filter my unassigned drafts ──
  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)

    fetch('/api/lessons?include_all=true')
      .then((r) => {
        if (!r.ok) throw new Error('lessons')
        return r.json()
      })
      .then((data: { lessons?: DraftRow[] }) => {
        if (cancelled) return
        const rows = (data.lessons || []).filter(
          (l) =>
            !!l.created_by &&
            l.created_by === currentUserEmail &&
            !l.course_id &&
            !l.is_template &&
            l.status === 'draft',
        )
        rows.sort((a, b) => sortKey(b) - sortKey(a))
        setDrafts(rows)
      })
      .catch(() => {
        if (!cancelled) setFetchError('Could not load your drafts. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentUserEmail])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  // ── Assign one draft into this course ──
  const assign = async (lessonId: string) => {
    setAssigningId(lessonId)
    setAssignError(null)
    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign-course', lessonId, course_id: courseId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed')
      }
      onAssigned()
      onClose()
    } catch {
      setAssignError({ id: lessonId, message: 'Could not assign this draft. Please try again.' })
      setAssigningId(null)
    }
  }

  const count = drafts.length
  const subtitle = useMemo(
    () => `Pick one of your drafts to add to ${courseName}.`,
    [courseName],
  )

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
        aria-label="Assign from My Library"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              📚 My Library
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5">
              Assign from My Library
            </h3>
            <p className="text-[12px] text-ink-muted mt-1 leading-relaxed">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {fetchError ? (
            <InlineError message={fetchError} onRetry={load} className="my-4" />
          ) : loading ? (
            <div className="space-y-2.5 py-2">
              <Skeleton className="h-[72px] w-full" />
              <Skeleton className="h-[72px] w-full" />
              <Skeleton className="h-[72px] w-full" />
            </div>
          ) : count === 0 ? (
            <EmptyState
              icon="🗂️"
              title="No unassigned drafts"
              hint="Create one in My Library first."
            />
          ) : (
            <div className="space-y-2.5">
              {drafts.map((d) => {
                const blocks = totalBlocks(d.block_counts)
                const metaParts: string[] = []
                if (d.flashcard_count > 0)
                  metaParts.push(`${d.flashcard_count} vocab card${d.flashcard_count === 1 ? '' : 's'}`)
                if (d.exercise_count > 0)
                  metaParts.push(`${d.exercise_count} exercise${d.exercise_count === 1 ? '' : 's'}`)
                if (blocks > 0) metaParts.push(`${blocks} block${blocks === 1 ? '' : 's'}`)

                const busy = assigningId === d.id
                const rowError = assignError?.id === d.id ? assignError.message : null

                return (
                  <div
                    key={d.id}
                    className="rounded-tile border border-hairline px-4 py-3 hover:border-sky-border transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-ink-black truncate">
                          {d.title || 'Untitled draft'}
                        </p>
                        <p className="text-[12px] text-ink-muted mt-0.5 truncate">
                          {metaParts.length > 0 ? metaParts.join(' · ') : 'Empty draft'}
                        </p>
                        {(d.template_level || d.template_category) && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {d.template_level && <Pill variant="level">{d.template_level}</Pill>}
                            {d.template_category && <Pill variant="wash">{d.template_category}</Pill>}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => assign(d.id)}
                          disabled={busy || assigningId !== null}
                        >
                          {busy ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Spinner size={14} label="Assigning…" /> Assigning…
                            </span>
                          ) : (
                            'Assign'
                          )}
                        </Button>
                      </div>
                    </div>
                    {rowError && <InlineError message={rowError} className="mt-2.5" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-hairline shrink-0">
          <span className="text-[12px] text-ink-muted">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={14} /> Loading drafts…
              </span>
            ) : (
              `${count} draft${count === 1 ? '' : 's'}`
            )}
          </span>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
