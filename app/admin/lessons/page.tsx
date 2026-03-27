'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Role-based admin check

// ── Types ──

interface Lesson {
  id: string
  title: string
  lesson_date: string
  summary: string | null
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
  flashcard_count?: number
  exercise_count?: number
  block_counts?: Record<string, number>
}

interface Flashcard {
  id?: string
  lesson_id?: string
  word: string
  phonetic: string
  meaning: string
  example: string
  notes: string
  order_index: number
}

interface ExerciseQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  hint: string
}

interface Exercise {
  id?: string
  lesson_id?: string
  title: string
  subtitle: string
  icon: string
  instructions: string
  exercise_type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions: any  // Shape varies by exercise_type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupData?: any  // For group_sort type
  order_index: number
}

const EXERCISE_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: '\uD83C\uDFAF' },
  { value: 'fill_blank', label: 'Fill in the Blank', icon: '\u270D\uFE0F' },
  { value: 'match_halves', label: 'Match Halves', icon: '\uD83E\uDDE9' },
  { value: 'unjumble', label: 'Unjumble', icon: '\uD83D\uDD00' },
  { value: 'transform', label: 'Transform', icon: '\uD83D\uDD04' },
  { value: 'true_or_false', label: 'True or False', icon: '\u2705' },
  { value: 'hangman', label: 'Hangman', icon: '\uD83C\uDFAE' },
  { value: 'type_answer', label: 'Type the Answer', icon: '\u2328\uFE0F' },
  { value: 'complete_sentence', label: 'Complete the Sentence', icon: '\uD83D\uDCDD' },
  { value: 'group_sort', label: 'Group Sort', icon: '\uD83D\uDDC2\uFE0F' },
]

// ── Content Block Types ──

interface MistakePractice {
  prompt: string
  options: string[]
  correctIndex: number
}

interface Mistake {
  original: string
  correction: string
  explanation: string
  practice: MistakePractice[]
}

interface MistakesContent {
  mistakes: Mistake[]
}

interface MCQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
}

interface VideoContent {
  youtube_url: string
  questions: MCQuestion[]
}

interface ArticleContent {
  text: string
  source: string
  questions: MCQuestion[]
}

interface DialogueContent {
  scenario: string
  target_words: string[]
  starter_message: string
}

interface GrammarContent {
  explanation: string
  examples: string[]
  exercises: MCQuestion[]
}

interface WritingContent {
  prompt: string
  guidelines: string
  word_limit: number
}

interface PronunciationWord {
  word: string
  phonetic: string
  tips: string
}

interface PronunciationContent {
  words: PronunciationWord[]
}

type BlockContent = MistakesContent | VideoContent | ArticleContent | DialogueContent | GrammarContent | WritingContent | PronunciationContent

type BlockType = 'mistakes' | 'video' | 'article' | 'dialogue' | 'grammar' | 'writing' | 'pronunciation'

interface ContentBlock {
  id?: string
  lesson_id?: string
  block_type: BlockType
  title: string
  content: BlockContent
  order_index: number
  collapsed?: boolean
}

// Unified content item: can be flashcards, exercise, or a content block
type ContentItemType = 'flashcards' | 'exercise' | BlockType
interface ContentItem {
  type: ContentItemType
  // For flashcards: stores the flashcards array
  // For exercise: stores the Exercise object
  // For blocks: stores the ContentBlock
  data: Flashcard[] | Exercise | ContentBlock
  collapsed: boolean
  order_index: number
}

type View = 'list' | 'editor'

// ── Block Config ──

const BLOCK_CONFIG: Record<ContentItemType, { label: string; icon: string; color: string }> = {
  flashcards: { label: 'Vocabulary / Flashcards', icon: '\uD83D\uDCDA', color: '#416ebe' },
  exercise: { label: 'Exercise', icon: '\uD83C\uDFAF', color: '#8b5cf6' },
  mistakes: { label: 'Error Corrections', icon: '\u2757', color: '#ef4444' },
  video: { label: 'Video', icon: '\uD83C\uDFAC', color: '#f59e0b' },
  article: { label: 'Reading / Article', icon: '\uD83D\uDCF0', color: '#10b981' },
  dialogue: { label: 'AI Dialogue Practice', icon: '\uD83D\uDCAC', color: '#06b6d4' },
  grammar: { label: 'Grammar', icon: '\uD83D\uDCD6', color: '#8b5cf6' },
  writing: { label: 'Writing Task', icon: '\u270F\uFE0F', color: '#f97316' },
  pronunciation: { label: 'Pronunciation', icon: '\uD83D\uDD0A', color: '#ec4899' },
}

// ── Helper: create default content for each block type ──

function createDefaultContent(type: BlockType): BlockContent {
  switch (type) {
    case 'mistakes':
      return { mistakes: [{ original: '', correction: '', explanation: '', practice: [] }] }
    case 'video':
      return { youtube_url: '', questions: [] }
    case 'article':
      return { text: '', source: '', questions: [] }
    case 'dialogue':
      return { scenario: '', target_words: [], starter_message: '' }
    case 'grammar':
      return { explanation: '', examples: [''], exercises: [] }
    case 'writing':
      return { prompt: '', guidelines: '', word_limit: 150 }
    case 'pronunciation':
      return { words: [{ word: '', phonetic: '', tips: '' }] }
  }
}

function createDefaultExercise(orderIndex: number): Exercise {
  return {
    title: '',
    subtitle: '',
    icon: '',
    instructions: '',
    exercise_type: 'multiple-choice',
    questions: [{ id: crypto.randomUUID(), prompt: '', options: ['', '', '', ''], correctIndex: 0, hint: '' }],
    order_index: orderIndex,
  }
}

function createMCQuestion(): MCQuestion {
  return { id: crypto.randomUUID(), prompt: '', options: ['', '', '', ''], correctIndex: 0 }
}

