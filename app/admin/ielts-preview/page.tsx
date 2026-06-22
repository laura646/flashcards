'use client'

// ─────────────────────────────────────────────────────────────────────────────
// IELTS Reading — INTERNAL PREVIEW (showcase route)
//
// ADDITIVE / UNLINKED. This page exists only to demo the eight new IELTS Reading
// student runners built under components/ielts/runners/. It is NOT wired into
// the lesson editor, NOT added to the sidebar, and touches no live file.
//
// Auth: same gate every other /admin/* page uses
//   isAdmin = role === 'superadmin' || role === 'teacher'
// (unauthenticated → redirect to '/'; authenticated non-admin → access denied).
//
// Each section pairs a short shared reading passage (split-screen, independent
// scroll, stacks on mobile) with one question group wired to its Runner, using
// believable inline sample data + accepted answers so every type is fully
// interactive: answer → Check → green/red + "N / M" score → Try again.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { SegmentedControl } from '@/components/student-ui'

import {
  ReadingMcqRunner,
  ReadingTfngRunner,
  ReadingYnngRunner,
  ReadingMatchingHeadingsRunner,
  ReadingMatchingInformationRunner,
  ReadingMatchingFeaturesRunner,
  ReadingMatchingSentenceEndingsRunner,
  ReadingSentenceCompletionRunner,
  ReadingNoteCompletionRunner,
  ReadingSummaryCompletionRunner,
  ReadingTableCompletionRunner,
  ReadingFlowChartCompletionRunner,
  ReadingDiagramLabelRunner,
  ReadingShortAnswerRunner,
} from '@/components/ielts/runners'

import type {
  ReadingPassage,
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
  DiagramLabelCompletionGroup,
  ShortAnswerGroup,
} from '@/lib/ielts/types'

// ════════════════════════════════════════════════════════════════
// Sample passage — shared by every type below (urban bees).
// ════════════════════════════════════════════════════════════════

const PASSAGE: ReadingPassage = {
  title: 'The Hidden Lives of Urban Bees',
  paragraphs: [
    {
      label: 'A',
      text: 'For most of the twentieth century, scientists assumed that bees thrived only in the countryside, among hedgerows, meadows and orchards. Cities, with their concrete, traffic and pollution, were thought to be hostile to pollinators. Recent surveys have overturned this picture. In a number of large European cities, researchers have found that urban areas can support a surprising diversity of wild bees — in some cases more species than the farmland that surrounds them.',
    },
    {
      label: 'B',
      text: 'The explanation lies partly in the nature of modern agriculture. Intensive farming tends to favour a single crop across huge areas, offering bees a brief glut of one type of flower followed by months of scarcity. Cities, by contrast, are a patchwork of gardens, parks, railway embankments and abandoned lots. This variety means that something is almost always in bloom, giving urban bees a steady supply of food across a long season.',
    },
    {
      label: 'C',
      text: 'Temperature also plays a part. Built-up areas trap heat, creating what is known as the urban heat island effect. Cities can be several degrees warmer than the countryside, particularly at night. For bees, this warmth can extend the active season at both ends, allowing them to emerge earlier in spring and to keep foraging later into the autumn.',
    },
    {
      label: 'D',
      text: 'Not every species benefits equally. Honeybees, kept in managed hives, have become fashionable, and the number of urban hives in some cities has risen sharply. Critics warn that too many honeybees may actually crowd out wild bees, competing for the same limited flowers. Conservationists now argue that planting for pollinators — choosing flowers rich in nectar and avoiding pesticides — does more good than simply adding more hives.',
    },
    {
      label: 'E',
      text: 'What ordinary residents do in their own gardens turns out to matter a great deal. A single window box of lavender, a patch of clover left unmown, or a small pond can provide food and water for dozens of insects. Multiplied across thousands of households, these tiny habitats join up into a network that stretches across the whole city, a phenomenon some researchers call the "unintentional nature reserve".',
    },
  ],
}

// ════════════════════════════════════════════════════════════════
// Sample question groups — one per type.
// ════════════════════════════════════════════════════════════════

