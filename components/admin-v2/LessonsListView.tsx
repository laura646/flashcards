'use client'

// 10B redesign — Lesson Manager LIST (Phase 1, "new beside old").
//
// Presentational only (data in via props) so it's verifiable with mock data in
// a harness AND reused by the real /admin-beta/lessons page. The live editor at
// app/admin/lessons/page.tsx is left 100% untouched; this is a fresh 10B view.
//
// Mirrors the legacy list (page.tsx ~4007-4115): header "Lesson Manager" +
// "+ New Lesson", an "All Lessons (N)" count + search box, and per-lesson rows
// showing title, status, date, and vocab / exercises / blocks counts. Styled
// fresh with the student-ui kit + 10B tokens.

import { Button, Pill, Skeleton, EmptyState } from '@/components/student-ui'
import type { Lesson } from '@/lib/lesson-editor/types'

// Lesson-type chips (mirrors legacy LESSON_TYPES labels; only shown when the
// type is not the default "lesson").
const LESSON_TYPE_LABELS: Record<string, string> = {
  lesson: 'Lesson',
  mid_course_test: 'Mid-Course Test',
  final_test: 'Final Test',
  review_test: 'Review Test',
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

export function LessonsListView({
  lessons,
  loading,
  query,
  onQueryChange,
  onOpenLesson,
  onNewLesson,
}: {
  lessons: Lesson[]
  loading: boolean
  query: string
  onQueryChange: (v: string) => void
  onOpenLesson: (id: string) => void
  onNewLesson: () => void
}) {
  const q = query.trim().toLowerCase()
  const filtered = q
    ? lessons.filter(
        (l) =>
          (l.title || '').toLowerCase().includes(q) ||
          (l.summary || '').toLowerCase().includes(q),
      )
    : lessons

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <h1 className="text-2xl font-bold text-brandblue">Lesson Manager</h1>
          <Button variant="primary" size="sm" onClick={onNewLesson}>
            ＋ New Lesson
          </Button>
        </div>

        {/* List card */}
        <div className="bg-white rounded-card border border-hairline overflow-hidden">
          {/* Count + search */}
          <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-bold text-ink-black shrink-0 text-sm">
              All Lessons{' '}
              <span className="text-xs font-normal text-ink-muted">
                ({q ? `${filtered.length} of ${lessons.length}` : lessons.length})
              </span>
            </h2>
            {lessons.length > 0 && (
              <div className="relative w-full max-w-xs">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Search lessons…"
                  className="w-full pl-9 pr-9 py-2 text-sm text-ink-body bg-white border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]"
                />
                {query && (
                  <button
                    onClick={() => onQueryChange('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-body"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          {loading ? (
            <div className="divide-y divide-hairline">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-28" />
                </div>
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <EmptyState
              icon="📚"
              title="No lessons yet"
              hint="Create your first lesson to get started."
              action={
                <Button variant="primary" size="sm" onClick={onNewLesson}>
                  ＋ Create Lesson
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No matches"
              hint={`No lessons match "${query}".`}
              action={
                <Button variant="secondary" size="sm" onClick={() => onQueryChange('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-hairline">
              {filtered.map((lesson) => {
                const blocks = blockTotal(lesson.block_counts)
                const typeLabel =
                  lesson.lesson_type && lesson.lesson_type !== 'lesson'
                    ? LESSON_TYPE_LABELS[lesson.lesson_type] || lesson.lesson_type
                    : null
                return (
                  <button
                    key={lesson.id}
                    onClick={() => onOpenLesson(lesson.id)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-sky-wash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-bold text-ink-black truncate">{lesson.title}</p>
                        {lesson.status === 'published' ? (
                          <Pill variant="correct">Published</Pill>
                        ) : (
                          <Pill variant="wash">Draft</Pill>
                        )}
                        {typeLabel && <Pill variant="level">{typeLabel}</Pill>}
                      </div>
                      <p className="text-xs text-ink-muted">{formatDate(lesson.lesson_date)}</p>
                    </div>
                    <div className="flex items-center gap-4 ml-2 shrink-0">
                      <Count value={lesson.flashcard_count || 0} label="vocab" />
                      <Count value={lesson.exercise_count || 0} label="exercises" />
                      {blocks > 0 && <Count value={blocks} label="blocks" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LessonsListView
