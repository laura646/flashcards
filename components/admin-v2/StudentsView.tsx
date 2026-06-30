'use client'

// Wave 0 — redesigned Students screen (10B), same fuller pattern as Courses.
// Presentational (data via props); search handled internally so the real
// page + harness stay simple. Summary strip + 2-col student cards so it
// doesn't read empty.

import { useState } from 'react'
import { Pill, EmptyState, Skeleton } from '@/components/student-ui'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_COLORS } from '@/lib/account-types'

export interface StudentSummary {
  email: string
  name: string
  level: string | null
  company: string | null
  account_type: string | null
  blocked: boolean
  courses: { course_id: string; course_name: string }[]
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-sky-wash rounded-card border border-sky-border p-4">
      <p className="text-[12px] text-ink-body">{label}</p>
      <p className="text-2xl font-bold text-sky-text mt-0.5">{value}</p>
    </div>
  )
}

export function StudentsView({ students, loading, onOpenStudent, onDeleteStudent }: {
  students: StudentSummary[]
  loading: boolean
  onOpenStudent: (email: string) => void
  onDeleteStudent?: (email: string) => Promise<void> | void
}) {
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<StudentSummary | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [accountFilter, setAccountFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const q = search.trim().toLowerCase()
  const cq = companyFilter.trim().toLowerCase()
  const filtered = students.filter((s) => {
    if (q && !((s.name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q))) return false
    if (accountFilter && s.account_type !== accountFilter) return false
    if (cq && !((s.company || '').toLowerCase().includes(cq))) return false
    return true
  })

  const distinctCourses = new Set(students.flatMap((s) => s.courses.map((c) => c.course_id))).size
  const distinctCompanies = new Set(students.map((s) => s.company).filter(Boolean)).size

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
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

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <select
            aria-label="Filter by account type"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 bg-white focus:outline-none focus:border-sky"
          >
            <option value="">All account types</option>
            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="text"
            aria-label="Filter by company"
            placeholder="Filter by company…"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="text-sm text-ink-body border border-hairline rounded-tile px-3 py-2 w-52 bg-white placeholder:text-ink-muted focus:outline-none focus:border-sky"
          />
          {(accountFilter || companyFilter) && (
            <button onClick={() => { setAccountFilter(''); setCompanyFilter('') }} className="text-xs font-bold text-ink-muted hover:text-ink-body px-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40">Clear</button>
          )}
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
              <div key={s.email} className="relative">
              <button
                onClick={() => onOpenStudent(s.email)}
                className="w-full text-left bg-white rounded-card border border-hairline p-4 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 flex flex-col min-h-[118px]"
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-wash text-sky-text flex items-center justify-center text-sm font-bold shrink-0" aria-hidden="true">
                    {(s.name || s.email)[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-ink-black truncate">{s.name || 'Unknown'}</p>
                      {s.level && <Pill variant="level">{s.level}</Pill>}
                      {s.account_type && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: ACCOUNT_TYPE_COLORS[s.account_type]?.bg, color: ACCOUNT_TYPE_COLORS[s.account_type]?.text }}>{s.account_type}</span>
                      )}
                      {s.blocked && <span className="text-[10px] font-bold bg-incorrect-bg text-incorrect-fg px-2 py-0.5 rounded-full">BLOCKED</span>}
                    </div>
                    <p className="text-xs text-ink-muted truncate mt-0.5">{s.email}</p>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-hairline flex gap-1.5 flex-wrap items-center">
                  {s.courses.slice(0, 2).map((c) => (
                    <span key={c.course_id} className="text-[10px] bg-surface text-ink-muted px-2 py-0.5 rounded-full">{c.course_name}</span>
                  ))}
                  {s.courses.length > 2 && <span className="text-[10px] text-ink-muted">+{s.courses.length - 2}</span>}
                  {s.company && <span className="text-[10px] text-ink-muted">🏢 {s.company}</span>}
                  {s.courses.length === 0 && !s.company && <span className="text-[10px] text-ink-muted">Not enrolled yet</span>}
                </div>
              </button>
              {onDeleteStudent && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmText(''); setDeleteTarget(s) }}
                  className="absolute top-2 right-2 text-[10px] font-bold text-incorrect-fg bg-white border border-hairline rounded-tile px-2 py-1 hover:bg-incorrect-bg"
                  aria-label={`Delete ${s.name || s.email}`}
                >
                  Delete
                </button>
              )}
              </div>
            ))}
          </div>
        )}

        {deleteTarget && onDeleteStudent && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { if (!deleting) setDeleteTarget(null) }}>
            <div className="bg-white rounded-card border border-hairline p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-ink-black mb-1">Delete student</h2>
              <p className="text-[13px] text-ink-body mb-3">
                This permanently deletes <strong>{deleteTarget.name || deleteTarget.email}</strong> and <strong>all their data</strong> — progress, vocabulary, enrolments, attendance, notes, and tests. This can&rsquo;t be undone.
              </p>
              <p className="text-[12px] text-ink-muted mb-1.5">Type the email to confirm: <span className="font-mono font-bold text-ink-black">{deleteTarget.email}</span></p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={deleteTarget.email}
                className="w-full text-sm border border-hairline rounded-tile px-3 py-2 mb-4 focus:outline-none focus:border-incorrect-fg"
                aria-label="Type email to confirm deletion"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(null)} className="text-[13px] font-bold text-ink-muted px-3 py-2">Cancel</button>
                <button
                  disabled={confirmText.trim().toLowerCase() !== deleteTarget.email.toLowerCase() || deleting}
                  onClick={async () => {
                    setDeleting(true)
                    await onDeleteStudent(deleteTarget.email)
                    setDeleting(false)
                    setDeleteTarget(null)
                    setConfirmText('')
                  }}
                  className="text-[13px] font-bold text-white bg-incorrect-fg rounded-tile px-4 py-2 disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentsView
