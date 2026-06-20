'use client'

// 10B redesign — Content Bank LIBRARY manager (Phase 1, "new beside old").
//
// Faithful COPY of the live app/admin/content-bank/page.tsx: ALL state,
// handlers, fetch calls, API actions/payloads, modals and role-gating are
// byte-faithful — only the JSX is restyled to the 10B kit + tokens and made
// COMPACT/DENSE (Laura's "less blank space" rule). The live page is left 100%
// untouched. Lives at a NEW route (/admin-beta/content-bank); an
// app/admin-beta/layout.tsx will provide the nav, so this renders content only.
//
// Internal links to the editor are repointed /admin/lessons -> /admin-beta/lessons
// (the new editor exists). All API paths are unchanged.

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ExercisePreview from '@/components/ExercisePreview'
import McqOptionsList, { validateMcqQuestion } from '@/components/McqOptionsList'
import { Button, Card, Pill, EmptyState, Skeleton } from '@/components/student-ui'

// ── Types ──

interface Template {
  id: string
  title: string
  lesson_date: string
  lesson_type: string
  summary: string | null
  template_category: string | null
  template_level: string | null
  created_at: string
  updated_at: string
  flashcard_count: number
  exercise_count: number
  block_counts: Record<string, number>
  author_email: string | null
  author_name: string
}

// Formats a full ISO timestamp like "Mar 12, 2025"
const formatAddedDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

interface Flashcard {
  id: string
  word: string
  phonetic: string
  meaning: string
  example: string
  notes: string
  image_url?: string
  order_index: number
}

interface Exercise {
  id: string
  title: string
  subtitle: string
  icon: string
  instructions: string
  exercise_type: string
  questions: unknown
  order_index: number
}

interface Block {
  id: string
  block_type: string
  title: string
  content: unknown
  order_index: number
}

interface Course {
  id: string
  name: string
}

interface Folder {
  id: string
  name: string
  parent_id: string | null
  created_by: string
  created_at: string
  template_count: number
}

const CATEGORIES = ['General English', 'Business English']

const LEVELS = [
  'Beginner',
  'Elementary Low', 'Elementary High',
  'Pre-Intermediate Low', 'Pre-Intermediate High',
  'Intermediate Low', 'Intermediate High',
  'Upper-Intermediate Low', 'Upper-Intermediate High',
  'Advanced',
]

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  fill_blank: 'Fill in the Blank',
  match_halves: 'Match Halves',
  transform: 'Transform',
  anagram: 'Unjumble',
  unjumble: 'Unjumble',
  true_or_false: 'True or False',
  hangman: 'Hangman',
  type_answer: 'Type the Answer',
  complete_sentence: 'Complete the Sentence',
  group_sort: 'Group Sort',
  odd_one_out: 'Odd One Out',
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  mistakes: 'Mistakes',
  video: 'Video',
  article: 'Article',
  dialogue: 'Dialogue',
  grammar: 'Grammar',
  writing: 'Writing',
  pronunciation: 'Pronunciation',
}

const LESSON_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  lesson: { label: 'Lesson', icon: '📚' },
  mid_course_test: { label: 'Mid-Course Test', icon: '📝' },
  final_test: { label: 'Final Test', icon: '🎓' },
  review_test: { label: 'Review Test', icon: '🔄' },
}

// Shared input class for the dense restyled selects/inputs in modals + filters.
const inputClass =
  'w-full px-3 py-2 text-sm text-ink-body bg-white border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]'

// ── Folder Tree Component ──