// Type 1 — Multiple choice (one single-select + one two-answer multi).
const MCQ_GROUP: McqGroup = {
  id: 'demo-mcq',
  kind: 'mcq',
  instruction: 'Choose the correct letter, A, B, C or D.',
  questions: [
    {
      number: 1,
      stem: 'According to the passage, recent surveys of large European cities found that cities can',
      options: [
        { id: 'A', text: 'support fewer bee species than nearby farmland.' },
        { id: 'B', text: 'support more bee species than the farmland around them.' },
        { id: 'C', text: 'support only honeybees kept in managed hives.' },
        { id: 'D', text: 'no longer support any wild bees at all.' },
      ],
      selectCount: 1,
      correct: ['B'],
    },
    {
      number: 2,
      stem: 'Which TWO features of cities does the writer say help wild bees? Choose TWO letters, A–E.',
      options: [
        { id: 'A', text: 'A single crop grown across huge areas' },
        { id: 'B', text: 'A patchwork of varied green spaces' },
        { id: 'C', text: 'Lower night-time temperatures than the countryside' },
        { id: 'D', text: 'Warmth from the urban heat island effect' },
        { id: 'E', text: 'Heavy use of pesticides in public parks' },
      ],
      selectCount: 2,
      correct: ['B', 'D'],
    },
  ],
}

// Type 2 — TRUE / FALSE / NOT GIVEN (facts).
const TFNG_GROUP: TfngGroup = {
  id: 'demo-tfng',
  kind: 'tfng',
  instruction:
    'Do the following statements agree with the information in the passage? Write TRUE, FALSE or NOT GIVEN.',
  statements: [
    {
      number: 3,
      text: 'Throughout the twentieth century, scientists believed cities were good places for bees.',
      correct: 'FALSE',
    },
    {
      number: 4,
      text: 'Intensive farming can leave bees with little food for months at a time.',
      correct: 'TRUE',
    },
    {
      number: 5,
      text: 'Cities in Asia were included in the European surveys mentioned in the passage.',
      correct: 'NOT GIVEN',
    },
  ],
}

// Type 3 — YES / NO / NOT GIVEN (writer's views).
const YNNG_GROUP: YnngGroup = {
  id: 'demo-ynng',
  kind: 'ynng',
  instruction:
    "Do the following statements agree with the claims of the writer? Write YES, NO or NOT GIVEN.",
  statements: [
    {
      number: 6,
      text: 'Adding more honeybee hives is the best way to help urban pollinators.',
      correct: 'NO',
    },
    {
      number: 7,
      text: 'The choices residents make in their own gardens have a meaningful effect.',
      correct: 'YES',
    },
    {
      number: 8,
      text: 'Lavender is the single most useful plant for city bees.',
      correct: 'NOT GIVEN',
    },
  ],
}

// Type 5 — Matching headings (more headings than paragraphs; distractors stay).
const MATCHING_HEADINGS_GROUP: MatchingHeadingsGroup = {
  id: 'demo-matching-headings',
  kind: 'matching_headings',
  instruction:
    'The passage has five paragraphs, A–E. Choose the correct heading for each paragraph from the list of headings below.',
  headings: [
    { id: 'i', text: 'How small private spaces add up' },
    { id: 'ii', text: 'A surprising reversal of an old belief' },
    { id: 'iii', text: 'The cost of city living for bees' },
    { id: 'iv', text: 'Warmth that lengthens the working year' },
    { id: 'v', text: 'Why variety beats a single crop' },
    { id: 'vi', text: 'When more hives is not the answer' },
    { id: 'vii', text: 'The history of professional beekeeping' },
  ],
  items: [
    { number: 9, paragraphLabel: 'A', correct: 'ii' },
    { number: 10, paragraphLabel: 'B', correct: 'v' },
    { number: 11, paragraphLabel: 'C', correct: 'iv' },
    { number: 12, paragraphLabel: 'D', correct: 'vi' },
    { number: 13, paragraphLabel: 'E', correct: 'i' },
  ],
}

