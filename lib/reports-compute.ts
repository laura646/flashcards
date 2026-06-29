// ═══════════════════════════════════════════════════════════════
// lib/reports-compute.ts
//
// Pure compute layer for the REDESIGNED teacher Reports (admin-v2).
// NO React, NO fetch — just data transforms. Turns the /api/reports
// payload into the props that components/admin-v2/ReportsView.tsx
// expects (StudentReport[]), and builds the exact request body that
// /api/student-summary expects (DigestPayload).
//
// Math is ported FAITHFULLY from app/admin/reports/page.tsx:
//   - computeStreak            (page.tsx ~L332)
//   - studentAggregates        (page.tsx ~L697-766)  → overview row
//   - buildStudentDetail       (page.tsx ~L769-1045) → per-student detail
//   - computeStudentDigest     (page.tsx ~L178-328)  → AI summary digest
// Same edge cases, same rounding, same sort orders.
//
// The live app/admin/reports/page.tsx is UNTOUCHED — this is a
// parallel, framework-agnostic implementation.
// ═══════════════════════════════════════════════════════════════

// ─────────── /api/reports JSON shape ───────────
// Mirrors app/api/reports/route.ts (returned object ~L276-289) and the
// interfaces declared there (Course, Student, Lesson, Exercise,
// ProgressRecord, WritingBlock, AttendanceRow + the inline note shape).

export interface ReportsCourse {
  id: string
  name: string
  description: string | null
  current_level?: string | null
  goal_level?: string | null
}

export interface ReportsStudent {
  email: string
  name: string | null
}

export interface ReportsLesson {
  id: string
  title: string
  lesson_date: string | null
}

export interface ReportsExercise {
  id: string
  lesson_id: string
  title: string
  exercise_type: string
  is_mandatory: boolean | null
  skills: string[] | null
  cefr_level: string | null
  test_type: string | null
}

export interface ReportsProgressRecord {
  user_email: string
  activity_type: string
  activity_id: string
  score: number | null
  total: number | null
  completed_at: string
  response_text: string | null
  points_earned: number | null
}

export interface ReportsWritingBlock {
  id: string
  lesson_id: string
  title: string | null
}

export interface ReportsSession {
  id: string
  session_date: string | null
  topic: string | null
  status: string
}

export interface ReportsAttendanceRow {
  session_id: string
  student_email: string
  status: string
}

export interface ReportsLessonFlashcard {
  lesson_id: string
  word: string
}

export interface ReportsVocabSrsRow {
  user_email: string
  word: string
  box_level: number
  repetitions: number
}

export interface ReportsNoteRow {
  id: string
  student_email: string
  course_id: string
  author_email: string
  tag: string
  text: string
  created_at: string
}

export interface ReportsAssessment {
  id: string
  student_email: string
  name: string
  test_date: string | null
  score: number | null
  max_score: number | null
  source: string | null
}

export interface ReportsData {
  courses: ReportsCourse[]
  course: ReportsCourse | null
  students: ReportsStudent[]
  lessons: ReportsLesson[]
  exercises: ReportsExercise[]
  progress: ReportsProgressRecord[]
  attendance: ReportsAttendanceRow[]
  sessions: ReportsSession[]
  writingBlocks: ReportsWritingBlock[]
  vocabStruggles: Record<string, number>
  lessonFlashcards: ReportsLessonFlashcard[]
  vocabSrs: ReportsVocabSrsRow[]
  notes: ReportsNoteRow[]
  courseProgress: Record<string, { pct: number | null; updatedAt: string | null }>
  assessments: ReportsAssessment[]
}

// ─────────── StudentReport (ReportsView contract) ───────────
// MUST stay in lockstep with the exported interface in
// components/admin-v2/ReportsView.tsx (~L16-32). Per the wiring spec,
// the View is being widened so aiSummary is string | null and a new
// optional aiGeneratedAt?: string | null is added — typed to match here.

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface StudentReport {
  email: string
  name: string
  cefr?: string
  completionPct: number
  attendancePct: number | null
  avgLatestPct: number | null
  streak: number
  wordsLearned: number
  groupRank: number | null
  groupSize: number
  courseProgressPct: number | null
  vocabFocus: number | null
  aiSummary: string | null
  aiGeneratedAt?: string | null
  skills: { label: string; pct: number }[]
  trend: number[]
  vocab: number[] // 5 counts: New, Learning, Familiar, Known, Mastered
  attendance: { lesson: string; status: AttendanceStatus }[]
  tests: { title: string; type: string; score: number }[]
  manualTests: { id: string; name: string; date: string | null; scorePct: number | null; source: string }[]
  notes: { tag: string; author: string; text: string }[]
}

