'use client'

// Wave 0 — first real teacher screen redesigned to the 10B look.
//
// Presentational only (data in via props) so it's verifiable with mock data
// in a harness AND reused by the real page. Uses the redesigned tokens +
// kit: Rubik, accessible sky-text for numbers, sky/hairline/rounded-card,
// Skeleton + EmptyState primitives, Pill (level = sky-wash/ink-body, which
// honours the LOCKED rule: never brandblue text on sky-wash).

import { Pill, EmptyState, Skeleton, Button } from '@/components/student-ui'

export interface CourseSummary {
  id: string
  name: string
  description: string
  course_type: string | null
  level: string | null
  student_count: number
  lesson_count: number
}

export function CoursesView({ courses, loading, onOpenCourse, onNewCourse }: {
  courses: CourseSummary[]
  loading: boolean
  onOpenCourse: (id: string) => void
  onNewCourse?: () => void
}) {
  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <h1 className="text-2xl font-bold text-brandblue">
            Courses{!loading && <span className="text-sm font-normal text-ink-muted"> · {courses.length}</span>}
          </h1>
          {onNewCourse && <Button size="sm" onClick={onNewCourse}>+ New course</Button>}
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-card border border-hairline p-5">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-3 w-72" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState icon="🦗" title="Crickets…" hint="No courses assigned to you yet. Ask a superadmin to add you as a teacher of a course." />
        ) : (
          <div className="grid gap-3">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpenCourse(c.id)}
                className="w-full text-left bg-white rounded-card border border-hairline p-5 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-ink-black">{c.name}</h3>
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2">{c.description || 'No description'}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {c.level && <Pill variant="level">{c.level}</Pill>}
                      {c.course_type && (
                        <span className="text-[10px] font-bold bg-surface text-ink-muted px-2.5 py-1 rounded-full">{c.course_type}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-6 text-center shrink-0">
                    <div>
                      <p className="text-xl font-bold text-sky-text">{c.student_count}</p>
                      <p className="text-[10px] text-ink-muted">students</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-sky-text">{c.lesson_count}</p>
                      <p className="text-[10px] text-ink-muted">lessons</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CoursesView
