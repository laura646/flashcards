'use client'

// Wave 0 — first real teacher screen redesigned to the 10B look.
//
// Presentational only (data in via props) so it's verifiable with mock data
// in a harness AND reused by the real page. Uses the redesigned tokens + kit:
// Rubik, accessible sky-text, sky/hairline/rounded-card, Skeleton +
// EmptyState, Pill (level = sky-wash/ink-body, honouring the LOCKED rule).
//
// Layout fills the page (Laura's note: avoid blank space): a summary strip up
// top + a dense filter/search header + a 2-column card grid + per-card stat
// footers, so there's no wide empty middle and the screen reads as useful.
//
// Filtering/search/sort is all client-side over the fetched list. The page
// fetches active + archived once (include_archived=true) and we hide archived
// by default via the Status control.

import { useMemo, useState } from 'react'
import { Pill, EmptyState, Skeleton, TextField, SegmentedControl } from '@/components/student-ui'

export interface CourseSummary {
  id: string
  name: string
  description: string | null
  invite_code: string
  course_type: string | null
  level: string | null
  archived_at: string | null
  created_at: string
  student_count: number
  lesson_count: number
  trainers: { email: string; name: string }[]
  student_emails: string[]
}

type StatusFilter = 'active' | 'archived' | 'all'
type SortKey = 'newest' | 'students' | 'az'

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-sky-wash rounded-card border border-sky-border p-4">
      <p className="text-[12px] text-ink-body">{label}</p>
      <p className="text-2xl font-bold text-sky-text mt-0.5">{value}</p>
    </div>
  )
}

// Compact Pill-style toggle for Level / Course type filter chips.
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${
        active
          ? 'bg-sky text-white border-sky'
          : 'bg-white text-ink-body border-hairline hover:border-sky'
      }`}
    >
      {children}
    </button>
  )
}

// Trainer display name: prefer name, fall back to email (name can be "" when
// the users row is missing per the backend contract).
function trainerLabel(t: { email: string; name: string }) {
  return t.name?.trim() ? t.name.trim() : t.email
}

export function CoursesView({ courses, loading, onOpenCourse, onNewCourse }: {
  courses: CourseSummary[]
  loading: boolean
  onOpenCourse: (id: string) => void
  onNewCourse?: () => void
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [level, setLevel] = useState<string | null>(null)
  const [courseType, setCourseType] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('newest')

  // Derive filter chip options from the loaded courses.
  const levelOptions = useMemo(
    () => Array.from(new Set(courses.map((c) => c.level).filter((l): l is string => !!l))).sort(),
    [courses],
  )
  const typeOptions = useMemo(
    () => Array.from(new Set(courses.map((c) => c.course_type).filter((t): t is string => !!t))).sort(),
    [courses],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = courses.filter((c) => {
      // Status (archived_at: null = active).
      if (status === 'active' && c.archived_at) return false
      if (status === 'archived' && !c.archived_at) return false
      // Level / type chips.
      if (level && c.level !== level) return false
      if (courseType && c.course_type !== courseType) return false
      // Smart search — name OR any trainer name/email OR any student email.
      if (q) {
        const inName = c.name.toLowerCase().includes(q)
        const inTrainers = c.trainers.some(
          (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q),
        )
        const inStudents = c.student_emails.some((e) => e.toLowerCase().includes(q))
        if (!inName && !inTrainers && !inStudents) return false
      }
      return true
    })

    out.sort((a, b) => {
      if (sort === 'students') return (b.student_count || 0) - (a.student_count || 0)
      if (sort === 'az') return a.name.localeCompare(b.name)
      // newest — created_at desc
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return out
  }, [courses, query, status, level, courseType, sort])

  const totalStudents = courses.reduce((n, c) => n + (c.student_count || 0), 0)
  const totalLessons = courses.reduce((n, c) => n + (c.lesson_count || 0), 0)

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-brandblue mb-5">Courses</h1>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mb-4">
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

        {/* Dense filter / search header */}
        {!loading && courses.length > 0 && (
          <div className="bg-white rounded-card border border-hairline p-3 mb-4 flex flex-col gap-3">
            {/* Row 1: search + status + sort */}
            <div className="flex flex-wrap items-end gap-3">
              <TextField
                label="Search"
                placeholder="Course, trainer, or student email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 min-w-[220px]"
              />
              <SegmentedControl<StatusFilter>
                segments={[
                  { value: 'active', label: 'Active' },
                  { value: 'archived', label: 'Archived' },
                  { value: 'all', label: 'All' },
                ]}
                value={status}
                onChange={setStatus}
              />
              <label className="block">
                <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="text-[13px] font-medium text-ink-body bg-white rounded-tile border-[1.5px] border-[#e3e5e9] px-3 py-[11px] focus:outline-none focus:border-sky transition-colors"
                >
                  <option value="newest">Newest</option>
                  <option value="students">Most students</option>
                  <option value="az">A–Z</option>
                </select>
              </label>
            </div>

            {/* Row 2: level + type filter chips */}
            {(levelOptions.length > 0 || typeOptions.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {levelOptions.length > 0 && (
                  <>
                    <span className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted mr-0.5">Level</span>
                    {levelOptions.map((l) => (
                      <FilterChip key={l} active={level === l} onClick={() => setLevel(level === l ? null : l)}>
                        {l}
                      </FilterChip>
                    ))}
                  </>
                )}
                {typeOptions.length > 0 && (
                  <>
                    <span className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted ml-2 mr-0.5">Type</span>
                    {typeOptions.map((t) => (
                      <FilterChip key={t} active={courseType === t} onClick={() => setCourseType(courseType === t ? null : t)}>
                        {t}
                      </FilterChip>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

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
        ) : visible.length === 0 ? (
          <EmptyState icon="🔍" title="No matches" hint="No courses match your search or filters. Try clearing the search or switching the status filter." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {visible.map((c) => {
              const trainers = c.trainers || []
              const trainerText =
                trainers.length === 0
                  ? null
                  : trainers.length === 1
                    ? trainerLabel(trainers[0])
                    : `${trainerLabel(trainers[0])} +${trainers.length - 1}`
              return (
                <button
                  key={c.id}
                  onClick={() => onOpenCourse(c.id)}
                  className="text-left bg-white rounded-card border border-hairline p-5 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-ink-black">{c.name}</h3>
                    {c.archived_at && (
                      <span className="shrink-0 text-[10px] font-bold bg-surface text-ink-muted px-2.5 py-1 rounded-full">Archived</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-1 line-clamp-2 min-h-[2.4em]">{c.description || 'No description'}</p>
                  {trainerText && (
                    <p className="text-[12px] text-ink-body mt-1.5">👤 {trainerText}</p>
                  )}
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
              )
            })}
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
