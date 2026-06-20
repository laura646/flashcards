'use client'

// Mock harness for the 10B Lesson editor views (Phase 2).
//
// Renders LessonsListView + LessonEditorView with hardcoded mock data and
// LOCAL state so the editor is actually editable WITHOUT auth or the API. The
// "Editor (with content)" tab now wires the real Phase-2 content actions
// (add / update / move / remove / publish-toggle / collapse) against a
// useState-backed contentItems array, so flashcards + the simple blocks can be
// edited live in the sandbox. Not part of the real app flow — purely a visual
// check page under the existing /student-ui-preview sandbox.

import { useState } from 'react'
import LessonsListView from '@/components/admin-v2/LessonsListView'
import LessonEditorView from '@/components/admin-v2/LessonEditorView'
import {
  type Lesson,
  type ContentItem,
  type Flashcard,
  type Exercise,
  type ContentBlock,
  type BlockType,
  createDefaultContent,
  createDefaultExercise,
} from '@/lib/lesson-editor/types'

const MOCK_LESSONS: Lesson[] = [
  {
    id: 'l1',
    title: 'Week 5 - Travel Vocabulary',
    lesson_date: '2026-06-10',
    summary: 'Airport, hotel and direction words.',
    status: 'published',
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
    flashcard_count: 18,
    exercise_count: 3,
    block_counts: { video: 1, article: 1 },
    lesson_type: 'lesson',
  },
  {
    id: 'l2',
    title: 'Mid-Course Test - Units 1-4',
    lesson_date: '2026-06-15',
    summary: 'Covers grammar and vocab from the first four units.',
    status: 'draft',
    created_at: '2026-06-12T10:00:00Z',
    updated_at: '2026-06-12T10:00:00Z',
    flashcard_count: 0,
    exercise_count: 6,
    block_counts: {},
    lesson_type: 'mid_course_test',
  },
  {
    id: 'l3',
    title: 'Phrasal Verbs Deep Dive',
    lesson_date: '2026-06-18',
    summary: '',
    status: 'draft',
    created_at: '2026-06-17T10:00:00Z',
    updated_at: '2026-06-17T10:00:00Z',
    flashcard_count: 24,
    exercise_count: 2,
    block_counts: { grammar: 1, mistakes: 1, audio: 1 },
    lesson_type: 'lesson',
  },
]

const MOCK_FLASHCARDS: Flashcard[] = [
  { word: 'itinerary', phonetic: '/aɪˈtɪnərəri/', meaning: 'a planned route or journey', example: 'Our itinerary includes three cities.', notes: '', image_url: '', order_index: 0 },
  { word: 'boarding pass', phonetic: '', meaning: 'a document to board a plane', example: '', notes: '', image_url: '', order_index: 1 },
  { word: 'layover', phonetic: '', meaning: 'a short stop between flights', example: '', notes: '', image_url: '', order_index: 2 },
]

const MOCK_EXERCISE: Exercise = {
  title: 'Choose the correct word',
  subtitle: '',
  icon: '🎯',
  instructions: 'Pick the best option for each gap.',
  exercise_type: 'multiple_choice',
  questions: [
    {
      id: 'q1',
      prompt: 'I usually ___ to work by bus.',
      options: ['go', 'goes', 'going'],
      correctIndex: 0,
      hint: 'Present simple, first person.',
      explanation: '"I go" is the present simple form for the first person.',
    },
    {
      id: 'q2',
      prompt: 'She ___ coffee every morning.',
      options: ['drink', 'drinks', 'drinking'],
      correctIndex: 1,
      hint: 'Third person singular.',
    },
  ],
  order_index: 3,
  published: true,
}

const MOCK_WRITING_BLOCK: ContentBlock = {
  block_type: 'writing',
  title: 'Writing: Postcard from abroad',
  content: { prompt: 'Write a postcard to a friend describing your trip.', guidelines: 'Use past tense and at least 3 vocab words.', word_limit: 120 },
  order_index: 1,
  published: true,
}

const MOCK_DIALOGUE_BLOCK: ContentBlock = {
  block_type: 'dialogue',
  title: 'Practice: At the check-in desk',
  content: { scenario: 'You are checking in for an international flight.', target_words: ['boarding pass', 'aisle', 'window seat'], starter_message: 'Good morning! May I see your passport, please?' },
  order_index: 2,
  published: false,
}

