'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ExercisePreview from '@/components/ExercisePreview'

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
  lesson: { label: 'Lesson', icon: '\uD83D\uDCDA' },
  mid_course_test: { label: 'Mid-Course Test', icon: '\uD83D\uDCDD' },
  final_test: { label: 'Final Test', icon: '\uD83C\uDF93' },
  review_test: { label: 'Review Test', icon: '\uD83D\uDD04' },
}

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
              className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                isSelected
                  ? 'bg-[#e6f0fa] text-[#416ebe] font-semibold'
                  : 'text-[#46464b] hover:bg-gray-100'
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              {/* Expand/collapse arrow */}
              <button
                onClick={e => { e.stopPropagation(); onToggleExpand(folder.id) }}
                className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-[#416ebe] shrink-0"
              >
                {hasChildren ? (isExpanded ? '\u25BE' : '\u25B8') : ''}
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
                <span className="text-xs text-gray-400 shrink-0">{folder.template_count}</span>
              )}

              {/* Context actions (visible on hover) */}
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); onCreateSubfolder(folder.id) }}
                  className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-[#416ebe] text-xs"
                  title="Add subfolder"
                >
                  +
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onRenameFolder(folder) }}
                  className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-[#416ebe] text-xs"
                  title="Rename"
                >
                  &#9998;
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteFolder(folder) }}
                  className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 text-xs"
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

