'use client'

// Bulk attendance backfill — for courses that have been running a while, set
// each learner's attendance as a course-to-date SUMMARY (no per-class marking).
// Type the total classes held, then only the misses per student; present is the
// remainder. Posts to /api/course-sessions (action=bulk-summary), which writes
// the summary onto course_students; reports prefer it over session marks. This
// does NOT touch the live session rail. Set a student's total to 0 to clear it.

import { useState } from 'react'
import { Button } from '@/components/student-ui'

interface Roster {
  email: string
  name: string
  archived_at?: string | null
}

interface RowState {
  total: number
  late: number
  absent: number
  excused: number
}

export default function BulkAttendanceModal({
  courseId,
  students,
  onClose,
}: {
  courseId: string
  students: Roster[]
  onClose: () => void
}) {
  const [courseTotal, setCourseTotal] = useState(0)
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {}
    for (const s of students) init[s.email] = { total: 0, late: 0, absent: 0, excused: 0 }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clampInt = (v: string) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const present = (r: RowState) => Math.max(0, r.total - r.late - r.absent - r.excused)
  const pct = (r: RowState) => (r.total > 0 ? Math.round(((present(r) + r.late) / r.total) * 100) : null)
  const hasOver = students.some((s) => {
    const r = rows[s.email]
    return r.late + r.absent + r.excused > r.total
  })

  const applyCourseTotal = (n: number) => {
    setCourseTotal(n)
    setRows((prev) => {
      const next: Record<string, RowState> = {}
      for (const email of Object.keys(prev)) next[email] = { ...prev[email], total: n }
      return next
    })
  }
  const setField = (email: string, field: keyof RowState, value: number) =>
    setRows((prev) => ({ ...prev, [email]: { ...prev[email], [field]: value } }))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const records = students.map((s) => {
        const r = rows[s.email]
        return {
          student_email: s.email,
          total: r.total,
          late: r.late,
          absent: r.absent,
          excused: r.excused,
          present: present(r),
        }
      })
      const res = await fetch('/api/course-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-summary', course_id: courseId, records }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || 'Failed to save attendance.')
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save attendance.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 font-rubik" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-card border border-hairline p-5 w-full max-w-2xl max-h-[88vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-ink-black">Bulk attendance backfill</h2>
          <button onClick={() => !saving && onClose()} className="text-ink-muted" aria-label="Close">✕</button>
        </div>
        <p className="text-[12px] text-ink-muted mb-3">
          Set the total classes held, then enter only the misses per student — present is the rest. This sets each learner&rsquo;s
          attendance total for reports; it doesn&rsquo;t affect the live class rail. Set a student&rsquo;s total to 0 to clear their summary.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <label className="text-[13px] font-bold text-ink-black">Total classes held</label>
          <input
            type="number"
            min={0}
            value={courseTotal || ''}
            onChange={(e) => applyCourseTotal(clampInt(e.target.value))}
            className="w-20 text-sm border border-hairline rounded-tile px-2 py-1.5 focus:outline-none focus:border-sky"
            aria-label="Total classes held"
          />
          <span className="text-[11px] text-ink-muted">applies to everyone — adjust per student below</span>
        </div>

        <div className="border border-hairline rounded-tile overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface text-ink-muted text-[11px] uppercase tracking-wide">
                <th className="text-left font-bold px-3 py-2">Student</th>
                <th className="font-bold px-2 py-2 w-16">Total</th>
                <th className="font-bold px-2 py-2 w-16">Late</th>
                <th className="font-bold px-2 py-2 w-16">Absent</th>
                <th className="font-bold px-2 py-2 w-16">Excused</th>
                <th className="font-bold px-2 py-2 w-16">Present</th>
                <th className="font-bold px-2 py-2 w-14">%</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const r = rows[s.email]
                const over = r.late + r.absent + r.excused > r.total
                return (
                  <tr key={s.email} className={`border-t border-hairline ${s.archived_at ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-1.5">
                      <div className="font-bold text-ink-black truncate max-w-[180px]">{s.name || s.email}</div>
                      <div className="text-[11px] text-ink-muted truncate max-w-[180px]">{s.email}</div>
                    </td>
                    {(['total', 'late', 'absent', 'excused'] as const).map((f) => (
                      <td key={f} className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min={0}
                          value={r[f] || ''}
                          onChange={(e) => setField(s.email, f, clampInt(e.target.value))}
                          className={`w-14 text-sm text-center border rounded-tile px-1.5 py-1 focus:outline-none focus:border-sky ${over && f !== 'total' ? 'border-incorrect-fg' : 'border-hairline'}`}
                          aria-label={`${f} for ${s.name || s.email}`}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-bold text-ink-black">{present(r)}</td>
                    <td className="px-2 py-1.5 text-center text-ink-muted">{pct(r) != null ? `${pct(r)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hasOver && <p className="text-[12px] text-incorrect-fg mt-3">Some rows have late + absent + excused above their total. Fix the highlighted cells to save.</p>}
        {error && <p className="text-[12px] text-incorrect-fg mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => !saving && onClose()} className="text-[13px] font-bold text-ink-muted px-3 py-2">Cancel</button>
          <Button variant="primary" size="sm" onClick={save} disabled={saving || hasOver}>
            {saving ? 'Saving…' : `Save attendance (${students.length})`}
          </Button>
        </div>
      </div>
    </div>
  )
}
