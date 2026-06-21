// ─────────────────────────────────────────────────────────────────────────────
// IELTS Reading — TEACHER authoring: group-editor registry.
//
// ADDITIVE: not imported by any live file. Maps each question-group `kind` to:
//   • label        — the human name shown in the "+ Add question set" menu and
//                     on the group card header,
//   • defaultGroup — a factory returning a fresh, VALID group of that kind
//                     (seeds one question/statement/item so it round-trips
//                     through the runner immediately),
//   • Editor       — the per-kind authoring component ({ group, onChange }).
//
// Coverage (this stage):
//   FULLY EDITABLE (13 — all kinds):
//     mcq, tfng, ynng, matching_headings, matching_information,
//     matching_features, matching_sentence_endings, sentence_completion,
//     note_completion, summary_completion, table_completion,
//     flow_chart_completion, short_answer
//
// Every kind in the ReadingQuestionGroup union has an entry, so the registry is
// exhaustive and the union is fully covered.
//
// Id generation: `gid()` runs at call time inside the add handler (client-only
// authoring), so a Date.now()/random id is fine here — this is NOT
// workflow-script code.
// ─────────────────────────────────────────────────────────────────────────────

import type { ComponentType } from 'react'

import type {
  ReadingQuestionGroup,
  ReadingQuestionKind,
  McqGroup,
  TfngGroup,
  YnngGroup,
  MatchingHeadingsGroup,
  MatchingInformationGroup,
  MatchingFeaturesGroup,
  MatchingSentenceEndingsGroup,
  SentenceCompletionGroup,
  NoteCompletionGroup,
  SummaryCompletionGroup,
  TableCompletionGroup,
  FlowChartCompletionGroup,
  ShortAnswerGroup,
} from '@/lib/ielts/types'

import McqGroupEditor from './groups/McqGroupEditor'
import TfngGroupEditor from './groups/TfngGroupEditor'
import YnngGroupEditor from './groups/YnngGroupEditor'
import MatchingHeadingsGroupEditor from './groups/MatchingHeadingsGroupEditor'
import MatchingInformationGroupEditor from './groups/MatchingInformationGroupEditor'
import MatchingFeaturesGroupEditor from './groups/MatchingFeaturesGroupEditor'
import MatchingSentenceEndingsGroupEditor from './groups/MatchingSentenceEndingsGroupEditor'
import SentenceCompletionGroupEditor from './groups/SentenceCompletionGroupEditor'
import NoteCompletionGroupEditor from './groups/NoteCompletionGroupEditor'
import SummaryCompletionGroupEditor from './groups/SummaryCompletionGroupEditor'
import TableCompletionGroupEditor from './groups/TableCompletionGroupEditor'
import FlowChartCompletionGroupEditor from './groups/FlowChartCompletionGroupEditor'
import ShortAnswerGroupEditor from './groups/ShortAnswerGroupEditor'

/** A per-kind editor's props: its specific group + a typed onChange. */
export interface GroupEditorProps<G extends ReadingQuestionGroup> {
  group: G
  onChange: (group: G) => void
}

/** One registry entry, generic over the concrete group type for that kind. */
export interface GroupEditorEntry<G extends ReadingQuestionGroup> {
  /** Human label for the add-menu + the group card header. */
  label: string
  /** Whether this kind has a bespoke field editor (false → placeholder). */
  editable: boolean
  /** Factory returning a fresh, valid group of this kind. */
  defaultGroup: () => G
  /** The authoring component for this kind. */
  Editor: ComponentType<GroupEditorProps<G>>
}

/** Client-only authoring id — call-time use is fine (not workflow-script code). */
let counter = 0
const gid = (kind: string) => `g_${kind}_${Date.now()}_${counter++}`

// ── Default-group factories (one valid seed per kind) ──────────────────────────

const defaultMcq = (): McqGroup => ({
  kind: 'mcq',
  id: gid('mcq'),
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
})

const defaultTfng = (): TfngGroup => ({
  kind: 'tfng',
  id: gid('tfng'),
  instruction:
    'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.',
  statements: [{ number: 1, text: '', correct: 'TRUE' }],
})

