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
