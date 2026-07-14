'use client'

// ─────────────────────────────────────────────────────────────────────────────
// useLessonEditor — the lesson-editor "brain" for the 10B redesign
// (/admin/lessons). Holds all Phase-1 state and ports the LOAD / SAVE data
// contract BYTE-FOR-BYTE from the legacy editor app/admin/lessons/page.tsx.
//
// The legacy file is left 100% untouched. Where the legacy code called
// showToast() for user feedback, this hook instead sets the `error` state and
// returns the message string (see saveLesson). All order_index / globalOrder /
// group_sort / MCQ-validation / payload logic is preserved verbatim.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Lesson,
  type Flashcard,
  type Exercise,
  type ContentBlock,
  type ContentItem,
  type BlockType,
  type View,
  type MistakesContent,
  type GrammarContent,
  createDefaultContent,
  createDefaultExercise,
  normalizeExerciseType,
  validateMcqQuestion,
} from './types'

export interface StartNewLessonOpts {
  courseId?: string | null
  courseName?: string
  contentBankMode?: boolean
  // When true, the new content is flagged is_shared on save so it lands in the
  // School Library (used by the School Library's "+ New" button).
  shareToSchool?: boolean
}

export function useLessonEditor() {
  // ── View ──
  const [view, setView] = useState<View>('list')

  // ── List ──
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [lessonQuery, setLessonQuery] = useState('')

  // ── Async status ──
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Editing identity / metadata ──
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [editingAuthorName, setEditingAuthorName] = useState<string | null>(null)
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null)

  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState<string>('')

  const [title, setTitle] = useState('')
  const [lessonDate, setLessonDate] = useState('')
  const [lessonType, setLessonType] = useState<string>('lesson')
  const [summary, setSummary] = useState('')

  const [currentLessonStatus, setCurrentLessonStatus] = useState<'draft' | 'published'>('draft')
  const [flashcardsPublished, setFlashcardsPublished] = useState(true)

  // ── Exam-mode settings (used only when lessonType is a test type) ──
  const [testTimeLimit, setTestTimeLimit] = useState<number>(30)
  const [testRevealAnswers, setTestRevealAnswers] = useState(true)
  const [testRulesLang, setTestRulesLang] = useState<'hy' | 'en'>('hy')

  const [isTemplate, setIsTemplate] = useState(false)
  const [templateCategory, setTemplateCategory] = useState('')
  const [templateLevel, setTemplateLevel] = useState('')
  // Whether this content is shared to the School Library (is_shared). Set on
  // load (preserve when editing) and on startNewLesson (the "+ New" school flow).
  const [isShared, setIsShared] = useState(false)

  // contentBankMode is a session flag the editor was opened with. It drives the
  // template-required guards in saveLesson and the default isTemplate in
  // startNewLesson, mirroring the legacy searchParams-derived value.
  const [contentBankMode, setContentBankMode] = useState(false)

  // ── Content ──
  const [contentItems, setContentItems] = useState<ContentItem[]>([])

  // ── Derived: filtered lessons ──
  const filteredLessons = useMemo(() => {
    const q = lessonQuery.trim().toLowerCase()
    if (!q) return lessons
    return lessons.filter((l) =>
      (l.title || '').toLowerCase().includes(q) ||
      (l.summary || '').toLowerCase().includes(q),
    )
  }, [lessons, lessonQuery])

  // ── Unsaved-changes tracking ──
  // dirty = the current editable state differs from the baseline captured at the
  // last load/save. pendingBaseline defers capturing the baseline until the
  // state has settled (load sets several fields). `collapsed` is excluded (it's
  // UI-only, not persisted) so expanding/collapsing a block never marks dirty.
  const [dirty, setDirty] = useState(false)
  const [pendingBaseline, setPendingBaseline] = useState(true)
  const baselineRef = useRef('')
  const editSignature = useMemo(
    () =>
      JSON.stringify({
        title,
        lessonDate,
        lessonType,
        summary,
        isTemplate,
        templateCategory,
        templateLevel,
        flashcardsPublished,
        testTimeLimit,
        testRevealAnswers,
        testRulesLang,
        items: contentItems.map((i) => ({ type: i.type, data: i.data, order_index: i.order_index })),
      }),
    [title, lessonDate, lessonType, summary, isTemplate, templateCategory, templateLevel, flashcardsPublished, testTimeLimit, testRevealAnswers, testRulesLang, contentItems],
  )
  useEffect(() => {
    if (pendingBaseline) {
      baselineRef.current = editSignature
      setPendingBaseline(false)
      setDirty(false)
      return
    }
    setDirty(editSignature !== baselineRef.current)
  }, [pendingBaseline, editSignature])

  // ── Load list (legacy page.tsx 893-904) ──
  const loadLessons = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lessons?include_all=true')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setLessons(data.lessons || [])
    } catch {
      setError('Failed to load lessons')
    }
    setLoading(false)
  }, [])

  // ── Open an existing lesson by id ──
  // Ported from legacy loadLessonForEditing (page.tsx 939-1029). ADAPTED: the
  // legacy function received a `lesson` summary object from the already-loaded
  // list and seeded metadata from it. Here we fetch directly by id
  // (GET /api/lessons?id=ID) and seed metadata from data.lesson — which carries
  // title, lesson_date, lesson_type, summary, is_template, template_category,
  // template_level, status, course_id, author_name, created_at,
  // flashcards_published — removing the need to first load the list. The
  // contentItems building (legacy 968-1025) is preserved EXACTLY.
  const openLessonById = useCallback(async (id: string) => {
    setError(null)
    setEditingLessonId(id)
    setView('editor')

    try {
      const res = await fetch(`/api/lessons?id=${id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()

      const lesson = data.lesson || {}

      // Seed metadata from data.lesson (replaces legacy seeding from the list row)
      setCourseId(lesson.course_id || null)
      setTitle(lesson.title || '')
      setLessonDate(lesson.lesson_date || '')
      setLessonType(lesson.lesson_type || 'lesson')
      setSummary(lesson.summary || '')
      setIsTemplate(lesson.is_template || false)
      setIsShared(lesson.is_shared || false)
      setTemplateCategory(lesson.template_category || '')
      setTemplateLevel(lesson.template_level || '')
      setCurrentLessonStatus(lesson.status === 'published' ? 'published' : 'draft')
      setTestTimeLimit(typeof lesson.time_limit_minutes === 'number' && lesson.time_limit_minutes >= 1 ? lesson.time_limit_minutes : 30)
      setTestRevealAnswers(lesson.test_reveal_answers !== false)
      setTestRulesLang(lesson.test_rules_lang === 'en' ? 'en' : 'hy')

      setEditingAuthorName(lesson.author_name || null)
      setEditingCreatedAt(lesson.created_at || null)
      setFlashcardsPublished(lesson.flashcards_published !== false)

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
        image_url: fc.image_url || '',
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
        exercise_type: normalizeExerciseType(ex.exercise_type),
        questions: ex.exercise_type === 'group_sort' ? [] : (ex.questions || []),
        groupData: ex.exercise_type === 'group_sort' ? (ex.questions || ex.groupData) : ex.groupData,
        order_index: ex.order_index,
        points_per_answer: ex.points_per_answer,
        completion_bonus: ex.completion_bonus,
        is_mandatory: ex.is_mandatory !== false,
        skills: ex.skills || [],
        cefr_level: ex.cefr_level || null,
        test_type: ex.test_type || null,
        published: ex.published !== false,
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
        published: b.published !== false,
      }))
      blocks.forEach((block) => {
        items.push({ type: block.block_type, data: block, collapsed: true, order_index: orderIdx++ })
      })

      setContentItems(items)
      setPendingBaseline(true)
    } catch {
      setError('Failed to load lesson data')
    }
  }, [])

  // ── Start a new lesson (legacy page.tsx 1033-1055) ──
  const startNewLesson = useCallback((opts: StartNewLessonOpts = {}) => {
    const optCourseId = opts.courseId ?? null
    const optCourseName = opts.courseName ?? ''
    const optContentBankMode = opts.contentBankMode ?? false

    setContentBankMode(optContentBankMode)
    setError(null)

    setEditingLessonId(null)
    setEditingAuthorName(null)
    setEditingCreatedAt(null)
    setCourseId(optCourseId)
    setCourseName(optCourseName)
    setTitle('')
    setLessonDate(new Date().toISOString().slice(0, 10))
    setLessonType('lesson')
    setSummary('')
    setContentItems([])
    setIsTemplate(optContentBankMode ? true : false)
    setIsShared(opts.shareToSchool ?? false)
    setTemplateCategory('')
    setTemplateLevel('')
    setCurrentLessonStatus('draft')
    setFlashcardsPublished(true)
    setTestTimeLimit(30)
    setTestRevealAnswers(true)
    setTestRulesLang('hy')
    setView('editor')
    setPendingBaseline(true)
  }, [])

  // ── Save (PORTED VERBATIM from legacy page.tsx 2251-2403) ──
  // ADAPTED: legacy showToast(...) calls on validation failure are replaced by
  // setError(message) + return of that message (so callers can surface it).
  // Everything else — title/date guards, the full MCQ validation sweep, the
  // content-bank category/level guard, flashcards/exercises/blocks extraction
  // (order_index = array idx, flashcards globalOrder = the flashcards item idx,
  // group_sort questions = groupData||questions, all field defaults), and the
  // POST /api/lessons body — is byte-for-byte identical to legacy.
  const saveLesson = useCallback(async (newStatus: 'draft' | 'published'): Promise<string | null> => {
    setError(null)
    if (!title.trim()) {
      const msg = 'Please enter a lesson title'
      setError(msg)
      return msg
    }
    if (!lessonDate) {
      const msg = 'Please set a lesson date'
      setError(msg)
      return msg
    }
    // MCQ validation across the whole lesson: standalone Exercise blocks,
    // Mistakes practice questions, Grammar block questions, and full
    // Exercise[] multiple_choice follow-ups on Article / Audio / Video.
    const mcqIssues: string[] = []
    contentItems.forEach((item, idx) => {
      const label = `Block ${idx + 1}`
      if (item.type === 'exercise') {
        const ex = item.data as Exercise
        if (ex.exercise_type === 'multiple_choice' && Array.isArray(ex.questions)) {
          ;(ex.questions as Array<{ options?: string[]; correctIndex?: number; correctIndices?: number[] }>).forEach((q, qi) => {
            mcqIssues.push(...validateMcqQuestion(q, `${label} Q${qi + 1}`))
          })
        }
      } else if (item.type === 'mistakes') {
        const content = (item.data as ContentBlock).content as MistakesContent
        content.mistakes?.forEach((m, mi) => {
          m.practice?.forEach((p, pi) => {
            mcqIssues.push(...validateMcqQuestion(p, `${label} Mistake ${mi + 1} Practice ${pi + 1}`))
          })
        })
      } else if (item.type === 'grammar') {
        const content = (item.data as ContentBlock).content as GrammarContent
        content.exercises?.forEach((q, qi) => {
          mcqIssues.push(...validateMcqQuestion(q, `${label} Grammar Q${qi + 1}`))
        })
      } else if (item.type === 'article' || item.type === 'audio' || item.type === 'video') {
        // Article / Audio / Video follow-ups are now full standalone Exercise[]
        // with `exercise_type`, so validate them like a standalone exercise
        // (read ex.exercise_type, not the legacy AttachedExercise `type`).
        const content = (item.data as ContentBlock).content as { exercises?: Exercise[] }
        content.exercises?.forEach((ex, axi) => {
          if (ex.exercise_type === 'multiple_choice' && Array.isArray(ex.questions)) {
            ;(ex.questions as Array<{ options?: string[]; correctIndex?: number; correctIndices?: number[] }>).forEach((q, qi) => {
              mcqIssues.push(...validateMcqQuestion(q, `${label} Follow-up ${axi + 1} Q${qi + 1}`))
            })
          }
        })
      }
    })
    if (mcqIssues.length > 0) {
      setError(mcqIssues[0])
      return mcqIssues[0]
    }
    // In content bank mode, require category and level
    if (contentBankMode && isTemplate) {
      if (!templateCategory) {
        const msg = 'Please select a category for this template'
        setError(msg)
        return msg
      }
      if (!templateLevel) {
        const msg = 'Please select a level for this template'
        setError(msg)
        return msg
      }
    }

    const isSavingDraft = newStatus === 'draft'
    if (isSavingDraft) setSaving(true)
    else setPublishing(true)

    try {
      // Extract flashcards, exercises, and blocks from content items
      let flashcardItems: Flashcard[] = []
      let flashcardsGlobalOrder = 0
      const exerciseItems: { title: string; subtitle: string; icon: string; instructions: string; exercise_type: string; questions: unknown; groupData?: unknown; order_index: number; points_per_answer?: number; completion_bonus?: number; is_mandatory?: boolean; skills?: string[] | null; cefr_level?: string | null; test_type?: string | null; published: boolean }[] = []
      const blockItems: { block_type: string; title: string; content: unknown; order_index: number; published: boolean }[] = []

      contentItems.forEach((item, idx) => {
        if (item.type === 'flashcards') {
          flashcardItems = item.data as Flashcard[]
          flashcardsGlobalOrder = idx
        } else if (item.type === 'exercise') {
          const ex = item.data as Exercise
          exerciseItems.push({
            title: ex.title,
            subtitle: ex.subtitle,
            icon: ex.icon,
            instructions: ex.instructions,
            exercise_type: ex.exercise_type,
            questions: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.questions,
            groupData: ex.groupData,
            order_index: idx,
            points_per_answer: ex.points_per_answer ?? 10,
            completion_bonus: ex.completion_bonus ?? 0,
            is_mandatory: ex.is_mandatory !== false,
            skills: ex.skills && ex.skills.length > 0 ? ex.skills : null,
            cefr_level: ex.cefr_level || null,
            test_type: ex.test_type || null,
            published: ex.published !== false,
          })
        } else {
          const b = item.data as ContentBlock
          blockItems.push({
            block_type: b.block_type,
            title: b.title,
            content: b.content,
            order_index: idx,
            published: b.published !== false,
          })
        }
      })

      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: editingLessonId,
          title: title.trim(),
          lesson_date: lessonDate,
          lesson_type: lessonType,
          summary: summary.trim() || null,
          status: newStatus,
          is_template: isTemplate,
          is_shared: isShared,
          template_category: templateCategory || null,
          template_level: templateLevel || null,
          course_id: courseId || null,
          time_limit_minutes: testTimeLimit,
          test_reveal_answers: testRevealAnswers,
          test_rules_lang: testRulesLang,
          flashcards: flashcardItems.map((fc, i) => ({
            word: fc.word,
            phonetic: fc.phonetic,
            meaning: fc.meaning,
            example: fc.example,
            notes: fc.notes,
            image_url: fc.image_url || null,
            globalOrder: flashcardsGlobalOrder,
          })),
          exercises: exerciseItems,
          blocks: blockItems,
          flashcards_published: flashcardsPublished,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to save')

      if (!editingLessonId && result.lessonId) {
        setEditingLessonId(result.lessonId)
      }

      // legacy showToast(success) — handled by caller; reload list (verbatim).
      await loadLessons()
      setPendingBaseline(true)
    } catch (err) {
      console.error(err)
      const msg = 'Failed to save lesson'
      setError(msg)
      setSaving(false)
      setPublishing(false)
      return msg
    }

    setSaving(false)
    setPublishing(false)
    return null
  }, [
    title, lessonDate, contentItems, contentBankMode, isTemplate, isShared, templateCategory,
    templateLevel, editingLessonId, lessonType, summary, courseId, flashcardsPublished,
    loadLessons,
  ])

  // ── Content-edit actions ──
  // Ported from the legacy editor's Content Item Management block. The legacy
  // code read `contentItems.length` and `currentLessonStatus` directly; here we
  // keep functional setContentItems where the new index is derived from the
  // array, and read currentLessonStatus from state for the publish default.

  // (legacy addContentItem flashcards branch 1302-1312) — append a single
  // flashcards item; refuse if one already exists.
  const addFlashcardsItem = useCallback(() => {
    setError(null)
    setContentItems((prev) => {
      if (prev.find((i) => i.type === 'flashcards')) {
        setError('Vocabulary block already exists in this lesson')
        return prev
      }
      return [
        ...prev,
        { type: 'flashcards', data: [] as Flashcard[], collapsed: false, order_index: prev.length },
      ]
    })
  }, [])

  // (legacy addManualBlock 1342-1356 + defaultPublishedForNewBlock 1272) —
  // append a new content block of the given type with default content.
  const addBlock = useCallback((type: BlockType) => {
    setContentItems((prev) => {
      const len = prev.length
      const block: ContentBlock = {
        block_type: type,
        title: '',
        content: createDefaultContent(type),
        order_index: len,
        published: currentLessonStatus !== 'published',
      }
      return [...prev, { type, data: block, collapsed: false, order_index: len }]
    })
  }, [currentLessonStatus])

  // (legacy addManualExercise 1851-1860 + defaultPublishedForNewBlock 1272) —
  // append a new standalone exercise (manual path only; the AI chooser modal is
  // deferred). Seeds a default MCQ exercise and returns the created item.
  const addExercise = useCallback((): ContentItem => {
    let created: ContentItem = { type: 'exercise', data: createDefaultExercise(0), collapsed: false, order_index: 0 }
    setContentItems((prev) => {
      const newIndex = prev.length
      const ex = createDefaultExercise(newIndex)
      ex.published = currentLessonStatus !== 'published'
      created = { type: 'exercise', data: ex, collapsed: false, order_index: newIndex }
      return [...prev, created]
    })
    return created
  }, [currentLessonStatus])

  // (legacy updateContentItem 1699-1705) — replace only .data at index,
  // preserving type / collapsed / order_index.
  const updateItemData = useCallback((index: number, data: ContentItem['data']) => {
    setContentItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], data }
      return updated
    })
  }, [])

  // (legacy moveItem 1687-1697) — swap with neighbour, then renumber order_index.
  const moveItem = useCallback((index: number, dir: 'up' | 'down') => {
    setContentItems((prev) => {
      const newIndex = dir === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[newIndex]
      updated[newIndex] = temp
      return updated.map((item, i) => ({ ...item, order_index: i }))
    })
  }, [])

  // (legacy removeContentItem 1675-1677) — drop the item, then renumber.
  const removeItem = useCallback((index: number) => {
    setContentItems((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order_index: i })))
  }, [])

  // (legacy togglePublished 1274-1290) — flashcards toggle separately (no-op);
  // exercise / block flip data.published.
  const togglePublished = useCallback((index: number) => {
    setContentItems((prev) => {
      const next = [...prev]
      const item = next[index]
      if (item.type === 'flashcards') {
        return prev
      } else if (item.type === 'exercise') {
        const ex = item.data as Exercise
        next[index] = { ...item, data: { ...ex, published: ex.published === false ? true : false } }
      } else {
        const block = item.data as ContentBlock
        next[index] = { ...item, data: { ...block, published: block.published === false ? true : false } }
      }
      return next
    })
  }, [])

  // (legacy isItemPublished 1292-1296) — flashcards read the top-level boolean.
  const isItemPublished = useCallback((item: ContentItem): boolean => {
    if (item.type === 'flashcards') return flashcardsPublished
    if (item.type === 'exercise') return (item.data as Exercise).published !== false
    return (item.data as ContentBlock).published !== false
  }, [flashcardsPublished])

  // (legacy toggleCollapse 1679-1685) — flip the item's collapsed flag.
  const toggleCollapse = useCallback((index: number) => {
    setContentItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], collapsed: !updated[index].collapsed }
      return updated
    })
  }, [])

  // ── AI insert actions ──
  // These mirror the legacy AI-merge logic so the new editor's AI flow inserts
  // generated content exactly as the old editor did. All use functional
  // setContentItems so order_index is derived from the live array, never a
  // stale closure.

  // (legacy generateFlashcards merge 1727-1745) — if a flashcards item exists,
  // append cards to it (re-indexing order_index = existing.length + i); else
  // create a new flashcards item. When the title is empty and the AI suggested
  // one, fill it in.
  const appendGeneratedFlashcards = useCallback((cards: Flashcard[], suggestedTitle?: string) => {
    setContentItems((prev) => {
      const idx = prev.findIndex((i) => i.type === 'flashcards')
      if (idx >= 0) {
        const existing = prev[idx].data as Flashcard[]
        const appended = cards.map((c, i) => ({ ...c, order_index: existing.length + i }))
        const next = [...prev]
        next[idx] = { ...next[idx], data: [...existing, ...appended] }
        return next
      }
      const reindexed = cards.map((c, i) => ({ ...c, order_index: i }))
      return [
        ...prev,
        { type: 'flashcards', data: reindexed, collapsed: false, order_index: prev.length },
      ]
    })
    if (!title.trim() && suggestedTitle) setTitle(suggestedTitle)
  }, [title])

  // (legacy aiExGenerateFromFiles inserts 1929-1932 / 1959-1967 / 2000-2003) —
  // append each generated exercise as its own content item at the end, stamping
  // order_index and the publish default from the current lesson status.
  const appendGeneratedExercises = useCallback((exercises: Exercise[]) => {
    setContentItems((prev) => {
      const published = currentLessonStatus !== 'published'
      const newItems: ContentItem[] = exercises.map((ex, i) => {
        const order_index = prev.length + i
        return {
          type: 'exercise',
          data: { ...ex, order_index, published },
          collapsed: false,
          order_index,
        }
      })
      return [...prev, ...newItems]
    })
  }, [currentLessonStatus])

  // (legacy AI block insert 1655-1668; also reading 1493-1504, grammar 1592-1603) —
  // append a single AI-generated content block of the given type.
  const appendGeneratedBlock = useCallback((blockType: BlockType, title: string, content: unknown) => {
    setContentItems((prev) => {
      const order_index = prev.length
      const block: ContentBlock = {
        block_type: blockType,
        title,
        content: content as ContentBlock['content'],
        order_index,
        published: currentLessonStatus !== 'published',
      }
      return [...prev, { type: blockType, data: block, collapsed: false, order_index }]
    })
  }, [currentLessonStatus])

  // ── Back to list ──
  const backToList = useCallback(() => {
    setEditingLessonId(null)
    setEditingAuthorName(null)
    setEditingCreatedAt(null)
    setView('list')
    void loadLessons()
  }, [loadLessons])

  return {
    // view
    view,

    // unsaved-changes flag (true when edits differ from the last load/save)
    dirty,

    // list
    lessons,
    filteredLessons,
    loading,
    lessonQuery,
    setLessonQuery,

    // async status
    saving,
    publishing,
    error,

    // editing identity
    editingLessonId,
    editingAuthorName,
    editingCreatedAt,

    // metadata + setters
    courseId,
    setCourseId,
    courseName,
    setCourseName,
    title,
    setTitle,
    lessonDate,
    setLessonDate,
    lessonType,
    setLessonType,
    summary,
    setSummary,
    currentLessonStatus,
    isTemplate,
    setIsTemplate,
    isShared,
    setIsShared,
    templateCategory,
    setTemplateCategory,
    templateLevel,
    setTemplateLevel,
    flashcardsPublished,
    setFlashcardsPublished,
    testTimeLimit,
    setTestTimeLimit,
    testRevealAnswers,
    setTestRevealAnswers,
    testRulesLang,
    setTestRulesLang,
    contentBankMode,

    // content
    contentItems,

    // functions
    loadLessons,
    openLessonById,
    startNewLesson,
    saveLesson,
    backToList,

    // content-edit actions
    addFlashcardsItem,
    addBlock,
    addExercise,
    updateItemData,
    moveItem,
    removeItem,
    togglePublished,
    isItemPublished,
    toggleCollapse,

    // AI insert actions
    appendGeneratedFlashcards,
    appendGeneratedExercises,
    appendGeneratedBlock,
  }
}

export type UseLessonEditor = ReturnType<typeof useLessonEditor>
