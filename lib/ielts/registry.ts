// ─────────────────────────────────────────────────────────────────────────────
// IELTS exercise registry (STANDALONE — not wired into live dispatch)
//
// ADDITIVE foundation module. This documents and tees up the future integration:
// it describes each IELTS Reading type with the same shape the live
// `EXERCISE_TYPES` picker uses (value / label / icon) PLUS the extra metadata an
// IELTS integration needs (group, enabled flag, defaultData factory).
//
// IMPORTANT: NO live file imports this. When the integration stage lands, the
// editor's type picker can merge `IELTS_READING_REGISTRY` (filtered by
// `enabled`) into its options, and the runner dispatch can use
// `value → kind/defaultData`. Nothing here changes live behaviour tonight.
//
// Flag: every entry is gated behind NEXT_PUBLIC_IELTS === "1" so the types stay
// invisible until we deliberately flip the flag in an environment.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ReadingExercise,
  ReadingQuestionGroup,
  ReadingQuestionKind,
} from '@/lib/ielts/types'

/** Read once: are IELTS types enabled in this environment? */
export const IELTS_ENABLED = process.env.NEXT_PUBLIC_IELTS === '1'

export interface IeltsRegistryEntry {
  /** The exercise_type value, namespaced to avoid clashing live types. */
  value: string
  /** The question-group discriminant this type maps to. */
  kind: ReadingQuestionKind
  /** Picker label. */
  label: string
  /** Emoji icon, matching the live picker convention (string icons). */
  icon: string
  /** Registry group for future grouped pickers. Always "ielts" here. */
  group: 'ielts'
  /** Whether this type is offered — gated on the IELTS feature flag. */
  enabled: boolean
  /** Factory returning a blank, valid ReadingExercise for a new instance. */
  defaultData: () => ReadingExercise
}

// ── Default seeds ──────────────────────────────────────────────────────────────
// Each returns a minimal but VALID ReadingExercise (one passage paragraph, one
// instruction, one question group with a single empty question) so a newly
// created exercise round-trips through the JSON editor + a future runner.

const blankPassage = () => ({
  passage: { title: '', paragraphs: [{ label: 'A', text: '' }] },
})

function seed(
  instructions: string,
  group: ReadingQuestionGroup,
): ReadingExercise {
  return { ...blankPassage(), instructions, questionGroups: [group] }
}

const gid = () => `g_${Math.random().toString(36).slice(2, 10)}`

// ── Registry ───────────────────────────────────────────────────────────────────

