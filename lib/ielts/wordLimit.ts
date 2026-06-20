// ─────────────────────────────────────────────────────────────────────────────
// IELTS Reading — answer-checking helpers (pure, unit-friendly)
//
// ADDITIVE foundation module. NOT imported by any live file yet. The Runners
// stage (and a future live integration) will consume these.
//
// Mirrors the official IELTS answer-key rules described in
// `IELTS spec/ielts-reading-14-types-build-spec.md` (Shared conventions →
// Answer-checking + Word limits):
//   • matching is case-insensitive and whitespace-collapsed,
//   • but spelling-exact — a misspelling is WRONG,
//   • a hyphenated token ("well-known") counts as ONE word,
//   • a contraction ("don't") counts as ONE word,
//   • over the word limit ⇒ wrong even if the words are right.
//
// NOTE for the integration stage: `lib/answer-check.ts` already ships a
// near-identical `checkGapAnswer` / `countWords` for the live student app. We
// keep these IELTS copies standalone tonight (additive rule — no edits to live
// files). When wiring IELTS into the live dispatch, consolidate the two so
// there is a single matcher; the contracts are intentionally compatible.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical form for comparison: trim ends, collapse internal runs of
 * whitespace to a single space, lowercase. Used by both the word count and the
 * accepted-answer match so they agree on what "the same" means.
 */
export function normalize(str: string): string {
  return (str ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * IELTS word count. Split on whitespace, so a hyphenated word ("well-known")
 * and a contraction ("don't") each count as ONE word. Empty / whitespace-only
 * input is 0.
 */
export function countWords(str: string): number {
  const t = (str ?? '').trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * True when `answer` is within `limit` words. An undefined/null limit means
 * "no limit" → always within. Zero or negative limits are treated as no limit
 * (defensive: a limit of 0 makes no sense for a gap-fill).
 */
export function withinWordLimit(answer: string, limit?: number): boolean {
  if (limit == null || limit <= 0) return true
  return countWords(answer) <= limit
}

/**
 * Core acceptance check for a single gap / short answer.
 *
 * Returns true iff:
 *   1. the answer is non-empty, AND
 *   2. it is within the word limit (if any), AND
 *   3. after `normalize`, it equals at least one of `acceptedAnswers`.
 *
 * Spelling must be exact (normalize only folds case + whitespace, never fixes
 * typos). Include every valid spelling/word-order variant in `acceptedAnswers`,
 * exactly as official IELTS answer keys list bracketed alternatives.
 *
 * @param answer          what the learner typed
 * @param acceptedAnswers accepted variants (case/spacing-insensitive)
 * @param wordLimit       optional max words (e.g. "NO MORE THAN TWO WORDS" → 2)
 */
export function checkAccepted(
  answer: string,
  acceptedAnswers: string[],
  wordLimit?: number,
): boolean {
  const a = answer ?? ''
  if (!a.trim()) return false
  if (!withinWordLimit(a, wordLimit)) return false
  const target = normalize(a)
  return acceptedAnswers.some((variant) => normalize(variant) === target)
}

/** Why a single gap answer failed — for accessible "explain why" feedback. */
export type GapReason = 'empty' | 'over_word_limit' | 'mismatch'

export interface GapResult {
  correct: boolean
  reason?: GapReason
  /** The first accepted answer, surfaced as "Expected: …" on a wrong answer. */
  expected?: string
}

/**
 * Richer variant of `checkAccepted` that also reports WHY it failed and what
 * the expected answer was, so the primitives can show a precise review message
 * (over-limit vs. wrong word vs. blank). Pure — no UI.
 */
export function checkGap(
  answer: string,
  acceptedAnswers: string[],
  wordLimit?: number,
): GapResult {
  const a = answer ?? ''
  const expected = acceptedAnswers[0]
  if (!a.trim()) return { correct: false, reason: 'empty', expected }
  if (!withinWordLimit(a, wordLimit)) {
    return { correct: false, reason: 'over_word_limit', expected }
  }
  return checkAccepted(a, acceptedAnswers, wordLimit)
    ? { correct: true }
    : { correct: false, reason: 'mismatch', expected }
}

/** Human-readable "why" for a wrong gap answer (pairs with <AnswerMark detail>). */
export function gapFeedback(result: GapResult, wordLimit?: number): string {
  if (result.correct) return 'Correct'
  switch (result.reason) {
    case 'empty':
      return 'No answer yet'
    case 'over_word_limit':
      return wordLimit != null ? `Over the ${wordLimit}-word limit` : 'Too many words'
    default:
      return result.expected ? `Expected: ${result.expected}` : 'Incorrect'
  }
}

/**
 * Exact-letter check for the letter/label types (MCQ letters, T/F/NG, matching
 * headings, matching features, sentence endings). Case-insensitive, trimmed.
 * For multi-select (e.g. "Choose TWO letters") pass arrays via `checkLetterSet`.
 */
export function checkLetter(answer: string | null | undefined, correct: string): boolean {
  if (answer == null) return false
  return normalize(answer) === normalize(correct)
}

/**
 * Order-independent set match for multi-answer letter questions ("Choose TWO
 * letters, A–E"). Both sets must match exactly (same members, no extras/missing).
 */
export function checkLetterSet(answers: string[], correct: string[]): boolean {
  const a = Array.from(new Set(answers.map(normalize).filter(Boolean)))
  const c = Array.from(new Set(correct.map(normalize).filter(Boolean)))
  if (a.length !== c.length) return false
  const cset = new Set(c)
  return a.every((x) => cset.has(x))
}
