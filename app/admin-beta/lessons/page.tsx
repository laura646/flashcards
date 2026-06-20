'use client'

// 10B redesign — Lesson Manager route (Phase 1, "new beside old").
//
// Same data + auth as the live /admin/lessons (which is left 100% untouched),
// just rendered through the new 10B presentational views + the useLessonEditor
// hook (which ports the LOAD / SAVE data contract byte-for-byte from legacy).
// Lives at a NEW route (/admin-beta/lessons), not linked from the live nav.
//
// Uses useSearchParams so the body is wrapped in <Suspense> per Next.js rules.
// URL contract (mirrors legacy searchParams):
//   ?id=ID                          -> open existing lesson in the editor
//   ?course_id=ID&course_name=NAME  -> start a new lesson for that course
//   ?mode=content-bank              -> start a new content-bank template
//   (none)                          -> the lessons list

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import LessonsListView from '@/components/admin-v2/LessonsListView'
import LessonEditorView from '@/components/admin-v2/LessonEditorView'
import { useLessonEditor } from '@/lib/lesson-editor/useLessonEditor'
import { useLessonAi } from '@/lib/lesson-editor/useLessonAi'
import type { BlockType } from '@/lib/lesson-editor/types'

function LessonsBetaBody() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useSearchParams()

  const editor = useLessonEditor()

  // AI orchestration brain — wired to the editor's insert actions. The course
  // level is not part of the editor's loaded state; the only level the editor
  // knows is templateLevel (content-bank templates), so we pass that as a hint
  // and otherwise let useLessonAi send no level. (Deriving a real course CEFR
  // would require an extra fetch — deferred.)
  const ai = useLessonAi({
    appendGeneratedFlashcards: editor.appendGeneratedFlashcards,
    appendGeneratedExercises: editor.appendGeneratedExercises,
    appendGeneratedBlock: editor.appendGeneratedBlock,
    courseId: editor.courseId,
    courseLevel: editor.templateLevel || undefined,
  })

  const [toast, setToast] = useState<string | null>(null)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  // URL params
  const idParam = params.get('id')
  const courseIdParam = params.get('course_id')
  const courseNameParam = params.get('course_name') || ''
  const modeParam = params.get('mode')

  // Redirect unauthenticated users out (mirrors /admin-beta/courses).
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  // Resolve the URL into the right view exactly once per distinct param set.
  // A ref guards against re-running on every render / on transient param reads.
  const resolvedKey = useRef<string | null>(null)
  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return
    const key = `${idParam || ''}|${courseIdParam || ''}|${courseNameParam}|${modeParam || ''}`
    if (resolvedKey.current === key) return
    resolvedKey.current = key

    if (idParam) {
      void editor.openLessonById(idParam)
    } else if (modeParam === 'content-bank') {
      editor.startNewLesson({ contentBankMode: true })
    } else if (courseIdParam) {
      editor.startNewLesson({ courseId: courseIdParam, courseName: courseNameParam })
    } else {
      editor.backToList()
    }
    // editor functions are stable (useCallback); intentionally excluded so this
    // runs on param/auth changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin, idParam, courseIdParam, courseNameParam, modeParam])

  // Auto-dismiss the save toast.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Warn before leaving (tab close / reload / external nav) with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editor.view === 'editor' && editor.dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [editor.view, editor.dirty])

  if (status === 'loading') {
    return <LessonsListView lessons={[]} loading query="" onQueryChange={() => {}} onOpenLesson={() => {}} onNewLesson={() => {}} />
  }

  if (status === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  const handleSave = async (newStatus: 'draft' | 'published') => {
    const err = await editor.saveLesson(newStatus)
    if (!err) {
      setToast(newStatus === 'published' ? 'Lesson published' : 'Draft saved')
    }
  }

  return (
    <>
      {editor.view === 'editor' ? (
        <LessonEditorView
          title={editor.title}
          lessonDate={editor.lessonDate}
          lessonType={editor.lessonType}
          summary={editor.summary}
          onTitleChange={editor.setTitle}
          onDateChange={editor.setLessonDate}
          onTypeChange={editor.setLessonType}
          onSummaryChange={editor.setSummary}
          currentLessonStatus={editor.currentLessonStatus}
          editingLessonId={editor.editingLessonId}
          editingAuthorName={editor.editingAuthorName}
          editingCreatedAt={editor.editingCreatedAt}
          contentItems={editor.contentItems}
          isItemPublished={editor.isItemPublished}
          flashcardsPublished={editor.flashcardsPublished}
          saving={editor.saving}
          publishing={editor.publishing}
          dirty={editor.dirty}
          error={editor.error}
          onSave={handleSave}
          onBack={() => {
            if (editor.dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
            editor.backToList()
            router.push('/admin-beta/lessons')
          }}
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
            // Apply each chosen section via the editor hook. Title/summary
            // overwrite the metadata fields; flashcards/mistakes append as items.
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
          onFetchCourseVocabulary={ai.fetchCourseVocabulary}
          onSuggestExercisesFromReading={ai.suggestExercisesFromReading}
          aiError={ai.aiError}
          onClearAiError={() => ai.setAiError(null)}
          generatingFlashcards={ai.generatingFlashcards}
          generatingExercises={ai.generatingExercises}
          generatingBlock={ai.generatingBlock}
          generatingGrammar={ai.generatingGrammar}
          generatingReading={ai.generatingReading}
          generatingImport={ai.generatingImport}
          generatingVocab={ai.generatingVocab}
          generatingSuggestEx={ai.generatingSuggestEx}
          onUpdateItem={editor.updateItemData}
          onMoveItem={editor.moveItem}
          onRemoveItem={editor.removeItem}
          onTogglePublished={editor.togglePublished}
          onToggleFlashcardsPublished={() => editor.setFlashcardsPublished((v) => !v)}
          onToggleCollapse={editor.toggleCollapse}
        />
      ) : (
        <LessonsListView
          lessons={editor.lessons}
          loading={editor.loading}
          query={editor.lessonQuery}
          onQueryChange={editor.setLessonQuery}
          onOpenLesson={(id) => router.push(`/admin-beta/lessons?id=${id}`)}
          onNewLesson={() => editor.startNewLesson()}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-ink-black text-white text-sm font-bold px-4 py-2.5 rounded-tile shadow-lg font-rubik"
        >
          {toast}
        </div>
      )}
    </>
  )
}

export default function LessonsBetaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LessonsBetaBody />
    </Suspense>
  )
}
