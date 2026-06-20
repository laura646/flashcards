'use client'

// Mock harness for the 10B Lesson editor views (Phase 1).
//
// Renders LessonsListView + LessonEditorView with hardcoded mock data and stub
// callbacks, so the presentational pieces are verifiable WITHOUT auth or the
// API. Not part of the real app flow — purely a visual check page that lives
// under the existing /student-ui-preview sandbox.

import { useState } from 'react'
import LessonsListView from '@/components/admin-v2/LessonsListView'
import LessonEditorView from '@/components/admin-v2/LessonEditorView'
import type { Lesson, ContentItem, Flashcard, Exercise, ContentBlock } from '@/lib/lesson-editor/types'

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

const MOCK_FLASHCARDS: Flashcard[] = Array.from({ length: 18 }).map((_, i) => ({
  word: `word ${i + 1}`,
  phonetic: '',
  meaning: '',
  example: '',
  notes: '',
  order_index: i,
}))

const MOCK_EXERCISE: Exercise = {
  title: 'Match the directions',
  subtitle: '',
  icon: '🎯',
  instructions: '',
  exercise_type: 'multiple_choice',
  questions: [],
  order_index: 1,
}

const MOCK_BLOCK: ContentBlock = {
  block_type: 'video',
  title: 'Asking for directions (YouTube)',
  content: { youtube_url: '', questions: [] },
  order_index: 2,
}

const MOCK_ITEMS: ContentItem[] = [
  { type: 'flashcards', data: MOCK_FLASHCARDS, collapsed: true, order_index: 0 },
  { type: 'exercise', data: MOCK_EXERCISE, collapsed: true, order_index: 1 },
  { type: 'video', data: MOCK_BLOCK, collapsed: true, order_index: 2 },
]

export default function LessonEditorV2Preview() {
  const [tab, setTab] = useState<'list' | 'editor' | 'empty'>('list')
  const [query, setQuery] = useState('')

  // Editor mock state (so fields are actually interactive in the preview).
  const [title, setTitle] = useState('Week 5 - Travel Vocabulary')
  const [lessonDate, setLessonDate] = useState('2026-06-10')
  const [lessonType, setLessonType] = useState('lesson')
  const [summary, setSummary] = useState('Airport, hotel and direction words.')

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
          contentItems={MOCK_ITEMS}
          saving={false}
          publishing={false}
          error={null}
          onSave={(s) => console.log('save', s)}
          onBack={() => setTab('list')}
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
          saving={false}
          publishing={false}
          error="Please enter a lesson title"
          onSave={(s) => console.log('save', s)}
          onBack={() => setTab('list')}
        />
      )}
    </div>
  )
}
