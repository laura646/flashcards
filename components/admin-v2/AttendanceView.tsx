'use client'

// Wave 0 — redesigned Attendance (10B), new beside old. Presentational: all
// state + handlers via props so the real page holds the fetch/save logic and
// the harness can drive it with mock state. Status buttons use icon + WORD
// (not colour alone — UX-pass fix) on accessible tokens, with aria-pressed.

import { Button, EmptyState, Skeleton } from '@/components/student-ui'

export type AttStatus = 'present' | 'absent' | 'late' | 'excused'
export interface AttCourse { id: string; name: string }
export interface AttLesson { id: string; title: string; lesson_date: string | null }
export interface AttStudent { email: string; name: string | null }
export type AttMarks = Record<string, { status: AttStatus; notes: string }>

const STATUS: { value: AttStatus; label: string; icon: string; on: string }[] = [
  { value: 'present', label: 'Present', icon: '✓', on: 'bg-correct-bg text-correct-fg border-correct-border' },
  { value: 'absent', label: 'Absent', icon: '✕', on: 'bg-incorrect-bg text-incorrect-fg border-incorrect-border' },
  { value: 'late', label: 'Late', icon: '🕐', on: 'bg-streak-fill text-streak-ink border-streak-fill' },
  { value: 'excused', label: 'Excused', icon: '📝', on: 'bg-sky-wash text-sky-text border-sky-border' },
]

export function AttendanceView(p: {
  courses: AttCourse[]
  selectedCourseId: string
  onSelectCourse: (id: string) => void
  lessons: AttLesson[]
  selectedLessonId: string
  onSelectLesson: (id: string) => void
  students: AttStudent[]
  marks: AttMarks
  loading: boolean
  saving: boolean
  savedAt: string | null
  error: string
  onSetStatus: (email: string, s: AttStatus) => void
  onSetNotes: (email: string, n: string) => void
  onMarkAllPresent: () => void
  onSave: () => void
}) {
  const counts = STATUS.map((s) => ({ ...s, n: p.students.filter((st) => (p.marks[st.email]?.status || 'absent') === s.value).length }))
  const selectCls = 'px-3 py-2 border border-hairline rounded-tile text-sm text-ink-body bg-white focus:outline-none focus:border-sky'

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <h1 className="text-2xl font-bold text-brandblue mr-auto">Attendance</h1>
          <select value={p.selectedCourseId} onChange={(e) => p.onSelectCourse(e.target.value)} aria-label="Course" className={selectCls}>
            {p.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="mb-5">
          <label className="block text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-2">Lesson</label>
          {p.lessons.length === 0 ? (
            <EmptyState icon="📅" title="No lessons in this course yet" hint="Create a lesson in the editor before taking attendance." />
          ) : (
            <select value={p.selectedLessonId} onChange={(e) => p.onSelectLesson(e.target.value)} aria-label="Lesson" className={`w-full ${selectCls}`}>
              <option value="">— Select a lesson —</option>
              {p.lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lesson_date ? new Date(l.lesson_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' — ' : ''}{l.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {p.selectedLessonId && (
          p.loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : p.students.length === 0 ? (
            <EmptyState icon="🦗" title="Crickets…" hint="No students enrolled in this course yet." />
          ) : (
            <>
              {/* Counts strip */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {counts.map((c) => (
                  <div key={c.value} className="bg-sky-wash rounded-card border border-sky-border p-3 text-center">
                    <p className="text-xl font-bold text-ink-black">{c.n}</p>
                    <p className="text-[11px] text-ink-body">{c.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-ink-muted">{p.students.length} student{p.students.length === 1 ? '' : 's'}</span>
                <button onClick={p.onMarkAllPresent} className="text-xs text-sky-text font-bold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40">Mark all present</button>
              </div>

              <div className="space-y-2 mb-5">
                {p.students.map((s) => {
                  const cur = p.marks[s.email]?.status || 'absent'
                  return (
                    <div key={s.email} className="bg-white border border-hairline rounded-card p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink-black truncate">{s.name || s.email}</p>
                          <p className="text-[10px] text-ink-muted truncate">{s.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {STATUS.map((opt) => {
                            const active = cur === opt.value
                            return (
                              <button
                                key={opt.value}
                                onClick={() => p.onSetStatus(s.email, opt.value)}
                                aria-pressed={active}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-tile border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${active ? opt.on : 'bg-white text-ink-muted border-hairline hover:border-sky-border'}`}
                              >
                                <span aria-hidden="true" className="mr-0.5">{opt.icon}</span>{opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={p.marks[s.email]?.notes || ''}
                        onChange={(e) => p.onSetNotes(s.email, e.target.value)}
                        placeholder="Optional note (e.g. joined 10 min late)"
                        className="w-full px-2.5 py-1.5 text-xs text-ink-body border border-hairline rounded-tile bg-surface focus:outline-none focus:border-sky"
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={p.onSave} disabled={p.saving}>{p.saving ? 'Saving…' : 'Save attendance'}</Button>
                {p.savedAt && <span className="text-xs font-bold text-correct-fg">✓ Saved</span>}
                {p.error && <span className="text-xs text-incorrect-fg">{p.error}</span>}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}

export default AttendanceView
