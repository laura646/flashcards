'use client'

// 10B redesign — CALM LESSON BUILDER preview (clickable PROTOTYPE).
//
// 100% ADDITIVE. A NEW, unlinked, auth-gated route that lets Laura see ALL our
// real builders + AI features arranged in the new 3-pane "calm builder" layout
// (outline | edit | preview). It REUSES the real editor brain (useLessonEditor)
// and the real AI brain (useLessonAi) exactly like /admin-beta/lessons, but
// renders CalmBuilderView instead of LessonEditorView. The live editor, the
// live student page, and every shared file are left 100% untouched (imported
// only).
//
// AdminSidebar (the real menu) is supplied by app/admin-beta/layout.tsx, so this
// page renders only the MAIN column. On mount the route SEEDS a sample lesson —
// one of every builder — so every editor + AI door + the live student preview
// are immediately visible without loading real data.
//
// The outline selection (activeIndex) is LIFTED here so the PREVIEW pane —
// LessonLivePreview, mounted in this page — follows the same selected item the
// CalmBuilderView outline highlights.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import CalmBuilderView from '@/components/admin-v2/calm-builder/CalmBuilderView'
import LessonLivePreview from '@/components/admin-v2/calm-builder/LessonLivePreview'
import { useLessonEditor } from '@/lib/lesson-editor/useLessonEditor'
import { useLessonAi } from '@/lib/lesson-editor/useLessonAi'
import type { BlockType, Exercise, Flashcard } from '@/lib/lesson-editor/types'

// ── Sample seed content (so every builder + the live preview show real shape) ──

const SEED_FLASHCARDS: Flashcard[] = [
  { word: 'itinerary', phonetic: 'aɪˈtɪnərəri', meaning: 'A planned route or schedule for a journey.', example: 'Our itinerary includes three cities in five days.', notes: '', order_index: 0 },
  { word: 'layover', phonetic: 'ˈleɪoʊvər', meaning: 'A short stop between flights.', example: 'We had a two-hour layover in Paris.', notes: '', order_index: 1 },
  { word: 'jet lag', phonetic: 'ˈdʒet læɡ', meaning: 'Tiredness after a long flight across time zones.', example: 'I had bad jet lag for two days.', notes: '', order_index: 2 },
]

const SEED_EXERCISE: Exercise = {
  title: 'Travel vocabulary check',
  subtitle: '',
  icon: '🎯',
  instructions: 'Choose the best answer.',
  exercise_type: 'multiple_choice',
  questions: [
    { id: 'q1', prompt: 'A short stop between two flights is a …', options: ['layover', 'itinerary', 'jet lag'], correctIndex: 0, hint: 'It is about waiting between flights.' },
    { id: 'q2', prompt: 'A planned schedule for a trip is an …', options: ['layover', 'itinerary', 'boarding pass'], correctIndex: 1, hint: 'It lists where you go and when.' },
  ],
  order_index: 0,
}

const SEED_ARTICLE = {
  text: 'Slow travel is a way of exploring a place without rushing. Instead of visiting ten cities in a week, slow travellers stay longer in fewer places. They walk, talk to locals, and learn how people really live. Many say they come home feeling rested rather than tired.',
  source: 'English with Laura — sample passage',
  questions: [],
  exercises: [
    {
      title: 'Reading check',
      subtitle: '',
      icon: '✅',
      instructions: 'True or False?',
      exercise_type: 'true_or_false',
      questions: [
        { id: 'r1', statement: 'Slow travellers visit as many cities as possible.', isTrue: false, explanation: 'They stay longer in fewer places.' },
        { id: 'r2', statement: 'Slow travel can feel restful.', isTrue: true, explanation: 'Many come home feeling rested.' },
      ],
      order_index: 0,
    } as Exercise,
  ],
}

const SEED_VIDEO = {
  youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  questions: [],
  exercises: [],
}

const SEED_AUDIO = {
  audio_url: '',
  exercises: [],
}

const SEED_GRAMMAR = {
  explanation: 'Use the present perfect (have/has + past participle) to talk about experiences without saying exactly when they happened.',
  examples: ['I have been to Spain.', 'She has tried sushi.', 'They have never flown business class.'],
  exercises: [],
}