const defaultYnng = (): YnngGroup => ({
  kind: 'ynng',
  id: gid('ynng'),
  instruction:
    'Do the following statements agree with the claims of the writer? Write YES, NO or NOT GIVEN.',
  statements: [{ number: 1, text: '', correct: 'YES' }],
})

const defaultMatchingHeadings = (): MatchingHeadingsGroup => ({
  kind: 'matching_headings',
  id: gid('matching_headings'),
  instruction:
    'Choose the correct heading for each paragraph from the list of headings below.',
  headings: [
    { id: 'i', text: '' },
    { id: 'ii', text: '' },
    { id: 'iii', text: '' },
  ],
  items: [{ number: 1, paragraphLabel: 'A', correct: '' }],
})

const defaultSentenceCompletion = (): SentenceCompletionGroup => ({
  kind: 'sentence_completion',
  id: gid('sentence_completion'),
  instruction:
    'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  wordLimit: 2,
  items: [{ number: 1, before: '', after: '', acceptedAnswers: [''] }],
})

const defaultNoteCompletion = (): NoteCompletionGroup => ({
  kind: 'note_completion',
  id: gid('note_completion'),
  instruction:
    'Complete the notes below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  wordLimit: 2,
  title: '',
  lines: [
    { heading: '' },
    { gap: { number: 1, before: '', after: '', acceptedAnswers: [''] } },
  ],
})

const defaultShortAnswer = (): ShortAnswerGroup => ({
  kind: 'short_answer',
  id: gid('short_answer'),
  instruction:
    'Answer the questions below. Choose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage.',
  wordLimit: 3,
  questions: [{ number: 1, text: '', acceptedAnswers: [''] }],
})

// ── Stubbed kinds — valid seeds, placeholder editor ────────────────────────────

const defaultMatchingInformation = (): MatchingInformationGroup => ({
  kind: 'matching_information',
  id: gid('matching_information'),
  instruction:
    'Which paragraph contains the following information? Write the correct letter, A–E. You may use any letter more than once.',
  options: [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
  ],
  items: [{ number: 1, text: '', correct: 'A' }],
})

const defaultMatchingFeatures = (): MatchingFeaturesGroup => ({
  kind: 'matching_features',
  id: gid('matching_features'),
  instruction:
    'Match each statement with the correct person, A–C. You may use any letter more than once.',
  features: [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
  ],
  items: [{ number: 1, text: '', correct: 'A' }],
})

const defaultMatchingSentenceEndings = (): MatchingSentenceEndingsGroup => ({
  kind: 'matching_sentence_endings',
  id: gid('matching_sentence_endings'),
  instruction: 'Complete each sentence with the correct ending, A–D.',
  endings: [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
  ],
  items: [{ number: 1, beginning: '', correct: 'A' }],
})

const defaultSummaryCompletion = (): SummaryCompletionGroup => ({
  kind: 'summary_completion',
  id: gid('summary_completion'),
  instruction:
    'Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  variant: 'passage',
  wordLimit: 2,
  segments: [
    { type: 'text', text: '' },
    { type: 'gap', number: 1, acceptedAnswers: [''] },
    { type: 'text', text: '' },
  ],
})

const defaultTableCompletion = (): TableCompletionGroup => ({
  kind: 'table_completion',
  id: gid('table_completion'),
  instruction:
    'Complete the table below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  wordLimit: 2,
  header: ['', ''],
  rows: [
    [
      { type: 'text', text: '' },
      { type: 'gap', number: 1, acceptedAnswers: [''] },
    ],
  ],
})

const defaultFlowChartCompletion = (): FlowChartCompletionGroup => ({
  kind: 'flow_chart_completion',
  id: gid('flow_chart_completion'),
  instruction:
    'Complete the flow-chart below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  variant: 'passage',
  wordLimit: 2,
  steps: [
    {
      segments: [
        { type: 'text', text: '' },
        { type: 'gap', number: 1, acceptedAnswers: [''] },
        { type: 'text', text: '' },
      ],
    },
  ],
})

// ── The registry ───────────────────────────────────────────────────────────────
//
// Typed as a mapped type so each kind's entry is generic over its OWN group
// type — `defaultGroup()` and `Editor` agree on the concrete shape, and the map
// is exhaustive over every ReadingQuestionKind.

