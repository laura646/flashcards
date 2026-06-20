// ─────────────────────────────────────────────────────────────────────────────
// IELTS Reading — data-shape interfaces (plain-JSON storable)
//
// ADDITIVE foundation module. NOT imported by any live file yet.
//
// These describe a single IELTS Reading exercise. They are designed to be
// stored verbatim inside the existing `lesson_exercises.questions` JSON column
// (see lib/lesson-editor/types.ts → Exercise.questions: any), so EVERY shape
// here must be plain JSON: no functions, no class instances, no undefined-only
// fields that must round-trip. Optional fields are fine (they serialise away).
//
// Authoritative per-type rules: `IELTS spec/ielts-reading-14-types-build-spec.md`.
//
// Scope tonight: the eight Reading types the foundation/Runners stage covers —
//   mcq, tfng, ynng, matching_headings, sentence_completion, note_completion,
//   summary_completion, short_answer.
// (table / flow-chart / diagram / matching-info / matching-features /
//  sentence-endings are container-shaped or letter-match variants and come in a
//  later stage; the union below is the additive subset agreed for this stage.)
// ─────────────────────────────────────────────────────────────────────────────

// ── Passage ──────────────────────────────────────────────────────────────────

/** One paragraph of the reading passage. `label` is the margin letter (A, B…). */
export interface ReadingParagraph {
  /** Margin label shown when the question set needs paragraph references. */
  label?: string
  text: string
}

export interface ReadingPassage {
  title?: string
  paragraphs: ReadingParagraph[]
}

// ── Shared building blocks ─────────────────────────────────────────────────────

/** Three-value label sets for the TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN types. */
export type TfngValue = 'TRUE' | 'FALSE' | 'NOT GIVEN'
export type YnngValue = 'YES' | 'NO' | 'NOT GIVEN'

/** A lettered option, used by MCQ and word/heading banks. `id` is the letter (A, B…). */
export interface LetteredOption {
  id: string
  text: string
}

// ── Question groups (discriminated union, keyed by `kind`) ──────────────────────

/** Fields every group shares. Each group renders one grey instruction line. */
interface BaseGroup {
  /** Stable id for React keys / answer maps. */
  id: string
  /** The grey instruction line shown above this set (spec: "instruction line"). */
  instruction: string
}

/**
 * Type 1 — Multiple choice.
 * Single-select (pick one letter) OR multi-select with a fixed required count
 * ("Choose TWO letters, A–E"). `selectCount` defaults to 1.
 */
export interface McqGroup extends BaseGroup {
  kind: 'mcq'
  questions: {
    /** Question number shown to the learner (1, 2, …). */
    number: number
    stem: string
    options: LetteredOption[]
    /** How many options to choose. 1 = radio; >1 = checkbox set. */
    selectCount?: number
    /** Correct option id(s). One entry for single-select; N for multi. */
    correct: string[]
  }[]
}

/** Type 2 — Identifying information (TRUE / FALSE / NOT GIVEN — facts). */
export interface TfngGroup extends BaseGroup {
  kind: 'tfng'
  statements: {
    number: number
    text: string
    correct: TfngValue
  }[]
}

/** Type 3 — Identifying writer's views/claims (YES / NO / NOT GIVEN — opinions). */
export interface YnngGroup extends BaseGroup {
  kind: 'ynng'
  statements: {
    number: number
    text: string
    correct: YnngValue
  }[]
}

/**
 * Type 5 — Matching headings.
 * A bank of headings (more headings than paragraphs; distractors stay unused),
 * each used at most once. Each item names a passage paragraph to match.
 */
export interface MatchingHeadingsGroup extends BaseGroup {
  kind: 'matching_headings'
  /** The full heading bank, lettered (often roman numerals: i, ii, iii…). */
  headings: LetteredOption[]
  items: {
    number: number
    /** The paragraph label this item refers to (e.g. "A"). Display only. */
    paragraphLabel: string
    /** The correct heading id from `headings`. */
    correct: string
  }[]
}