// ── Helpers ──

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export default function LessonsAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // ── State ──
  const [view, setView] = useState<View>('list')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // Editor state
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [lessonDate, setLessonDate] = useState('')
  const [summary, setSummary] = useState('')

  // Content items (unified list of all content blocks)
  const [contentItems, setContentItems] = useState<ContentItem[]>([])

  // AI generation state
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false)
  const [generatingExercise, setGeneratingExercise] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string; base64: string; type: string }[]>([])
  const [exerciseTextInput, setExerciseTextInput] = useState('')
  const [preferredExType, setPreferredExType] = useState('')

  // Google Drive import state
  const [googleDocUrl, setGoogleDocUrl] = useState('')
  const [importingDoc, setImportingDoc] = useState(false)
  const [importResult, setImportResult] = useState<{ flashcards: Flashcard[]; summary: string; mistakes: Mistake[]; docPreview: string; suggestedTitle?: string } | null>(null)

  // Saving state
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // Add block dropdown
  const [showAddMenu, setShowAddMenu] = useState(false)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load Lessons ──

  const loadLessons = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lessons?include_all=true')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setLessons(data.lessons || [])
    } catch {
      showToast('Failed to load lessons')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) loadLessons()
  }, [status, isAdmin, loadLessons])

  // ── Load Lesson for Editing ──

  const loadLessonForEditing = async (lesson: Lesson) => {
    setEditingLessonId(lesson.id)
    setTitle(lesson.title)
    setLessonDate(lesson.lesson_date)
    setSummary(lesson.summary || '')
    setUploadedImages([])
    setGoogleDocUrl('')
    setImportResult(null)
    setView('editor')

    try {
      const res = await fetch(`/api/lessons?id=${lesson.id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()

      const items: ContentItem[] = []
      let orderIdx = 0

      // Load flashcards as a single content item (if any)
      const flashcards: Flashcard[] = (data.flashcards || []).map((fc: Flashcard) => ({
        id: fc.id,
        lesson_id: fc.lesson_id,
        word: fc.word,
        phonetic: fc.phonetic,
        meaning: fc.meaning,
        example: fc.example,
        notes: fc.notes || '',
        order_index: fc.order_index,
      }))
      if (flashcards.length > 0) {
        items.push({ type: 'flashcards', data: flashcards, collapsed: true, order_index: orderIdx++ })
      }

      // Load exercises as individual content items
      const exercises: Exercise[] = (data.exercises || []).map((ex: Exercise) => ({
        id: ex.id,
        lesson_id: ex.lesson_id,
        title: ex.title,
        subtitle: ex.subtitle || '',
        icon: ex.icon || '',
        instructions: ex.instructions || '',
        exercise_type: ex.exercise_type,
        questions: ex.exercise_type === 'group_sort' ? [] : (ex.questions || []),
        groupData: ex.exercise_type === 'group_sort' ? (ex.questions || ex.groupData) : ex.groupData,
        order_index: ex.order_index,
      }))
      exercises.forEach((ex) => {
        items.push({ type: 'exercise', data: ex, collapsed: true, order_index: orderIdx++ })
      })

      // Load content blocks
      const blocks: ContentBlock[] = (data.blocks || []).map((b: ContentBlock) => ({
        id: b.id,
        lesson_id: b.lesson_id,
        block_type: b.block_type,
        title: b.title || '',
        content: b.content,
        order_index: b.order_index,
      }))
      blocks.forEach((block) => {
        items.push({ type: block.block_type, data: block, collapsed: true, order_index: orderIdx++ })
      })

      setContentItems(items)
    } catch {
      showToast('Failed to load lesson data')
    }
  }

  // ── New Lesson ──

  const startNewLesson = () => {
    setEditingLessonId(null)
    setTitle('')
    setLessonDate(new Date().toISOString().slice(0, 10))
    setSummary('')
    setContentItems([])
    setUploadedImages([])
    setGoogleDocUrl('')
    setImportResult(null)
    setView('editor')
  }

  // ── Content Item Management ──

  const addContentItem = (type: ContentItemType) => {
    setShowAddMenu(false)
    const newIndex = contentItems.length

    if (type === 'flashcards') {
      // Check if flashcards block already exists
      const existing = contentItems.find((i) => i.type === 'flashcards')
      if (existing) {
        showToast('Vocabulary block already exists. Expand it to edit.')
        return
      }
      setContentItems((prev) => [
        ...prev,
        { type: 'flashcards', data: [] as Flashcard[], collapsed: false, order_index: newIndex },
      ])
    } else if (type === 'exercise') {
      setContentItems((prev) => [
        ...prev,
        { type: 'exercise', data: createDefaultExercise(newIndex), collapsed: false, order_index: newIndex },
      ])
    } else {
      const blockType = type as BlockType
      const block: ContentBlock = {
        block_type: blockType,
        title: '',
        content: createDefaultContent(blockType),
        order_index: newIndex,
      }
      setContentItems((prev) => [
        ...prev,
        { type: blockType, data: block, collapsed: false, order_index: newIndex },
      ])
    }
  }

  const removeContentItem = (index: number) => {
    setContentItems((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order_index: i })))
  }

  const toggleCollapse = (index: number) => {
    setContentItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], collapsed: !updated[index].collapsed }
      return updated
    })
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= contentItems.length) return
    setContentItems((prev) => {
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[newIndex]
      updated[newIndex] = temp
      return updated.map((item, i) => ({ ...item, order_index: i }))
    })
  }

  const updateContentItem = (index: number, data: ContentItem['data']) => {
    setContentItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], data }
      return updated
    })
  }

  // ── AI Generation: Flashcards ──

  const generateFlashcards = async (itemIndex: number) => {
    if (!summary.trim()) {
      showToast('Please paste a class summary in the Summary field first')
      return
    }
    setGeneratingFlashcards(true)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-flashcards', summary: summary.trim() }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const existingFlashcards = contentItems[itemIndex].data as Flashcard[]
      const generated: Flashcard[] = (data.flashcards || []).map(
        (fc: { word: string; phonetic: string; meaning: string; example: string; notes: string }, i: number) => ({
          word: fc.word || '',
          phonetic: fc.phonetic || '',
          meaning: fc.meaning || '',
          example: fc.example || '',
          notes: fc.notes || '',
          order_index: existingFlashcards.length + i,
        })
      )
      updateContentItem(itemIndex, [...existingFlashcards, ...generated])
      // Auto-fill title if empty and AI suggested one
      if (!title.trim() && data.suggestedTitle) {
        setTitle(data.suggestedTitle)
      }
      showToast(`Generated ${generated.length} flashcards${data.suggestedTitle && !title.trim() ? ' + suggested title' : ''}`)
    } catch {
      showToast('Failed to generate flashcards')
    }
    setGeneratingFlashcards(false)
  }

  // ── AI Generation: Exercises from Image ──

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newImages: { file: File; preview: string; base64: string; type: string }[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const base64 = await fileToBase64(file)
      newImages.push({ file, preview: URL.createObjectURL(file), base64, type: file.type || 'image/png' })
    }
    setUploadedImages((prev) => [...prev, ...newImages])
    e.target.value = ''
  }

  const removeUploadedImage = (index: number) => {
    setUploadedImages((prev) => {
      const newArr = [...prev]
      URL.revokeObjectURL(newArr[index].preview)
      newArr.splice(index, 1)
      return newArr
    })
  }

  const generateExerciseFromImage = async (imageIndex: number, contentItemIndex: number, preferredType?: string) => {
    const img = uploadedImages[imageIndex]
    if (!img) return

    setGeneratingExercise(true)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-exercises',
          image: img.base64,
          imageType: img.type,
          preferredType: preferredType || undefined,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      if (data.exercise) {
        applyGeneratedExercise(data.exercise, contentItemIndex)
      }
    } catch {
      showToast('Failed to generate exercise from image')
    }
    setGeneratingExercise(false)
  }

  const generateExerciseFromText = async (text: string, contentItemIndex: number, preferredType?: string) => {
    if (!text.trim()) {
      showToast('Please enter some text content')
      return
    }
    setGeneratingExercise(true)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-exercises',
          text: text.trim(),
          preferredType: preferredType || undefined,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      if (data.exercise) {
        applyGeneratedExercise(data.exercise, contentItemIndex)
      }
    } catch {
      showToast('Failed to generate exercise from text')
    }
    setGeneratingExercise(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyGeneratedExercise = (generated: any, contentItemIndex: number) => {
    const exercise = contentItems[contentItemIndex].data as Exercise
    const updatedExercise: Exercise = {
      ...exercise,
      title: generated.title || exercise.title || 'Untitled Exercise',
      subtitle: generated.subtitle || exercise.subtitle || '',
      icon: generated.icon || exercise.icon || '',
      instructions: generated.instructions || exercise.instructions || '',
      exercise_type: generated.exercise_type || exercise.exercise_type || 'multiple_choice',
      questions: generated.questions || exercise.questions || [],
      groupData: generated.groupData || exercise.groupData || undefined,
    }
    updateContentItem(contentItemIndex, updatedExercise)
    showToast(`Generated ${generated.exercise_type || 'exercise'}: ${updatedExercise.title}`)
  }

  // ── Google Drive Import ──

  const importFromGoogleDoc = async () => {
    if (!googleDocUrl.trim()) {
      showToast('Please paste a Google Docs link')
      return
    }
    setImportingDoc(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import-google-doc', url: googleDocUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to import document')
        setImportingDoc(false)
        return
      }
      const flashcards: Flashcard[] = (data.flashcards || []).map(
        (fc: { word: string; phonetic: string; meaning: string; example: string; notes: string }, i: number) => ({
          word: fc.word || '',
          phonetic: fc.phonetic || '',
          meaning: fc.meaning || '',
          example: fc.example || '',
          notes: fc.notes || '',
          order_index: i,
        })
      )
      const mistakes: Mistake[] = (data.mistakes || []).map(
        (m: { original: string; correction: string; explanation: string; practice: MistakePractice[] }) => ({
          original: m.original || '',
          correction: m.correction || '',
          explanation: m.explanation || '',
          practice: m.practice || [],
        })
      )
      // Auto-fill title if empty and AI suggested one
      if (!title.trim() && data.suggestedTitle) {
        setTitle(data.suggestedTitle)
      }
      setImportResult({
        flashcards,
        summary: data.summary || '',
        mistakes,
        docPreview: data.docText || '',
        suggestedTitle: data.suggestedTitle || '',
      })
      showToast(`Imported! ${flashcards.length} flashcards, ${mistakes.length} mistakes found.${data.suggestedTitle && !title.trim() ? ' Title suggested!' : ''}`)
    } catch {
      showToast('Failed to import from Google Doc')
    }
    setImportingDoc(false)
  }

  const applyImportResults = (applyFlashcards: boolean, applySummary: boolean, applyMistakes: boolean) => {
    if (!importResult) return
    const newItems = [...contentItems]
    let nextIndex = newItems.length

    if (applySummary && importResult.summary) {
      setSummary(importResult.summary)
    }

    if (applyFlashcards && importResult.flashcards.length > 0) {
      const existingIdx = newItems.findIndex((i) => i.type === 'flashcards')
      if (existingIdx >= 0) {
        const existing = newItems[existingIdx].data as Flashcard[]
        const merged = [...existing, ...importResult.flashcards.map((fc, i) => ({ ...fc, order_index: existing.length + i }))]
        newItems[existingIdx] = { ...newItems[existingIdx], data: merged }
      } else {
        newItems.push({ type: 'flashcards', data: importResult.flashcards, collapsed: false, order_index: nextIndex++ })
      }
    }

    if (applyMistakes && importResult.mistakes.length > 0) {
      const existingIdx = newItems.findIndex((i) => i.type === 'mistakes')
      if (existingIdx >= 0) {
        const block = newItems[existingIdx].data as ContentBlock
        const existingMistakes = (block.content as MistakesContent).mistakes
        const merged: MistakesContent = { mistakes: [...existingMistakes, ...importResult.mistakes] }
        newItems[existingIdx] = { ...newItems[existingIdx], data: { ...block, content: merged } }
      } else {
        const block: ContentBlock = {
          block_type: 'mistakes',
          title: 'Common Mistakes',
          content: { mistakes: importResult.mistakes } as MistakesContent,
          order_index: nextIndex++,
        }
        newItems.push({ type: 'mistakes', data: block, collapsed: false, order_index: nextIndex - 1 })
      }
    }

    setContentItems(newItems.map((item, i) => ({ ...item, order_index: i })))
    setImportResult(null)
    setGoogleDocUrl('')
    showToast('Content added to lesson!')
  }

  // ── Save / Publish ──

  const saveLesson = async (newStatus: 'draft' | 'published') => {
    if (!title.trim()) {
      showToast('Please enter a lesson title')
      return
    }
    if (!lessonDate) {
      showToast('Please set a lesson date')
      return
    }

    const isSavingDraft = newStatus === 'draft'
    if (isSavingDraft) setSaving(true)
    else setPublishing(true)

    try {
      let lessonId = editingLessonId

      if (lessonId) {
        const { error } = await supabase
          .from('lessons')
          .update({
            title: title.trim(),
            lesson_date: lessonDate,
            summary: summary.trim() || null,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lessonId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('lessons')
          .insert({
            title: title.trim(),
            lesson_date: lessonDate,
            summary: summary.trim() || null,
            status: newStatus,
          })
          .select('id')
          .single()
        if (error) throw error
        lessonId = data.id
        setEditingLessonId(lessonId)
      }

      // Extract flashcards, exercises, and blocks from content items
      // Use the unified order_index from contentItems position so the student
      // sees blocks in the same order the admin arranged them.
      let flashcards: Flashcard[] = []
      let flashcardsGlobalOrder = 0
      const exercises: { exercise: Exercise; globalOrder: number }[] = []
      const blocks: { block: ContentBlock; globalOrder: number }[] = []

      contentItems.forEach((item, idx) => {
        if (item.type === 'flashcards') {
          flashcards = item.data as Flashcard[]
          flashcardsGlobalOrder = idx
        } else if (item.type === 'exercise') {
          exercises.push({ exercise: item.data as Exercise, globalOrder: idx })
        } else {
          blocks.push({ block: item.data as ContentBlock, globalOrder: idx })
        }
      })

      // Save flashcards: delete existing, then insert all
      // Use globalOrder * 1000 + individual index to encode both global position and card order
      await supabase.from('lesson_flashcards').delete().eq('lesson_id', lessonId)
      if (flashcards.length > 0) {
        const fcRows = flashcards.map((fc, i) => ({
          lesson_id: lessonId,
          word: fc.word,
          phonetic: fc.phonetic,
          meaning: fc.meaning,
          example: fc.example,
          notes: fc.notes,
          order_index: flashcardsGlobalOrder * 1000 + i,
        }))
        const { error: fcError } = await supabase.from('lesson_flashcards').insert(fcRows)
        if (fcError) throw fcError
      }

      // Save exercises: delete existing, then insert all
      await supabase.from('lesson_exercises').delete().eq('lesson_id', lessonId)
      if (exercises.length > 0) {
        const exRows = exercises.map(({ exercise: ex, globalOrder }) => ({
          lesson_id: lessonId,
          title: ex.title,
          subtitle: ex.subtitle,
          icon: ex.icon,
          instructions: ex.instructions,
          exercise_type: ex.exercise_type,
          // For group_sort, store groupData in the questions JSONB column
          questions: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.questions,
          order_index: globalOrder,
        }))
        const { error: exError } = await supabase.from('lesson_exercises').insert(exRows)
        if (exError) throw exError
      }

      // Save content blocks: delete existing, then insert all
      await supabase.from('lesson_blocks').delete().eq('lesson_id', lessonId)
      if (blocks.length > 0) {
        const blockRows = blocks.map(({ block: b, globalOrder }) => ({
          lesson_id: lessonId,
          block_type: b.block_type,
          title: b.title,
          content: b.content,
          order_index: globalOrder,
        }))
        const { error: blockError } = await supabase.from('lesson_blocks').insert(blockRows)
        if (blockError) throw blockError
      }

      showToast(newStatus === 'published' ? 'Lesson published!' : 'Draft saved!')
      await loadLessons()
    } catch (err) {
      console.error(err)
      showToast('Failed to save lesson')
    }

    setSaving(false)
    setPublishing(false)
  }

  // ── Delete Lesson ──

  const deleteLesson = async (lessonId: string) => {
    try {
      // Get block IDs to clean up dialogue messages
      const { data: blockData } = await supabase.from('lesson_blocks').select('id').eq('lesson_id', lessonId)
      if (blockData && blockData.length > 0) {
        const blockIds = blockData.map((b: { id: string }) => b.id)
        await supabase.from('dialogue_messages').delete().in('block_id', blockIds)
      }
      await supabase.from('lesson_flashcards').delete().eq('lesson_id', lessonId)
      await supabase.from('lesson_exercises').delete().eq('lesson_id', lessonId)
      await supabase.from('lesson_blocks').delete().eq('lesson_id', lessonId)
      await supabase.from('lessons').delete().eq('id', lessonId)
      showToast('Lesson deleted')
      setShowDeleteConfirm(null)
      await loadLessons()
    } catch {
      showToast('Failed to delete lesson')
    }
  }

  // ══════════════════════════════════════════
  // BLOCK EDITORS
  // ══════════════════════════════════════════

  // ── Flashcards Editor ──

  const renderFlashcardsEditor = (itemIndex: number) => {
    const flashcards = contentItems[itemIndex].data as Flashcard[]

    const updateFlashcard = (fcIndex: number, field: keyof Flashcard, value: string) => {
      const updated = [...flashcards]
      updated[fcIndex] = { ...updated[fcIndex], [field]: value }
      updateContentItem(itemIndex, updated)
    }

    const removeFlashcard = (fcIndex: number) => {
      const updated = flashcards.filter((_, i) => i !== fcIndex).map((fc, i) => ({ ...fc, order_index: i }))
      updateContentItem(itemIndex, updated)
    }

    const addBlankFlashcard = () => {
      updateContentItem(itemIndex, [
        ...flashcards,
        { word: '', phonetic: '', meaning: '', example: '', notes: '', order_index: flashcards.length },
      ])
    }

    return (
      <div className="space-y-4">
        {/* AI Generation */}
        <div className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
          <p className="text-xs font-bold text-gray-500 mb-2">AI Generation</p>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Paste your class summary here to generate flashcards with AI..."
            className="w-full h-24 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors mb-2"
          />
          <button
            onClick={() => generateFlashcards(itemIndex)}
            disabled={generatingFlashcards || !summary.trim()}
            className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors disabled:opacity-50"
          >
            {generatingFlashcards ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              'Generate with AI'
            )}
          </button>
        </div>

        {/* Cards */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500">{flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''}</p>
          <button onClick={addBlankFlashcard} className="text-xs text-[#416ebe] font-bold hover:underline">+ Add Manually</button>
        </div>

        {flashcards.map((fc, fcIdx) => (
          <div key={fcIdx} className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold text-[#416ebe]">#{fcIdx + 1}</span>
              <button onClick={() => removeFlashcard(fcIdx)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                &#x2715; Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Word</label>
                <input type="text" value={fc.word} onChange={(e) => updateFlashcard(fcIdx, 'word', e.target.value)}
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Phonetic</label>
                <input type="text" value={fc.phonetic} onChange={(e) => updateFlashcard(fcIdx, 'phonetic', e.target.value)}
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Meaning</label>
              <input type="text" value={fc.meaning} onChange={(e) => updateFlashcard(fcIdx, 'meaning', e.target.value)}
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
            </div>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Example</label>
              <input type="text" value={fc.example} onChange={(e) => updateFlashcard(fcIdx, 'example', e.target.value)}
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Notes</label>
              <input type="text" value={fc.notes} onChange={(e) => updateFlashcard(fcIdx, 'notes', e.target.value)}
                placeholder="Optional notes..."
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Exercise Editor ──

  const renderExerciseEditor = (itemIndex: number) => {
    const exercise = contentItems[itemIndex].data as Exercise

    const updateField = (field: keyof Exercise, value: string) => {
      updateContentItem(itemIndex, { ...exercise, [field]: value })
    }

    const updateQuestion = (qIndex: number, field: keyof ExerciseQuestion, value: string | number | string[]) => {
      const questions = [...exercise.questions]
      questions[qIndex] = { ...questions[qIndex], [field]: value }
      updateContentItem(itemIndex, { ...exercise, questions })
    }

    const addQuestion = () => {
      updateContentItem(itemIndex, {
        ...exercise,
        questions: [...exercise.questions, { id: crypto.randomUUID(), prompt: '', options: ['', '', '', ''], correctIndex: 0, hint: '' }],
      })
    }

    const removeQuestion = (qIndex: number) => {
      updateContentItem(itemIndex, {
        ...exercise,
        questions: exercise.questions.filter((_: unknown, i: number) => i !== qIndex),
      })
    }

    return (
      <div className="space-y-4">
        {/* AI Generation */}
        <div className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
          <p className="text-xs font-bold text-gray-500 mb-2">AI Generation</p>

          {/* Preferred type selector */}
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">AI should generate</label>
            <select
              value={preferredExType}
              onChange={(e) => setPreferredExType(e.target.value)}
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors bg-white"
            >
              <option value="">Let AI decide the best type</option>
              {EXERCISE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>

          {/* From text */}
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">From Text</label>
            <textarea
              value={exerciseTextInput}
              onChange={(e) => setExerciseTextInput(e.target.value)}
              placeholder="Paste text content here (lesson notes, vocabulary list, grammar rules...)"
              className="w-full h-20 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors mb-2"
            />
            <button
              onClick={() => generateExerciseFromText(exerciseTextInput, itemIndex, preferredExType || undefined)}
              disabled={generatingExercise || !exerciseTextInput.trim()}
              className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors disabled:opacity-50"
            >
              {generatingExercise ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </span>
              ) : 'Generate from Text'}
            </button>
          </div>

          {/* From screenshot */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">From Screenshot</label>
            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#cddcf0] rounded-xl cursor-pointer hover:border-[#416ebe] transition-colors mb-3">
              <div className="text-center">
                <p className="text-xs text-gray-400">Click to upload screenshot</p>
                <p className="text-[10px] text-gray-300">PNG, JPG</p>
              </div>
              <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
            </label>
            {uploadedImages.length > 0 && (
              <div className="space-y-2 mb-3">
                {uploadedImages.map((img, imgIdx) => (
                  <div key={imgIdx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-[#e6f0fa]">
                    <img src={img.preview} alt={`Upload ${imgIdx + 1}`} className="w-12 h-12 object-cover rounded" />
                    <p className="text-xs text-gray-500 flex-1 truncate">{img.file.name}</p>
                    <button onClick={() => generateExerciseFromImage(imgIdx, itemIndex, preferredExType || undefined)} disabled={generatingExercise}
                      className="px-3 py-1 bg-[#416ebe] text-white text-[10px] font-bold rounded-lg hover:bg-[#3560b0] disabled:opacity-50">
                      {generatingExercise ? 'Generating...' : 'Generate'}
                    </button>
                    <button onClick={() => removeUploadedImage(imgIdx)} className="text-xs text-gray-300 hover:text-red-400">&#x2715;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Exercise Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Title</label>
            <input type="text" value={exercise.title} onChange={(e) => updateField('title', e.target.value)}
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subtitle</label>
            <input type="text" value={exercise.subtitle} onChange={(e) => updateField('subtitle', e.target.value)}
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Icon (emoji)</label>
            <input type="text" value={exercise.icon} onChange={(e) => updateField('icon', e.target.value)}
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Exercise Type</label>
            <select
              value={exercise.exercise_type}
              onChange={(e) => updateField('exercise_type', e.target.value)}
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors bg-white"
            >
              <option value="">Select type...</option>
              {EXERCISE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Instructions</label>
          <textarea value={exercise.instructions} onChange={(e) => updateField('instructions', e.target.value)}
            className="w-full h-16 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>

        {/* Questions / Data Editor — varies by exercise type */}
        {['true_or_false', 'hangman', 'type_answer', 'complete_sentence', 'group_sort'].includes(exercise.exercise_type) ? (
          // For new exercise types, show a JSON data editor
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500">
                Exercise Data {exercise.exercise_type === 'group_sort' ? '(Groups)' : `(${Array.isArray(exercise.questions) ? exercise.questions.length : 0} items)`}
              </p>
              <p className="text-[10px] text-gray-400">
                {exercise.exercise_type === 'group_sort' ? 'Edit groupData JSON' : 'Edit questions JSON'}
              </p>
            </div>
            <textarea
              value={JSON.stringify(
                exercise.exercise_type === 'group_sort' ? (exercise.groupData || { groups: [] }) : (exercise.questions || []),
                null, 2
              )}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  if (exercise.exercise_type === 'group_sort') {
                    updateContentItem(itemIndex, { ...exercise, groupData: parsed })
                  } else {
                    updateContentItem(itemIndex, { ...exercise, questions: parsed })
                  }
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              className="w-full h-48 text-xs font-mono text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-y focus:outline-none focus:border-[#416ebe] transition-colors"
              spellCheck={false}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {exercise.exercise_type === 'true_or_false' && 'Format: [{"id": 1, "statement": "...", "isTrue": true/false, "explanation": "..."}]'}
              {exercise.exercise_type === 'hangman' && 'Format: [{"id": 1, "word": "WORD", "clue": "Definition or clue"}]'}
              {exercise.exercise_type === 'type_answer' && 'Format: [{"id": 1, "prompt": "Question?", "answer": "correct answer", "hint": "optional"}]'}
              {exercise.exercise_type === 'complete_sentence' && 'Format: [{"id": 1, "text": "I {{1}} to...", "blanks": {"1": "went"}, "wordBank": ["went", "gone"]}]'}
              {exercise.exercise_type === 'group_sort' && 'Format: {"groups": [{"name": "Group A", "items": ["item1", "item2"]}, ...]}'}
            </p>
          </div>
        ) : (
          // Classic question editor for multiple_choice, fill_blank, etc.
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500">{Array.isArray(exercise.questions) ? exercise.questions.length : 0} question{(Array.isArray(exercise.questions) && exercise.questions.length !== 1) ? 's' : ''}</p>
              <button onClick={addQuestion} className="text-xs text-[#416ebe] font-bold hover:underline">+ Add Question</button>
            </div>

            {Array.isArray(exercise.questions) && exercise.questions.map((q: ExerciseQuestion, qIdx: number) => (
              <div key={q.id || qIdx} className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-bold text-[#416ebe]">Q{qIdx + 1}</span>
                  <button onClick={() => removeQuestion(qIdx)} className="text-xs text-gray-300 hover:text-red-400">&#x2715;</button>
                </div>
                <div className="mb-3">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prompt</label>
                  <input type="text" value={q.prompt} onChange={(e) => updateQuestion(qIdx, 'prompt', e.target.value)}
                    className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
                </div>
                <div className="mb-3">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Options</label>
                  {q.options.map((opt: string, oIdx: number) => (
                    <div key={oIdx} className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name={`correct-${itemIndex}-${qIdx}`}
                        checked={q.correctIndex === oIdx}
                        onChange={() => updateQuestion(qIdx, 'correctIndex', oIdx)}
                        className="accent-[#416ebe]"
                      />
                      <input type="text" value={opt}
                        onChange={(e) => {
                          const newOpts = [...q.options]
                          newOpts[oIdx] = e.target.value
                          updateQuestion(qIdx, 'options', newOpts)
                        }}
                        placeholder={`Option ${oIdx + 1}`}
                        className="flex-1 px-3 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hint</label>
                  <input type="text" value={q.hint} onChange={(e) => updateQuestion(qIdx, 'hint', e.target.value)}
                    placeholder="Optional hint..."
                    className="w-full px-3 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    )
  }

  // ── Mistakes Editor ──

  const renderMistakesEditor = (itemIndex: number) => {
    const block = contentItems[itemIndex].data as ContentBlock
    const content = block.content as MistakesContent
    const mistakes = content.mistakes || []

    const updateBlock = (newContent: MistakesContent) => {
      updateContentItem(itemIndex, { ...block, content: newContent })
    }

    const updateMistake = (mIdx: number, field: keyof Mistake, value: string) => {
      const updated = [...mistakes]
      updated[mIdx] = { ...updated[mIdx], [field]: value }
      updateBlock({ mistakes: updated })
    }

    const addMistake = () => {
      updateBlock({ mistakes: [...mistakes, { original: '', correction: '', explanation: '', practice: [] }] })
    }

    const removeMistake = (mIdx: number) => {
      updateBlock({ mistakes: mistakes.filter((_, i) => i !== mIdx) })
    }

    const addPractice = (mIdx: number) => {
      const updated = [...mistakes]
      updated[mIdx] = { ...updated[mIdx], practice: [...updated[mIdx].practice, { prompt: '', options: ['', '', '', ''], correctIndex: 0 }] }
      updateBlock({ mistakes: updated })
    }

    const updatePractice = (mIdx: number, pIdx: number, field: string, value: string | number | string[]) => {
      const updated = [...mistakes]
      const practice = [...updated[mIdx].practice]
      practice[pIdx] = { ...practice[pIdx], [field]: value }
      updated[mIdx] = { ...updated[mIdx], practice }
      updateBlock({ mistakes: updated })
    }

    const removePractice = (mIdx: number, pIdx: number) => {
      const updated = [...mistakes]
      updated[mIdx] = { ...updated[mIdx], practice: updated[mIdx].practice.filter((_, i) => i !== pIdx) }
      updateBlock({ mistakes: updated })
    }

    return (
      <div className="space-y-4">
        <div className="mb-2">
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Block Title</label>
          <input type="text" value={block.title} onChange={(e) => updateContentItem(itemIndex, { ...block, title: e.target.value })}
            placeholder="e.g. Common Mistakes from Today's Class"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>

        {mistakes.map((m, mIdx) => (
          <div key={mIdx} className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold text-red-500">Mistake #{mIdx + 1}</span>
              <button onClick={() => removeMistake(mIdx)} className="text-xs text-gray-300 hover:text-red-400">&#x2715;</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Original (wrong)</label>
                <input type="text" value={m.original} onChange={(e) => updateMistake(mIdx, 'original', e.target.value)}
                  placeholder={`e.g. I didn't went`}
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Correction</label>
                <input type="text" value={m.correction} onChange={(e) => updateMistake(mIdx, 'correction', e.target.value)}
                  placeholder={`e.g. I didn't go`}
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Explanation</label>
              <textarea value={m.explanation} onChange={(e) => updateMistake(mIdx, 'explanation', e.target.value)}
                placeholder="Explain why this is wrong..."
                className="w-full h-16 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors" />
            </div>

            {/* Practice Questions */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Practice Questions ({m.practice.length})</p>
              <button onClick={() => addPractice(mIdx)} className="text-[10px] text-[#416ebe] font-bold hover:underline">+ Add Practice</button>
            </div>
            {m.practice.map((p, pIdx) => (
              <div key={pIdx} className="bg-white rounded-lg p-3 border border-[#e6f0fa] mb-2">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] font-bold text-gray-400">Practice {pIdx + 1}</span>
                  <button onClick={() => removePractice(mIdx, pIdx)} className="text-[10px] text-gray-300 hover:text-red-400">&#x2715;</button>
                </div>
                <input type="text" value={p.prompt} onChange={(e) => updatePractice(mIdx, pIdx, 'prompt', e.target.value)}
                  placeholder="Question prompt..."
                  className="w-full px-3 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors mb-2" />
                {p.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2 mb-1">
                    <input type="radio" name={`mp-${itemIndex}-${mIdx}-${pIdx}`} checked={p.correctIndex === oIdx}
                      onChange={() => updatePractice(mIdx, pIdx, 'correctIndex', oIdx)} className="accent-[#416ebe]" />
                    <input type="text" value={opt}
                      onChange={(e) => { const newOpts = [...p.options]; newOpts[oIdx] = e.target.value; updatePractice(mIdx, pIdx, 'options', newOpts) }}
                      placeholder={`Option ${oIdx + 1}`}
                      className="flex-1 px-3 py-1 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        <button onClick={addMistake} className="w-full py-2 border-2 border-dashed border-[#cddcf0] rounded-xl text-xs font-bold text-gray-400 hover:border-[#416ebe] hover:text-[#416ebe] transition-colors">
          + Add Mistake
        </button>
      </div>
    )
  }

  // ── Video Editor ──

  const renderVideoEditor = (itemIndex: number) => {
    const block = contentItems[itemIndex].data as ContentBlock
    const content = block.content as VideoContent

    const updateVideoContent = (partial: Partial<VideoContent>) => {
      updateContentItem(itemIndex, { ...block, content: { ...content, ...partial } })
    }

    const addQuestion = () => {
      updateVideoContent({ questions: [...content.questions, createMCQuestion()] })
    }

    const updateQuestion = (qIdx: number, field: string, value: string | number | string[]) => {
      const questions = [...content.questions]
      questions[qIdx] = { ...questions[qIdx], [field]: value }
      updateVideoContent({ questions })
    }

    const removeQuestion = (qIdx: number) => {
      updateVideoContent({ questions: content.questions.filter((_, i) => i !== qIdx) })
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Block Title</label>
          <input type="text" value={block.title} onChange={(e) => updateContentItem(itemIndex, { ...block, title: e.target.value })}
            placeholder="e.g. Watch: TED Talk on Communication"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">YouTube URL</label>
          <input type="text" value={content.youtube_url} onChange={(e) => updateVideoContent({ youtube_url: e.target.value })}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
          {content.youtube_url && (() => {
            const match = content.youtube_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
            if (match) return <p className="text-[10px] text-gray-400 mt-1">Video ID: {match[1]}</p>
            return null
          })()}
        </div>

        {/* Follow-up Questions */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500">{content.questions.length} follow-up question{content.questions.length !== 1 ? 's' : ''}</p>
          <button onClick={addQuestion} className="text-xs text-[#416ebe] font-bold hover:underline">+ Add Question</button>
        </div>

        {content.questions.map((q, qIdx) => (
          <div key={q.id || qIdx} className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold text-[#416ebe]">Q{qIdx + 1}</span>
              <button onClick={() => removeQuestion(qIdx)} className="text-xs text-gray-300 hover:text-red-400">&#x2715;</button>
            </div>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prompt</label>
              <input type="text" value={q.prompt} onChange={(e) => updateQuestion(qIdx, 'prompt', e.target.value)}
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
            </div>
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2 mb-1">
                <input type="radio" name={`vq-${itemIndex}-${qIdx}`} checked={q.correctIndex === oIdx}
                  onChange={() => updateQuestion(qIdx, 'correctIndex', oIdx)} className="accent-[#416ebe]" />
                <input type="text" value={opt}
                  onChange={(e) => { const newOpts = [...q.options]; newOpts[oIdx] = e.target.value; updateQuestion(qIdx, 'options', newOpts) }}
                  placeholder={`Option ${oIdx + 1}`}
                  className="flex-1 px-3 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // ── Article Editor ──

  const renderArticleEditor = (itemIndex: number) => {
    const block = contentItems[itemIndex].data as ContentBlock
    const content = block.content as ArticleContent

    const updateArticleContent = (partial: Partial<ArticleContent>) => {
      updateContentItem(itemIndex, { ...block, content: { ...content, ...partial } })
    }

    const addQuestion = () => {
      updateArticleContent({ questions: [...content.questions, createMCQuestion()] })
    }

    const updateQuestion = (qIdx: number, field: string, value: string | number | string[]) => {
      const questions = [...content.questions]
      questions[qIdx] = { ...questions[qIdx], [field]: value }
      updateArticleContent({ questions })
    }

    const removeQuestion = (qIdx: number) => {
      updateArticleContent({ questions: content.questions.filter((_, i) => i !== qIdx) })
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Block Title</label>
          <input type="text" value={block.title} onChange={(e) => updateContentItem(itemIndex, { ...block, title: e.target.value })}
            placeholder="e.g. Reading: Climate Change Article"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Article Text</label>
          <textarea value={content.text} onChange={(e) => updateArticleContent({ text: e.target.value })}
            placeholder="Paste the article text here..."
            className="w-full h-40 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-y focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Source (optional)</label>
          <input type="text" value={content.source} onChange={(e) => updateArticleContent({ source: e.target.value })}
            placeholder="e.g. BBC News"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>

        {/* Comprehension Questions */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500">{content.questions.length} comprehension question{content.questions.length !== 1 ? 's' : ''}</p>
          <button onClick={addQuestion} className="text-xs text-[#416ebe] font-bold hover:underline">+ Add Question</button>
        </div>

        {content.questions.map((q, qIdx) => (
          <div key={q.id || qIdx} className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold text-[#416ebe]">Q{qIdx + 1}</span>
              <button onClick={() => removeQuestion(qIdx)} className="text-xs text-gray-300 hover:text-red-400">&#x2715;</button>
            </div>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prompt</label>
              <input type="text" value={q.prompt} onChange={(e) => updateQuestion(qIdx, 'prompt', e.target.value)}
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
            </div>
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2 mb-1">
                <input type="radio" name={`aq-${itemIndex}-${qIdx}`} checked={q.correctIndex === oIdx}
                  onChange={() => updateQuestion(qIdx, 'correctIndex', oIdx)} className="accent-[#416ebe]" />
                <input type="text" value={opt}
                  onChange={(e) => { const newOpts = [...q.options]; newOpts[oIdx] = e.target.value; updateQuestion(qIdx, 'options', newOpts) }}
                  placeholder={`Option ${oIdx + 1}`}
                  className="flex-1 px-3 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // ── Dialogue Editor ──

  const renderDialogueEditor = (itemIndex: number) => {
    const block = contentItems[itemIndex].data as ContentBlock
    const content = block.content as DialogueContent

    const updateDialogueContent = (partial: Partial<DialogueContent>) => {
      updateContentItem(itemIndex, { ...block, content: { ...content, ...partial } })
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Block Title</label>
          <input type="text" value={block.title} onChange={(e) => updateContentItem(itemIndex, { ...block, title: e.target.value })}
            placeholder="e.g. Practice: At the Restaurant"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Scenario Description</label>
          <textarea value={content.scenario} onChange={(e) => updateDialogueContent({ scenario: e.target.value })}
            placeholder="Describe the conversation scenario... e.g. You're at a restaurant ordering food for a dinner party."
            className="w-full h-24 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target Words (comma-separated)</label>
          <input type="text" value={content.target_words.join(', ')}
            onChange={(e) => updateDialogueContent({ target_words: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) })}
            placeholder="appetizer, reservation, bill, tip"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
          {content.target_words.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {content.target_words.map((w, i) => (
                <span key={i} className="px-2 py-0.5 bg-[#416ebe]/10 text-[#416ebe] text-[10px] font-bold rounded-full">{w}</span>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">AI Starter Message</label>
          <textarea value={content.starter_message} onChange={(e) => updateDialogueContent({ starter_message: e.target.value })}
            placeholder="The first message the AI will say... e.g. Welcome! Have you been here before?"
            className="w-full h-20 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
      </div>
    )
  }

  // ── Grammar Editor ──

  const renderGrammarEditor = (itemIndex: number) => {
    const block = contentItems[itemIndex].data as ContentBlock
    const content = block.content as GrammarContent

    const updateGrammarContent = (partial: Partial<GrammarContent>) => {
      updateContentItem(itemIndex, { ...block, content: { ...content, ...partial } })
    }

    const addExample = () => {
      updateGrammarContent({ examples: [...content.examples, ''] })
    }

    const updateExample = (idx: number, value: string) => {
      const examples = [...content.examples]
      examples[idx] = value
      updateGrammarContent({ examples })
    }

    const removeExample = (idx: number) => {
      updateGrammarContent({ examples: content.examples.filter((_, i) => i !== idx) })
    }

    const addExercise = () => {
      updateGrammarContent({ exercises: [...content.exercises, createMCQuestion()] })
    }

    const updateExercise = (qIdx: number, field: string, value: string | number | string[]) => {
      const exercises = [...content.exercises]
      exercises[qIdx] = { ...exercises[qIdx], [field]: value }
      updateGrammarContent({ exercises })
    }

    const removeExercise = (qIdx: number) => {
      updateGrammarContent({ exercises: content.exercises.filter((_, i) => i !== qIdx) })
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Block Title</label>
          <input type="text" value={block.title} onChange={(e) => updateContentItem(itemIndex, { ...block, title: e.target.value })}
            placeholder="e.g. Grammar: Past Simple vs. Present Perfect"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Explanation</label>
          <textarea value={content.explanation} onChange={(e) => updateGrammarContent({ explanation: e.target.value })}
            placeholder="Explain the grammar rule..."
            className="w-full h-32 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-y focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>

        {/* Examples */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500">{content.examples.length} example{content.examples.length !== 1 ? 's' : ''}</p>
          <button onClick={addExample} className="text-xs text-[#416ebe] font-bold hover:underline">+ Add Example</button>
        </div>
        {content.examples.map((ex, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input type="text" value={ex} onChange={(e) => updateExample(idx, e.target.value)}
              placeholder="e.g. I walked to school yesterday."
              className="flex-1 px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
            <button onClick={() => removeExample(idx)} className="text-xs text-gray-300 hover:text-red-400">&#x2715;</button>
          </div>
        ))}

        {/* Practice Exercises */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500">{content.exercises.length} practice exercise{content.exercises.length !== 1 ? 's' : ''}</p>
          <button onClick={addExercise} className="text-xs text-[#416ebe] font-bold hover:underline">+ Add Exercise</button>
        </div>

        {content.exercises.map((q, qIdx) => (
          <div key={q.id || qIdx} className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold text-[#416ebe]">Q{qIdx + 1}</span>
              <button onClick={() => removeExercise(qIdx)} className="text-xs text-gray-300 hover:text-red-400">&#x2715;</button>
            </div>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prompt</label>
              <input type="text" value={q.prompt} onChange={(e) => updateExercise(qIdx, 'prompt', e.target.value)}
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
            </div>
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2 mb-1">
                <input type="radio" name={`gq-${itemIndex}-${qIdx}`} checked={q.correctIndex === oIdx}
                  onChange={() => updateExercise(qIdx, 'correctIndex', oIdx)} className="accent-[#416ebe]" />
                <input type="text" value={opt}
                  onChange={(e) => { const newOpts = [...q.options]; newOpts[oIdx] = e.target.value; updateExercise(qIdx, 'options', newOpts) }}
                  placeholder={`Option ${oIdx + 1}`}
                  className="flex-1 px-3 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // ── Writing Editor ──

  const renderWritingEditor = (itemIndex: number) => {
    const block = contentItems[itemIndex].data as ContentBlock
    const content = block.content as WritingContent

    const updateWritingContent = (partial: Partial<WritingContent>) => {
      updateContentItem(itemIndex, { ...block, content: { ...content, ...partial } })
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Block Title</label>
          <input type="text" value={block.title} onChange={(e) => updateContentItem(itemIndex, { ...block, title: e.target.value })}
            placeholder="e.g. Writing: Formal Email"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Writing Prompt</label>
          <textarea value={content.prompt} onChange={(e) => updateWritingContent({ prompt: e.target.value })}
            placeholder="Describe what the student should write..."
            className="w-full h-24 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Guidelines</label>
          <textarea value={content.guidelines} onChange={(e) => updateWritingContent({ guidelines: e.target.value })}
            placeholder="e.g. Use formal language, include a greeting and sign-off..."
            className="w-full h-20 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Word Limit</label>
          <input type="number" value={content.word_limit} onChange={(e) => updateWritingContent({ word_limit: parseInt(e.target.value) || 0 })}
            className="w-32 px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>
      </div>
    )
  }

  // ── Pronunciation Editor ──

  const renderPronunciationEditor = (itemIndex: number) => {
    const block = contentItems[itemIndex].data as ContentBlock
    const content = block.content as PronunciationContent
    const words = content.words || []

    const updateWords = (newWords: PronunciationWord[]) => {
      updateContentItem(itemIndex, { ...block, content: { words: newWords } })
    }

    const updateWord = (wIdx: number, field: keyof PronunciationWord, value: string) => {
      const updated = [...words]
      updated[wIdx] = { ...updated[wIdx], [field]: value }
      updateWords(updated)
    }

    const addWord = () => {
      updateWords([...words, { word: '', phonetic: '', tips: '' }])
    }

    const removeWord = (wIdx: number) => {
      updateWords(words.filter((_, i) => i !== wIdx))
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Block Title</label>
          <input type="text" value={block.title} onChange={(e) => updateContentItem(itemIndex, { ...block, title: e.target.value })}
            placeholder="e.g. Pronunciation Practice"
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
        </div>

        {words.map((w, wIdx) => (
          <div key={wIdx} className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-bold text-[#ec4899]">#{wIdx + 1}</span>
              <button onClick={() => removeWord(wIdx)} className="text-xs text-gray-300 hover:text-red-400">&#x2715;</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Word</label>
                <input type="text" value={w.word} onChange={(e) => updateWord(wIdx, 'word', e.target.value)}
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Phonetic</label>
                <input type="text" value={w.phonetic} onChange={(e) => updateWord(wIdx, 'phonetic', e.target.value)}
                  placeholder="/..."
                  className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tips</label>
              <input type="text" value={w.tips} onChange={(e) => updateWord(wIdx, 'tips', e.target.value)}
                placeholder="Pronunciation tips..."
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors" />
            </div>
          </div>
        ))}

        <button onClick={addWord} className="w-full py-2 border-2 border-dashed border-[#cddcf0] rounded-xl text-xs font-bold text-gray-400 hover:border-[#416ebe] hover:text-[#416ebe] transition-colors">
          + Add Word
        </button>
      </div>
    )
  }

  // ── Render the correct editor for a content item ──

  const renderBlockEditor = (item: ContentItem, index: number) => {
    switch (item.type) {
      case 'flashcards': return renderFlashcardsEditor(index)
      case 'exercise': return renderExerciseEditor(index)
      case 'mistakes': return renderMistakesEditor(index)
      case 'video': return renderVideoEditor(index)
      case 'article': return renderArticleEditor(index)
      case 'dialogue': return renderDialogueEditor(index)
      case 'grammar': return renderGrammarEditor(index)
      case 'writing': return renderWritingEditor(index)
      case 'pronunciation': return renderPronunciationEditor(index)
      default: return <p className="text-xs text-gray-400">Unknown block type</p>
    }
  }

  // ── Get block summary text ──

  const getBlockSummary = (item: ContentItem): string => {
    switch (item.type) {
      case 'flashcards': {
        const fc = item.data as Flashcard[]
        return `${fc.length} flashcard${fc.length !== 1 ? 's' : ''}`
      }
      case 'exercise': {
        const ex = item.data as Exercise
        return ex.title || `${ex.questions.length} question${ex.questions.length !== 1 ? 's' : ''}`
      }
      default: {
        const block = item.data as ContentBlock
        return block.title || 'Untitled'
      }
    }
  }

  // ══════════════════════════════════════════
  // RENDER GUARDS
  // ══════════════════════════════════════════

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f7fafd]">
        <div className="text-[#416ebe] text-sm">Loading lesson manager...</div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#f7fafd]">
        <div className="text-center">
          <div className="text-4xl mb-4">&#x1F512;</div>
          <h1 className="text-xl font-bold text-[#46464b] mb-2">Access Denied</h1>
          <p className="text-sm text-gray-400">This page is only available to administrators.</p>
          <button onClick={() => router.push('/home')} className="mt-6 text-sm text-[#416ebe] hover:underline">
            &larr; Go home
          </button>
        </div>
      </main>
    )
  }

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════

  return (
    <main className="min-h-screen bg-[#f7fafd] px-4 py-6">
      <div className="max-w-4xl mx-auto">

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 bg-[#416ebe] text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50 animate-fade-in">
            {toast}
          </div>
        )}

        {/* ══════════ LIST VIEW ══════════ */}
        {view === 'list' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <button onClick={() => router.push('/admin')} className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1">
                  &larr; Admin Console
                </button>
                <h1 className="text-2xl font-bold text-[#416ebe]">Lesson Manager</h1>
              </div>
              <button
                onClick={startNewLesson}
                className="px-5 py-2.5 bg-[#416ebe] text-white text-xs font-bold rounded-xl hover:bg-[#3560b0] transition-colors shadow-sm"
              >
                + New Lesson
              </button>
            </div>

            {/* Lessons Table */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e6f0fa]">
                <h2 className="font-bold text-[#46464b]">
                  All Lessons <span className="text-xs font-normal text-gray-400">({lessons.length})</span>
                </h2>
              </div>

              {lessons.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="text-4xl mb-3 opacity-40">&#x1F4DA;</div>
                  <p className="text-sm text-gray-400 mb-4">No lessons yet. Create your first lesson to get started.</p>
                  <button
                    onClick={startNewLesson}
                    className="px-5 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                  >
                    + Create Lesson
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#e6f0fa]">
                  {lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-[#f7fafd] cursor-pointer transition-colors"
                      onClick={() => loadLessonForEditing(lesson)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-[#46464b] truncate">{lesson.title}</p>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              lesson.status === 'published'
                                ? 'bg-green-100 text-green-600'
                                : 'bg-yellow-100 text-yellow-600'
                            }`}
                          >
                            {lesson.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{formatDate(lesson.lesson_date)}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#416ebe]">{lesson.flashcard_count || 0}</p>
                          <p className="text-[10px] text-gray-400">vocab</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#416ebe]">{lesson.exercise_count || 0}</p>
                          <p className="text-[10px] text-gray-400">exercises</p>
                        </div>
                        {lesson.block_counts && Object.keys(lesson.block_counts).length > 0 && (
                          <div className="text-center">
                            <p className="text-sm font-bold text-[#416ebe]">
                              {Object.values(lesson.block_counts).reduce((a, b) => a + b, 0)}
                            </p>
                            <p className="text-[10px] text-gray-400">blocks</p>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteConfirm(lesson.id)
                          }}
                          className="text-xs text-gray-300 hover:text-red-400 transition-colors p-1"
                          title="Delete lesson"
                        >
                          &#x2715;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                  <h3 className="font-bold text-[#46464b] mb-2">Delete Lesson?</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    This will permanently delete the lesson and all its content (flashcards, exercises, and blocks). This cannot be undone.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteLesson(showDeleteConfirm)}
                      className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ EDITOR VIEW ══════════ */}
        {view === 'editor' && (
          <>
            {/* Editor Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <button
                  onClick={() => { setView('list'); setUploadedImages([]) }}
                  className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1"
                >
                  &larr; Back to lessons
                </button>
                <h1 className="text-2xl font-bold text-[#416ebe]">
                  {editingLessonId ? 'Edit Lesson' : 'New Lesson'}
                </h1>
              </div>
            </div>

            {/* ── Lesson Details Header Card ── */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-6 mb-6">
              <h2 className="font-bold text-[#46464b] mb-4">Lesson Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Week 5 - Travel Vocabulary"
                    className="w-full px-4 py-2.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    value={lessonDate}
                    onChange={(e) => setLessonDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Summary / Class Notes</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Paste class summary here (used for AI flashcard generation)..."
                  className="w-full h-24 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors"
                />
              </div>
            </div>

            {/* ── Google Drive Import ── */}
            <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">&#x1F4C4;</span>
                <h2 className="font-bold text-[#46464b]">Import from Google Drive</h2>
              </div>
              <p className="text-xs text-gray-400 mb-3">Paste a Google Docs link to auto-generate flashcards, class summary, and student mistakes.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={googleDocUrl}
                  onChange={(e) => setGoogleDocUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="flex-1 px-4 py-2.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
                />
                <button
                  onClick={importFromGoogleDoc}
                  disabled={importingDoc || !googleDocUrl.trim()}
                  className="px-5 py-2.5 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {importingDoc ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                      Analyzing...
                    </span>
                  ) : 'Import & Analyze'}
                </button>
              </div>

              {/* Import Results Preview */}
              {importResult && (
                <div className="mt-5 border-t border-[#e8f0fc] pt-5">
                  <h3 className="text-sm font-bold text-[#46464b] mb-3">AI Suggestions — Review & Add to Lesson</h3>

                  {/* Suggested Title */}
                  {importResult.suggestedTitle && (
                    <div className="mb-4 p-4 bg-[#f7fafd] rounded-xl border border-[#e8f0fc]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#416ebe] uppercase tracking-wider">Suggested Title</span>
                        <button
                          onClick={() => {
                            setTitle(importResult.suggestedTitle || '')
                            showToast('Title applied!')
                          }}
                          className="text-xs font-bold text-[#416ebe] hover:underline"
                        >
                          Use as Title
                        </button>
                      </div>
                      <p className="text-sm text-[#46464b] font-medium">{importResult.suggestedTitle}</p>
                    </div>
                  )}

                  {/* Summary Preview */}
                  {importResult.summary && (
                    <div className="mb-4 p-4 bg-[#f7fafd] rounded-xl border border-[#e8f0fc]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#416ebe] uppercase tracking-wider">Class Summary</span>
                        <button
                          onClick={() => applyImportResults(false, true, false)}
                          className="text-xs font-bold text-[#416ebe] hover:underline"
                        >
                          Use as Summary
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">{importResult.summary}</p>
                    </div>
                  )}

                  {/* Flashcards Preview */}
                  {importResult.flashcards.length > 0 && (
                    <div className="mb-4 p-4 bg-[#f7fafd] rounded-xl border border-[#e8f0fc]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#416ebe] uppercase tracking-wider">
                          Vocabulary ({importResult.flashcards.length} words)
                        </span>
                        <button
                          onClick={() => applyImportResults(true, false, false)}
                          className="text-xs font-bold text-[#416ebe] hover:underline"
                        >
                          Add to Lesson
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {importResult.flashcards.map((fc, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white border border-[#cddcf0] rounded-full text-xs text-[#46464b] font-medium">
                            {fc.word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mistakes Preview */}
                  {importResult.mistakes.length > 0 && (
                    <div className="mb-4 p-4 bg-[#f7fafd] rounded-xl border border-[#e8f0fc]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#ef4444] uppercase tracking-wider">
                          Common Mistakes ({importResult.mistakes.length})
                        </span>
                        <button
                          onClick={() => applyImportResults(false, false, true)}
                          className="text-xs font-bold text-[#416ebe] hover:underline"
                        >
                          Add to Lesson
                        </button>
                      </div>
                      <div className="space-y-2">
                        {importResult.mistakes.slice(0, 3).map((m, i) => (
                          <div key={i} className="text-xs">
                            <span className="text-red-400 line-through">{m.original}</span>
                            <span className="mx-1.5 text-gray-300">&rarr;</span>
                            <span className="text-green-600 font-medium">{m.correction}</span>
                          </div>
                        ))}
                        {importResult.mistakes.length > 3 && (
                          <p className="text-xs text-gray-400">+{importResult.mistakes.length - 3} more...</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Add All Button */}
                  <button
                    onClick={() => applyImportResults(true, true, true)}
                    className="w-full py-2.5 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                  >
                    Add Everything to Lesson
                  </button>
                </div>
              )}
            </div>

            {/* ── Content Blocks ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[#46464b]">Content Blocks ({contentItems.length})</h2>
                <div className="relative">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="px-4 py-2 bg-[#416ebe] text-white text-xs font-bold rounded-lg hover:bg-[#3560b0] transition-colors"
                  >
                    + Add Content Block
                  </button>

                  {/* Dropdown Menu */}
                  {showAddMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-[#cddcf0] shadow-xl z-50 overflow-hidden">
                        {(Object.keys(BLOCK_CONFIG) as ContentItemType[]).map((type) => {
                          const config = BLOCK_CONFIG[type]
                          return (
                            <button
                              key={type}
                              onClick={() => addContentItem(type)}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#f7fafd] transition-colors text-left"
                            >
                              <span className="text-lg">{config.icon}</span>
                              <div>
                                <p className="text-sm font-bold text-[#46464b]">{config.label}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Content Items List */}
              {contentItems.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm px-6 py-16 text-center">
                  <div className="text-4xl mb-3 opacity-40">&#x1F4E6;</div>
                  <p className="text-sm text-gray-400 mb-2">No content blocks yet.</p>
                  <p className="text-xs text-gray-300">Click &quot;+ Add Content Block&quot; to start building your lesson.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contentItems.map((item, index) => {
                    const config = BLOCK_CONFIG[item.type]
                    return (
                      <div key={index} className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
                        {/* Block Header */}
                        <div
                          className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-[#f7fafd] transition-colors"
                          onClick={() => toggleCollapse(index)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-lg flex-shrink-0">{config.icon}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: config.color }}>
                                  {config.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 truncate">{getBlockSummary(item)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); moveItem(index, 'up') }}
                              disabled={index === 0}
                              className="p-1.5 text-xs text-gray-300 hover:text-[#416ebe] disabled:opacity-30 transition-colors"
                              title="Move up"
                            >
                              &#x25B2;
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveItem(index, 'down') }}
                              disabled={index === contentItems.length - 1}
                              className="p-1.5 text-xs text-gray-300 hover:text-[#416ebe] disabled:opacity-30 transition-colors"
                              title="Move down"
                            >
                              &#x25BC;
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeContentItem(index) }}
                              className="p-1.5 text-xs text-gray-300 hover:text-red-400 transition-colors"
                              title="Delete block"
                            >
                              &#x2715;
                            </button>
                            <span className="text-xs text-gray-300 ml-1">
                              {item.collapsed ? '&#x25B6;' : '&#x25BC;'}
                            </span>
                          </div>
                        </div>

                        {/* Block Editor (expanded) */}
                        {!item.collapsed && (
                          <div className="px-5 pb-5 border-t border-[#e6f0fa] pt-4">
                            {renderBlockEditor(item, index)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Save / Publish Buttons ── */}
            <div className="flex gap-3 justify-end pb-8">
              <button
                onClick={() => saveLesson('draft')}
                disabled={saving || publishing}
                className="px-6 py-3 bg-white border border-[#cddcf0] text-[#416ebe] text-sm font-bold rounded-xl hover:border-[#416ebe] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => saveLesson('published')}
                disabled={saving || publishing}
                className="px-6 py-3 bg-[#416ebe] text-white text-sm font-bold rounded-xl hover:bg-[#3560b0] transition-colors disabled:opacity-50 shadow-sm"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
