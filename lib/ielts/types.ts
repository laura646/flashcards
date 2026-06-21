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

/**
 * Type 4 — Matching information.
 * Each statement names the passage paragraph (A, B, C…) that contains it.
 * Paragraphs CAN be reused; some are never used (distractors). Unlike matching
 * headings, there is no one-to-one constraint — the same letter may answer many
 * statements (spec §4: "Allow reuse").
 */
export interface MatchingInformationGroup extends BaseGroup {
  kind: 'matching_information'
  /** The reusable paragraph-letter bank shown in each dropdown (A, B, C…). */
  options: LetteredOption[]
  items: {
    number: number
    /** The statement to locate in the passage. */
    text: string
    /** The correct paragraph letter from `options`. */
    correct: string
  }[]
}

/**
 * Type 6 — Matching features.
 * Each statement is linked to a short lettered "feature" (a person/thing/date/
 * place). Features CAN be reused or stay unused (spec §6: "You may use any
 * letter more than once.").
 */
export interface MatchingFeaturesGroup extends BaseGroup {
  kind: 'matching_features'
  /** The lettered features bank (people/things), reusable across items. */
  features: LetteredOption[]
  items: {
    number: number
    /** The statement to attribute to a feature. */
    text: string
    /** The correct feature id from `features`. */
    correct: string
  }[]
}

/**
 * Type 7 — Matching sentence endings.
 * Numbered sentence beginnings are matched to longer lettered endings. There
 * are MORE endings than beginnings (distractors stay unused) and each ending is
 * used at most ONCE — a one-to-one match like matching headings (spec §7).
 */
export interface MatchingSentenceEndingsGroup extends BaseGroup {
  kind: 'matching_sentence_endings'
  /** The full endings bank, lettered (more endings than beginnings). */
  endings: LetteredOption[]
  items: {
    number: number
    /** The sentence beginning shown on the left. */
    beginning: string
    /** The correct ending id from `endings`. */
    correct: string
  }[]
}

/**
 * Type 11 — Table completion.
 * A grid (rows × cols) where some cells are gaps (typed in) and the rest are
 * read-only labels. `header` is an optional first row rendered as column
 * headings. Each cell is either static text or a gap (accepted answers + word
 * limit, like the other completion types).
 */
export interface TableCompletionGroup extends BaseGroup {
  kind: 'table_completion'
  /** Default word limit for every gap in the table (per-gap can override). */
  wordLimit?: number
  /** Optional column headings rendered as a bold header row. */
  header?: string[]
  /** Body rows, top to bottom; each is a left-to-right list of cells. */
  rows: TableCell[][]
}

/** One table cell: a read-only label, or a typed-in gap. */
export type TableCell =
  | { type: 'text'; text: string }
  | {
      type: 'gap'
      number: number
      acceptedAnswers: string[]
      wordLimit?: number
    }

/**
 * Type 12 — Flow-chart completion.
 * A vertical sequence of connected step boxes (arrow connectors between them),
 * some boxes containing gaps. Two sub-variants (spec §12):
 *   • 'passage'   — type words from the passage into each gap,
 *   • 'word_bank' — choose from a provided box of words (more words than gaps).
 * Each step box is text segments interleaved with gaps, rendered in order.
 */
export interface FlowChartCompletionGroup extends BaseGroup {
  kind: 'flow_chart_completion'
  variant: 'passage' | 'word_bank'
  wordLimit?: number
  /** Provided words (lettered) for the 'word_bank' variant; omit for 'passage'. */
  wordBank?: LetteredOption[]
  /** The step boxes, top to bottom; connected by downward arrows. */
  steps: FlowChartStep[]
}

/** One step box in the flow chart: prose segments interleaved with gaps. */
export interface FlowChartStep {
  segments: FlowChartSegment[]
}

/** One piece of a flow-chart step: either static prose or a gap. */
export type FlowChartSegment =
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
 * Type 13 — Diagram-label completion (AUTHENTIC exam version).
 * A teacher-uploaded diagram image with numbered blanks POSITIONED at points on
 * the image; the learner types the label at each point. `x`/`y` are PERCENTAGES
 * (0–100) of the image width/height, so each label pin positions responsively
 * regardless of the rendered image size. Each label carries accepted-answer
 * variants + an optional per-label word limit (overriding the group default);
 * matching reuses checkAccepted/checkGap — misspelling counts as wrong.
 */
export interface DiagramLabelCompletionGroup extends BaseGroup {
  kind: 'diagram_label_completion'
  /** The uploaded diagram image to label. */
  imageUrl: string
  /** Default word limit for every label in the set (per-label can override). */
  wordLimit?: number
  /** Numbered blanks pinned to the image at (x, y) percentage coordinates. */
  labels: {
    number: number
    /** Horizontal pin position as a percentage (0–100) of image width. */
    x: number
    /** Vertical pin position as a percentage (0–100) of image height. */
    y: number
    acceptedAnswers: string[]
    /** Overrides the group `wordLimit` for this label. */
    wordLimit?: number
  }[]
}

/** The discriminated union of every supported Reading question group. */
export type ReadingQuestionGroup =
  | McqGroup
  | TfngGroup
  | YnngGroup
  | MatchingHeadingsGroup
  | MatchingInformationGroup
  | MatchingFeaturesGroup
  | MatchingSentenceEndingsGroup
  | SentenceCompletionGroup
  | NoteCompletionGroup
  | SummaryCompletionGroup
  | TableCompletionGroup
  | FlowChartCompletionGroup
  | DiagramLabelCompletionGroup
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
