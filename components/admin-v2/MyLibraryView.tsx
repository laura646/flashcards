'use client'

// 10B redesign — MY LIBRARY (Phase 1, "My Library" model).
//
// A teacher's personal space: start a lesson course-free, hold unpublished
// drafts, then ASSIGN a draft to a course (it then lives in that course).
//
// Phase 1 scope is the CREATE + DRAFTS + ASSIGN core only. School Library and
// sharing are later phases. No DB migration this phase.
//
// Presentational w.r.t. lessons (data in via props), but self-fetches the
// teacher's courses (GET /api/admin?action=my-courses) so it can power the
// assign picker + map course_id -> name for the "Assigned to <course>" toast.

import { useEffect, useMemo, useState } from 'react'
import { Button, Pill, Skeleton, EmptyState, Spinner } from '@/components/student-ui'
import type { Lesson } from '@/lib/lesson-editor/types'

// Minimal shape we need off the my-courses payload (it returns more fields).
interface CourseLite {
  id: string
  name: string
}

// Verbatim date formatting from legacy formatDate (page.tsx 482-485).
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function blockTotal(counts: Record<string, number> | undefined): number {
  if (!counts) return 0
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-sky-text leading-none">{value}</p>
      <p className="text-[10px] text-ink-muted mt-0.5">{label}</p>
    </div>
  )
}

export default function MyLibraryView({
  lessons,
  loading,
  currentUserEmail,
  onOpenLesson,
  onNewLesson,
  onAssign,
  onOpenSchoolLibrary,
}: {
  lessons: Lesson[]
  loading: boolean
  currentUserEmail: string
  onOpenLesson: (id: string) => void
  onNewLesson: () => void
  onAssign: (lessonId: string, courseId: string) => Promise<{ ok: boolean; error?: string }>
  onOpenSchoolLibrary: () => void
}) {
  // ── Self-fetched courses (for the assign picker + name mapping) ──
  const [courses, setCourses] = useState<CourseLite[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin?action=my-courses')
        const data = await res.json()
        if (!cancelled) setCourses(data.courses || [])
      } catch {
        /* swallow — picker just shows no courses */
      } finally {
        if (!cancelled) setCoursesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // course_id -> name lookup (for the "Assigned to <course>" toast).
  const courseNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of courses) map[c.id] = c.name
    return map
  }, [courses])

  // ── My unassigned drafts ──
  // Mine + course-free + not a template + status draft. A row missing
  // created_by is treated as not-mine (older rows have no creator stamp).
  const drafts = useMemo(() => {
    return lessons
      .filter(
        (l) =>
          !!l.created_by &&
          l.created_by === currentUserEmail &&
          !l.course_id &&
          !l.is_template &&
          l.status === 'draft',
      )
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.updated_at || a.lesson_date || 0).getTime()
        const tb = new Date(b.updated_at || b.lesson_date || 0).getTime()
        return tb - ta
      })
  }, [lessons, currentUserEmail])

  // Drafts removed optimistically after a successful assign (so the card
  // disappears immediately, before the parent's loadLessons() round-trips).
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const visibleDrafts = useMemo(
    () => drafts.filter((d) => !assignedIds.has(d.id)),
    [drafts, assignedIds],
  )

  // Transient "Assigned to <course>" toast.
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-brandblue mb-1">My Library</h1>
        <p className="text-sm text-ink-muted mb-5">
          Draft lessons here, then assign them to a course.
        </p>

        {/* ── CREATE panel ── */}
        <div className="bg-sky-wash border border-sky-border rounded-card p-4 mb-7">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="md" onClick={onNewLesson}>
              ＋ New Lesson
            </Button>
            <Button variant="textLink" size="sm" className="ml-auto" onClick={onOpenSchoolLibrary}>
              Browse School Library →
            </Button>
          </div>
        </div>

        {/* ── DRAFTS IN PROGRESS ── */}
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
            Drafts in progress
          </h2>
          {!loading && visibleDrafts.length > 0 && (
            <span className="text-xs font-normal text-ink-muted">
              {visibleDrafts.length} draft{visibleDrafts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-card border border-hairline p-4">
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-3 w-24 mb-4" />
                <Skeleton className="h-7 w-full" />
              </div>
            ))}
          </div>
        ) : visibleDrafts.length === 0 ? (
          <div className="bg-white rounded-card border border-hairline">
            <EmptyState
              icon="📝"
              title="No drafts yet"
              hint="Click ＋ New Lesson to start one."
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {visibleDrafts.map((lesson) => (
              <DraftCard
                key={lesson.id}
                lesson={lesson}
                courses={courses}
                coursesLoading={coursesLoading}
                onOpenLesson={onOpenLesson}
                onAssign={async (courseId) => {
                  const res = await onAssign(lesson.id, courseId)
                  if (res.ok) {
                    setAssignedIds((prev) => {
                      const next = new Set(prev)
                      next.add(lesson.id)
                      return next
                    })
                    setToast(`Assigned to ${courseNameById[courseId] || 'course'}`)
                  }
                  return res
                }}
              />
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-ink-black text-white text-sm font-bold px-4 py-2.5 rounded-tile shadow-lg font-rubik"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Draft card ──────────────────────────────────────────────────────────────
// Card body is a clickable area (opens the lesson); the assign control sits in
// a SEPARATE row beneath so we never nest an interactive control inside another
// (avoids the nested-interactive a11y issue).
function DraftCard({
  lesson,
  courses,
  coursesLoading,
  onOpenLesson,
  onAssign,
}: {
  lesson: Lesson
  courses: CourseLite[]
  coursesLoading: boolean
  onOpenLesson: (id: string) => void
  onAssign: (courseId: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocks = blockTotal(lesson.block_counts)

  const handleAssign = async () => {
    if (!selectedCourseId || assigning) return
    setAssigning(true)
    setError(null)
    const res = await onAssign(selectedCourseId)
    // On ok the parent removes this card from the list; no need to reset state.
    if (!res.ok) {
      setError(res.error || 'Failed to assign')
      setAssigning(false)
    }
  }

  return (
    <div className="bg-white rounded-card border border-hairline flex flex-col">
      {/* Clickable body — opens the lesson */}
      <button
        onClick={() => onOpenLesson(lesson.id)}
        className="text-left p-4 flex flex-col gap-2 hover:bg-surface/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 rounded-t-card"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-ink-black leading-snug line-clamp-2">
            {lesson.title || 'Untitled lesson'}
          </p>
          <Pill variant="wash">Draft</Pill>
        </div>
        <span className="text-xs text-ink-muted">{formatDate(lesson.lesson_date)}</span>
        <div className="flex items-center gap-5 pt-2.5 border-t border-hairline">
          <Count value={lesson.flashcard_count || 0} label="vocab" />
          <Count value={lesson.exercise_count || 0} label="exercises" />
          {blocks > 0 && <Count value={blocks} label="blocks" />}
        </div>
      </button>

      {/* Assign control — separate row beneath the clickable body */}
      <div className="px-4 pb-4 pt-3 border-t border-hairline">
        <div className="flex items-center gap-2">
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value)
              setError(null)
            }}
            disabled={coursesLoading || assigning}
            aria-label="Assign to course"
            className="flex-1 min-w-0 text-[13px] font-medium text-ink-body bg-white rounded-tile border-[1.5px] border-[#e3e5e9] px-3 py-2 focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
          >
            <option value="">Assign to course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            disabled={!selectedCourseId || assigning}
            onClick={handleAssign}
          >
            {assigning ? <Spinner size={14} label="Assigning…" /> : 'Assign'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-[12px] font-medium text-incorrect-fg mt-2">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