// Type 4 — Matching information (paragraph letters; reusable, some unused).
const MATCHING_INFORMATION_GROUP: MatchingInformationGroup = {
  id: 'demo-matching-information',
  kind: 'matching_information',
  instruction:
    'Which paragraph contains the following information? Write the correct letter, A–E. You may use any letter more than once.',
  options: [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
    { id: 'E', text: '' },
  ],
  items: [
    { number: 14, text: 'a comparison between intensive farming and the variety found in cities', correct: 'B' },
    { number: 15, text: 'a warning that one type of bee may crowd out others', correct: 'D' },
    { number: 16, text: 'an example of a small feature a resident can add to a garden', correct: 'E' },
    { number: 17, text: 'a reference to bees being active for longer because of warmth', correct: 'C' },
  ],
}

// Type 6 — Matching features (statements → short lettered people; reusable).
const MATCHING_FEATURES_GROUP: MatchingFeaturesGroup = {
  id: 'demo-matching-features',
  kind: 'matching_features',
  instruction:
    'Match each statement with the correct group, A–C. You may use any letter more than once.',
  features: [
    { id: 'A', text: 'Researchers' },
    { id: 'B', text: 'Critics' },
    { id: 'C', text: 'Conservationists' },
  ],
  items: [
    { number: 18, text: 'warn that too many urban hives may harm wild bees', correct: 'B' },
    { number: 19, text: 'recommend planting nectar-rich flowers over adding hives', correct: 'C' },
    { number: 20, text: 'call the joined-up garden habitats an "unintentional nature reserve"', correct: 'A' },
  ],
}

// Type 7 — Matching sentence endings (beginnings → longer endings; one-to-one,
// more endings than beginnings so some stay unused).
const MATCHING_SENTENCE_ENDINGS_GROUP: MatchingSentenceEndingsGroup = {
  id: 'demo-matching-sentence-endings',
  kind: 'matching_sentence_endings',
  instruction: 'Complete each sentence with the correct ending, A–E.',
  endings: [
    { id: 'A', text: 'because something is almost always in bloom across a long season.' },
    { id: 'B', text: 'so bees can emerge earlier in spring and forage later into autumn.' },
    { id: 'C', text: 'because cities have no flowers at all for most of the year.' },
    { id: 'D', text: 'which can compete with wild bees for the same limited flowers.' },
    { id: 'E', text: 'that together form a network stretching across the whole city.' },
  ],
  items: [
    { number: 21, beginning: 'The patchwork of green spaces in cities helps bees', correct: 'A' },
    { number: 22, beginning: 'The urban heat island effect extends the active season', correct: 'B' },
    { number: 23, beginning: 'A sharp rise in managed honeybee hives creates pressure', correct: 'D' },
    { number: 24, beginning: 'Thousands of tiny private habitats join up', correct: 'E' },
  ],
}

// Type 8 — Sentence completion (type words from the passage).
const SENTENCE_COMPLETION_GROUP: SentenceCompletionGroup = {
  id: 'demo-sentence-completion',
  kind: 'sentence_completion',
  instruction: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  wordLimit: 2,
  items: [
    {
      number: 14,
      before: 'Built-up areas trap heat, producing what is called the urban',
      after: 'effect.',
      acceptedAnswers: ['heat island', 'heat-island'],
    },
    {
      number: 15,
      before: 'In some cities, the number of urban',
      after: 'has risen sharply.',
      acceptedAnswers: ['hives'],
    },
  ],
}

// Type 10 — Note completion (indented note block with gapped lines).
const NOTE_COMPLETION_GROUP: NoteCompletionGroup = {
  id: 'demo-note-completion',
  kind: 'note_completion',
  instruction: 'Complete the notes below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  wordLimit: 2,
  title: 'Why cities suit wild bees',
  lines: [
    { heading: 'Food supply' },
    {
      gap: {
        number: 16,
        before: 'Cities are a',
        after: 'of gardens, parks and embankments',
        acceptedAnswers: ['patchwork'],
      },
    },
    {
      gap: {
        number: 17,
        before: 'Something is almost always in',
        after: 'across a long season',
        acceptedAnswers: ['bloom'],
      },
    },
    { heading: 'Climate' },
    {
      gap: {
        number: 18,
        before: 'Warmth lets bees emerge earlier in',
        after: '',
        acceptedAnswers: ['spring'],
      },
    },
  ],
}