export default function ContentBankPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLevel, setFilterLevel] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

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
    return parts.join(' \u00B7 ') || 'Empty'
  }

  const selectedFolderName = selectedFolderId
    ? folders.find(f => f.id === selectedFolderId)?.name || 'Folder'
    : null

  return (
    <div className="min-h-screen bg-[#f5f8fc] p-4 sm:p-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#416ebe] text-white px-5 py-3 rounded-xl text-xs font-bold shadow-lg">
          {toast}
        </div>
      )}

      {/* Clone Modal */}
      {showCloneModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-[#46464b] mb-1">Clone to Course</h3>
            <p className="text-xs text-gray-400 mb-4">
              &ldquo;{selectedTemplate.title}&rdquo; will be added as a draft lesson in the selected course.
            </p>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2 border border-[#cddcf0] rounded-lg text-sm mb-4"
            >
              <option value="">Select a course...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCloneModal(false); setSelectedCourseId('') }}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={cloneLesson}
                disabled={!selectedCourseId || cloning}
                className="px-5 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50"
              >
                {cloning ? 'Cloning...' : 'Clone Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {renamingFolder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#46464b] mb-3">Rename Folder</h3>
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameFolder()}
              className="w-full px-3 py-2 border border-[#cddcf0] rounded-lg text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRenamingFolder(null); setRenameValue('') }}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={renameFolder}
                disabled={!renameValue.trim()}
                className="px-5 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#46464b] mb-2">Delete Folder?</h3>
            <p className="text-xs text-gray-500 mb-4">
              &ldquo;{confirmDelete.name}&rdquo; and all subfolders will be deleted. Templates inside will not be deleted, just unlinked from the folder.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteFolder(confirmDelete)}
                className="px-5 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Exercise Confirmation Modal */}
      {confirmExerciseDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#46464b] mb-2">Delete Exercise?</h3>
            <p className="text-xs text-gray-500 mb-4">
              This will permanently delete the exercise. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmExerciseDelete(null)}
                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteExercise(confirmExerciseDelete); setConfirmExerciseDelete(null) }}
                className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Folder Modal */}
      {assigningTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#46464b] mb-1">Add to Folder</h3>
            <p className="text-xs text-gray-400 mb-4">
              Select a folder for &ldquo;{assigningTemplate.title}&rdquo;
            </p>
            {folders.length === 0 ? (
              <p className="text-xs text-gray-400 mb-4">No folders yet. Create one first.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto mb-4 border border-[#cddcf0] rounded-lg">
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => assignToFolder(assigningTemplate, f.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#e6f0fa] transition-colors border-b border-[#cddcf0] last:border-b-0"
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
              <button
                onClick={() => setAssigningTemplate(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#46464b] mb-1">Delete Template?</h3>
            <p className="text-xs text-gray-400 mb-4">
              This will permanently delete &ldquo;{deletingTemplate.title}&rdquo; and all its content. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingTemplate(null)}
                disabled={deleteInProgress}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTemplate(deletingTemplate)}
                disabled={deleteInProgress}
                className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteInProgress ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DETAIL VIEW ══════════ */}
      {selectedTemplate ? (
        <div className="max-w-4xl mx-auto">
          {/* Back + header */}
          <button
            onClick={() => { setSelectedTemplate(null); setFlashcards([]); setExercises([]); setBlocks([]) }}
            className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-2"
          >
            &larr; Back to Content Bank
          </button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#416ebe]">{selectedTemplate.title}</h1>
              <div className="flex gap-2 mt-2">
                {selectedTemplate.template_level && (
                  <span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-xs rounded-full font-medium">
                    {selectedTemplate.template_level}
                  </span>
                )}
                {selectedTemplate.template_category && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full font-medium">
                    {selectedTemplate.template_category}
                  </span>
                )}
                {selectedTemplate.lesson_type && selectedTemplate.lesson_type !== 'lesson' && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium">
                    {LESSON_TYPE_LABELS[selectedTemplate.lesson_type]?.icon} {LESSON_TYPE_LABELS[selectedTemplate.lesson_type]?.label}
                  </span>
                )}
              </div>
              {selectedTemplate.summary && (
                <p className="text-sm text-gray-500 mt-2">{selectedTemplate.summary}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setDeletingTemplate(selectedTemplate)}
                className="px-4 py-2.5 border border-red-200 text-red-400 text-xs font-bold rounded-xl hover:border-red-400 hover:text-red-500 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => router.push(`/admin/lessons?id=${selectedTemplate.id}`)}
                className="px-4 py-2.5 border border-[#cddcf0] text-[#46464b] text-xs font-bold rounded-xl hover:border-[#416ebe] hover:text-[#416ebe] transition-colors"
              >
                Edit Template
              </button>
              <button
                onClick={() => setAssigningTemplate(selectedTemplate)}
                className="px-4 py-2.5 border border-[#cddcf0] text-[#46464b] text-xs font-bold rounded-xl hover:border-[#416ebe] hover:text-[#416ebe] transition-colors"
              >
                Add to Folder
              </button>
              <button
                onClick={openCloneModal}
                className="px-5 py-2.5 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0] transition-colors shadow-sm"
              >
                Clone to Course
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <p className="text-center text-gray-400 py-12">Loading content...</p>
          ) : (
            <div className="space-y-4">
              {/* Flashcards */}
              {flashcards.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#cddcf0] p-5">
                  <h3 className="font-bold text-[#46464b] mb-3">
                    Flashcards <span className="text-xs font-normal text-gray-400">({flashcards.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {flashcards.map(fc => (
                      <div key={fc.id} className="bg-[#f5f8fc] rounded-lg p-3 border border-[#e6f0fa]">
                        <p className="font-bold text-sm text-[#416ebe]">{fc.word}</p>
                        {fc.phonetic && <p className="text-xs text-gray-400">{fc.phonetic}</p>}
                        <p className="text-xs text-[#46464b] mt-1">{fc.meaning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercises */}
              {exercises.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#cddcf0] p-5">
                  <h3 className="font-bold text-[#46464b] mb-3">
                    Exercises <span className="text-xs font-normal text-gray-400">({exercises.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {exercises.map(ex => {
                      const isExpanded = expandedExerciseId === ex.id
                      const isEditing = editingExercise?.id === ex.id
                      const editEx = isEditing ? editingExercise : ex
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const questions = (editEx.questions || []) as any[]

                      return (
                        <div key={ex.id} className="bg-[#f5f8fc] rounded-lg border border-[#e6f0fa] overflow-hidden">
                          {/* Collapsed header — clickable */}
                          <div
                            className="p-3 flex items-center gap-3 cursor-pointer hover:bg-[#edf4fc] transition-colors"
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
                              <p className="font-bold text-sm text-[#46464b]">{ex.title}</p>
                              <p className="text-xs text-gray-400">
                                {EXERCISE_TYPE_LABELS[ex.exercise_type] || ex.exercise_type}
                                {ex.subtitle && ` \u00B7 ${ex.subtitle}`}
                                {' \u00B7 '}
                                {questions.length} question{questions.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>&#x25BC;</span>
                          </div>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="border-t border-[#e6f0fa] p-4">
                              {/* Action buttons */}
                              <div className="flex gap-2 mb-4">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPreviewExercise(ex) }}
                                  className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
                                >
                                  ▶ Preview
                                </button>
                                {!isEditing ? (
                                  <button
                                    onClick={() => setEditingExercise({ ...ex, questions: ex.questions })}
                                    className="px-3 py-1.5 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                                  >
                                    Edit
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => saveExercise(editingExercise)}
                                      disabled={savingExercise}
                                      className="px-3 py-1.5 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors disabled:opacity-50"
                                    >
                                      {savingExercise ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => setEditingExercise(null)}
                                      className="px-3 py-1.5 border border-[#cddcf0] text-[#46464b] text-xs font-bold rounded-lg hover:border-[#416ebe] transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setConfirmExerciseDelete(ex.id)}
                                  className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors ml-auto"
                                >
                                  Delete
                                </button>
                              </div>

                              {/* Editable fields */}
                              {isEditing ? (
                                <div className="space-y-3 mb-4">
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Title</label>
                                    <input type="text" value={editEx.title} onChange={(e) => setEditingExercise({ ...editEx, title: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe]" />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Instructions</label>
                                    <textarea value={editEx.instructions} onChange={(e) => setEditingExercise({ ...editEx, instructions: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] h-16 resize-y" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type</label>
                                      <select
                                        value={editEx.exercise_type}
                                        disabled={convertingType}
                                        onChange={(e) => convertExerciseType(editEx, e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-[#cddcf0] rounded-lg bg-white disabled:opacity-50"
                                      >
                                        {Object.entries(EXERCISE_TYPE_LABELS).map(([val, label]) => (
                                          <option key={val} value={val}>{label}</option>
                                        ))}
                                      </select>
                                      {convertingType && (
                                        <p className="text-[10px] text-[#416ebe] mt-1 flex items-center gap-1">
                                          <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-[#416ebe] border-t-transparent rounded-full" />
                                          Converting questions...
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subtitle</label>
                                      <input type="text" value={editEx.subtitle} onChange={(e) => setEditingExercise({ ...editEx, subtitle: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe]" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mb-4">
                                  {editEx.instructions && (
                                    <p className="text-xs text-gray-500 italic mb-2">{editEx.instructions}</p>
                                  )}
                                </div>
                              )}

                              {/* Questions list */}
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Questions</p>
                                {questions.map((q: { id?: number; prompt?: string; statement?: string; word?: string; text?: string; options?: string[]; correctIndex?: number; answer?: string; isTrue?: boolean; explanation?: string; clue?: string; hint?: string; blanks?: Record<string, string>; wordBank?: string[] }, qi: number) => (
                                  <div key={q.id || qi} className="bg-white rounded-lg p-3 border border-[#e6f0fa] text-xs">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-400 font-bold w-5">{qi + 1}.</span>
                                          <input
                                            type="text"
                                            value={q.prompt || q.statement || q.word || q.text || ''}
                                            onChange={(e) => {
                                              const updated = [...questions]
                                              const field = q.prompt !== undefined ? 'prompt' : q.statement !== undefined ? 'statement' : q.word !== undefined ? 'word' : 'text'
                                              updated[qi] = { ...updated[qi], [field]: e.target.value }
                                              setEditingExercise({ ...editEx, questions: updated })
                                            }}
                                            className="flex-1 px-2 py-1 border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe] text-xs"
                                          />
                                        </div>
                                        {q.options && (
                                          <div className="ml-7 space-y-1">
                                            {q.options.map((opt: string, oi: number) => (
                                              <div key={oi} className="flex items-center gap-2">
                                                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] ${oi === q.correctIndex ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-300'}`}>
                                                  {oi === q.correctIndex ? '✓' : ''}
                                                </span>
                                                <input
                                                  type="text"
                                                  value={opt}
                                                  onChange={(e) => {
                                                    const updated = [...questions]
                                                    const newOpts = [...(updated[qi].options || [])]
                                                    newOpts[oi] = e.target.value
                                                    updated[qi] = { ...updated[qi], options: newOpts }
                                                    setEditingExercise({ ...editEx, questions: updated })
                                                  }}
                                                  className="flex-1 px-2 py-1 border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe] text-xs"
                                                />
                                                <button
                                                  onClick={() => {
                                                    const updated = [...questions]
                                                    updated[qi] = { ...updated[qi], correctIndex: oi }
                                                    setEditingExercise({ ...editEx, questions: updated })
                                                  }}
                                                  className={`text-[10px] px-1.5 py-0.5 rounded ${oi === q.correctIndex ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500'}`}
                                                >
                                                  correct
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {q.answer !== undefined && (
                                          <div className="ml-7 flex items-center gap-2">
                                            <span className="text-gray-400">Answer:</span>
                                            <input
                                              type="text"
                                              value={q.answer}
                                              onChange={(e) => {
                                                const updated = [...questions]
                                                updated[qi] = { ...updated[qi], answer: e.target.value }
                                                setEditingExercise({ ...editEx, questions: updated })
                                              }}
                                              className="flex-1 px-2 py-1 border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe] text-xs"
                                            />
                                          </div>
                                        )}
                                        {q.explanation !== undefined && (
                                          <div className="ml-7 flex items-center gap-2">
                                            <span className="text-gray-400">Explanation:</span>
                                            <input
                                              type="text"
                                              value={q.explanation}
                                              onChange={(e) => {
                                                const updated = [...questions]
                                                updated[qi] = { ...updated[qi], explanation: e.target.value }
                                                setEditingExercise({ ...editEx, questions: updated })
                                              }}
                                              className="flex-1 px-2 py-1 border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe] text-xs"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <p className="text-[#46464b]">
                                          <span className="text-gray-400 font-bold">{qi + 1}.</span>{' '}
                                          {q.prompt || q.statement || (q.word && `Guess: ${q.word}`) || q.text || ''}
                                        </p>
                                        {q.options && (
                                          <div className="ml-5 mt-1 space-y-0.5">
                                            {q.options.map((opt: string, oi: number) => (
                                              <p key={oi} className={oi === q.correctIndex ? 'text-green-600 font-medium' : 'text-gray-400'}>
                                                {String.fromCharCode(97 + oi)}) {opt} {oi === q.correctIndex && '✓'}
                                              </p>
                                            ))}
                                          </div>
                                        )}
                                        {q.answer !== undefined && (
                                          <p className="ml-5 mt-1 text-green-600 font-medium">Answer: {q.answer}</p>
                                        )}
                                        {q.isTrue !== undefined && (
                                          <p className="ml-5 mt-1 text-green-600 font-medium">{q.isTrue ? 'True' : 'False'}</p>
                                        )}
                                        {q.clue && (
                                          <p className="ml-5 mt-1 text-gray-400">Clue: {q.clue}</p>
                                        )}
                                        {q.explanation && (
                                          <p className="ml-5 mt-1 text-gray-400 italic">{q.explanation}</p>
                                        )}
                                        {q.wordBank && (
                                          <p className="ml-5 mt-1 text-gray-400">Word bank: {q.wordBank.join(', ')}</p>
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
                </div>
              )}

              {/* Content Blocks */}
              {blocks.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#cddcf0] p-5">
                  <h3 className="font-bold text-[#46464b] mb-3">
                    Content Blocks <span className="text-xs font-normal text-gray-400">({blocks.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {blocks.map(b => (
                      <div key={b.id} className="bg-[#f5f8fc] rounded-lg p-3 border border-[#e6f0fa]">
                        <p className="font-bold text-sm text-[#46464b]">
                          {BLOCK_TYPE_LABELS[b.block_type] || b.block_type}
                          {b.title && `: ${b.title}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {flashcards.length === 0 && exercises.length === 0 && blocks.length === 0 && (
                <p className="text-center text-gray-400 py-8">This template has no content yet.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ══════════ LIST VIEW WITH FOLDER SIDEBAR ══════════ */
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <button
                onClick={() => router.push('/admin')}
                className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1"
              >
                &larr; Admin Console
              </button>
              <h1 className="text-2xl font-bold text-[#416ebe]">Content Bank</h1>
              <p className="text-xs text-gray-400 mt-1">Browse shared lesson templates. Clone or cherry-pick content into your lessons.</p>
            </div>
            <button
              onClick={() => router.push('/admin/lessons?mode=content-bank')}
              className="px-5 py-2.5 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0] transition-colors shadow-sm shrink-0"
            >
              + Create Template
            </button>
          </div>

          <div className="flex gap-6">
            {/* ── Folder Sidebar ── */}
            <div className="w-56 shrink-0">
              <div className="bg-white rounded-2xl border border-[#cddcf0] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-[#46464b]">Folders</h3>
                  <button
                    onClick={() => { setShowNewFolder(true); setNewFolderParentId(null) }}
                    className="text-xs text-[#416ebe] hover:text-[#3560b0] font-bold"
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
                      className="w-full px-2 py-1.5 border border-[#cddcf0] rounded-lg text-xs mb-1"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={createFolder}
                        disabled={!newFolderName.trim()}
                        className="px-2 py-1 bg-[#416ebe] text-white text-xs rounded-lg disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setShowNewFolder(false); setNewFolderName(''); setNewFolderParentId(null) }}
                        className="px-2 py-1 text-xs text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* "All Templates" option */}
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm mb-1 transition-colors ${
                    selectedFolderId === null
                      ? 'bg-[#e6f0fa] text-[#416ebe] font-semibold'
                      : 'text-[#46464b] hover:bg-gray-100'
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
                  <p className="text-xs text-gray-300 mt-2">No folders yet.</p>
                )}
              </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 min-w-0">
              {/* Active folder label + Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {selectedFolderName && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#46464b]">{selectedFolderName}</span>
                    <button
                      onClick={() => setSelectedFolderId(null)}
                      className="text-xs text-gray-400 hover:text-[#416ebe]"
                    >
                      &times; Clear
                    </button>
                  </div>
                )}
                <select
                  value={filterLevel}
                  onChange={e => setFilterLevel(e.target.value)}
                  className="px-3 py-2 border border-[#cddcf0] rounded-lg text-sm bg-white"
                >
                  <option value="">All Levels</option>
                  {LEVELS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border border-[#cddcf0] rounded-lg text-sm bg-white"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Templates grid */}
              {loading ? (
                <p className="text-center text-gray-400 py-12">Loading templates...</p>
              ) : templates.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-gray-400 mb-2">
                    {selectedFolderId ? 'No templates in this folder.' : 'No templates found.'}
                  </p>
                  <p className="text-xs text-gray-300">
                    {selectedFolderId
                      ? 'Open a template and click "Add to Folder" to organize it here.'
                      : 'Create a template with the button above, or mark an existing lesson as "Share as Template" in the Lesson Manager.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      className="bg-white rounded-2xl border border-[#cddcf0] p-5 hover:shadow-md hover:border-[#416ebe] transition-all group relative"
                    >
                      <button
                        onClick={() => openTemplate(t)}
                        className="w-full text-left"
                      >
                        <h3 className="font-bold text-[#46464b] group-hover:text-[#416ebe] transition-colors mb-1">
                          {t.title}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {t.template_level && (
                            <span className="px-2 py-0.5 bg-[#e6f0fa] text-[#416ebe] text-xs rounded-full">
                              {t.template_level}
                            </span>
                          )}
                          {t.template_category && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">
                              {t.template_category}
                            </span>
                          )}
                          {t.lesson_type && t.lesson_type !== 'lesson' && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                              {LESSON_TYPE_LABELS[t.lesson_type]?.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{contentSummary(t)}</p>
                        {t.summary && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{t.summary}</p>
                        )}
                      </button>

                      {/* Quick actions */}
                      <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setAssigningTemplate(t) }}
                          className="px-2 py-1 bg-white border border-[#cddcf0] rounded-lg text-xs text-gray-500 hover:text-[#416ebe] hover:border-[#416ebe]"
                          title="Add to folder"
                        >
                          Folder
                        </button>
                        {selectedFolderId && (
                          <button
                            onClick={e => { e.stopPropagation(); removeFromFolder(t.id) }}
                            className="px-2 py-1 bg-white border border-[#cddcf0] rounded-lg text-xs text-gray-500 hover:text-red-500 hover:border-red-300"
                            title="Remove from this folder"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