type Registry = {
  [K in ReadingQuestionKind]: GroupEditorEntry<
    Extract<ReadingQuestionGroup, { kind: K }>
  >
}

/** Cast helper: a kind-specific editor satisfies the generic entry shape. */
const editorFor = <G extends ReadingQuestionGroup>(
  Comp: ComponentType<GroupEditorProps<G>>,
): ComponentType<GroupEditorProps<G>> => Comp

export const GROUP_EDITOR_REGISTRY: Registry = {
  mcq: {
    label: 'Multiple choice',
    editable: true,
    defaultGroup: defaultMcq,
    Editor: editorFor<McqGroup>(McqGroupEditor),
  },
  tfng: {
    label: 'True / False / Not Given',
    editable: true,
    defaultGroup: defaultTfng,
    Editor: editorFor<TfngGroup>(TfngGroupEditor),
  },
  ynng: {
    label: 'Yes / No / Not Given',
    editable: true,
    defaultGroup: defaultYnng,
    Editor: editorFor<YnngGroup>(YnngGroupEditor),
  },
  matching_headings: {
    label: 'Matching headings',
    editable: true,
    defaultGroup: defaultMatchingHeadings,
    Editor: editorFor<MatchingHeadingsGroup>(MatchingHeadingsGroupEditor),
  },
  sentence_completion: {
    label: 'Sentence completion',
    editable: true,
    defaultGroup: defaultSentenceCompletion,
    Editor: editorFor<SentenceCompletionGroup>(SentenceCompletionGroupEditor),
  },
  note_completion: {
    label: 'Note completion',
    editable: true,
    defaultGroup: defaultNoteCompletion,
    Editor: editorFor<NoteCompletionGroup>(NoteCompletionGroupEditor),
  },
  short_answer: {
    label: 'Short-answer questions',
    editable: true,
    defaultGroup: defaultShortAnswer,
    Editor: editorFor<ShortAnswerGroup>(ShortAnswerGroupEditor),
  },

  matching_information: {
    label: 'Matching information',
    editable: true,
    defaultGroup: defaultMatchingInformation,
    Editor: editorFor<MatchingInformationGroup>(MatchingInformationGroupEditor),
  },
  matching_features: {
    label: 'Matching features',
    editable: true,
    defaultGroup: defaultMatchingFeatures,
    Editor: editorFor<MatchingFeaturesGroup>(MatchingFeaturesGroupEditor),
  },
  matching_sentence_endings: {
    label: 'Matching sentence endings',
    editable: true,
    defaultGroup: defaultMatchingSentenceEndings,
    Editor: editorFor<MatchingSentenceEndingsGroup>(
      MatchingSentenceEndingsGroupEditor,
    ),
  },
  summary_completion: {
    label: 'Summary completion',
    editable: true,
    defaultGroup: defaultSummaryCompletion,
    Editor: editorFor<SummaryCompletionGroup>(SummaryCompletionGroupEditor),
  },
  table_completion: {
    label: 'Table completion',
    editable: true,
    defaultGroup: defaultTableCompletion,
    Editor: editorFor<TableCompletionGroup>(TableCompletionGroupEditor),
  },
  flow_chart_completion: {
    label: 'Flow-chart completion',
    editable: true,
    defaultGroup: defaultFlowChartCompletion,
    Editor: editorFor<FlowChartCompletionGroup>(FlowChartCompletionGroupEditor),
  },
}

/** Ordered list of kinds for the "+ Add question set" menu. */
export const GROUP_EDITOR_KINDS: ReadingQuestionKind[] = [
  'mcq',
  'tfng',
  'ynng',
  'matching_headings',
  'matching_information',
  'matching_features',
  'matching_sentence_endings',
  'sentence_completion',
  'note_completion',
  'summary_completion',
  'table_completion',
  'flow_chart_completion',
  'short_answer',
]

/** Build a fresh, valid group for a kind (used by the "+ Add question set"). */
export function makeDefaultGroup(kind: ReadingQuestionKind): ReadingQuestionGroup {
  return GROUP_EDITOR_REGISTRY[kind].defaultGroup()
}