// ─────────── DigestPayload (/api/student-summary contract) ───────────
// MUST match the DigestPayload interface in
// app/api/student-summary/route.ts (~L30-57).

export interface DigestPayload {
  studentName: string
  studentEmail: string
  courseId: string
  courseName: string
  timeRangeLabel: string

  completionPct: number
  attempted: number
  assigned: number

  avgLatestPct: number | null
  avgBestPct: number | null

  attendancePct: number | null
  attendanceMarked: number

  streak: number
  totalAttempts: number

  trendDirection: 'up' | 'down' | 'flat' | 'none'

  topStrengths: { title: string; pct: number }[]
  topWeaknesses: { title: string; pct: number }[]

  skillBreakdown: { label: string; avgPct: number; attempted: number }[]
  cefrBreakdown: { level: string; avgPct: number; attempted: number }[]
}

export type ReportsDays = '7' | '30' | '90' | 'all'

// ─────────── Constants (ported from page.tsx) ───────────

// Pretty labels for skill tags (page.tsx ~L140-148).
const SKILL_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  pronunciation: 'Pronunciation',
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// Attendance counted as "present" for % calc if present or late (page.tsx ~L137).
const ATTENDANCE_PRESENT_STATUSES = new Set(['present', 'late'])

// ─────────── computeStreak (ported verbatim, page.tsx ~L332) ───────────
// Compute consecutive-day streak counting back from today. A "study day"
// is any day with at least one completed progress row.
export function computeStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0
  // Collect YYYY-MM-DD strings in local time, de-duped
  const daysSet = new Set(
    completedDates.map((iso) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )
  let streak = 0
  const cursor = new Date()
  // Allow today OR yesterday to start the streak (so evening-cutoff quirks are tolerated)
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
  const yestCursor = new Date()
  yestCursor.setDate(yestCursor.getDate() - 1)
  const yesterdayKey = `${yestCursor.getFullYear()}-${yestCursor.getMonth()}-${yestCursor.getDate()}`
  if (!daysSet.has(todayKey) && !daysSet.has(yesterdayKey)) return 0
  if (!daysSet.has(todayKey)) cursor.setDate(cursor.getDate() - 1) // start from yesterday
  while (true) {
    const k = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
    if (daysSet.has(k)) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// ─────────── Internal: time-range cutoff for lessons ───────────
// studentAggregates filters lessons by lesson_date >= (today - days).
// Ported from the lessonsInRange useMemo (page.tsx) + computeStudentDigest's
// inline cutoff. Lessons with no lesson_date are EXCLUDED from the overview
// aggregate (matching lessonsInRange, which returns false for null dates).

function sessionsInRangeIdSet(data: ReportsData, days: ReportsDays): Set<string> {
  const valid = (data.sessions || []).filter((s) => s.status !== 'cancelled')
  const ids = new Set<string>()
  const addAll = () =>
    valid.forEach((s) => {
      if (s.session_date) ids.add(s.id)
    })
  if (days === 'all') {
    addAll()
    return ids
  }
  const n = parseInt(days, 10)
  if (isNaN(n) || n <= 0) {
    addAll()
    return ids
  }
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - n)
  valid.forEach((s) => {
    if (!s.session_date) return
    if (new Date(s.session_date) >= cutoff) ids.add(s.id)
  })
  return ids
}

// ─────────── Internal: overview aggregate (studentAggregates row) ───────────
// Ported from page.tsx ~L697-766. One row per student. avgLatest is the
// metric the spec maps to StudentReport.avgLatestPct.

interface OverviewAggregate {
  email: string
  name: string
  completionPct: number
  assigned: number
  completed: number
  avgLatest: number | null
  avgBest: number | null
  totalAttempts: number
  attendancePct: number | null
  attendanceMarked: number
}

function computeOverviewAggregate(
  data: ReportsData,
  student: ReportsStudent,
  courseExerciseIds: Set<string>,
  sessionsInRangeIds: Set<string>
): OverviewAggregate {
  const studentExerciseProgress = data.progress.filter(
    (p) =>
      p.user_email === student.email &&
      p.activity_type === 'exercise' &&
      courseExerciseIds.has(p.activity_id)
  )

  // Unique exercises attempted
  const attemptedIds = new Set(studentExerciseProgress.map((p) => p.activity_id))
  const assigned = data.exercises.length
  const completed = attemptedIds.size
  const completionPct = assigned > 0 ? Math.round((completed / assigned) * 100) : 0

  // For each unique exercise, find latest and best percentages
  const latestPcts: number[] = []
  const bestPcts: number[] = []
  let totalAttempts = 0

  attemptedIds.forEach((exId) => {
    const attempts = studentExerciseProgress.filter((p) => p.activity_id === exId)
    totalAttempts += attempts.length
    // progress is sorted desc by completed_at from the API
    const latest = attempts[0]
    if (latest?.score != null && latest?.total) {
      latestPcts.push(Math.round((latest.score / latest.total) * 100))
    }
    // Best score
    let best = 0
    for (const a of attempts) {
      if (a.score != null && a.total) {
        const pct = Math.round((a.score / a.total) * 100)
        if (pct > best) best = pct
      }
    }
    bestPcts.push(best)
  })

  const avgLatest = latestPcts.length > 0 ? Math.round(latestPcts.reduce((a, b) => a + b, 0) / latestPcts.length) : null
  const avgBest = bestPcts.length > 0 ? Math.round(bestPcts.reduce((a, b) => a + b, 0) / bestPcts.length) : null

  // Attendance: count marked lessons in range where student was present-or-late
  const studentAttendance = data.attendance.filter(
    (a) => a.student_email === student.email && sessionsInRangeIds.has(a.session_id)
  )
  const marked = studentAttendance.length
  const presentOrLate = studentAttendance.filter((a) => ATTENDANCE_PRESENT_STATUSES.has(a.status)).length
  const attendancePct = marked > 0 ? Math.round((presentOrLate / marked) * 100) : null

  return {
    email: student.email,
    name: student.name || student.email,
    completionPct,
    assigned,
    completed,
    avgLatest,
    avgBest,
    totalAttempts,
    attendancePct,
    attendanceMarked: marked,
  }
}

// ─────────── Internal: per-student detail (buildStudentDetail) ───────────
// Ported from page.tsx ~L769-1045. Only the fields the StudentReport mapping
// needs are carried through (trend scores, skillBreakdown, cefrBreakdown,
// attendanceRows, tests, vocab.stageCounts, vocab.needsAttention). Math and
// edge cases are identical to the source.

interface StudentDetail {
  trend: { attempt: number; date: string; score: number }[]
  attendanceRows: { lesson_title: string; status: string }[]
  skillBreakdown: { skill: string; label: string; avgPct: number; attempted: number }[]
  cefrBreakdown: { level: string; avgPct: number; attempted: number }[]
  tests: {
    id: string
    title: string
    test_type: string
    attempts: number
    first: number | null
    latest: number | null
    firstAt: string | null
  }[]
  vocab: {
    needsAttention: number
    stageCounts: number[]
  }
}

function buildStudentDetail(data: ReportsData, selectedStudentEmail: string): StudentDetail | null {
  const student = data.students.find((s) => s.email === selectedStudentEmail)
  if (!student) return null

  const studentExerciseProgress = data.progress.filter(
    (p) => p.user_email === selectedStudentEmail && p.activity_type === 'exercise'
  )

  const perExercise = data.exercises.map((ex) => {
    const attempts = studentExerciseProgress.filter((p) => p.activity_id === ex.id)
    if (attempts.length === 0) {
      return { id: ex.id, title: ex.title, attempts: 0, latest: null as number | null, best: null as number | null, lastAt: null as string | null }
    }
    const latest = attempts[0]
    const latestPct = latest.score != null && latest.total ? Math.round((latest.score / latest.total) * 100) : null
    let best = 0
    for (const a of attempts) {
      if (a.score != null && a.total) {
        const pct = Math.round((a.score / a.total) * 100)
        if (pct > best) best = pct
      }
    }
    return { id: ex.id, title: ex.title, attempts: attempts.length, latest: latestPct, best, lastAt: latest.completed_at }
  })

  // Score trend (chronological, one point per attempt)
  const trend = studentExerciseProgress
    .filter((p) => p.score != null && p.total)
    .slice()
    .reverse() // chronological
    .map((p, i) => ({
      attempt: i + 1,
      date: new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      score: Math.round(((p.score as number) / (p.total as number)) * 100),
    }))

  // Attendance: filter attendance rows for this student, join with lessons for date/title
  const sessionById = new Map((data.sessions || []).map((sx) => [sx.id, sx]))
  const studentAttendanceRows = data.attendance
    .filter((a) => {
      if (a.student_email !== selectedStudentEmail) return false
      const sx = sessionById.get(a.session_id)
      return !!sx && sx.status !== 'cancelled'
    })
    .map((a) => {
      const sx = sessionById.get(a.session_id)
      const dateLabel = sx?.session_date
        ? new Date(sx.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : null
      return {
        status: a.status,
        lesson_title: sx?.topic || dateLabel || '(class)',
        lesson_date: sx?.session_date || null,
      }
    })
    .sort((x, y) => {
      const dx = x.lesson_date ? new Date(x.lesson_date).getTime() : 0
      const dy = y.lesson_date ? new Date(y.lesson_date).getTime() : 0
      return dy - dx // newest first
    })

  // ─── Skill breakdown + CEFR performance (best-score per exercise) ───
  const bestByExerciseId: Record<string, number> = {}
  for (const ex of perExercise) {
    if (ex.best != null) bestByExerciseId[ex.id] = ex.best
  }

  const exerciseById = new Map(data.exercises.map((e) => [e.id, e]))

  const skillSums: Record<string, { sum: number; count: number }> = {}
  for (const [exId, pct] of Object.entries(bestByExerciseId)) {
    const ex = exerciseById.get(exId)
    if (!ex || !ex.skills) continue
    for (const skill of ex.skills) {
      if (!skillSums[skill]) skillSums[skill] = { sum: 0, count: 0 }
      skillSums[skill].sum += pct
      skillSums[skill].count += 1
    }
  }
  const skillBreakdown = Object.entries(skillSums)
    .map(([skill, { sum, count }]) => ({
      skill,
      label: SKILL_LABELS[skill] || skill,
      avgPct: Math.round(sum / count),
      attempted: count,
    }))
    .sort((a, b) => b.avgPct - a.avgPct)

  const cefrSums: Record<string, { sum: number; count: number }> = {}
  for (const [exId, pct] of Object.entries(bestByExerciseId)) {
    const ex = exerciseById.get(exId)
    if (!ex || !ex.cefr_level) continue
    if (!cefrSums[ex.cefr_level]) cefrSums[ex.cefr_level] = { sum: 0, count: 0 }
    cefrSums[ex.cefr_level].sum += pct
    cefrSums[ex.cefr_level].count += 1
  }
  const cefrBreakdown = CEFR_ORDER
    .filter((level) => cefrSums[level])
    .map((level) => ({
      level,
      avgPct: Math.round(cefrSums[level].sum / cefrSums[level].count),
      attempted: cefrSums[level].count,
    }))

  // Tests: exercises tagged with a test_type. FIRST attempt is the real grade.
  const tests = data.exercises
    .filter((ex) => ex.test_type)
    .map((ex) => {
      const attempts = studentExerciseProgress.filter((p) => p.activity_id === ex.id)
      if (attempts.length === 0) {
        return {
          id: ex.id,
          title: ex.title,
          test_type: ex.test_type as string,
          attempts: 0,
          first: null as number | null,
          latest: null as number | null,
          firstAt: null as string | null,
        }
      }
      // progress is sorted DESC by completed_at — first chronological attempt is the LAST element
      const firstAttempt = attempts[attempts.length - 1]
      const latestAttempt = attempts[0]
      const firstPct =
        firstAttempt.score != null && firstAttempt.total
          ? Math.round((firstAttempt.score / firstAttempt.total) * 100)
          : null
      const latestPct =
        latestAttempt.score != null && latestAttempt.total
          ? Math.round((latestAttempt.score / latestAttempt.total) * 100)
          : null
      return {
        id: ex.id,
        title: ex.title,
        test_type: ex.test_type as string,
        attempts: attempts.length,
        first: firstPct,
        latest: latestPct,
        firstAt: firstAttempt.completed_at,
      }
    })

  // ─── Vocabulary breakdown ───
  const studentSrs = (data.vocabSrs || []).filter((v) => v.user_email === selectedStudentEmail)

  const vocabStageCounts = [0, 0, 0, 0, 0, 0] // indices 1..5 = New..Mastered
  studentSrs.forEach((v) => {
    const b = v.box_level >= 1 && v.box_level <= 5 ? v.box_level : 1
    vocabStageCounts[b]++
  })
  const vocabNeedsAttention = studentSrs.filter((v) => v.repetitions > 0 && v.box_level <= 2).length

  return {
    trend,
    attendanceRows: studentAttendanceRows.map((a) => ({ lesson_title: a.lesson_title, status: a.status })),
    skillBreakdown,
    cefrBreakdown,
    tests,
    vocab: {
      needsAttention: vocabNeedsAttention,
      stageCounts: vocabStageCounts,
    },
  }
}

// ─────────── Internal: normalize attendance status for the View ───────────
// ReportsView types attendance status as a fixed union; map unknown values to
// 'absent' as a safe default (the % math already used present/late upstream).

function toAttendanceStatus(status: string): AttendanceStatus {
  if (status === 'present' || status === 'absent' || status === 'late' || status === 'excused') {
    return status
  }
  return 'absent'
}

// ─────────── buildStudentReports ───────────
// For EVERY enrolled student, compute the overview aggregate + per-student
// detail and MAP to ReportsView's StudentReport per the wiring spec.
// aiSummary / aiGeneratedAt are left null — the page fills these from cache.

export function buildStudentReports(data: ReportsData, days: ReportsDays): StudentReport[] {
  const courseExerciseIds = new Set(data.exercises.map((e) => e.id))
  const sessionsInRangeIds = sessionsInRangeIdSet(data, days)

  // Words learned (vocab_srs rows per student) + group rank (by points earned
  // in the period, across the cohort). Rank 1 = most points.
  const wordsByEmail: Record<string, number> = {}
  for (const v of data.vocabSrs || []) wordsByEmail[v.user_email] = (wordsByEmail[v.user_email] || 0) + 1
  const pointsByEmail: Record<string, number> = {}
  for (const p of data.progress) pointsByEmail[p.user_email] = (pointsByEmail[p.user_email] || 0) + (p.points_earned ?? 0)
  const groupSize = data.students.length
  const rankByEmail: Record<string, number> = {}
  data.students
    .map((st) => ({ email: st.email, pts: pointsByEmail[st.email] || 0 }))
    .sort((a, b) => b.pts - a.pts)
    .forEach((r, i) => {
      rankByEmail[r.email] = i + 1
    })

  return data.students
    .map((student) => {
      const overview = computeOverviewAggregate(data, student, courseExerciseIds, sessionsInRangeIds)
      const detail = buildStudentDetail(data, student.email)

      // cefr (optional) = highest level present in cefrBreakdown, else omit.
      // CEFR_ORDER is low→high; cefrBreakdown is already filtered to present
      // levels in CEFR_ORDER sequence, so the last entry is the highest.
      let cefr: string | undefined
      if (detail && detail.cefrBreakdown.length > 0) {
        cefr = detail.cefrBreakdown[detail.cefrBreakdown.length - 1].level
      }

      // Notes for this student (course notes already scoped to the course by
      // the API). tag/author/text per the spec.
      const studentNotes = data.notes
        .filter((n) => n.student_email === student.email)
        .map((n) => ({ tag: n.tag, author: n.author_email, text: n.text }))

      const report: StudentReport = {
        email: student.email,
        name: student.name || student.email, // never empty
        completionPct: overview.completionPct,
        avgLatestPct: overview.avgLatest,
        attendancePct: overview.attendancePct,
        streak: computeStreak(
          data.progress.filter((p) => p.user_email === student.email).map((p) => p.completed_at)
        ),
        wordsLearned: wordsByEmail[student.email] || 0,
        groupRank: groupSize > 0 ? rankByEmail[student.email] : null,
        groupSize,
        courseProgressPct: data.courseProgress?.[student.email]?.pct ?? null,
        vocabFocus: detail ? detail.vocab.needsAttention : null,
        skills: detail ? detail.skillBreakdown.map((s) => ({ label: s.label, pct: s.avgPct })) : [],
        trend: detail ? detail.trend.map((t) => t.score) : [],
        // stageCounts is [0, New, Learning, Familiar, Known, Mastered];
        // slice(1, 6) yields the 5 real stage counts the View expects.
        vocab: detail ? detail.vocab.stageCounts.slice(1, 6) : [0, 0, 0, 0, 0],
        attendance: detail
          ? detail.attendanceRows.map((r) => ({ lesson: r.lesson_title, status: toAttendanceStatus(r.status) }))
          : [],
        tests: detail
          ? detail.tests.map((t) => ({ title: t.title, type: t.test_type, score: t.first ?? t.latest ?? 0 }))
          : [],
        manualTests: (data.assessments || [])
          .filter((a) => a.student_email === student.email)
          .map((a) => ({
            id: a.id,
            name: a.name,
            date: a.test_date
              ? new Date(a.test_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              : null,
            scorePct: a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 100) : null,
            source: a.source || 'Written',
          })),
        notes: studentNotes,
        aiSummary: null,
        aiGeneratedAt: null,
      }
      if (cefr !== undefined) report.cefr = cefr

      return report
    })
    // Match studentAggregates ordering: completion desc, then name asc.
    .sort((a, b) => b.completionPct - a.completionPct || a.name.localeCompare(b.name))
}

// ─────────── buildDigestPayload ───────────
// Build the EXACT request body /api/student-summary expects (DigestPayload).
// Ported from computeStudentDigest (page.tsx ~L178-328). Returns null if the
// course is missing or the student isn't enrolled.

export function buildDigestPayload(
  email: string,
  data: ReportsData,
  courseName: string,
  days: ReportsDays
): DigestPayload | null {
  if (!data.course) return null
  const student = data.students.find((s) => s.email === email)
  if (!student) return null

  const courseExerciseIds = new Set(data.exercises.map((e) => e.id))
  const exById = new Map(data.exercises.map((e) => [e.id, e]))
  const studentExProgress = data.progress.filter(
    (p) => p.user_email === email && p.activity_type === 'exercise' && courseExerciseIds.has(p.activity_id)
  )

  // Per-exercise latest + best
  type PerEx = { id: string; title: string; attempts: number; latest: number | null; best: number | null }
  const perEx: PerEx[] = data.exercises.map((ex) => {
    const attempts = studentExProgress.filter((p) => p.activity_id === ex.id)
    if (attempts.length === 0) return { id: ex.id, title: ex.title, attempts: 0, latest: null, best: null }
    const latest = attempts[0]
    const latestPct = latest.score != null && latest.total ? Math.round((latest.score / latest.total) * 100) : null
    let best = 0
    for (const a of attempts) {
      if (a.score != null && a.total) {
        const pct = Math.round((a.score / a.total) * 100)
        if (pct > best) best = pct
      }
    }
    return { id: ex.id, title: ex.title, attempts: attempts.length, latest: latestPct, best }
  })

  const attempted = perEx.filter((p) => p.attempts > 0).length
  const assigned = data.exercises.length
  const completionPct = assigned > 0 ? Math.round((attempted / assigned) * 100) : 0
  const totalAttempts = perEx.reduce((s, p) => s + p.attempts, 0)

  const latestPcts = perEx.map((p) => p.latest).filter((x): x is number => x != null)
  const bestPcts = perEx.map((p) => p.best).filter((x): x is number => x != null)
  const avgLatestPct = latestPcts.length > 0 ? Math.round(latestPcts.reduce((a, b) => a + b, 0) / latestPcts.length) : null
  const avgBestPct = bestPcts.length > 0 ? Math.round(bestPcts.reduce((a, b) => a + b, 0) / bestPcts.length) : null

  // Attendance %, filtered to lessons in the selected time range
  const cutoffMs = (() => {
    if (days === 'all') return 0
    const n = parseInt(days, 10)
    if (isNaN(n) || n <= 0) return 0
    return Date.now() - n * 24 * 60 * 60 * 1000
  })()
  const sessionsInRangeIds = new Set(
    (data.sessions || [])
      .filter((sx) => sx.status !== 'cancelled' && (!sx.session_date || new Date(sx.session_date).getTime() >= cutoffMs))
      .map((sx) => sx.id)
  )
  const studentAttendance = data.attendance.filter(
    (a) => a.student_email === email && sessionsInRangeIds.has(a.session_id)
  )
  const attendanceMarked = studentAttendance.length
  const presentOrLate = studentAttendance.filter((a) => a.status === 'present' || a.status === 'late').length
  const attendancePct = attendanceMarked > 0 ? Math.round((presentOrLate / attendanceMarked) * 100) : null

  // Streak (uses full progress history, not time-range filtered)
  const allStudentProgress = data.progress.filter((p) => p.user_email === email)
  const streak = computeStreak(allStudentProgress.map((p) => p.completed_at))

  // Score trend direction: compare first-half vs second-half avg of attempt scores
  const scoredProgress = studentExProgress.filter((p) => p.score != null && p.total)
  let trendDirection: 'up' | 'down' | 'flat' | 'none' = 'none'
  if (scoredProgress.length >= 4) {
    // progress is sorted desc by completed_at, so reverse for chronological
    const chrono = scoredProgress.slice().reverse()
    const half = Math.floor(chrono.length / 2)
    const firstHalf = chrono.slice(0, half)
    const secondHalf = chrono.slice(-half)
    const avg = (arr: typeof chrono) =>
      arr.reduce((s, p) => s + ((p.score as number) / (p.total as number)) * 100, 0) / arr.length
    const diff = avg(secondHalf) - avg(firstHalf)
    if (diff > 5) trendDirection = 'up'
    else if (diff < -5) trendDirection = 'down'
    else trendDirection = 'flat'
  }

  // Top strengths (best score) and weaknesses (latest score), excluding untaken
  const topStrengths = perEx
    .filter((p) => p.best != null)
    .sort((a, b) => (b.best as number) - (a.best as number))
    .slice(0, 3)
    .map((p) => ({ title: p.title || '(untitled)', pct: p.best as number }))

  const topWeaknesses = perEx
    .filter((p) => p.latest != null)
    .sort((a, b) => (a.latest as number) - (b.latest as number))
    .slice(0, 3)
    .map((p) => ({ title: p.title || '(untitled)', pct: p.latest as number }))

  // Skill + CEFR breakdown (best score per exercise)
  const bestByEx: Record<string, number> = {}
  for (const p of perEx) if (p.best != null) bestByEx[p.id] = p.best
  const skillSums: Record<string, { sum: number; count: number }> = {}
  for (const [exId, pct] of Object.entries(bestByEx)) {
    const ex = exById.get(exId)
    if (!ex || !ex.skills) continue
    for (const s of ex.skills) {
      if (!skillSums[s]) skillSums[s] = { sum: 0, count: 0 }
      skillSums[s].sum += pct
      skillSums[s].count += 1
    }
  }
  const skillBreakdown = Object.entries(skillSums)
    .map(([s, v]) => ({ label: SKILL_LABELS[s] || s, avgPct: Math.round(v.sum / v.count), attempted: v.count }))
    .sort((a, b) => b.avgPct - a.avgPct)

  const cefrSums: Record<string, { sum: number; count: number }> = {}
  for (const [exId, pct] of Object.entries(bestByEx)) {
    const ex = exById.get(exId)
    if (!ex || !ex.cefr_level) continue
    if (!cefrSums[ex.cefr_level]) cefrSums[ex.cefr_level] = { sum: 0, count: 0 }
    cefrSums[ex.cefr_level].sum += pct
    cefrSums[ex.cefr_level].count += 1
  }
  const cefrBreakdown = CEFR_ORDER
    .filter((l) => cefrSums[l])
    .map((l) => ({ level: l, avgPct: Math.round(cefrSums[l].sum / cefrSums[l].count), attempted: cefrSums[l].count }))

  return {
    studentName: student.name || student.email,
    studentEmail: email,
    courseId: data.course.id,
    courseName,
    timeRangeLabel: days === 'all' ? 'All time' : `Last ${days} days`,
    completionPct,
    attempted,
    assigned,
    avgLatestPct,
    avgBestPct,
    attendancePct,
    attendanceMarked,
    streak,
    totalAttempts,
    trendDirection,
    topStrengths,
    topWeaknesses,
    skillBreakdown,
    cefrBreakdown,
  }
}

// ─────────── Course-level digest (for the course AI overview) ───────────
// Aggregates the per-student reports into a cohort snapshot that
// /api/course-summary turns into three short narratives
// (summary / needs attention / ready to level up). Reuses buildStudentReports
// so the numbers match exactly what the View shows.

export interface CourseDigestPayload {
  courseId: string
  courseName: string
  timeRangeLabel: string
  studentCount: number
  avgCompletionPct: number
  avgScorePct: number | null
  avgAttendancePct: number | null
  activeStreaks: number
  skillCohort: { label: string; avgPct: number; students: number }[]
  topPerformers: { name: string; scorePct: number | null; completionPct: number }[]
  needsAttention: { name: string; completionPct: number; scorePct: number | null; attendancePct: number | null }[]
}

export function buildCourseDigest(
  data: ReportsData,
  courseName: string,
  days: ReportsDays
): CourseDigestPayload | null {
  if (!data.course) return null
  const reports = buildStudentReports(data, days)
  const n = reports.length
  const mean = (arr: number[]): number | null =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  const avgCompletionPct = mean(reports.map((r) => r.completionPct)) ?? 0
  const avgScorePct = mean(reports.map((r) => r.avgLatestPct).filter((x): x is number => x != null))
  const avgAttendancePct = mean(reports.map((r) => r.attendancePct).filter((x): x is number => x != null))
  const activeStreaks = reports.filter((r) => r.streak > 0).length

  // Cohort skill averages across all students who have a score for that skill.
  const skillSums: Record<string, { sum: number; count: number }> = {}
  for (const r of reports) {
    for (const sk of r.skills) {
      if (!skillSums[sk.label]) skillSums[sk.label] = { sum: 0, count: 0 }
      skillSums[sk.label].sum += sk.pct
      skillSums[sk.label].count += 1
    }
  }
  const skillCohort = Object.entries(skillSums)
    .map(([label, v]) => ({ label, avgPct: Math.round(v.sum / v.count), students: v.count }))
    .sort((a, b) => b.avgPct - a.avgPct)

  const topPerformers = reports
    .slice()
    .sort((a, b) => (b.avgLatestPct ?? -1) - (a.avgLatestPct ?? -1) || b.completionPct - a.completionPct)
    .slice(0, 3)
    .map((r) => ({ name: r.name, scorePct: r.avgLatestPct, completionPct: r.completionPct }))

  const needsAttention = reports
    .slice()
    .sort((a, b) => a.completionPct - b.completionPct || (a.avgLatestPct ?? 101) - (b.avgLatestPct ?? 101))
    .slice(0, 3)
    .map((r) => ({
      name: r.name,
      completionPct: r.completionPct,
      scorePct: r.avgLatestPct,
      attendancePct: r.attendancePct,
    }))

  return {
    courseId: data.course.id,
    courseName,
    timeRangeLabel: days === 'all' ? 'All time' : `Last ${days} days`,
    studentCount: n,
    avgCompletionPct,
    avgScorePct,
    avgAttendancePct,
    activeStreaks,
    skillCohort,
    topPerformers,
    needsAttention,
  }
}