function FolderTree({
  folders,
  parentId,
  selectedFolderId,
  expandedFolders,
  onSelectFolder,
  onToggleExpand,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
  depth = 0,
}: {
  folders: Folder[]
  parentId: string | null
  selectedFolderId: string | null
  expandedFolders: Set<string>
  onSelectFolder: (id: string | null) => void
  onToggleExpand: (id: string) => void
  onCreateSubfolder: (parentId: string) => void
  onRenameFolder: (folder: Folder) => void
  onDeleteFolder: (folder: Folder) => void
  depth?: number
}) {
  const children = folders.filter(f => f.parent_id === parentId)
  if (children.length === 0) return null

  return (
    <div>
      {children.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id)
        const isExpanded = expandedFolders.has(folder.id)
        const isSelected = selectedFolderId === folder.id

        return (
          <div key={folder.id}>
            <div
              className={`group flex items-center gap-1 px-2 py-1.5 rounded-tile cursor-pointer text-sm transition-colors ${
                isSelected
                  ? 'bg-sky-wash text-sky-text font-semibold'
                  : 'text-ink-body hover:bg-surface'
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              {/* Expand/collapse arrow */}
              <button
                onClick={e => { e.stopPropagation(); onToggleExpand(folder.id) }}
                className="w-4 h-4 flex items-center justify-center text-ink-muted hover:text-sky-text shrink-0"
              >
                {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
              </button>

              {/* Folder name */}
              <button
                onClick={() => onSelectFolder(isSelected ? null : folder.id)}
                className="flex-1 text-left truncate"
              >
                {folder.name}
              </button>

              {/* Count badge */}
              {folder.template_count > 0 && (
                <span className="text-xs text-ink-muted shrink-0">{folder.template_count}</span>
              )}

              {/* Context actions (visible on hover) */}
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); onCreateSubfolder(folder.id) }}
                  className="w-5 h-5 flex items-center justify-center text-ink-muted hover:text-sky-text text-xs"
                  title="Add subfolder"
                >
                  +
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onRenameFolder(folder) }}
                  className="w-5 h-5 flex items-center justify-center text-ink-muted hover:text-sky-text text-xs"
                  title="Rename"
                >
                  &#9998;
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteFolder(folder) }}
                  className="w-5 h-5 flex items-center justify-center text-ink-muted hover:text-incorrect-fg text-xs"
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
              <FolderTree
                folders={folders}
                parentId={folder.id}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                onSelectFolder={onSelectFolder}
                onToggleExpand={onToggleExpand}
                onCreateSubfolder={onCreateSubfolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ──

export default function ContentBankBetaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLevel, setFilterLevel] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'author'>('recent')
  const [search, setSearch] = useState('')

  // Folders
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Assign to folder modal
  const [assigningTemplate, setAssigningTemplate] = useState<Template | null>(null)

  // Delete template
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)

  // Detail view
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Exercise expand/edit
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [savingExercise, setSavingExercise] = useState(false)
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null)
  const [convertingType, setConvertingType] = useState(false)

  // Clone modal
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [cloning, setCloning] = useState(false)

  // Add to Lesson modal
  const [showAddToLessonModal, setShowAddToLessonModal] = useState(false)
  const [addToLessonCourseId, setAddToLessonCourseId] = useState('')
  const [addToLessonLessons, setAddToLessonLessons] = useState<{ id: string; title: string; status: string }[]>([])
  const [addToLessonId, setAddToLessonId] = useState('')
  const [addToLessonLoading, setAddToLessonLoading] = useState(false)
  const [copying, setCopying] = useState(false)

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<Folder | null>(null)
  const [confirmExerciseDelete, setConfirmExerciseDelete] = useState<string | null>(null)

  // Toast
  const [toast, setToast] = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string) => {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToast(msg)
    toastRef.current = setTimeout(() => setToast(''), 3000)
  }

  const role = session?.user?.role
  const isAdmin = role === 'superadmin' || role === 'teacher'

  // ── Load folders ──
  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/content-bank?action=list-folders')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setFolders(data.folders || [])
    } catch {
      // silent
    }
  }, [])

  // ── Load templates ──
  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ action: 'list' })
      if (filterLevel) params.set('level', filterLevel)
      if (filterCategory) params.set('category', filterCategory)
      if (selectedFolderId) params.set('folder_id', selectedFolderId)

      const res = await fetch(`/api/content-bank?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      showToast('Failed to load templates')
    }
    setLoading(false)
  }, [filterLevel, filterCategory, selectedFolderId])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      loadTemplates()
      loadFolders()
    }
  }, [status, isAdmin, loadTemplates, loadFolders])

  // ── Load template detail ──
  const openTemplate = async (template: Template) => {
    setSelectedTemplate(template)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/content-bank?action=detail&id=${template.id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setFlashcards(data.flashcards || [])
      setExercises(data.exercises || [])
      setBlocks(data.blocks || [])
    } catch {
      showToast('Failed to load template details')
    }
    setLoadingDetail(false)
  }

  // ── Load courses for clone ──
  const openCloneModal = async () => {
    setShowCloneModal(true)
    try {
      const res = await fetch('/api/superadmin?action=courses')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCourses(data.courses || [])
    } catch {
      showToast('Failed to load courses')
    }
  }

  // ── Exercise edit/delete ──
  const saveExercise = async (ex: Exercise) => {
    // Validate MCQ-shaped questions before saving (block on blank options /
    // unset correct answer / fewer than 2 options).
    if (ex.exercise_type === 'multiple_choice' && Array.isArray(ex.questions)) {
      const issues: string[] = []
      ;(ex.questions as Array<{ prompt?: string; options?: string[]; correctIndex?: number; correctIndices?: number[] }>).forEach((q, qi) => {
        issues.push(...validateMcqQuestion(q, `Q${qi + 1}`))
      })
      if (issues.length > 0) {
        showToast(issues[0])
        return
      }
    }
    setSavingExercise(true)
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-exercise',
          exercise_id: ex.id,
          title: ex.title,
          subtitle: ex.subtitle,
          icon: ex.icon,
          instructions: ex.instructions,
          exercise_type: ex.exercise_type,
          questions: ex.questions,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setExercises(prev => prev.map(e => e.id === ex.id ? ex : e))
      setEditingExercise(null)
      showToast('Exercise saved!')
    } catch {
      showToast('Failed to save exercise')
    }
    setSavingExercise(false)
  }

  const convertExerciseType = async (exercise: Exercise, newType: string) => {
    if (newType === exercise.exercise_type) return
    setConvertingType(true)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert-exercise-type', exercise, newType }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to convert exercise type')
        setConvertingType(false)
        return
      }
      const converted = data.exercise
      setEditingExercise({
        ...exercise,
        title: converted.title || exercise.title,
        subtitle: converted.subtitle || '',
        icon: converted.icon || exercise.icon,
        instructions: converted.instructions || '',
        exercise_type: newType,
        questions: converted.questions || [],
      })
      showToast(`Converted to ${EXERCISE_TYPE_LABELS[newType]}!`)
    } catch {
      showToast('Failed to convert exercise type')
    }
    setConvertingType(false)
  }

  const deleteExercise = async (exerciseId: string) => {
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-exercise', exercise_id: exerciseId }),
      })
      if (!res.ok) throw new Error('Failed')
      setExercises(prev => prev.filter(e => e.id !== exerciseId))
      setExpandedExerciseId(null)
      setEditingExercise(null)
      showToast('Exercise deleted')
    } catch {
      showToast('Failed to delete exercise')
    }
  }

  // ── Clone lesson ──
  const cloneLesson = async () => {
    if (!selectedTemplate || !selectedCourseId) return
    setCloning(true)
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clone-lesson',
          template_id: selectedTemplate.id,
          course_id: selectedCourseId,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast('Lesson cloned as draft! Go to Lessons to edit & publish.')
      setShowCloneModal(false)
      setSelectedCourseId('')
    } catch {
      showToast('Failed to clone lesson')
    }
    setCloning(false)
  }

  // ── Add to Lesson ──
  const openAddToLessonModal = async () => {
    setShowAddToLessonModal(true)
    setAddToLessonCourseId('')
    setAddToLessonLessons([])
    setAddToLessonId('')
    // Load courses if not already loaded
    if (courses.length === 0) {
      try {
        const res = await fetch('/api/superadmin?action=courses')
        if (res.ok) {
          const data = await res.json()
          setCourses(data.courses || [])
        }
      } catch { /* ignore */ }
    }
  }

  const loadLessonsForCourse = async (courseId: string) => {
    setAddToLessonCourseId(courseId)
    setAddToLessonId('')
    if (!courseId) { setAddToLessonLessons([]); return }
    setAddToLessonLoading(true)
    try {
      const res = await fetch(`/api/lessons?course_id=${courseId}&include_all=true`)
      if (res.ok) {
        const data = await res.json()
        // Filter out templates
        const lessons = (data.lessons || []).filter((l: { is_template?: boolean }) => !l.is_template)
        setAddToLessonLessons(lessons)
      }
    } catch { /* ignore */ }
    setAddToLessonLoading(false)
  }

  const copyToLesson = async () => {
    if (!selectedTemplate || !addToLessonId) return
    setCopying(true)
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy-to-lesson',
          template_id: selectedTemplate.id,
          target_lesson_id: addToLessonId,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`Content copied! ${data.copied} items added to lesson.`)
        setShowAddToLessonModal(false)
      } else {
        showToast(data.error || 'Failed to copy')
      }
    } catch {
      showToast('Failed to copy content')
    }
    setCopying(false)
  }

  // ── Folder actions ──
  const createFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-folder',
          name: newFolderName.trim(),
          parent_id: newFolderParentId,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast('Folder created')
      setNewFolderName('')
      setShowNewFolder(false)
      setNewFolderParentId(null)
      // Auto-expand parent
      if (newFolderParentId) {
        setExpandedFolders(prev => new Set([...Array.from(prev), newFolderParentId]))
      }
      loadFolders()
    } catch {
      showToast('Failed to create folder')
    }
  }

  const renameFolder = async () => {
    if (!renamingFolder || !renameValue.trim()) return
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename-folder',
          folder_id: renamingFolder.id,
          name: renameValue.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast('Folder renamed')
      setRenamingFolder(null)
      setRenameValue('')
      loadFolders()
    } catch {
      showToast('Failed to rename folder')
    }
  }

  const deleteFolder = async (folder: Folder) => {
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-folder', folder_id: folder.id }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast('Folder deleted')
      if (selectedFolderId === folder.id) setSelectedFolderId(null)
      setConfirmDelete(null)
      loadFolders()
      loadTemplates()
    } catch {
      showToast('Failed to delete folder')
    }
  }

  const deleteTemplate = async (template: Template) => {
    setDeleteInProgress(true)
    try {
      const res = await fetch('/api/lessons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: template.id }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast('Template deleted')
      setDeletingTemplate(null)
      setSelectedTemplate(null)
      setFlashcards([]); setExercises([]); setBlocks([])
      loadTemplates()
      loadFolders()
    } catch {
      showToast('Failed to delete template')
    }
    setDeleteInProgress(false)
  }

  const assignToFolder = async (template: Template, folderId: string) => {
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-to-folder',
          lesson_id: template.id,
          folder_id: folderId,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(`Added to folder`)
      setAssigningTemplate(null)
      loadFolders()
    } catch {
      showToast('Failed to assign to folder')
    }
  }

  const removeFromFolder = async (templateId: string) => {
    if (!selectedFolderId) return
    try {
      const res = await fetch('/api/content-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-from-folder',
          lesson_id: templateId,
          folder_id: selectedFolderId,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast('Removed from folder')
      loadFolders()
      loadTemplates()
    } catch {
      showToast('Failed to remove from folder')
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(Array.from(prev))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateSubfolder = (parentId: string) => {
    setNewFolderParentId(parentId)
    setShowNewFolder(true)
    setExpandedFolders(prev => new Set([...Array.from(prev), parentId]))
  }

  const handleRenameFolder = (folder: Folder) => {
    setRenamingFolder(folder)
    setRenameValue(folder.name)
  }

  // ── Auth guard ──
  if (status === 'loading') return null
  if (!isAdmin) {
    router.push('/')
    return null
  }

  const totalBlocks = (t: Template) =>
    Object.values(t.block_counts).reduce((a, b) => a + b, 0)

  const contentSummary = (t: Template) => {
    const parts: string[] = []
    if (t.flashcard_count > 0) parts.push(`${t.flashcard_count} flashcards`)
    if (t.exercise_count > 0) parts.push(`${t.exercise_count} exercises`)
    const bc = totalBlocks(t)
    if (bc > 0) parts.push(`${bc} blocks`)
    return parts.join(' · ') || 'Empty'
  }

  const selectedFolderName = selectedFolderId
    ? folders.find(f => f.id === selectedFolderId)?.name || 'Folder'
    : null

  return (
    <div className="font-rubik min-h-screen bg-surface px-4 py-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-brandblue text-white px-5 py-3 rounded-tile text-xs font-bold shadow-lg">
          {toast}
        </div>
      )}

      {/* Clone Modal */}
      {showCloneModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <h3 className="font-bold text-ink-black mb-1">Clone to Course</h3>
            <p className="text-xs text-ink-muted mb-4">
              &ldquo;{selectedTemplate.title}&rdquo; will be added as a draft lesson in the selected course.
            </p>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className={`${inputClass} mb-4`}
            >
              <option value="">Select a course...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button
                variant="neutral"
                size="sm"
                onClick={() => { setShowCloneModal(false); setSelectedCourseId('') }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={cloneLesson}
                disabled={!selectedCourseId || cloning}
              >
                {cloning ? 'Cloning...' : 'Clone Lesson'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add to Lesson Modal */}
      {showAddToLessonModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <h3 className="font-bold text-ink-black mb-1">Add to Existing Lesson</h3>
            <p className="text-xs text-ink-muted mb-4">
              Copy all content from &ldquo;{selectedTemplate.title}&rdquo; into an existing lesson.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Course</label>
                <select
                  value={addToLessonCourseId}
                  onChange={e => loadLessonsForCourse(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a course...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {addToLessonCourseId && (
                <div>
                  <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Lesson</label>
                  {addToLessonLoading ? (
                    <p className="text-xs text-ink-muted py-2">Loading lessons...</p>
                  ) : addToLessonLessons.length === 0 ? (
                    <p className="text-xs text-ink-muted py-2">No lessons in this course yet.</p>
                  ) : (
                    <select
                      value={addToLessonId}
                      onChange={e => setAddToLessonId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select a lesson...</option>
                      {addToLessonLessons.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.title} {l.status === 'draft' ? '(draft)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <Button
                variant="neutral"
                size="sm"
                onClick={() => { setShowAddToLessonModal(false); setAddToLessonCourseId(''); setAddToLessonId('') }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={copyToLesson}
                disabled={!addToLessonId || copying}
              >
                {copying ? 'Copying...' : 'Add to Lesson'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Rename Folder Modal */}
      {renamingFolder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-ink-black mb-3">Rename Folder</h3>
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameFolder()}
              className={`${inputClass} mb-4`}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="neutral"
                size="sm"
                onClick={() => { setRenamingFolder(null); setRenameValue('') }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={renameFolder}
                disabled={!renameValue.trim()}
              >
                Rename
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Folder Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-ink-black mb-2">Delete Folder?</h3>
            <p className="text-xs text-ink-muted mb-4">
              &ldquo;{confirmDelete.name}&rdquo; and all subfolders will be deleted. Templates inside will not be deleted, just unlinked from the folder.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="neutral" size="sm" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <button
                onClick={() => deleteFolder(confirmDelete)}
                className="px-4 py-2 bg-incorrect-fg text-white text-xs font-extrabold rounded-tile hover:brightness-95 transition-all"
              >
                Delete
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Exercise Confirmation Modal */}
      {confirmExerciseDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-ink-black mb-2">Delete Exercise?</h3>
            <p className="text-xs text-ink-muted mb-4">
              This will permanently delete the exercise. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="neutral" size="sm" onClick={() => setConfirmExerciseDelete(null)}>
                Cancel
              </Button>
              <button
                onClick={() => { deleteExercise(confirmExerciseDelete); setConfirmExerciseDelete(null) }}
                className="px-4 py-2 bg-incorrect-fg text-white text-xs font-extrabold rounded-tile hover:brightness-95 transition-all"
              >
                Delete
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Assign to Folder Modal */}
      {assigningTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-ink-black mb-1">Add to Folder</h3>
            <p className="text-xs text-ink-muted mb-4">
              Select a folder for &ldquo;{assigningTemplate.title}&rdquo;
            </p>
            {folders.length === 0 ? (
              <p className="text-xs text-ink-muted mb-4">No folders yet. Create one first.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto mb-4 border border-hairline rounded-tile">
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => assignToFolder(assigningTemplate, f.id)}
                    className="w-full text-left px-3 py-2 text-sm text-ink-body hover:bg-sky-wash transition-colors border-b border-hairline last:border-b-0"
                  >
                    {/* Show hierarchy via indent */}
                    <span style={{ paddingLeft: `${getFolderDepth(folders, f.id) * 16}px` }}>
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="neutral" size="sm" onClick={() => setAssigningTemplate(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-ink-black mb-1">Delete Template?</h3>
            <p className="text-xs text-ink-muted mb-4">
              This will permanently delete &ldquo;{deletingTemplate.title}&rdquo; and all its content. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="neutral"
                size="sm"
                onClick={() => setDeletingTemplate(null)}
                disabled={deleteInProgress}
              >
                Cancel
              </Button>
              <button
                onClick={() => deleteTemplate(deletingTemplate)}
                disabled={deleteInProgress}
                className="px-4 py-2 bg-incorrect-fg text-white text-xs font-extrabold rounded-tile hover:brightness-95 transition-all disabled:opacity-50"
              >
                {deleteInProgress ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════ DETAIL VIEW ══════════ */}
      {selectedTemplate ? (
        <div className="max-w-5xl mx-auto">
          {/* Back + header */}
          <button
            onClick={() => { setSelectedTemplate(null); setFlashcards([]); setExercises([]); setBlocks([]) }}
            className="text-xs text-ink-muted hover:text-sky-text transition-colors mb-2"
          >
            &larr; Back to Content Bank
          </button>

          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <h1 className="text-2xl font-bold text-brandblue">{selectedTemplate.title}</h1>
              <div className="flex gap-2 mt-2 flex-wrap">
                {selectedTemplate.template_level && (
                  <Pill variant="level">{selectedTemplate.template_level}</Pill>
                )}
                {selectedTemplate.template_category && (
                  <Pill variant="wash">{selectedTemplate.template_category}</Pill>
                )}
                {selectedTemplate.lesson_type && selectedTemplate.lesson_type !== 'lesson' && (
                  <Pill variant="wash">
                    {LESSON_TYPE_LABELS[selectedTemplate.lesson_type]?.icon} {LESSON_TYPE_LABELS[selectedTemplate.lesson_type]?.label}
                  </Pill>
                )}
              </div>
              {selectedTemplate.summary && (
                <p className="text-sm text-ink-muted mt-2">{selectedTemplate.summary}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => setDeletingTemplate(selectedTemplate)}
                className="px-3 py-2 border border-incorrect-border text-incorrect-fg text-xs font-extrabold rounded-tile hover:bg-incorrect-bg transition-colors"
              >
                Delete
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/admin-beta/lessons?id=${selectedTemplate.id}`)}
              >
                Edit Template
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAssigningTemplate(selectedTemplate)}>
                Add to Folder
              </Button>
              <Button variant="secondary" size="sm" onClick={openAddToLessonModal}>
                Add to Lesson
              </Button>
              <Button variant="primary" size="sm" onClick={openCloneModal}>
                Clone to Course
              </Button>
            </div>
          </div>

          {loadingDetail ? (
            <div className="space-y-3">
              {[0, 1].map(i => (
                <Card key={i}>
                  <Skeleton className="h-4 w-32 mb-3" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Flashcards */}
              {flashcards.length > 0 && (
                <Card>
                  <h3 className="font-bold text-ink-black mb-3">
                    Flashcards <span className="text-xs font-normal text-ink-muted">({flashcards.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {flashcards.map(fc => (
                      <div key={fc.id} className="bg-surface rounded-tile p-3 border border-hairline">
                        <p className="font-bold text-sm text-sky-text">{fc.word}</p>
                        {fc.phonetic && <p className="text-xs text-ink-muted">{fc.phonetic}</p>}
                        <p className="text-xs text-ink-body mt-1">{fc.meaning}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Exercises */}
              {exercises.length > 0 && (
                <Card>
                  <h3 className="font-bold text-ink-black mb-3">
                    Exercises <span className="text-xs font-normal text-ink-muted">({exercises.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {exercises.map(ex => {
                      const isExpanded = expandedExerciseId === ex.id
                      const isEditing = editingExercise?.id === ex.id
                      const editEx = isEditing ? editingExercise : ex
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const questions = (editEx.questions || []) as any[]

                      return (
                        <div key={ex.id} className="bg-surface rounded-tile border border-hairline overflow-hidden">
                          {/* Collapsed header — clickable */}
                          <div
                            className="p-3 flex items-center gap-3 cursor-pointer hover:bg-sky-wash transition-colors"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedExerciseId(null)
                                setEditingExercise(null)
                              } else {
                                setExpandedExerciseId(ex.id)
                                setEditingExercise(null)
                              }
                            }}
                          >
                            <span className="text-lg">{ex.icon}</span>
                            <div className="flex-1">
                              <p className="font-bold text-sm text-ink-black">{ex.title}</p>
                              <p className="text-xs text-ink-muted">
                                {EXERCISE_TYPE_LABELS[ex.exercise_type] || ex.exercise_type}
                                {ex.subtitle && ` · ${ex.subtitle}`}
                                {' · '}
                                {questions.length} question{questions.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <span className={`text-ink-muted text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>&#x25BC;</span>
                          </div>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="border-t border-hairline p-4">
                              {/* Action buttons */}
                              <div className="flex gap-2 mb-4">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPreviewExercise(ex) }}
                                  className="px-3 py-1.5 bg-streak-fill text-streak-ink text-xs font-extrabold rounded-tile hover:brightness-95 transition-all"
                                >
                                  ▶ Preview
                                </button>
                                {!isEditing ? (
                                  <button
                                    onClick={() => setEditingExercise({ ...ex, questions: ex.questions })}
                                    className="px-3 py-1.5 bg-sky text-white text-xs font-extrabold rounded-tile hover:bg-[#0099d6] transition-colors"
                                  >
                                    Edit
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => saveExercise(editingExercise)}
                                      disabled={savingExercise}
                                      className="px-3 py-1.5 bg-sky text-white text-xs font-extrabold rounded-tile hover:bg-[#0099d6] transition-colors disabled:opacity-50"
                                    >
                                      {savingExercise ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => setEditingExercise(null)}
                                      className="px-3 py-1.5 border-[1.5px] border-sky-border text-sky-text text-xs font-extrabold rounded-tile hover:border-sky transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setConfirmExerciseDelete(ex.id)}
                                  className="px-3 py-1.5 border border-incorrect-border text-incorrect-fg text-xs font-extrabold rounded-tile hover:bg-incorrect-bg transition-colors ml-auto"
                                >
                                  Delete
                                </button>
                              </div>

                              {/* Editable fields */}
                              {isEditing ? (
                                <div className="space-y-3 mb-4">
                                  <div>
                                    <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Title</label>
                                    <input type="text" value={editEx.title} onChange={(e) => setEditingExercise({ ...editEx, title: e.target.value })}
                                      className={inputClass} />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Instructions</label>
                                    <textarea value={editEx.instructions} onChange={(e) => setEditingExercise({ ...editEx, instructions: e.target.value })}
                                      className={`${inputClass} h-16 resize-y`} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Type</label>
                                      <select
                                        value={editEx.exercise_type}
                                        disabled={convertingType}
                                        onChange={(e) => convertExerciseType(editEx, e.target.value)}
                                        className={`${inputClass} disabled:opacity-50`}
                                      >
                                        {Object.entries(EXERCISE_TYPE_LABELS).map(([val, label]) => (
                                          <option key={val} value={val}>{label}</option>
                                        ))}
                                      </select>
                                      {convertingType && (
                                        <p className="text-[10px] text-sky-text mt-1 flex items-center gap-1">
                                          <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-sky-text border-t-transparent rounded-full" />
                                          Converting questions...
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Subtitle</label>
                                      <input type="text" value={editEx.subtitle} onChange={(e) => setEditingExercise({ ...editEx, subtitle: e.target.value })}
                                        className={inputClass} />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mb-4">
                                  {editEx.instructions && (
                                    <p className="text-xs text-ink-muted italic mb-2">{editEx.instructions}</p>
                                  )}
                                </div>
                              )}

                              {/* Questions list */}
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-ink-muted uppercase">Questions</p>
                                {questions.map((q: { id?: number; prompt?: string; statement?: string; word?: string; text?: string; options?: string[]; correctIndex?: number; answer?: string; isTrue?: boolean; explanation?: string; clue?: string; hint?: string; blanks?: Record<string, string>; wordBank?: string[] }, qi: number) => (
                                  <div key={q.id || qi} className="bg-white rounded-tile p-3 border border-hairline text-xs">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-ink-muted font-bold w-5">{qi + 1}.</span>
                                          <input
                                            type="text"
                                            value={q.prompt || q.statement || q.word || q.text || ''}
                                            onChange={(e) => {
                                              const updated = [...questions]
                                              const field = q.prompt !== undefined ? 'prompt' : q.statement !== undefined ? 'statement' : q.word !== undefined ? 'word' : 'text'
                                              updated[qi] = { ...updated[qi], [field]: e.target.value }
                                              setEditingExercise({ ...editEx, questions: updated })
                                            }}
                                            className="flex-1 px-2 py-1 border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky text-xs"
                                          />
                                        </div>
                                        {q.options && (
                                          <div className="ml-7">
                                            <McqOptionsList
                                              options={q.options}
                                              correctIndex={typeof q.correctIndex === 'number' ? q.correctIndex : -1}
                                              radioName={`cb-mcq-${qi}`}
                                              onChange={({ options, correctIndex }) => {
                                                const updated = [...questions]
                                                updated[qi] = { ...updated[qi], options, correctIndex }
                                                setEditingExercise({ ...editEx, questions: updated })
                                              }}
                                            />
                                          </div>
                                        )}
                                        {q.answer !== undefined && (
                                          <div className="ml-7 flex items-center gap-2">
                                            <span className="text-ink-muted">Answer:</span>
                                            <input
                                              type="text"
                                              value={q.answer}
                                              onChange={(e) => {
                                                const updated = [...questions]
                                                updated[qi] = { ...updated[qi], answer: e.target.value }
                                                setEditingExercise({ ...editEx, questions: updated })
                                              }}
                                              className="flex-1 px-2 py-1 border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky text-xs"
                                            />
                                          </div>
                                        )}
                                        {q.explanation !== undefined && (
                                          <div className="ml-7 flex items-center gap-2">
                                            <span className="text-ink-muted">Explanation:</span>
                                            <input
                                              type="text"
                                              value={q.explanation}
                                              onChange={(e) => {
                                                const updated = [...questions]
                                                updated[qi] = { ...updated[qi], explanation: e.target.value }
                                                setEditingExercise({ ...editEx, questions: updated })
                                              }}
                                              className="flex-1 px-2 py-1 border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky text-xs"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <p className="text-ink-body">
                                          <span className="text-ink-muted font-bold">{qi + 1}.</span>{' '}
                                          {q.prompt || q.statement || (q.word && `Guess: ${q.word}`) || q.text || ''}
                                        </p>
                                        {q.options && (
                                          <div className="ml-5 mt-1 space-y-0.5">
                                            {q.options.map((opt: string, oi: number) => (
                                              <p key={oi} className={oi === q.correctIndex ? 'text-correct-fg font-medium' : 'text-ink-muted'}>
                                                {String.fromCharCode(97 + oi)}) {opt} {oi === q.correctIndex && '✓'}
                                              </p>
                                            ))}
                                          </div>
                                        )}
                                        {q.answer !== undefined && (
                                          <p className="ml-5 mt-1 text-correct-fg font-medium">Answer: {q.answer}</p>
                                        )}
                                        {q.isTrue !== undefined && (
                                          <p className="ml-5 mt-1 text-correct-fg font-medium">{q.isTrue ? 'True' : 'False'}</p>
                                        )}
                                        {q.clue && (
                                          <p className="ml-5 mt-1 text-ink-muted">Clue: {q.clue}</p>
                                        )}
                                        {q.explanation && (
                                          <p className="ml-5 mt-1 text-ink-muted italic">{q.explanation}</p>
                                        )}
                                        {q.wordBank && (
                                          <p className="ml-5 mt-1 text-ink-muted">Word bank: {q.wordBank.join(', ')}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Content Blocks */}
              {blocks.length > 0 && (
                <Card>
                  <h3 className="font-bold text-ink-black mb-3">
                    Content Blocks <span className="text-xs font-normal text-ink-muted">({blocks.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {blocks.map(b => (
                      <div key={b.id} className="bg-surface rounded-tile p-3 border border-hairline">
                        <p className="font-bold text-sm text-ink-black">
                          {BLOCK_TYPE_LABELS[b.block_type] || b.block_type}
                          {b.title && `: ${b.title}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {flashcards.length === 0 && exercises.length === 0 && blocks.length === 0 && (
                <Card>
                  <EmptyState icon="📭" title="No content yet" hint="This template has no flashcards, exercises or blocks." />
                </Card>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ══════════ LIST VIEW WITH FOLDER SIDEBAR ══════════ */
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h1 className="text-2xl font-bold text-brandblue">Content Bank</h1>
              <p className="text-xs text-ink-muted mt-1">Browse shared lesson templates. Clone or cherry-pick content into your lessons.</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/admin-beta/lessons?mode=content-bank')}
            >
              ＋ Create Template
            </Button>
          </div>

          <div className="flex gap-4">
            {/* ── Folder Sidebar ── */}
            <div className="w-52 shrink-0">
              <Card padding="sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-ink-black">Folders</h3>
                  <button
                    onClick={() => { setShowNewFolder(true); setNewFolderParentId(null) }}
                    className="text-xs text-sky-text hover:underline font-bold"
                  >
                    + New
                  </button>
                </div>

                {/* New folder input */}
                {showNewFolder && (
                  <div className="mb-3">
                    <input
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') createFolder()
                        if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); setNewFolderParentId(null) }
                      }}
                      placeholder={newFolderParentId ? 'Subfolder name...' : 'Folder name...'}
                      className="w-full px-2 py-1.5 border-[1.5px] border-[#e3e5e9] rounded-tile text-xs mb-1 focus:outline-none focus:border-sky"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={createFolder}
                        disabled={!newFolderName.trim()}
                        className="px-2 py-1 bg-sky text-white text-xs font-extrabold rounded-tile disabled:opacity-50 hover:bg-[#0099d6] transition-colors"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setShowNewFolder(false); setNewFolderName(''); setNewFolderParentId(null) }}
                        className="px-2 py-1 text-xs text-ink-muted hover:text-ink-body"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* "All Templates" option */}
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className={`w-full text-left px-2 py-1.5 rounded-tile text-sm mb-1 transition-colors ${
                    selectedFolderId === null
                      ? 'bg-sky-wash text-sky-text font-semibold'
                      : 'text-ink-body hover:bg-surface'
                  }`}
                >
                  All Templates
                </button>

                {/* Folder tree */}
                <FolderTree
                  folders={folders}
                  parentId={null}
                  selectedFolderId={selectedFolderId}
                  expandedFolders={expandedFolders}
                  onSelectFolder={setSelectedFolderId}
                  onToggleExpand={toggleExpand}
                  onCreateSubfolder={handleCreateSubfolder}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={f => setConfirmDelete(f)}
                />

                {folders.length === 0 && !showNewFolder && (
                  <p className="text-xs text-ink-muted mt-2">No folders yet.</p>
                )}
              </Card>
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 min-w-0">
              {/* Active folder label + Filters */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {selectedFolderName && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-body">{selectedFolderName}</span>
                    <button
                      onClick={() => setSelectedFolderId(null)}
                      className="text-xs text-ink-muted hover:text-sky-text"
                    >
                      &times; Clear
                    </button>
                  </div>
                )}
                <div className="relative w-full max-w-xs">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates…"
                    className="w-full pl-9 pr-9 py-2 text-sm text-ink-body bg-white border-[1.5px] border-[#e3e5e9] rounded-tile focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2]"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-body"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <select
                  value={filterLevel}
                  onChange={e => setFilterLevel(e.target.value)}
                  className="px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm bg-white text-ink-body focus:outline-none focus:border-sky"
                >
                  <option value="">All Levels</option>
                  {LEVELS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm bg-white text-ink-body focus:outline-none focus:border-sky"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={filterAuthor}
                  onChange={e => setFilterAuthor(e.target.value)}
                  className="px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm bg-white text-ink-body focus:outline-none focus:border-sky"
                >
                  <option value="">All Authors</option>
                  {Array.from(new Set(templates.map((t) => t.author_name || 'Unknown'))).sort((a, b) => a.localeCompare(b)).map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'recent' | 'author')}
                  className="px-3 py-2 border-[1.5px] border-[#e3e5e9] rounded-tile text-sm bg-white text-ink-body focus:outline-none focus:border-sky"
                  title="Sort templates"
                >
                  <option value="recent">Most recent</option>
                  <option value="author">Author A→Z</option>
                </select>
              </div>

              {/* Templates grid */}
              {(() => {
                const q = search.trim().toLowerCase()
                const filtered = templates.filter((t) => {
                  if (q && !t.title.toLowerCase().includes(q)) return false
                  if (filterAuthor && (t.author_name || 'Unknown') !== filterAuthor) return false
                  return true
                })
                const visible = sortBy === 'author'
                  ? [...filtered].sort((a, b) =>
                      (a.author_name || 'Unknown').localeCompare(b.author_name || 'Unknown')
                    )
                  : filtered
                if (loading) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-card border border-hairline p-4">
                          <Skeleton className="h-4 w-40 mb-2" />
                          <Skeleton className="h-3 w-24 mb-3" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      ))}
                    </div>
                  )
                }
                if (visible.length === 0) {
                  const filtersActive = !!filterAuthor || !!selectedFolderId || !!filterLevel || !!filterCategory || !!q
                  return (
                    <div className="bg-white rounded-card border border-hairline">
                      <EmptyState
                        icon={filtersActive ? '🔍' : '🗂️'}
                        title={filtersActive ? 'No templates match the current filters.' : 'No templates found.'}
                        hint={filtersActive
                          ? 'Try clearing a filter to see more.'
                          : 'Create a template with the button above, or mark an existing lesson as "Share as Template" in the Lesson Manager.'}
                      />
                    </div>
                  )
                }
                return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visible.map(t => (
                    <div
                      key={t.id}
                      className="bg-white rounded-card border border-hairline p-4 hover:border-sky transition-colors group relative"
                    >
                      <button
                        onClick={() => openTemplate(t)}
                        className="w-full text-left"
                      >
                        <h3 className="font-bold text-ink-black group-hover:text-sky-text transition-colors mb-1">
                          {t.title}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {t.template_level && (
                            <Pill variant="level">{t.template_level}</Pill>
                          )}
                          {t.template_category && (
                            <Pill variant="wash">{t.template_category}</Pill>
                          )}
                          {t.lesson_type && t.lesson_type !== 'lesson' && (
                            <Pill variant="wash">{LESSON_TYPE_LABELS[t.lesson_type]?.label}</Pill>
                          )}
                        </div>
                        <p className="text-xs text-ink-muted">{contentSummary(t)}</p>
                        {t.summary && (
                          <p className="text-xs text-ink-muted mt-2 line-clamp-2">{t.summary}</p>
                        )}
                      </button>
                      <p className="text-xs text-ink-muted mt-2">
                        Created by{' '}
                        <button
                          onClick={(e) => { e.stopPropagation(); setFilterAuthor(t.author_name || 'Unknown') }}
                          className="hover:text-sky-text hover:underline"
                          title={`Show only ${t.author_name || 'Unknown'}'s templates`}
                        >
                          {t.author_name || 'Unknown'}
                        </button>
                        {' · Added '}
                        {formatAddedDate(t.created_at)}
                      </p>

                      {/* Quick actions */}
                      <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setAssigningTemplate(t) }}
                          className="px-2 py-1 bg-white border border-hairline rounded-tile text-xs text-ink-muted hover:text-sky-text hover:border-sky"
                          title="Add to folder"
                        >
                          Folder
                        </button>
                        {selectedFolderId && (
                          <button
                            onClick={e => { e.stopPropagation(); removeFromFolder(t.id) }}
                            className="px-2 py-1 bg-white border border-hairline rounded-tile text-xs text-ink-muted hover:text-incorrect-fg hover:border-incorrect-border"
                            title="Remove from this folder"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Exercise Preview Modal */}
      {previewExercise && (
        <ExercisePreview
          exercise={previewExercise}
          onClose={() => setPreviewExercise(null)}
        />
      )}
    </div>
  )
}

// Helper: get folder depth for indentation in flat list
function getFolderDepth(folders: Folder[], folderId: string): number {
  let depth = 0
  let current = folders.find(f => f.id === folderId)
  while (current?.parent_id) {
    depth++
    current = folders.find(f => f.id === current!.parent_id)
  }
  return depth
}
