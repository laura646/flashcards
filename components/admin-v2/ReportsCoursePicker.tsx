'use client'

// Reports course picker — the SAME search/filter bar as the Courses area
// (CoursesView) over the rich my-courses list, then a compact selectable list.
// Selecting a course drives the report shown below. Mirrors CoursesView's
// filter logic (search by name/trainer/student email · Active/Archived/All ·
// sort · level/type/category chips) so the two stay consistent.

import { useMemo, useState } from 'react'
import { TextField, SegmentedControl } from '@/components/student-ui'
import { COURSE_CATEGORIES } from '@/lib/common-issues'
import type { CourseSummary } from '@/components/admin-v2/CoursesView'

type StatusFilter = 'active' | 'archived' | 'all'
type SortKey = 'newest' | 'students' | 'az'

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
        active ? 'bg-sky text-white border-sky' : 'bg-white text-ink-body border-hairline hover:border-sky'
      }`}
    >
      {children}
    </button>
  )
}

export default function ReportsCoursePicker({
  courses,
  selectedId,
  onSelect,
}: {
  courses: CourseSummary[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [level, setLevel] = useState<string | null>(null)
  const [courseType, setCourseType] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('newest')

  const levelOptions = useMemo(
    () => Array.from(new Set(courses.map((c) => c.level).filter((l): l is string => !!l))).sort(),
    [courses]
  )
  const typeOptions = useMemo(
    () => Array.from(new Set(courses.map((c) => c.course_type).filter((t): t is string => !!t))).sort(),
    [courses]
  )
  const categoryOptions = useMemo(() => {
    const present = new Set(courses.map((c) => c.course_category).filter((c): c is string => !!c))
    const known = COURSE_CATEGORIES.map((c) => c.value).filter((v) => present.has(v))
    const unknown = Array.from(present).filter((v) => !COURSE_CATEGORIES.some((c) => c.value === v)).sort()
    return [...known, ...unknown]
  }, [courses])
  const categoryLabel = (value: string) => COURSE_CATEGORIES.find((c) => c.value === value)?.label ?? value

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = courses.filter((c) => {
      if (statusFilter === 'active' && c.archived_at) return false
      if (statusFilter === 'archived' && !c.archived_at) return false
      if (level && c.level !== level) return false
      if (courseType && c.course_type !== courseType) return false
      if (category && c.course_category !== category) return false
      if (q) {
        const inName = c.name.toLowerCase().includes(q)
        const inTrainers = (c.trainers || []).some(
          (t) => (t.name || '').toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
        )
        const inStudents = (c.student_emails || []).some((e) => e.toLowerCase().includes(q))
        if (!inName && !inTrainers && !inStudents) return false
      }
      return true
    })
    out.sort((a, b) => {
      if (sort === 'students') return (b.student_count || 0) - (a.student_count || 0)
      if (sort === 'az') return a.name.localeCompare(b.name)
      // 'newest' = created_at desc — matches CoursesView exactly, independent of input order
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
    return out
  }, [courses, query, statusFilter, level, courseType, category, sort])

  const trainerLabel = (c: CourseSummary) => {
    const ts = c.trainers || []
    if (ts.length === 0) return null
    const first = ts[0].name || ts[0].email
    return ts.length === 1 ? first : `${first} +${ts.length - 1}`
  }

  return (
    <div className="bg-sky-wash rounded-card border border-sky-border p-3 flex flex-col gap-3">
      {/* Row 1: search + status + sort — identical to the Courses header */}
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
          value={statusFilter}
          onChange={setStatusFilter}
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

      {/* Row 2: level + type + category chips */}
      {(levelOptions.length > 0 || typeOptions.length > 0 || categoryOptions.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {levelOptions.length > 0 && (
            <>
              <span className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted mr-0.5">Level</span>
              {levelOptions.map((l) => (
                <FilterChip key={l} active={level === l} onClick={() => setLevel(level === l ? null : l)}>{l}</FilterChip>
              ))}
            </>
          )}
          {typeOptions.length > 0 && (
            <>
              <span className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted ml-2 mr-0.5">Type</span>
              {typeOptions.map((t) => (
                <FilterChip key={t} active={courseType === t} onClick={() => setCourseType(courseType === t ? null : t)}>{t}</FilterChip>
              ))}
            </>
          )}
          {categoryOptions.length > 0 && (
            <>
              <span className="text-[10px] font-extrabold uppercase tracking-eyebrow text-ink-muted ml-2 mr-0.5">Category</span>
              {categoryOptions.map((cat) => (
                <FilterChip key={cat} active={category === cat} onClick={() => setCategory(category === cat ? null : cat)}>{categoryLabel(cat)}</FilterChip>
              ))}
            </>
          )}
        </div>
      )}

      {/* Compact selectable course list → drives the report below */}
      <div className="bg-white rounded-tile border border-hairline max-h-64 overflow-auto divide-y divide-hairline">
        {visible.length === 0 ? (
          <div className="px-3 py-4 text-[13px] text-ink-muted">No courses match your search or filters.</div>
        ) : (
          visible.map((c) => {
            const active = c.id === selectedId
            const tl = trainerLabel(c)
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors focus:outline-none ${active ? 'bg-sky-wash' : 'hover:bg-surface'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-sky' : 'bg-transparent'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[14px] font-bold truncate ${active ? 'text-sky-text' : 'text-ink-black'}`}>{c.name}</span>
                    {c.level && <span className="text-[10px] font-bold bg-sky-wash text-ink-body px-2 py-0.5 rounded-full">{c.level}</span>}
                    {c.archived_at && <span className="text-[10px] font-bold bg-surface text-ink-muted px-2 py-0.5 rounded-full">Archived</span>}
                  </span>
                  <span className="block text-[11px] text-ink-muted truncate mt-0.5">
                    {tl ? `👤 ${tl}` : 'No trainer'} · {c.student_count || 0} student{(c.student_count || 0) === 1 ? '' : 's'}
                    {c.course_type ? ` · ${c.course_type}` : ''}
                  </span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