// Type 9 — Summary completion, word-bank variant (choose from a box of words).
const SUMMARY_WORD_BANK_GROUP: SummaryCompletionGroup = {
  id: 'demo-summary-word-bank',
  kind: 'summary_completion',
  variant: 'word_bank',
  instruction: 'Complete the summary using the list of words, A–F, below.',
  wordBank: [
    { id: 'A', text: 'countryside' },
    { id: 'B', text: 'diversity' },
    { id: 'C', text: 'pesticides' },
    { id: 'D', text: 'water' },
    { id: 'E', text: 'farmland' },
    { id: 'F', text: 'traffic' },
  ],
  segments: [
    { type: 'text', text: 'Cities were once thought hostile to bees, but they can support a real ' },
    { type: 'gap', number: 19, correctOptionId: 'B' },
    { type: 'text', text: ' of species. To help them, conservationists suggest planting nectar-rich flowers and avoiding ' },
    { type: 'gap', number: 20, correctOptionId: 'C' },
    { type: 'text', text: '. Even a small pond offers food and ' },
    { type: 'gap', number: 21, correctOptionId: 'D' },
    { type: 'text', text: ' to dozens of insects.' },
  ],
}

// Type 11 — Table completion (read-only label cells + typed-in gap cells).
const TABLE_COMPLETION_GROUP: TableCompletionGroup = {
  id: 'demo-table-completion',
  kind: 'table_completion',
  instruction: 'Complete the table below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  wordLimit: 2,
  header: ['Factor', 'How it helps urban bees'],
  rows: [
    [
      { type: 'text', text: 'Food supply' },
      {
        type: 'gap',
        number: 25,
        acceptedAnswers: ['patchwork'],
      },
    ],
    [
      { type: 'text', text: 'Temperature' },
      {
        type: 'gap',
        number: 26,
        acceptedAnswers: ['heat island', 'urban heat island', 'heat-island'],
      },
    ],
    [
      {
        type: 'gap',
        number: 27,
        acceptedAnswers: ['residents', 'ordinary residents'],
      },
      { type: 'text', text: 'add window boxes, clover patches and small ponds' },
    ],
  ],
}

// Type 12 — Flow-chart completion (vertical step boxes; passage type-in variant).
const FLOW_CHART_COMPLETION_GROUP: FlowChartCompletionGroup = {
  id: 'demo-flow-chart-completion',
  kind: 'flow_chart_completion',
  variant: 'passage',
  instruction: 'Complete the flow-chart below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  wordLimit: 2,
  steps: [
    {
      segments: [
        { type: 'text', text: 'Cities provide a' },
        { type: 'gap', number: 28, acceptedAnswers: ['patchwork'] },
        { type: 'text', text: 'of green spaces.' },
      ],
    },
    {
      segments: [
        { type: 'text', text: 'Something is almost always in' },
        { type: 'gap', number: 29, acceptedAnswers: ['bloom'] },
        { type: 'text', text: ', giving a steady food supply.' },
      ],
    },
    {
      segments: [
        { type: 'text', text: 'Warmth extends the active' },
        { type: 'gap', number: 30, acceptedAnswers: ['season'] },
        { type: 'text', text: 'at both ends of the year.' },
      ],
    },
  ],
}

// Type 14 — Short-answer questions (open, a few words from the passage).
const SHORT_ANSWER_GROUP: ShortAnswerGroup = {
  id: 'demo-short-answer',
  kind: 'short_answer',
  instruction:
    'Answer the questions below. Choose NO MORE THAN THREE WORDS from the passage for each answer.',
  wordLimit: 3,
  questions: [
    {
      number: 22,
      text: 'What effect makes cities several degrees warmer than the countryside?',
      acceptedAnswers: ['urban heat island', 'the urban heat island', 'heat island effect', 'urban heat island effect'],
      wordLimit: 3,
    },
    {
      number: 23,
      text: 'What phrase do some researchers use for the network of tiny garden habitats?',
      acceptedAnswers: ['unintentional nature reserve', 'an unintentional nature reserve'],
      wordLimit: 3,
    },
  ],
}

