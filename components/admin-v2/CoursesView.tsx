'use client'

// Wave 0 — first real teacher screen redesigned to the 10B look.
//
// Presentational only (data in via props) so it's verifiable with mock data
// in a harness AND reused by the real page. Uses the redesigned tokens + kit:
// Rubik, accessible sky-text, sky/hairline/rounded-card, Skeleton +
// EmptyState, Pill (level = sky-wash/ink-body, honouring the LOCKED rule).
//
// Layout fills the page (Laura's note: avoid blank space): a summary strip up
// top + a 2-column card grid + per-card stat footers, so there's no wide
// empty middle and the screen reads as useful, not barren.

import { Pill, EmptyState, Skeleton } from '@/components/student-ui'

export interface CourseSummary {
  id: string
  name: string
  description: string
  course_type: string | null
  level: string | null
  student_count: number
  lesson_count: number
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-sky-wash rounded-card border border-sky-border p-4">
      <p className="text-[12px] text-ink-body">{label}</p>
      <p className="text-2xl font-bold text-sky-text mt-0.5">{value}</p>
    </div>
  )
}

export function CoursesView({ courses, loading, onOpenCourse, onNewCourse }: {
  courses: CourseSummary[]
  loading: boolean
  onOpenCourse: (id: string) => void
  onNewCourse?: () => void
}) {
  const totalStudents = courses.reduce((n, c) => n + (c.student_count || 0), 0)
  const totalLessons = courses.reduce((n, c) => n + (c.lesson_count || 0), 0)

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-brandblue mb-5">Courses</h1>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-card border border-hairline p-4">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))
          ) : (
            <>
              <Stat label="Courses" value={courses.length} />
              <Stat label="Students" value={totalStudents} />
              <Stat label="Lessons" value={totalLessons} />
            </>
          )}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-card border border-hairline p-5">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState icon="🦗" title="Crickets…" hint="No courses assigned to you yet. Ask a superadmin to add you as a teacher of a course." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpenCourse(c.id)}
                className="text-left bg-white rounded-card border border-hairline p-5 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 flex flex-col"
              >
                <h3 className="font-bold text-ink-black">{c.name}</h3>
                <p className="text-xs text-ink-muted mt-1 line-clamp-2 min-h-[2.4em]">{c.description || 'No description'}</p>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  {c.level && <Pill variant="level">{c.level}</Pill>}
                  {c.course_type && (
                    <span className="text-[10px] font-bold bg-surface text-ink-muted px-2.5 py-1 rounded-full">{c.course_type}</span>
                  )}
                </div>
                <div className="flex gap-5 mt-3 pt-3 border-t border-hairline text-[12px] text-ink-muted">
                  <span>👥 <strong className="text-sky-text">{c.student_count}</strong> students</span>
                  <span>📖 <strong className="text-sky-text">{c.lesson_count}</strong> lessons</span>
                </div>
              </button>
            ))}
            {onNewCourse && (
              <button
                onClick={onNewCourse}
                className="rounded-card border border-dashed border-sky-border text-sky-text font-bold flex flex-col items-center justify-center gap-1 p-5 min-h-[150px] hover:bg-sky-wash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
              >
                <span className="text-2xl leading-none" aria-hidden="true">＋</span>
                <span className="text-sm">New course</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CoursesView