export const IELTS_READING_REGISTRY: IeltsRegistryEntry[] = [
  {
    value: 'ielts_reading_mcq',
    kind: 'mcq',
    label: 'IELTS Reading — Multiple Choice',
    icon: '🎯',
    group: 'ielts',
    enabled: IELTS_ENABLED,
    defaultData: () =>
      seed('Choose the correct letter, A, B, C or D.', {
        kind: 'mcq',
        id: gid(),
        instruction: 'Choose the correct letter, A, B, C or D.',
        questions: [
          {
            number: 1,
            stem: '',
            options: [
              { id: 'A', text: '' },
              { id: 'B', text: '' },
              { id: 'C', text: '' },
              { id: 'D', text: '' },
            ],
            selectCount: 1,
            correct: [],
          },
        ],
      }),
  },
  {
    value: 'ielts_reading_tfng',
    kind: 'tfng',
    label: 'IELTS Reading — True / False / Not Given',
    icon: '✅',
    group: 'ielts',
    enabled: IELTS_ENABLED,
    defaultData: () =>
      seed(
        'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.',
        {
          kind: 'tfng',
          id: gid(),
          instruction:
            'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.',
          statements: [{ number: 1, text: '', correct: 'TRUE' }],
        },
      ),
  },
  {
    value: 'ielts_reading_ynng',
    kind: 'ynng',
    label: "IELTS Reading — Yes / No / Not Given",
    icon: '🗣️',
    group: 'ielts',
    enabled: IELTS_ENABLED,
    defaultData: () =>
      seed(
        'Do the following statements agree with the claims of the writer? Write YES, NO or NOT GIVEN.',
        {
          kind: 'ynng',
          id: gid(),
          instruction:
            'Do the following statements agree with the claims of the writer? Write YES, NO or NOT GIVEN.',
          statements: [{ number: 1, text: '', correct: 'YES' }],
        },
      ),
  },
  {
    value: 'ielts_reading_matching_headings',
    kind: 'matching_headings',
    label: 'IELTS Reading — Matching Headings',
    icon: '🧩',
    group: 'ielts',
    enabled: IELTS_ENABLED,
    defaultData: () =>
      seed('Choose the correct heading for each paragraph from the list of headings below.', {
        kind: 'matching_headings',
        id: gid(),
        instruction:
          'Choose the correct heading for each paragraph from the list of headings below.',
        headings: [
          { id: 'i', text: '' },
          { id: 'ii', text: '' },
          { id: 'iii', text: '' },
        ],
        items: [{ number: 1, paragraphLabel: 'A', correct: 'i' }],
      }),
  },
  {
    value: 'ielts_reading_sentence_completion',
    kind: 'sentence_completion',
    label: 'IELTS Reading — Sentence Completion',
    icon: '✍️',
    group: 'ielts',
    enabled: IELTS_ENABLED,
    defaultData: () =>
      seed('Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage.', {
        kind: 'sentence_completion',
        id: gid(),
        instruction:
          'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage.',
        wordLimit: 2,
        items: [{ number: 1, before: '', after: '', acceptedAnswers: [''] }],
      }),
  },
  {
    value: 'ielts_reading_note_completion',
    kind: 'note_completion',
    label: 'IELTS Reading — Note Completion',
    icon: '🗒️',
    group: 'ielts',
    enabled: IELTS_ENABLED,
    defaultData: () =>
      seed('Complete the notes below. Choose NO MORE THAN TWO WORDS from the passage.', {
        kind: 'note_completion',
        id: gid(),
        instruction:
          'Complete the notes below. Choose NO MORE THAN TWO WORDS from the passage.',
        wordLimit: 2,
        title: '',
        lines: [
          { heading: '' },
          { gap: { number: 1, before: '', after: '', acceptedAnswers: [''] } },
        ],
      }),
  },
  {
    value: 'ielts_reading_summary_completion',
    kind: 'summary_completion',
    label: 'IELTS Reading — Summary Completion',
    icon: '📝',
    group: 'ielts',
    enabled: IELTS_ENABLED,
    defaultData: () =>
      seed('Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage.', {
        kind: 'summary_completion',
        id: gid(),
        instruction:
          'Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage.',
        variant: 'passage',
        wordLimit: 2,
        segments: [
          { type: 'text', text: '' },
          { type: 'gap', number: 1, acceptedAnswers: [''] },
          { type: 'text', text: '' },
        ],
      }),
  },
  {
    value: 'ielts_reading_short_answer',
    kind: 'short_answer',
    label: 'IELTS Reading — Short-Answer Questions',
    icon: '❓',
    group: 'ielts',
    enabled: IELTS_ENABLED,
    defaultData: () =>
      seed(
        'Answer the questions below. Choose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage.',
        {
          kind: 'short_answer',
          id: gid(),
          instruction:
            'Answer the questions below. Choose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage.',
          wordLimit: 3,
          questions: [{ number: 1, text: '', acceptedAnswers: [''] }],
        },
      ),
  },
]

/** Look up a registry entry by its exercise_type value. */
export function getIeltsEntry(value: string): IeltsRegistryEntry | undefined {
  return IELTS_READING_REGISTRY.find((e) => e.value === value)
}

/** Only the entries enabled in this environment (for a future picker merge). */
export function enabledIeltsEntries(): IeltsRegistryEntry[] {
  return IELTS_READING_REGISTRY.filter((e) => e.enabled)
}