// Video block carrying only the LEGACY `questions` array (no `exercises`), so
// the media editor's effective-read migration is exercised in the sandbox:
// it should surface these MCQs as a Multiple Choice attached exercise.
const MOCK_VIDEO_BLOCK: ContentBlock = {
  block_type: 'video',
  title: 'Watch: How airports work',
  content: {
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    questions: [
      { id: 'vq1', prompt: 'What document do you need to board?', options: ['Boarding pass', 'Receipt', 'Map'], correctIndex: 0 },
      { id: 'vq2', prompt: 'Where do you check in luggage?', options: ['Gate', 'Check-in desk', 'Runway'], correctIndex: 1 },
    ],
  },
  order_index: 3,
  published: true,
}

const MOCK_ARTICLE_BLOCK: ContentBlock = {
  block_type: 'article',
  title: 'Reading: The history of flight',
  content: {
    text: 'The first powered flight took place in 1903 when the Wright brothers flew their aircraft in North Carolina...',
    source: 'Aviation Weekly',
    questions: [],
  },
  order_index: 4,
  published: true,
}

// Grammar block carrying only the LEGACY `exercises` MCQ array (no
// `practice_exercises`), so the grammar editor's practice migration is
// exercised in the sandbox: it should surface these MCQs as a Multiple Choice
// attached exercise. Also includes a couple of examples, a target structure
// and two pitfalls to exercise the always-rendered Pitfalls section.
const MOCK_GRAMMAR_BLOCK: ContentBlock = {
  block_type: 'grammar',
  title: 'Grammar: Present Perfect vs. Past Simple',
  content: {
    explanation: 'Use the present perfect for experiences and unfinished time; use the past simple for finished actions at a specific past time.',
    examples: ['I have visited Paris three times.', 'I visited Paris in 2019.'],
    target_structure: 'have / has + past participle',
    exercises: [
      { id: 'gq1', prompt: 'I ___ my homework already.', options: ['have finished', 'finished', 'finishing'], correctIndex: 0 },
      { id: 'gq2', prompt: 'She ___ to London last summer.', options: ['has gone', 'went', 'goes'], correctIndex: 1 },
    ],
    pitfalls: [
      { mistake: 'I have went to the shop.', correct: 'I have gone to the shop.', tip: 'Use the past participle "gone", not the past simple "went", after "have".' },
      { mistake: 'I have seen him yesterday.', correct: 'I saw him yesterday.', tip: 'Use the past simple with a finished time like "yesterday".' },
    ],
  },
  order_index: 5,
  published: true,
}

const INITIAL_ITEMS: ContentItem[] = [
  { type: 'flashcards', data: MOCK_FLASHCARDS, collapsed: false, order_index: 0 },
  { type: 'writing', data: MOCK_WRITING_BLOCK, collapsed: false, order_index: 1 },
  { type: 'dialogue', data: MOCK_DIALOGUE_BLOCK, collapsed: true, order_index: 2 },
  { type: 'video', data: MOCK_VIDEO_BLOCK, collapsed: false, order_index: 3 },
  { type: 'article', data: MOCK_ARTICLE_BLOCK, collapsed: true, order_index: 4 },
  { type: 'grammar', data: MOCK_GRAMMAR_BLOCK, collapsed: false, order_index: 5 },
  { type: 'exercise', data: MOCK_EXERCISE, collapsed: true, order_index: 6 },
]

