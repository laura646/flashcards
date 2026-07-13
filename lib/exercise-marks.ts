// ── Server-side authoritative mark total + points for lesson exercises ──
//
// The /api/progress POST used to trust client-reported score/total/points.
// A student could POST inflated numbers for their OWN account (the route
// guards only block cross-user writes), pumping their score %, completion,
// and — via points_earned — the group-rank leaderboard (lib/reports-compute
// sums points_earned).
//
// This module reconstructs the authoritative mark total for a lesson_exercises
// row directly from its stored `questions` (JSONB) so the route can:
//   1. clamp the self-reported score to a real ceiling, and
//   2. recompute points_earned = clamp(score) * points_per_answer +
//      completion_bonus (never trusting the client value).
//
// IMPORTANT — mirror of the client runners. Each exercise runner in
// components/*Runner.tsx computes the `total` it reports on completion. The
// per-type rules below reproduce those exactly (see comments per case). The
// cap is EXACT for well-formed content and only ever ERRS HIGH (over-counts)
// for malformed/unknown content — never low — so a legitimate score is never
// clamped down. When you add a new exercise type + runner, add its rule here.

export interface ExerciseMarkRow {
  exercise_type?: string | null
  // JSONB. For most types an array of per-mark questions; for group_sort it is
  // the { groups: [{ name, items: [{text}] }] } object (the insert path in
  // app/api/lessons stores groupData in this column). For gap_fill it is a
  // single-element array whose [0] holds { gaps: [...] }.
  questions?: unknown
  // Present only after client-side normalization; the raw DB row usually keeps
  // group_sort data in `questions`. We read either.
  groupData?: unknown
  points_per_answer?: number | null
  completion_bonus?: number | null
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function wordCount(s: string): number {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

// Verbatim port of ErrorCorrectionRunner.tsx `findErrors`, reduced to the
// COUNT of correctable error positions (the Map size). Kept byte-for-byte in
// sync with the runner so the derived total matches what the student saw.
// Pure deletions (no corresponding correct word) are intentionally skipped by
// the runner and therefore excluded here too.
function correctableErrorCount(incorrect: string, correct: string): number {
  const inc = incorrect.trim().split(/\s+/)
  const cor = correct.trim().split(/\s+/)
  const n = inc.length
  const m = cor.length

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (inc[i - 1].toLowerCase() === cor[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const matched = new Set<number>()
  const matchToJ = new Map<number, number>()
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (inc[i - 1].toLowerCase() === cor[j - 1].toLowerCase()) {
      matched.add(i - 1)
      matchToJ.set(i - 1, j - 1)
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  let count = 0
  for (let k = 0; k < n; k++) {
    if (matched.has(k)) continue
    let prevJ = -1
    for (let p = k - 1; p >= 0; p--) {
      if (matched.has(p)) { prevJ = matchToJ.get(p)!; break }
    }
    let nextJ = m
    for (let p = k + 1; p < n; p++) {
      if (matched.has(p)) { nextJ = matchToJ.get(p)!; break }
    }
    if (prevJ + 1 < nextJ) count++
  }
  return count
}

// A deliberately GENEROUS structural count, used only as a fallback ceiling for
// unknown exercise types or malformed content. Over-counting here is safe: it
// only loosens the clamp (never crushes a legit score); it never applies to the
// well-formed known types below.
function genericCeiling(node: unknown, depth = 0): number {
  if (depth > 6 || node == null) return 0
  if (Array.isArray(node)) {
    let n = node.length
    for (const el of node) n += genericCeiling(el, depth + 1)
    return n
  }
  if (typeof node === 'object') {
    let n = 0
    for (const v of Object.values(node as Record<string, unknown>)) {
      n += genericCeiling(v, depth + 1)
    }
    return n
  }
  return 0
}

// Authoritative maximum marks for a lesson exercise. Guaranteed >= 1 and never
// below the true total for well-formed content.
export function authoritativeExerciseTotal(ex: ExerciseMarkRow): number {
  const type = ex.exercise_type ?? ''
  const qs: unknown[] = Array.isArray(ex.questions) ? (ex.questions as unknown[]) : []

  try {
    switch (type) {
      // Per-blank scoring: total = number of blank keys across all questions.
      case 'complete_sentence':
      case 'cloze_listening': {
        let t = 0
        for (const q of qs) {
          const blanks = (q as { blanks?: unknown })?.blanks
          if (blanks && typeof blanks === 'object') t += Object.keys(blanks).length
        }
        if (t > 0) return t
        break
      }
      // Per-item scoring: total = number of items across all groups. Raw DB rows
      // keep this object in `questions`; normalized rows use `groupData`.
      case 'group_sort': {
        const gd = (ex.groupData ?? ex.questions) as { groups?: unknown }
        const groups = Array.isArray(gd?.groups) ? (gd!.groups as unknown[]) : []
        let t = 0
        for (const g of groups) {
          const items = (g as { items?: unknown })?.items
          if (Array.isArray(items)) t += items.length
        }
        if (t > 0) return t
        break
      }
      // Per-gap scoring: the whole config lives in questions[0].gaps.
      case 'gap_fill': {
        const cfg = qs[0] as { gaps?: unknown }
        const gaps = Array.isArray(cfg?.gaps) ? (cfg!.gaps as unknown[]) : []
        if (gaps.length > 0) return gaps.length
        break
      }
      // Per-correctable-error scoring (LCS diff). Exact when the port succeeds;
      // falls back to a word-count over-estimate (>= true errors) on any error.
      case 'error_correction': {
        let t = 0
        for (const q of qs) {
          const inc = String((q as { incorrect?: unknown })?.incorrect ?? '')
          const cor = String((q as { correct?: unknown })?.correct ?? '')
          try {
            t += correctableErrorCount(inc, cor)
          } catch {
            t += Math.max(wordCount(inc), wordCount(cor))
          }
        }
        if (t > 0) return t
        break
      }
      // Everything else is one mark per question: multiple_choice, true_or_false,
      // type_answer, dictation, rank_order, text_sequencing, anagram/unjumble,
      // match_halves, odd_one_out, hangman, fill_blank, transform, and any
      // future type that falls through the default runner.
      default: {
        if (qs.length > 0) return qs.length
        break
      }
    }
  } catch {
    // fall through to the generic ceiling
  }

  // Malformed content or an unrecognized shape: never clamp below what is
  // structurally present, and never below 1.
  const generic = Math.max(genericCeiling(ex.questions), genericCeiling(ex.groupData))
  return Math.max(generic, qs.length, 1)
}

// Server-side points: clamp(score) * points_per_answer + completion_bonus.
// Mirrors app/lessons/[id]/page.tsx (ppa default 10, cb default 0) but is the
// authoritative value — the client-sent points_earned is ignored.
export function recomputeExercisePoints(ex: ExerciseMarkRow, safeScore: number): number {
  const ppa = num(ex.points_per_answer, 10)
  const cb = num(ex.completion_bonus, 0)
  return Math.max(0, Math.round(safeScore * ppa + cb))
}