function BuilderPreviewBody() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const editor = useLessonEditor()

  const ai = useLessonAi({
    appendGeneratedFlashcards: editor.appendGeneratedFlashcards,
    appendGeneratedExercises: editor.appendGeneratedExercises,
    appendGeneratedBlock: editor.appendGeneratedBlock,
    courseId: editor.courseId,
    courseLevel: editor.templateLevel || undefined,
  })

  const [toast, setToast] = useState<string | null>(null)

  // Outline selection — LIFTED here so the preview (mounted below) follows it.
  const [activeIndex, setActiveIndex] = useState(0)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  // Redirect unauthenticated users out (mirrors /admin-beta/lessons).
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  // Start a fresh lesson AND seed one of every builder, exactly once, so the
  // prototype is immediately full of real content (all builders + AI doors live,
  // nothing to load). Seeds via the editor's append* actions (which carry real
  // content) plus addBlock for the empty-by-design media/IELTS shells.
  const seededRef = useRef(false)
  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return
    if (seededRef.current) return
    seededRef.current = true

    editor.startNewLesson()
    editor.setTitle('Sample lesson — every builder')
    // appended in outline order:
    editor.appendGeneratedFlashcards(SEED_FLASHCARDS)        // 0 flashcards
    editor.appendGeneratedExercises([SEED_EXERCISE])         // 1 exercise
    editor.appendGeneratedBlock('article', 'Slow travel', SEED_ARTICLE)   // 2 reading
    editor.appendGeneratedBlock('video', 'Watch & answer', SEED_VIDEO)    // 3 video
    editor.appendGeneratedBlock('audio', 'Listen & answer', SEED_AUDIO)   // 4 audio
    editor.appendGeneratedBlock('grammar', 'Present perfect', SEED_GRAMMAR) // 5 grammar
    // Empty-by-design shells so their builders are also visible:
    editor.addBlock('mistakes')        // 6 error corrections
    editor.addBlock('dialogue')        // 7 AI dialogue
    editor.addBlock('writing')         // 8 writing task
    editor.addBlock('pronunciation')   // 9 pronunciation
    if (process.env.NEXT_PUBLIC_IELTS === '1') {
      editor.addBlock('ielts_reading' as BlockType) // 10 IELTS reading (gated)
    }
    // editor actions are stable (useCallback); excluded intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin])

  // Auto-dismiss the save toast.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  if (status === 'loading') {
    return <div className="min-h-screen bg-surface" />
  }

  if (status === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  if (status !== 'authenticated') {
    return <div className="min-h-screen bg-surface" />
  }

  return (
    <>
      <CalmBuilderView
        title={editor.title}
        lessonType={editor.lessonType}
        contentItems={editor.contentItems}
        isItemPublished={editor.isItemPublished}
        onTitleChange={editor.setTitle}
        onAddFlashcards={editor.addFlashcardsItem}
        onAddExercise={editor.addExercise}
        onAddBlock={editor.addBlock}
        onGenerateFlashcards={ai.generateFlashcards}
        onGenerateExercises={ai.generateExercises}
        onGenerateBlock={ai.generateBlock}
        onGenerateGrammar={ai.generateGrammar}
        onGenerateReading={ai.generateReading}
        onImportGoogleDoc={ai.importGoogleDoc}
        onApplyImport={(result, opts) => {
          if (opts.title && result.suggestedTitle) {
            editor.setTitle(result.suggestedTitle)
          }
          if (opts.summary && result.summary) {
            editor.setSummary(result.summary)
          }
          if (opts.flashcards && result.flashcards.length > 0) {
            editor.appendGeneratedFlashcards(result.flashcards, undefined)
          }
          if (opts.mistakes && result.mistakes.length > 0) {
            editor.appendGeneratedBlock('mistakes', 'Common Mistakes', {
              mistakes: result.mistakes,
            })
          }
        }}
        onAddFromBank={(picked) => {
          editor.appendGeneratedFlashcards(picked.flashcards)
          editor.appendGeneratedExercises(picked.exercises)
          picked.blocks.forEach((b) =>
            editor.appendGeneratedBlock(b.block_type as BlockType, b.title, b.content),
          )
        }}
        onNotify={setToast}
        onFetchCourseVocabulary={ai.fetchCourseVocabulary}
        onGenerateExercisesFromText={ai.generateExercisesFromText}
        onGenerateExercisesFromUpload={ai.generateExercisesFromFiles}
        aiError={ai.aiError}
        onClearAiError={() => ai.setAiError(null)}
        generatingFlashcards={ai.generatingFlashcards}
        generatingExercises={ai.generatingExercises}
        generatingBlock={ai.generatingBlock}
        generatingGrammar={ai.generatingGrammar}
        generatingReading={ai.generatingReading}
        generatingImport={ai.generatingImport}
        generatingVocab={ai.generatingVocab}
        onUpdateItem={editor.updateItemData}
        onMoveItem={editor.moveItem}
        onRemoveItem={editor.removeItem}
        onTogglePublished={editor.togglePublished}
        onToggleFlashcardsPublished={() => editor.setFlashcardsPublished((v) => !v)}
        error={editor.error}
        // Outline selection is controlled here so the PREVIEW pane (below) tracks it.
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        // The PREVIEW pane: render the SELECTED item as a real student.
        previewSlot={<LessonLivePreview items={editor.contentItems} activeIndex={activeIndex} />}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink-black text-white text-sm font-bold px-4 py-2.5 rounded-tile shadow-lg font-rubik"
        >
          {toast}
        </div>
      )}
    </>
  )
}

export default function BuilderPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <BuilderPreviewBody />
    </Suspense>
  )
}