export default function LessonEditorV2Preview() {
  const [tab, setTab] = useState<'list' | 'editor' | 'empty'>('editor')
  const [query, setQuery] = useState('')

  // Editor mock state (so fields are actually interactive in the preview).
  const [title, setTitle] = useState('Week 5 - Travel Vocabulary')
  const [lessonDate, setLessonDate] = useState('2026-06-10')
  const [lessonType, setLessonType] = useState('lesson')
  const [summary, setSummary] = useState('Airport, hotel and direction words.')

  // Live content state — mirrors the hook's contentItems + flashcardsPublished.
  const [contentItems, setContentItems] = useState<ContentItem[]>(INITIAL_ITEMS)
  const [flashcardsPublished, setFlashcardsPublished] = useState(true)

  // Stub actions mirroring the useLessonEditor contract (local-only versions).
  const isItemPublished = (item: ContentItem): boolean => {
    if (item.type === 'flashcards') return flashcardsPublished
    if (item.type === 'exercise') return (item.data as Exercise).published !== false
    return (item.data as ContentBlock).published !== false
  }

  const addFlashcards = () => {
    setContentItems((prev) => {
      if (prev.find((i) => i.type === 'flashcards')) return prev
      return [...prev, { type: 'flashcards', data: [] as Flashcard[], collapsed: false, order_index: prev.length }]
    })
  }

  const addExercise = () => {
    setContentItems((prev) => {
      const len = prev.length
      return [...prev, { type: 'exercise', data: createDefaultExercise(len), collapsed: false, order_index: len }]
    })
  }

  const addBlock = (type: BlockType) => {
    setContentItems((prev) => {
      const len = prev.length
      const block: ContentBlock = { block_type: type, title: '', content: createDefaultContent(type), order_index: len, published: true }
      return [...prev, { type, data: block, collapsed: false, order_index: len }]
    })
  }

  const updateItem = (index: number, data: ContentItem['data']) => {
    setContentItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], data }
      return next
    })
  }

  const moveItem = (index: number, dir: 'up' | 'down') => {
    setContentItems((prev) => {
      const newIndex = dir === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[newIndex]
      next[newIndex] = tmp
      return next.map((it, i) => ({ ...it, order_index: i }))
    })
  }

  const removeItem = (index: number) => {
    setContentItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, order_index: i })))
  }

  const togglePublished = (index: number) => {
    setContentItems((prev) => {
      const next = [...prev]
      const item = next[index]
      if (item.type === 'flashcards') return prev
      if (item.type === 'exercise') {
        const ex = item.data as Exercise
        next[index] = { ...item, data: { ...ex, published: ex.published === false } }
      } else {
        const b = item.data as ContentBlock
        next[index] = { ...item, data: { ...b, published: b.published === false } }
      }
      return next
    })
  }

  const toggleCollapse = (index: number) => {
    setContentItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], collapsed: !next[index].collapsed }
      return next
    })
  }

  return (
    <div className="font-rubik">
      {/* Harness switcher */}
      <div className="sticky top-0 z-50 bg-white border-b border-hairline px-4 py-2 flex gap-2">
        {(['list', 'editor', 'empty'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              tab === t ? 'bg-sky text-white' : 'bg-sky-wash text-ink-body'
            }`}
          >
            {t === 'list' ? 'List' : t === 'editor' ? 'Editor (with content)' : 'Editor (empty)'}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <LessonsListView
          lessons={MOCK_LESSONS}
          loading={false}
          query={query}
          onQueryChange={setQuery}
          onOpenLesson={(id) => console.log('open lesson', id)}
          onNewLesson={() => console.log('new lesson')}
        />
      )}

      {tab === 'editor' && (
        <LessonEditorView
          title={title}
          lessonDate={lessonDate}
          lessonType={lessonType}
          summary={summary}
          onTitleChange={setTitle}
          onDateChange={setLessonDate}
          onTypeChange={setLessonType}
          onSummaryChange={setSummary}
          currentLessonStatus="published"
          editingLessonId="l1"
          editingAuthorName="Laura"
          editingCreatedAt="2026-06-01T10:00:00Z"
          contentItems={contentItems}
          isItemPublished={isItemPublished}
          flashcardsPublished={flashcardsPublished}
          saving={false}
          publishing={false}
          error={null}
          onSave={(s) => console.log('save', s)}
          onBack={() => setTab('list')}
          onAddFlashcards={addFlashcards}
          onAddExercise={addExercise}
          onAddBlock={addBlock}
          onUpdateItem={updateItem}
          onMoveItem={moveItem}
          onRemoveItem={removeItem}
          onTogglePublished={togglePublished}
          onToggleFlashcardsPublished={() => setFlashcardsPublished((v) => !v)}
          onToggleCollapse={toggleCollapse}
        />
      )}

      {tab === 'empty' && (
        <LessonEditorView
          title=""
          lessonDate="2026-06-20"
          lessonType="lesson"
          summary=""
          onTitleChange={() => {}}
          onDateChange={() => {}}
          onTypeChange={() => {}}
          onSummaryChange={() => {}}
          currentLessonStatus="draft"
          editingLessonId={null}
          editingAuthorName={null}
          editingCreatedAt={null}
          contentItems={[]}
          isItemPublished={() => true}
          flashcardsPublished={true}
          saving={false}
          publishing={false}
          error="Please enter a lesson title"
          onSave={(s) => console.log('save', s)}
          onBack={() => setTab('list')}
          onAddFlashcards={() => console.log('add flashcards')}
          onAddExercise={() => console.log('add exercise')}
          onAddBlock={(t) => console.log('add block', t)}
          onUpdateItem={(i, d) => console.log('update', i, d)}
          onMoveItem={(i, dir) => console.log('move', i, dir)}
          onRemoveItem={(i) => console.log('remove', i)}
          onTogglePublished={(i) => console.log('toggle published', i)}
          onToggleFlashcardsPublished={() => console.log('toggle flashcards published')}
          onToggleCollapse={(i) => console.log('toggle collapse', i)}
        />
      )}
    </div>
  )
}
