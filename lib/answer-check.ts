// Wave 0 — shared answer-checking for IELTS gap-fill / short-answer types.
//
// The critic flagged this matcher as needed EARLY (several Reading/Listening
// types depend on it): word-limit enforcement + accepted-answer variants,
// with the official rules — hyphenated words count as ONE word, contractions
// count as one, matching is case/space-insensitive but spelling-exact
// (a misspelling is wrong). Pure functions — no UI, easy to verify.

export type GapReason = 'empty' | 'over_word_limit' | 'mismatch'

export interface GapResult {
  correct: boolean
  reason?: GapReason
  /** The first accepted answer, for "Expected: …" feedback. */
  expected?: string
}

/** IELTS word count: split on whitespace, so "well-known" and "don't" each = 1. */
export function countWords(s: string): number {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Check a learner's gap answer.
 * @param input     what the learner typed
 * @param accepted  accepted answers (include valid spelling/order variants)
 * @param wordLimit optional max words (e.g. "NO MORE THAN TWO WORDS" → 2)
 */
export function checkGapAnswer(input: string, accepted: string[], wordLimit?: number): GapResult {
  const a = input ?? ''
  const expected = accepted[0]
  if (!a.trim()) return { correct: false, reason: 'empty', expected }
  if (wordLimit != null && countWords(a) > wordLimit) {
    return { correct: false, reason: 'over_word_limit', expected }
  }
  const ok = accepted.some((x) => norm(x) === norm(a))
  return ok ? { correct: true } : { correct: false, reason: 'mismatch', expected }
}

/** Human-readable "why" for a wrong answer — the UX-pass "explain why" fix. */
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
