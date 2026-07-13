// ─────────────────────────────────────────────────────────────────
// Shared "needs attention" rule for the progress-alerts cron.
//
// Deliberately CONSERVATIVE thresholds — stricter than the grid's tunable
// defaults (7 days / 10 pts) — so auto-alerts fire only on high-confidence
// cases while the rule is still being tuned on real classes. The teacher-facing
// grid (CourseProgressTab) stays the place to explore softer signals.
// ─────────────────────────────────────────────────────────────────

export const ALERT_RULE = { inactiveDays: 10, accDrop: 15, lowAcc: 50 }

export interface ProgressRow {
  user_email: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
}

export interface AttentionResult {
  email: string
  reasons: string[]
  accuracy: number | null
  lastDays: number
}

const DAY = 86400000
const mean = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0)

/**
 * Given a course's students + its exercise ids + the students' progress rows,
 * return the students who currently meet the (conservative) attention rule.
 * Students with NO graded activity are never flagged (nothing to alert on).
 * Pure + server-safe — no DB, no React. Mirrors CourseProgressTab's signals.
 */
export function computeCourseAttention(
  studentEmails: string[],
  courseExerciseIds: Set<string>,
  progress: ProgressRow[],
  now: number,
  rule = ALERT_RULE,
): AttentionResult[] {
  const byStudent = new Map<string, ProgressRow[]>()
  for (const p of progress) {
    if (p.activity_type !== 'exercise' || !courseExerciseIds.has(p.activity_id)) continue
    if (typeof p.score !== 'number' || typeof p.total !== 'number' || !p.total) continue
    const arr = byStudent.get(p.user_email) || []
    arr.push(p)
    byStudent.set(p.user_email, arr)
  }

  const out: AttentionResult[] = []
  for (const email of studentEmails) {
    const rows = (byStudent.get(email) || []).slice().sort((a, b) => +new Date(b.completed_at) - +new Date(a.completed_at))
    if (rows.length === 0) continue // never alert on students who haven't started

    const lastDays = Math.floor((now - +new Date(rows[0].completed_at)) / DAY)

    // Accuracy = average of each exercise's LATEST attempt (matches the grid).
    const latestByEx = new Map<string, number>()
    for (const r of rows) {
      if (!latestByEx.has(r.activity_id)) latestByEx.set(r.activity_id, Math.round((r.score as number / (r.total as number)) * 100))
    }
    const accuracy = latestByEx.size ? Math.round(mean(Array.from(latestByEx.values()))) : null

    // Drop = earlier-half mean minus later-half mean of graded attempts (chronological).
    const chrono = rows.slice().reverse().map((r) => Math.round((r.score as number / (r.total as number)) * 100))
    const n = chrono.length
    const half = Math.max(1, Math.floor(n / 2))
    const drop = n >= 2 ? Math.round(mean(chrono.slice(0, half)) - mean(chrono.slice(n - half))) : null

    const reasons: string[] = []
    if (lastDays >= rule.inactiveDays) reasons.push(`inactive ${lastDays} days`)
    if (drop != null && drop >= rule.accDrop) reasons.push(`accuracy dropped ${drop}%`)
    if (accuracy != null && accuracy < rule.lowAcc) reasons.push(`accuracy at ${accuracy}%`)

    if (reasons.length) out.push({ email, reasons, accuracy, lastDays })
  }
  return out
}
