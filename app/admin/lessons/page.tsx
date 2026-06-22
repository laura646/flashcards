'use client'

// 10B redesign — Lesson Manager route (Phase 1, "new beside old").
//
// Same data + auth as the live /admin/lessons (which is left 100% untouched),
// just rendered through the new 10B presentational views + the useLessonEditor
// hook (which ports the LOAD / SAVE data contract byte-for-byte from legacy).
// Lives at a NEW route (/admin/lessons), not linked from the live nav.
//
// Uses useSearchParams so the body is wrapped in <Suspense> per Next.js rules.
// URL contract (mirrors legacy searchParams):
//   ?id=ID                          -> open existing lesson in the editor
//   ?course_id=ID&course_name=NAME  -> start a new lesson for that course
//   ?mode=content-bank              -> start a new content-bank template
//   (none)                          -> the lessons list

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import MyLibraryView, { type MyLibraryFolderHandlers } from '@/components/admin-v2/MyLibraryView'
// Phase 3: the REAL lesson editor is now the calm 3-pane CalmLessonEditor (outline
// | edit | per-item preview). It keeps the same prop contract as the prior
// LessonEditorView (chrome: save/publish bar, metadata, unsaved guard, all AI
// modals, content-bank flows), so this is a drop-in swap. LessonEditorView is left
// untouched for rollback; /admin/* imports neither, so it is unaffected.
import CalmLessonEditor from '@/components/admin-v2/CalmLessonEditor'
import type { Folder } from '@/components/admin-v2/FolderTree'
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

  // ── Personal folders for My Library (created_by-scoped via &mine=true) ──
  const [folders, setFolders] = useState<Folder[]>([])

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/content-bank?action=list-folders&mine=true')
      if (!res.ok) return
      const data = await res.json()
      setFolders(data.folders || [])
    } catch {
      /* silent — folder panel just shows empty */
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) void loadFolders()
  }, [status, isAdmin, loadFolders])

  // Folder + membership mutations. Each returns ok and refreshes the data the
  // UI reads from (folders for the tree, lessons for the per-lesson folder_ids).
  const folderApi: MyLibraryFolderHandlers = {
    folders,
    onCreateFolder: async (name, parentId) => {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-folder', name, parent_id: parentId }),
      })
      if (!res.ok) return false
      await loadFolders()
      return true
    },
    onRenameFolder: async (folderId, name) => {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename-folder', folder_id: folderId, name }),
      })
      if (!res.ok) return false
      await loadFolders()
      return true
    },
    onDeleteFolder: async (folderId) => {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-folder', folder_id: folderId }),
      })
      if (!res.ok) return false
      await Promise.all([loadFolders(), editor.loadLessons?.()])
      return true
    },
    onAssignToFolder: async (lessonId, folderId) => {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign-to-folder', lesson_id: lessonId, folder_id: folderId }),
      })
      if (!res.ok) return false
      await editor.loadLessons?.()
      return true
    },
    onRemoveFromFolder: async (lessonId, folderId) => {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-from-folder', lesson_id: lessonId, folder_id: folderId }),
      })
      if (!res.ok) return false
      await editor.loadLessons?.()
      return true
    },
  }

  // URL params
  const idParam = params.get('id')
  const courseIdParam = params.get('course_id')
  const courseNameParam = params.get('course_name') || ''
  const modeParam = params.get('mode')
  const shareParam = params.get('share')

  // Redirect unauthenticated users out (mirrors /admin/courses).
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  // Resolve the URL into the right view exactly once per distinct param set.
  // A ref guards against re-running on every render / on transient param reads.
  const resolvedKey = useRef<string | null>(null)
  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return
    const key = `${idParam || ''}|${courseIdParam || ''}|${courseNameParam}|${modeParam || ''}|${shareParam || ''}`
    if (resolvedKey.current === key) return
    resolvedKey.current = key

    if (idParam) {
      void editor.openLessonById(idParam)
    } else if (modeParam === 'content-bank') {
      editor.startNewLesson({ contentBankMode: true, shareToSchool: shareParam === 'school' })
    } else if (courseIdParam) {
      editor.startNewLesson({ courseId: courseIdParam, courseName: courseNameParam })
    } else {
      editor.backToList()
    }
    // editor functions are stable (useCallback); intentionally excluded so this
    // runs on param/auth changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin, idParam, courseIdParam, courseNameParam, modeParam, shareParam])

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
    return (
      <MyLibraryView
        lessons={[]}
        loading
        currentUserEmail=""
        onOpenLesson={() => {}}
        onNewLesson={() => {}}
        onAssign={async () => ({ ok: false })}
        onShareToSchool={async () => ({ ok: false })}
        onUnshareFromSchool={async () => ({ ok: false })}
        onOpenSchoolLibrary={() => {}}
        folderApi={{
          folders: [],
          onCreateFolder: async () => false,
          onRenameFolder: async () => false,
          onDeleteFolder: async () => false,
          onAssignToFolder: async () => false,
          onRemoveFromFolder: async () => false,
        }}
      />
    )
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
        <CalmLessonEditor
          title={editor.title}
          lessonDate={editor.lessonDate}
          lessonType={editor.lessonType}
          summary={editor.summary}
          onTitleChange={editor.setTitle}
          onDateChange={editor.setLessonDate}
          onTypeChange={editor.setLessonType}
          onSummaryChange={editor.setSummary}
          isTemplate={editor.isTemplate}
          contentBankMode={editor.contentBankMode}
          templateCategory={editor.templateCategory}
          templateLevel={editor.templateLevel}
          onCategoryChange={editor.setTemplateCategory}
          onLevelChange={editor.setTemplateLevel}
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
            router.push('/admin/lessons')
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
          onToggleCollapse={editor.toggleCollapse}
        />
      ) : (
        <MyLibraryView
          lessons={editor.lessons}
          loading={editor.loading}
          currentUserEmail={session?.user?.email || ''}
          onOpenLesson={(id) => router.push(`/admin/lessons?id=${id}`)}
          onNewLesson={() => editor.startNewLesson()}
          onOpenSchoolLibrary={() => router.push('/admin/content-bank')}
          folderApi={folderApi}
          onAssign={async (lessonId, courseId) => {
            const res = await fetch('/api/lessons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'assign-course', lessonId, course_id: courseId }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.ok) {
              void editor.loadLessons?.()
              return { ok: true }
            }
            return { ok: false, error: data.error || 'Failed to assign' }
          }}
          onShareToSchool={async (lessonId) => {
            const res = await fetch('/api/content-bank', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'share-to-school', lesson_id: lessonId }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.ok) {
              void editor.loadLessons?.()
              return { ok: true }
            }
            return { ok: false, error: data.error || 'Failed to share' }
          }}
          onUnshareFromSchool={async (lessonId) => {
            const res = await fetch('/api/content-bank', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'unshare-from-school', lesson_id: lessonId }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.ok) {
              void editor.loadLessons?.()
              return { ok: true }
            }
            return { ok: false, error: data.error || 'Failed to unshare' }
          }}
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
