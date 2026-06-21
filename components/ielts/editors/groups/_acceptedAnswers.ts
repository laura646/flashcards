// IELTS Reading — TEACHER authoring shared helpers for "accepted answers".
//
// ADDITIVE: not imported by any live file. Used by the completion / short-answer
// group editors (sentence_completion, note_completion, short_answer, …) so they
// all parse the teacher's comma-separated accepted-answer input the same way.
//
// The runners check answers via checkAccepted(answer, acceptedAnswers, limit):
// each entry is an accepted variant (case/whitespace-insensitive at check time).
// Teachers type the variants on one line separated by commas, e.g.
//   "heat island, heat-island"  →  ['heat island', 'heat-island'].

/** Join an acceptedAnswers array back into the comma-separated input value. */
export function answersToInput(acceptedAnswers: string[]): string {
  return acceptedAnswers.join(', ')
}

/**
 * Parse the teacher's comma-separated input into an acceptedAnswers array.
 * Trims each variant and drops empties. Returns [''] when nothing was typed so
 * the shape always has at least one (empty) slot, matching the seed defaults.
 */
export function inputToAnswers(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return parts.length > 0 ? parts : ['']
}

/** Parse a word-limit text field: blank / non-positive → undefined (no limit). */
export function parseWordLimit(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