// Type 13 — Diagram label completion (AUTHENTIC: pinned blanks on an image).
// Standalone (no reading passage): the diagram itself is the source. The image
// is a public domain water-cycle diagram from Wikimedia Commons, loaded over a
// plain <img> tag (no next/image domain allowlist needed). Pin x/y are PERCENT
// of the image box, hand-placed over the relevant parts of the diagram.
const DIAGRAM_LABEL_GROUP: DiagramLabelCompletionGroup = {
  id: 'demo-diagram-label',
  kind: 'diagram_label_completion',
  instruction:
    'Label the diagram below. Write ONE WORD ONLY for each answer.',
  imageUrl:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Water_cycle_blank.svg/640px-Water_cycle_blank.svg.png',
  wordLimit: 1,
  labels: [
    {
      number: 1,
      x: 30,
      y: 18,
      acceptedAnswers: ['evaporation', 'evaporate'],
    },
    {
      number: 2,
      x: 58,
      y: 22,
      acceptedAnswers: ['condensation', 'condense'],
    },
    {
      number: 3,
      x: 70,
      y: 55,
      acceptedAnswers: ['precipitation', 'rain', 'rainfall'],
    },
    {
      number: 4,
      x: 40,
      y: 80,
      acceptedAnswers: ['collection', 'runoff', 'run-off'],
    },
  ],
}

// ════════════════════════════════════════════════════════════════
// Section descriptor — drives both the jump-list and the rendering.
// ════════════════════════════════════════════════════════════════

interface DemoSection {
  anchor: string
  /** Short label for the jump SegmentedControl. */
  short: string
  /** Full type name shown as the section heading. */
  title: string
  /** Whether to show the passage split-screen beside this runner. */
  withPassage: boolean
  render: () => React.ReactNode
}

const SECTIONS: DemoSection[] = [
  {
    anchor: 'mcq',
    short: 'MCQ',
    title: 'Type 1 — Multiple choice',
    withPassage: true,
    render: () => <ReadingMcqRunner group={MCQ_GROUP} />,
  },
  {
    anchor: 'tfng',
    short: 'T/F/NG',
    title: 'Type 2 — True / False / Not Given',
    withPassage: true,
    render: () => <ReadingTfngRunner group={TFNG_GROUP} />,
  },
  {
    anchor: 'ynng',
    short: 'Y/N/NG',
    title: "Type 3 — Yes / No / Not Given",
    withPassage: true,
    render: () => <ReadingYnngRunner group={YNNG_GROUP} />,
  },
  {
    anchor: 'matching-headings',
    short: 'Headings',
    title: 'Type 5 — Matching headings',
    withPassage: true,
    render: () => <ReadingMatchingHeadingsRunner group={MATCHING_HEADINGS_GROUP} />,
  },
  {
    anchor: 'matching-information',
    short: 'Match info',
    title: 'Type 4 — Matching information',
    withPassage: true,
    render: () => <ReadingMatchingInformationRunner group={MATCHING_INFORMATION_GROUP} />,
  },
  {
    anchor: 'matching-features',
    short: 'Features',
    title: 'Type 6 — Matching features',
    withPassage: true,
    render: () => <ReadingMatchingFeaturesRunner group={MATCHING_FEATURES_GROUP} />,
  },
  {
    anchor: 'matching-sentence-endings',
    short: 'Endings',
    title: 'Type 7 — Matching sentence endings',
    withPassage: true,
    render: () => (
      <ReadingMatchingSentenceEndingsRunner group={MATCHING_SENTENCE_ENDINGS_GROUP} />
    ),
  },
  {
    anchor: 'sentence-completion',
    short: 'Sentences',
    title: 'Type 8 — Sentence completion',
    withPassage: true,
    render: () => <ReadingSentenceCompletionRunner group={SENTENCE_COMPLETION_GROUP} />,
  },
  {
    anchor: 'note-completion',
    short: 'Notes',
    title: 'Type 10 — Note completion',
    withPassage: true,
    render: () => <ReadingNoteCompletionRunner group={NOTE_COMPLETION_GROUP} />,
  },
  {
    anchor: 'summary-completion',
    short: 'Summary',
    title: 'Type 9 — Summary completion (word bank)',
    withPassage: true,
    render: () => <ReadingSummaryCompletionRunner group={SUMMARY_WORD_BANK_GROUP} />,
  },
  {
    anchor: 'table-completion',
    short: 'Table',
    title: 'Type 11 — Table completion',
    withPassage: true,
    render: () => <ReadingTableCompletionRunner group={TABLE_COMPLETION_GROUP} />,
  },
  {
    anchor: 'flow-chart-completion',
    short: 'Flow chart',
    title: 'Type 12 — Flow-chart completion',
    withPassage: true,
    render: () => <ReadingFlowChartCompletionRunner group={FLOW_CHART_COMPLETION_GROUP} />,
  },
  {
    anchor: 'diagram-label',
    short: 'Diagram',
    title: 'Type 13 — Diagram label completion',
    withPassage: false,
    render: () => <ReadingDiagramLabelRunner group={DIAGRAM_LABEL_GROUP} />,
  },
  {
    anchor: 'short-answer',
    short: 'Short ans.',
    title: 'Type 14 — Short-answer questions',
    withPassage: true,
    render: () => <ReadingShortAnswerRunner group={SHORT_ANSWER_GROUP} />,
  },
]

