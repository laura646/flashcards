'use client'

// 10B redesign — LESSON-BUILDER LANDING (Phase 1, "new beside old").
//
// Replaces the flat all-lessons list as the default /admin-beta/lessons view.
// In the new model "lessons live inside Courses", so this landing is a launcher:
//   1. START A NEW LESSON  — pick a course, then "+ New Lesson" (or course-less)
//   2. CONTINUE A DRAFT    — the teacher's most-recent unpublished drafts
//   3. JUMP TO A COURSE    — chips that open each course (where its lesson list
//                            now lives)
//
// Presentational w.r.t. lessons (data in via props), but self-fetches the
// teacher's courses (GET /api/admin?action=my-courses) so it can map
// course_id -> name and power the course picker + jump-to chips. The live editor
// at app/admin/lessons/page.tsx and the old LessonsListView are left untouched.

import { useEffect, useMemo, useState } from 'react'
import { Button, Pill, Skeleton, EmptyState } from '@/components/student-ui'
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

export default function LessonBuilderView({
  lessons,
  loading,
  onOpenLesson,
  onNewLesson,
  onNewTemplate,
  onOpenCourse,
}: {
  lessons: Lesson[]
  loading: boolean
  onOpenLesson: (id: string) => void
  onNewLesson: (courseId?: string, courseName?: string) => void
  onNewTemplate: () => void
  onOpenCourse: (id: string) => void
}) {
  // ── Self-fetched courses (for the picker + name mapping + jump chips) ──
  const [courses, setCourses] = useState<CourseLite[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [selectedCourseId, setSelectedCourseId] = useState('')

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

  // course_id -> name lookup for draft cards.
  const courseNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of courses) map[c.id] = c.name
    return map
  }, [courses])

  const selectedCourseName = selectedCourseId ? courseNameById[selectedCourseId] : undefined

  // ── Continue-a-draft: drafts, newest first, capped at ~8 ──
  const drafts = useMemo(() => {
    return lessons
      .filter((l) => l.status === 'draft')
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.updated_at || a.lesson_date || 0).getTime()
        const tb = new Date(b.updated_at || b.lesson_date || 0).getTime()
        return tb - ta
      })
      .slice(0, 8)
  }, [lessons])

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-brandblue mb-5">Lessons</h1>

        {/* ── START A NEW LESSON ── */}
        <div className="bg-sky-wash border border-sky-border rounded-card p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 min-w-[220px]">
              <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
                Course
              </span>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={coursesLoading}
                className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile border-[1.5px] border-[#e3e5e9] px-3.5 py-3 focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
              >
                <option value="">Choose a course…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="primary"
              size="md"
              onClick={() => onNewLesson(selectedCourseId || undefined, selectedCourseName)}
            >
              ＋ New Lesson
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
            {!selectedCourseId ? (
              <p className="text-[12px] text-ink-muted">Tip: pick a course so the lesson is organised.</p>
            ) : (
              <span aria-hidden="true" />
            )}
            <Button variant="textLink" size="sm" onClick={onNewTemplate}>
              New Content Bank template →
            </Button>
          </div>
        </div>

        {/* ── CONTINUE A DRAFT ── */}
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold text-ink-black">Continue a draft</h2>
          {!loading && drafts.length > 0 && (
            <span className="text-xs font-normal text-ink-muted">{drafts.length} in progress</span>
          )}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-card border border-hairline p-4">
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-3 w-24 mb-4" />
                <Skeleton className="h-7 w-32" />
              </div>
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="bg-white rounded-card border border-hairline mb-8">
            <EmptyState
              icon="📝"
              title="Nothing in progress"
              hint="New lessons you start will show here until you publish them."
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {drafts.map((lesson) => {
              const blocks = blockTotal(lesson.block_counts)
              const courseName = lesson.course_id ? courseNameById[lesson.course_id] : null
              return (
                <button
                  key={lesson.id}
                  onClick={() => onOpenLesson(lesson.id)}
                  className="bg-white rounded-card border border-hairline p-4 text-left hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-ink-black leading-snug line-clamp-2">
                      {lesson.title || 'Untitled lesson'}
                    </p>
                    <Pill variant="wash">Draft</Pill>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] text-ink-body">
                      {courseName || (lesson.course_id ? 'Course' : 'No course')}
                    </span>
                    <span className="text-xs text-ink-muted">{formatDate(lesson.lesson_date)}</span>
                  </div>
                  <div className="mt-auto flex items-center gap-5 pt-2.5 border-t border-hairline">
                    <Count value={lesson.flashcard_count || 0} label="vocab" />
                    <Count value={lesson.exercise_count || 0} label="exercises" />
                    {blocks > 0 && <Count value={blocks} label="blocks" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* ── JUMP TO A COURSE ── */}
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold text-ink-black">Jump to a course</h2>
        </div>
        <p className="text-xs text-ink-muted mb-3">
          A course's full lesson list now lives inside the course.
        </p>
        {coursesLoading ? (
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-28 !rounded-full" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="text-xs text-ink-muted">No courses assigned to you yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpenCourse(c.id)}
                className="text-[12px] font-bold px-3 py-1.5 rounded-full border border-hairline bg-white text-ink-body hover:border-sky hover:text-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
