'use client'

// Wave 0 — redesigned Students screen (10B), same fuller pattern as Courses.
// Presentational (data via props); search handled internally so the real
// page + harness stay simple. Summary strip + 2-col student cards so it
// doesn't read empty.

import { useState } from 'react'
import { Pill, EmptyState, Skeleton } from '@/components/student-ui'

export interface StudentSummary {
  email: string
  name: string
  level: string | null
  company: string | null
  blocked: boolean
  courses: { course_id: string; course_name: string }[]
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-card border border-hairline p-4">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className="text-2xl font-bold text-sky-text mt-0.5">{value}</p>
    </div>
  )
}

export function StudentsView({ students, loading, onOpenStudent }: {
  students: StudentSummary[]
  loading: boolean
  onOpenStudent: (email: string) => void
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filtered = q ? students.filter((s) => (s.name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) : students

  const distinctCourses = new Set(students.flatMap((s) => s.courses.map((c) => c.course_id))).size
  const distinctCompanies = new Set(students.map((s) => s.company).filter(Boolean)).size

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <h1 className="text-2xl font-bold text-brandblue">Students</h1>
          <input
            type="text"
            aria-label="Search students"
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 w-60 bg-white placeholder:text-ink-muted focus:outline-none focus:border-sky"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-card border border-hairline p-4">
                <Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-6 w-10" />
              </div>
            ))
          ) : (
            <>
              <Stat label="Students" value={students.length} />
              <Stat label="Courses" value={distinctCourses} />
              <Stat label="Companies" value={distinctCompanies} />
            </>
          )}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-card border border-hairline p-4 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1"><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-44" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          q ? (
            <EmptyState icon="🔍" title="No matches" hint="Try a different name or email." />
          ) : (
            <EmptyState icon="🦗" title="Crickets…" hint="No students in your courses yet. When a student signs up with your course's invite code, they'll appear here." />
          )
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <button
                key={s.email}
                onClick={() => onOpenStudent(s.email)}
                className="text-left bg-white rounded-card border border-hairline p-4 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 flex gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-sky-wash text-sky-text flex items-center justify-center text-sm font-bold shrink-0" aria-hidden="true">
                  {(s.name || s.email)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-ink-black truncate">{s.name || 'Unknown'}</p>
                    {s.level && <Pill variant="level">{s.level}</Pill>}
                    {s.blocked && <span className="text-[10px] font-bold bg-incorrect-bg text-incorrect-fg px-2 py-0.5 rounded-full">BLOCKED</span>}
                  </div>
                  <p className="text-xs text-ink-muted truncate">{s.email}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                    {s.courses.slice(0, 2).map((c) => (
                      <span key={c.course_id} className="text-[10px] bg-surface text-ink-muted px-2 py-0.5 rounded-full">{c.course_name}</span>
                    ))}
                    {s.courses.length > 2 && <span className="text-[10px] text-ink-muted">+{s.courses.length - 2}</span>}
                    {s.company && <span className="text-[10px] text-ink-muted">· {s.company}</span>}
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

export default StudentsView