// ════════════════════════════════════════════════════════════════
// Passage panel (left/top column of the split-screen).
// ════════════════════════════════════════════════════════════════

function PassagePanel() {
  return (
    <aside className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="bg-white rounded-card border border-hairline p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky mb-2">
          Reading passage
        </p>
        {PASSAGE.title && (
          <h3 className="text-[17px] font-extrabold text-brandblue mb-3 leading-snug">
            {PASSAGE.title}
          </h3>
        )}
        <div className="space-y-3">
          {PASSAGE.paragraphs.map((p) => (
            <p key={p.label ?? p.text.slice(0, 8)} className="text-[13.5px] leading-relaxed text-ink-body">
              {p.label && (
                <span className="inline-block font-extrabold text-sky mr-1.5">{p.label}</span>
              )}
              {p.text}
            </p>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ════════════════════════════════════════════════════════════════
// Page
// ════════════════════════════════════════════════════════════════

export default function IeltsPreviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [active, setActive] = useState<string>(SECTIONS[0].anchor)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const isAdmin =
    session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  const segments = useMemo(
    () => SECTIONS.map((s) => ({ value: s.anchor, label: s.short })),
    [],
  )

  const jumpTo = (anchor: string) => {
    setActive(anchor)
    sectionRefs.current[anchor]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (status === 'loading') {
    return (
      <div className="font-rubik p-8 text-sm text-ink-muted">Loading…</div>
    )
  }

  if (status === 'authenticated' && !isAdmin) {
    return (
      <div className="font-rubik p-8 text-sm text-incorrect-fg">
        Access denied — admin or teacher only.
      </div>
    )
  }

  if (status !== 'authenticated') {
    // unauthenticated → redirect already fired; render nothing meaningful.
    return null
  }

  return (
    <div className="font-rubik min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-5">
          <h1 className="text-[22px] font-extrabold text-brandblue leading-tight">
            IELTS Reading — preview
          </h1>
          <p className="text-[13px] text-ink-muted mt-1">
            Internal preview of the new IELTS Reading question types. Not yet wired into the
            lesson editor.
          </p>
        </header>

        {/* Jump list */}
        <div className="mb-6 overflow-x-auto -mx-1 px-1 pb-1">
          <SegmentedControl
            segments={segments}
            value={active}
            onChange={jumpTo}
            className="flex-nowrap"
          />
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <section
              key={section.anchor}
              id={section.anchor}
              ref={(el) => {
                sectionRefs.current[section.anchor] = el
              }}
              className="scroll-mt-4"
            >
              <h2 className="text-[15px] font-extrabold text-ink-black mb-3">
                {section.title}
              </h2>

              {section.withPassage ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  <PassagePanel />
                  <div className="bg-white rounded-card border border-hairline p-5">
                    {section.render()}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-card border border-hairline p-5">
                  {section.render()}
                </div>
              )}
            </section>
          ))}
        </div>

        <p className="text-[12px] text-ink-muted mt-10 text-center">
          Preview only — answers are session-only and nothing is saved.
        </p>
      </div>
    </div>
  )
}
