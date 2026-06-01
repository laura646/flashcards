// Maps the friendly course-level names used in CRM ('Beginner',
// 'Intermediate Low', etc.) to the CEFR codes the AI prompts are
// written against. Also returns level-specific guidance text the
// prompts inject — vague "simpler for A1-A2" doesn't move the
// needle; concrete word-count + vocabulary caps do.
//
// Both CEFR codes and friendly names are accepted on input (the
// Reading + Grammar rich forms send CEFR directly; everywhere else
// the value comes from courses.level which is friendly).

const FRIENDLY_TO_CEFR: Record<string, string> = {
  Beginner: 'A1',
  'Elementary Low': 'A1',
  'Elementary High': 'A2',
  'Pre-Intermediate Low': 'A2',
  'Pre-Intermediate High': 'B1',
  'Intermediate Low': 'B1',
  'Intermediate High': 'B1',
  'Upper-Intermediate Low': 'B2',
  'Upper-Intermediate High': 'B2',
  Advanced: 'C1',
}

const CEFR_CODES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * Normalize any level input to a CEFR code. Returns '' if the level
 * is unrecognised so callers can fall through to "no level passed".
 */
export function normalizeCefr(level: unknown): string {
  if (typeof level !== 'string') return ''
  const t = level.trim()
  if (!t) return ''
  if (CEFR_CODES.includes(t.toUpperCase())) return t.toUpperCase()
  return FRIENDLY_TO_CEFR[t] || ''
}

/**
 * Concrete, behavior-shaping guidance per CEFR level. Embed in
 * prompts to override the model's default "neutral" tone. Each line
 * is short on purpose — long instructions get ignored.
 */
export function cefrGuidance(cefr: string): string {
  switch (cefr) {
    case 'A1':
      return `Audience: A1 absolute beginners. Use only the 1000 most common English words. Definitions ≤ 8 words. Example sentences ≤ 8 words, present simple only. Avoid passive voice, relative clauses, idioms. Plain everyday vocabulary — say "pet animal", not "domesticated animal"; say "work" not "occupation".`
    case 'A2':
      return `Audience: A2 elementary. Use the 2000 most common English words. Definitions ≤ 12 words. Example sentences ≤ 10 words, present + past simple, going-to future. Avoid passive voice, perfect tenses, idioms, multi-clause sentences.`
    case 'B1':
      return `Audience: B1 intermediate. Definitions ≤ 18 words, can use light academic register. Examples ≤ 14 words. Use present perfect, conditionals, modals freely. Avoid heavy idiom or specialist vocabulary.`
    case 'B2':
      return `Audience: B2 upper intermediate. Definitions ≤ 25 words. Use nuanced vocabulary, common idioms, passive voice, relative clauses. Avoid only the most academic or literary register.`
    case 'C1':
      return `Audience: C1 advanced. Definitions can be precise and nuanced. Use idiomatic expressions, abstract nouns, complex sentence structure. Show register awareness (formal vs informal).`
    case 'C2':
      return `Audience: C2 proficient. No vocabulary or structural ceiling. Use sophisticated phrasing, subtle register shifts, literary/academic vocabulary where natural.`
    default:
      return ''
  }
}

/**
 * Convenience: take any level input + return the full prompt-ready
 * instruction line (or '' if no usable level). Use this in API
 * actions to inject one block of leveled guidance.
 */
export function levelInstruction(level: unknown): string {
  const cefr = normalizeCefr(level)
  if (!cefr) return ''
  return `Target CEFR level: ${cefr}.\n${cefrGuidance(cefr)}\nStay strictly within this level — both the vocabulary you choose AND the grammar structures you use.`
}
