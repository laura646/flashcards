// Shared normalisation for typed answers.
//
// Phones and Macs turn a typed ' into a curly ’ (smart punctuation), so a
// student writing "hasn't used" sends "hasn’t used". Comparing raw strings
// marks that wrong even though it is the exact answer the key lists — the
// classic "it didn't record my answer" complaint. Everything typographic is
// folded to its ASCII form before any comparison.
const TYPOGRAPHIC: Record<string, string> = {
  '‘': "'", '’': "'", '‛': "'", 'ʼ': "'",
  '“': '"', '”': '"',
  '–': '-', '—': '-', '−': '-',
  ' ': ' ',
}

/** Fold curly quotes/dashes to ASCII. Keeps the text otherwise intact. */
export function foldTypographic(s: string): string {
  return String(s ?? '').replace(/[‘’‛ʼ“”–—− ]/g, (c) => TYPOGRAPHIC[c] || c)
}

/** trim + lowercase + typographic folding — for exact-match comparisons. */
export function normalizeAnswer(s: string): string {
  return foldTypographic(s).replace(/\s+/g, ' ').trim().toLowerCase()
}

/** normalizeAnswer + drop punctuation — for free-typed sentence answers. */
export function normalizeAnswerLoose(s: string): string {
  return foldTypographic(s)
    .replace(/[.,!?;:'"()\-…]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// ── Matching rules used by the runners (extracted so they can be tested) ──

/** Levenshtein distance (iterative, two-row) — open-mode typo tolerance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/** Open (typed) gap: normalised equality, plus <=1 edit unless requireExact. */
export function openMatches(value: string, answers: string[], requireExact: boolean): boolean {
  const v = normalizeAnswer(value)
  if (!v) return false
  return answers.some((ans) => {
    const a = normalizeAnswer(ans)
    if (v === a) return true
    if (requireExact) return false
    return levenshtein(v, a) <= 1
  })
}

/** Word-bank / dropdown gap: normalised equality against any accepted answer. */
export function pickMatches(value: string | null, answers: string[]): boolean {
  if (value == null) return false
  const v = normalizeAnswer(value)
  return answers.some((ans) => normalizeAnswer(ans) === v)
}

/** Multiple-choice correctness (single- and multi-select). */
export function isChoiceCorrect(
  q: { correctIndex?: number; correctIndices?: number[] },
  ans: number | number[] | null,
): boolean {
  if (ans === null) return false
  if (Array.isArray(q.correctIndices)) {
    if (!Array.isArray(ans)) return false
    const correct = new Set(q.correctIndices)
    if (ans.length !== correct.size) return false
    return ans.every((i) => correct.has(i))
  }
  return typeof ans === 'number' && ans === q.correctIndex
}