/**
 * Type 8 — Sentence completion (type words from the passage into a gap).
 * Each item is a sentence template with one gap; `acceptedAnswers` lists every
 * valid variant; `wordLimit` enforces "NO MORE THAN N WORDS".
 */
export interface SentenceCompletionGroup extends BaseGroup {
  kind: 'sentence_completion'
  /** Default word limit for every gap in the set (per-gap can override). */
  wordLimit?: number
  items: {
    number: number
    /** Sentence with the gap marked by "____" (or text before/after the field). */
    before: string
    after?: string
    acceptedAnswers: string[]
    /** Overrides the group `wordLimit` for this gap. */
    wordLimit?: number
  }[]
}

/**
 * Type 10 — Note completion. Like summary completion but in note form
 * (indented blocks under sub-headings rather than prose). Each note line may be
 * a heading line (no gap) or a gapped line.
 */
export interface NoteCompletionGroup extends BaseGroup {
  kind: 'note_completion'
  wordLimit?: number
  /** Optional title for the whole note block (e.g. "The migration process"). */
  title?: string
  lines: {
    /** Sub-heading line with no gap — rendered bold, not an input. */
    heading?: string
    /** Gapped note line. Present when this line has a fill-in field. */
    gap?: {
      number: number
      before: string
      after?: string
      acceptedAnswers: string[]
      wordLimit?: number
    }
  }[]
}

/**
 * Type 9 — Summary completion. Two sub-variants:
 *   • 'passage'  — type words taken from the passage (free text + word limit),
 *   • 'word_bank' — choose from a provided box of words (more words than gaps).
 * The summary is rendered as prose with inline gaps in order.
 */
export interface SummaryCompletionGroup extends BaseGroup {
  kind: 'summary_completion'
  variant: 'passage' | 'word_bank'
  wordLimit?: number
  /** Provided words (lettered) for the 'word_bank' variant; omit for 'passage'. */
  wordBank?: LetteredOption[]
  /**
   * Summary prose split into segments interleaved with gaps. Render `text`
   * segments as static prose and `gap` segments as the input/selector, in order.
   */
  segments: SummarySegment[]
}

/** One piece of a summary: either static prose or a gap. */
export type SummarySegment =
  | { type: 'text'; text: string }
  | {
      type: 'gap'
      number: number
      /** For 'passage' variant: accepted typed answers + optional word limit. */
      acceptedAnswers?: string[]
      wordLimit?: number
      /** For 'word_bank' variant: the correct option id from `wordBank`. */
      correctOptionId?: string
    }

/**
 * Type 14 — Short-answer questions (open who/what/how-many, answered in a few
 * words from the passage). One single-line field per question + word limit.
 */
export interface ShortAnswerGroup extends BaseGroup {
  kind: 'short_answer'
  wordLimit?: number
  questions: {
    number: number
    text: string
    acceptedAnswers: string[]
    wordLimit?: number
  }[]
}

/** The discriminated union of every supported Reading question group. */
export type ReadingQuestionGroup =
  | McqGroup
  | TfngGroup
  | YnngGroup
  | MatchingHeadingsGroup
  | SentenceCompletionGroup
  | NoteCompletionGroup
  | SummaryCompletionGroup
  | ShortAnswerGroup

/** The `kind` discriminant values, for registries / exhaustive switches. */
export type ReadingQuestionKind = ReadingQuestionGroup['kind']

// ── The exercise ──────────────────────────────────────────────────────────────

/**
 * A complete IELTS Reading exercise: one passage + a set-level instruction +
 * one or more question groups. Stored as-is in `lesson_exercises.questions`.
 */
export interface ReadingExercise {
  passage: ReadingPassage
  /** Exercise-level instruction (the groups each carry their own line too). */
  instructions: string
  questionGroups: ReadingQuestionGroup[]
}

// ── Session answer state (in-memory only; not persisted in the preview) ─────────

/**
 * A learner's in-progress answers, keyed by question number (string).
 * Letter types store a single letter; multi-select MCQ stores an array; gap
 * types store the typed/selected string. Held in memory for the session only.
 */
export type ReadingAnswerValue = string | string[]
export type ReadingAnswers = Record<string, ReadingAnswerValue>
