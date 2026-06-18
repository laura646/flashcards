'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AudioButton from '@/components/AudioButton'
import { RatingRow, type Rating } from '@/components/student-ui'

interface SrsWord {
  id: string
  word: string
  meaning: string
  phonetic: string
  example: string
  notes?: string | null
  translation?: string | null
  image_url?: string | null
  box_level: number
  next_review_at: string
}

type Grade = 'again' | 'hard' | 'good' | 'easy'

interface Stats {
  1: number; 2: number; 3: number; 4: number; 5: number
  total: number; due: number; review_due: number; new_words: number
}

interface SessionResults {
  again: number
  hard: number
  good: number
  easy: number
  total: number
}

interface Props {
  onBack: () => void
  // Deep-link entry from the Home quick-action tiles:
  //   'add'  → open the add-word view
  //   'flip' / 'quiz' → open the Start-Review modal with that mode preset
  // (always over the student's REAL SRS words, never a demo deck).
  initialAction?: 'flip' | 'quiz' | 'add' | null
}

type ReviewMode = 'flip' | 'quiz'
type ReviewFilter = 'due' | 'hard' | 'easy' | 'all'

const BOX_LABELS = ['', 'New', 'Learning', 'Familiar', 'Known', 'Mastered']
// Leitner ramp (brief §3) — used ONLY for the box-distribution bar chart.
const BOX_COLORS = ['', 'bg-leitner-new', 'bg-leitner-learning', 'bg-leitner-familiar', 'bg-leitner-known', 'bg-leitner-mastered']

const GRADE_CONFIG = [
  { grade: 'again' as Grade, label: 'Again', sub: 'forgot',   base: 'bg-red-50 border-red-200 text-red-500',         active: 'bg-red-500 border-red-500 text-white',    dot: 'bg-red-400',    pill: 'bg-red-100 text-red-500' },
  { grade: 'hard'  as Grade, label: 'Hard',  sub: 'barely',   base: 'bg-orange-50 border-orange-200 text-orange-500', active: 'bg-orange-500 border-orange-500 text-white', dot: 'bg-orange-400', pill: 'bg-orange-100 text-orange-500' },
  { grade: 'good'  as Grade, label: 'Good',  sub: 'got it',   base: 'bg-green-50 border-green-200 text-green-600',   active: 'bg-green-500 border-green-500 text-white',  dot: 'bg-green-400',  pill: 'bg-green-100 text-green-600' },
  { grade: 'easy'  as Grade, label: 'Easy',  sub: 'too easy', base: 'bg-blue-50 border-blue-200 text-blue-500',      active: 'bg-blue-500 border-blue-500 text-white',    dot: 'bg-blue-400',   pill: 'bg-blue-100 text-blue-500' },
]

export default function VocabTrainer({ onBack, initialAction = null }: Props) {
  const { data: session } = useSession()
  const studentEmail = session?.user?.email || ''
  const initialActionDone = useRef(false)
  // Guard so a fast double-tap on the one-tap RatingRow can't rate two
  // cards from a single render (it commits an irreversible SRS write).
  const ratingInFlight = useRef(false)
  // Undo support: snapshot of the just-rated card so a mis-tap is recoverable.
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lastReview, setLastReview] = useState<
    { wordId: string; word: string; prev: unknown; grade: Grade; requeued: boolean; prevIdx: number } | null
  >(null)

  const [view, setView] = useState<'home' | 'review' | 'add'>('home')
  const [stats, setStats] = useState<Stats | null>(null)
  const [dueWords, setDueWords] = useState<SrsWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState<ReviewMode>('flip')

  // Review state
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [hasFlipped, setHasFlipped] = useState(false)
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null)
  const [quizOptions, setQuizOptions] = useState<string[]>([])
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const [sessionResults, setSessionResults] = useState<SessionResults>({ again: 0, hard: 0, good: 0, easy: 0, total: 0 })
  const [sessionDone, setSessionDone] = useState(false)

  // Pre-review modal
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewWordCount, setReviewWordCount] = useState(15)
  const [wordCountInput, setWordCountInput] = useState('15')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('due')
  const [modalMode, setModalMode] = useState<ReviewMode>('flip')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  // Add word
  const [addWord, setAddWord] = useState('')
  const [addMeaning, setAddMeaning] = useState('')
  const [addPhonetic, setAddPhonetic] = useState('')
  const [addExample, setAddExample] = useState('')
  const [addTranslation, setAddTranslation] = useState('')

  // Streak + focus
  const [streak, setStreak] = useState(0)
  const [reviewedToday, setReviewedToday] = useState(false)
  const [focusWords, setFocusWords] = useState<{ id: string; word: string; meaning: string }[]>([])
  const [showFocus, setShowFocus] = useState(false)

  // Stage browser
  const [stageBox, setStageBox] = useState<number | null>(null)
  const [stageWords, setStageWords] = useState<SrsWord[]>([])
  const [stageLoading, setStageLoading] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ word: '', phonetic: '', meaning: '', example: '', notes: '', translation: '', image_url: '' })
  const [editSaving, setEditSaving] = useState(false)

  const startEdit = (w: SrsWord) => {
    setEditingId(w.id)
    setEditForm({
      word: w.word || '',
      phonetic: w.phonetic || '',
      meaning: w.meaning || '',
      example: w.example || '',
      notes: w.notes || '',
      translation: w.translation || '',
      image_url: w.image_url || '',
    })
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (id: string) => {
    if (!editForm.word.trim()) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          word_id: id,
          word: editForm.word.trim(),
          phonetic: editForm.phonetic,
          meaning: editForm.meaning,
          example: editForm.example,
          notes: editForm.notes,
          translation: editForm.translation,
          image_url: editForm.image_url || null,
        }),
      })
      if (res.ok) {
        setStageWords((prev) =>
          prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  word: editForm.word.trim(),
                  phonetic: editForm.phonetic,
                  meaning: editForm.meaning,
                  example: editForm.example,
                  notes: editForm.notes || null,
                  translation: editForm.translation || null,
                  image_url: editForm.image_url || null,
                }
              : w
          )
        )
        setEditingId(null)
      } else {
        setError('Could not save your changes. Please try again.')
      }
    } catch {
      setError('Network error — changes not saved.')
    }
    setEditSaving(false)
  }

  const openStage = useCallback(async (box: number) => {
    setStageBox(box)
    setStageLoading(true)
    setStageWords([])
    try {
      const res = await fetch('/api/vocab-srs?action=all')
      const data = await res.json()
      const all: SrsWord[] = data.words || []
      setStageWords(all.filter((w) => (w.box_level || 1) === box).sort((a, b) => a.word.localeCompare(b.word)))
    } catch { /* leave empty */ }
    setStageLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/vocab-srs?action=stats')
    const data = await res.json()
    if (data.stats) setStats(data.stats)
  }, [])

  const loadDueWords = useCallback(async () => {
    const res = await fetch('/api/vocab-srs?action=due')
    const data = await res.json()
    setDueWords(data.words || [])
  }, [])

  const loadStreak = useCallback(async () => {
    try {
      const res = await fetch('/api/vocab-srs?action=streak')
      const data = await res.json()
      setStreak(data.streak || 0)
      setReviewedToday(!!data.reviewedToday)
    } catch { /* non-blocking */ }
  }, [])

  const loadFocus = useCallback(async () => {
    try {
      const res = await fetch('/api/vocab-srs?action=focus')
      const data = await res.json()
      setFocusWords(data.words || [])
    } catch { /* non-blocking */ }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        await fetch('/api/vocab-srs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync' }),
        })
      } catch { /* non-blocking */ }
      await Promise.all([loadStats(), loadDueWords(), loadStreak(), loadFocus()])
      setLoading(false)
    }
    init()
  }, [loadStats, loadDueWords, loadStreak, loadFocus])

  // Deep-link entry from the Home quick-action tiles. Runs once, after the
  // trainer has loaded, so review starts over real (synced) SRS words.
  useEffect(() => {
    if (loading || !initialAction || initialActionDone.current) return
    initialActionDone.current = true
    if (initialAction === 'add') {
      setView('add')
    } else if (initialAction === 'flip' || initialAction === 'quiz') {
      setModalMode(initialAction)
      setModalError('')
      setShowReviewModal(true)
    }
  }, [loading, initialAction])

  const handleAddWord = async () => {
    if (!addWord.trim()) return
    setError(null)
    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          word: addWord.trim(),
          meaning: addMeaning.trim(),
          phonetic: addPhonetic.trim(),
          example: addExample.trim(),
          translation: addTranslation.trim() || null,
        }),
      })
      if (!res.ok) { setError('Failed to add word. Please try again.'); return }
      setAddWord(''); setAddMeaning(''); setAddPhonetic(''); setAddExample(''); setAddTranslation('')
      await Promise.all([loadStats(), loadDueWords()])
      setView('home')
    } catch {
      setError('Network error — could not add word.')
    }
  }

  const generateQuizOptions = useCallback((idx: number) => {
    if (dueWords.length === 0) return
    const correct = dueWords[idx]
    const wrongPool = dueWords.filter((_, i) => i !== idx).map((w) => w.meaning).filter((m) => m && m.length > 0)
    const shuffled = [...wrongPool].sort(() => Math.random() - 0.5).slice(0, 3)
    setQuizOptions([...shuffled, correct.meaning].sort(() => Math.random() - 0.5))
  }, [dueWords])

  const startReview = (mode: ReviewMode) => {
    setReviewMode(mode)
    setCurrentIdx(0)
    setFlipped(false)
    setHasFlipped(false)
    setSelectedGrade(null)
    setQuizSelected(null)
    setSessionResults({ again: 0, hard: 0, good: 0, easy: 0, total: 0 })
    setSessionDone(false)
    setView('review')
    if (mode === 'quiz') generateQuizOptions(0)
  }

  const reviewStage = () => {
    if (stageWords.length === 0) return
    setDueWords(stageWords)
    setStageBox(null)
    startReview('flip')
  }

  const openReviewModal = () => {
    setModalError('')
    setShowReviewModal(true)
  }

  const startModalReview = async () => {
    setModalLoading(true)
    setModalError('')
    try {
      const actionMap: Record<ReviewFilter, string> = {
        due: 'due', hard: 'focus', easy: 'easy', all: 'all',
      }
      const res = await fetch(`/api/vocab-srs?action=${actionMap[reviewFilter]}`)
      const data = await res.json()
      let words: SrsWord[] = data.words || []
      if (reviewFilter === 'all') words = [...words].sort(() => Math.random() - 0.5)
      words = words.slice(0, reviewWordCount)

      if (words.length === 0) {
        setModalError('No words match this filter. Try a different one.')
        setModalLoading(false)
        return
      }
      setDueWords(words)
      setShowReviewModal(false)
      startReview(modalMode)
    } catch {
      setModalError('Could not load words. Please try again.')
    }
    setModalLoading(false)
  }

  const handleReviewResult = async (grade: Grade) => {
    if (ratingInFlight.current) return // block double-tap rating two cards
    const word = dueWords[currentIdx]
    if (!word) return
    ratingInFlight.current = true

    let prevSnapshot: unknown = null
    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', word_id: word.id, grade }),
      })
      if (!res.ok) setError('Failed to save review. Progress may be lost.')
      else {
        setError(null) // clear any prior transient failure on success
        const data = await res.json().catch(() => null)
        prevSnapshot = data?.prev ?? null
      }
    } catch {
      setError('Network error — review not saved.')
    }

    const newResults: SessionResults = {
      ...sessionResults,
      [grade]: sessionResults[grade] + 1,
      total: sessionResults.total + 1,
    }
    setSessionResults(newResults)

    // Re-queue failed words at the end so they come back in the same session
    if (grade === 'again') {
      setDueWords(prev => [...prev, word])
    }

    if (currentIdx + 1 < dueWords.length) {
      // Offer a brief Undo for flip-mode self-ratings (irreversible SRS write).
      if (prevSnapshot && reviewMode === 'flip') {
        setLastReview({ wordId: word.id, word: word.word, prev: prevSnapshot, grade, requeued: grade === 'again', prevIdx: currentIdx })
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
        undoTimerRef.current = setTimeout(() => setLastReview(null), 4500)
      }
      setCurrentIdx(currentIdx + 1)
      setFlipped(false)
      setHasFlipped(false)
      setSelectedGrade(null)
      setQuizSelected(null)
      if (reviewMode === 'quiz') generateQuizOptions(currentIdx + 1)
    } else {
      setSessionDone(true)
      if (studentEmail) {
        fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_email: studentEmail,
            activity_type: 'vocab_review',
            activity_id: 'srs',
            score: newResults.good + newResults.easy,
            total: newResults.total,
          }),
        }).catch(() => { /* non-blocking */ })
      }
      loadStats()
      loadStreak()
    }
    ratingInFlight.current = false
  }

  // Undo the most recent rating: restore the word's prior SRS state, step
  // back to it, and roll back the session tally + any 'again' re-queue.
  const undoLastReview = async () => {
    if (!lastReview) return
    const lr = lastReview
    setLastReview(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    try {
      await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', word_id: lr.wordId, prev: lr.prev }),
      })
    } catch { /* best-effort; UI still rolls back */ }
    setSessionResults((prev) => ({
      ...prev,
      [lr.grade]: Math.max(0, prev[lr.grade] - 1),
      total: Math.max(0, prev.total - 1),
    }))
    if (lr.requeued) setDueWords((prev) => prev.slice(0, -1)) // drop the re-queued copy
    setCurrentIdx(lr.prevIdx)
    setFlipped(true)      // show the answer again so they can re-rate
    setHasFlipped(true)
    setSelectedGrade(null)
    setQuizSelected(null)
  }

  const handleQuizSelect = (optionIdx: number) => {
    if (quizSelected !== null) return
    setQuizSelected(optionIdx)
    const correct = quizOptions[optionIdx] === dueWords[currentIdx].meaning
    setTimeout(() => handleReviewResult(correct ? 'good' : 'again'), 1200)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-brandblue text-sm">Loading trainer...</div>
      </div>
    )
  }

  // ── SESSION DONE ──
  if (view === 'review' && sessionDone) {
    const recalled = sessionResults.good + sessionResults.easy
    const pct = sessionResults.total > 0 ? Math.round((recalled / sessionResults.total) * 100) : 0

    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-3">{pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}</div>
          <h2 className="text-xl font-bold text-brandblue">Session Complete!</h2>
          <p className="text-sm text-ink-muted mt-1">{sessionResults.total} words reviewed</p>
        </div>

        <div className="bg-white rounded-2xl border border-sky-border p-4 space-y-2.5">
          <p className="text-xs font-bold text-ink-muted uppercase mb-3">How it went</p>
          {GRADE_CONFIG.map(({ grade, label, dot, pill }) => (
            <div key={grade} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="text-sm text-ink-body">{label}</span>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${pill}`}>
                {sessionResults[grade]}
              </span>
            </div>
          ))}
        </div>

        {stats && (
          <div className="bg-white rounded-2xl border border-sky-border p-4">
            <p className="text-xs font-bold text-ink-muted uppercase mb-3">Your vocabulary boxes</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((box) => {
                const count = stats[box as keyof Stats] as number || 0
                const pctWidth = stats.total > 0 ? Math.max((count / stats.total) * 100, count > 0 ? 8 : 0) : 0
                return (
                  <div key={box} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-16 bg-gray-100 rounded-lg relative overflow-hidden">
                      <div className={`absolute bottom-0 w-full rounded-lg ${BOX_COLORS[box]} transition-all`} style={{ height: `${pctWidth}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-ink-muted">{count}</span>
                    <span className="text-[9px] text-ink-muted">{BOX_LABELS[box]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => { setView('home'); loadDueWords(); loadStats() }}
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Done
        </button>
      </div>
    )
  }

  // ── REVIEW MODE (FLIP) ──
  if (view === 'review' && reviewMode === 'flip' && dueWords.length > 0) {
    const word = dueWords[currentIdx]
    const progress = (currentIdx / dueWords.length) * 100

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('home')} className="text-sm text-ink-muted hover:text-sky">← Back</button>
          <h2 className="text-sm font-bold text-brandblue flex-1">Vocabulary Review</h2>
          <span className="text-xs text-ink-muted">{currentIdx + 1}/{dueWords.length}</span>
        </div>

        <div className="h-1.5 bg-sky-wash rounded-full overflow-hidden">
          <div className="h-full bg-sky rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Save-failure feedback on the active card — the dashboard banner
            isn't visible mid-session, so surface it here too. */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs text-red-500">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600 font-bold ml-2">✕</button>
          </div>
        )}

        {/* 3D flip card — auto-height so long words/translations/examples
            on the back never clip (grid-stacks both faces). */}
        <div className="card-flip w-full" style={{ minHeight: '280px' }}>
          <div className={`card-flip-inner flip-autoheight w-full h-full${flipped ? ' flipped' : ''}`}>

            {/* FRONT — word only */}
            <div
              className="card-front bg-white border-2 border-sky rounded-flashcard p-8 flex flex-col items-center justify-center cursor-pointer transition-colors"
              onClick={() => { setFlipped(true); setHasFlipped(true) }}
            >
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white mb-3 bg-sky">
                {BOX_LABELS[word.box_level]}
              </span>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-2xl font-bold text-brandblue">{word.word}</h3>
                <span onClick={(e) => e.stopPropagation()}>
                  <AudioButton text={word.word} />
                </span>
              </div>
              {word.phonetic && <p className="text-xs text-ink-muted mb-2">{word.phonetic}</p>}
              <p className="text-xs text-ink-muted mt-2">Tap to flip</p>
            </div>

            {/* BACK — meaning, photo, translation, example */}
            <div
              className="card-back bg-white border-2 border-sky rounded-flashcard p-6 flex flex-col items-center justify-center cursor-pointer"
              onClick={() => setFlipped(false)}
            >
              {word.image_url && (
                <img src={word.image_url} alt="" className="max-h-24 max-w-[180px] object-contain rounded-xl mb-3" />
              )}
              <p className="text-base text-ink-body font-medium text-center">{word.meaning}</p>
              {word.translation && (
                <p className="text-sm text-brandblue font-medium mt-1.5">🌐 {word.translation}</p>
              )}
              {word.example && (
                <p className="text-xs text-ink-muted italic mt-2 text-center">{word.example}</p>
              )}
              <p className="text-[10px] text-ink-muted mt-3">Tap to flip back</p>
            </div>

          </div>
        </div>

        {/* One-tap rating (brief §6): tapping a grade commits the SRS
            review and advances immediately — no confirm step. */}
        {hasFlipped && (
          <RatingRow
            onRate={(r) => handleReviewResult(r as Grade)}
            captions={{ again: 'forgot', hard: 'barely', good: 'got it', easy: 'too easy' }}
          />
        )}

        {/* Undo strip — recover a mis-tapped one-tap rating (4.5s window). */}
        {lastReview && (
          <div className="flex items-center justify-between bg-ink-black text-white rounded-tile px-4 py-3">
            <span className="text-sm">Rated <span className="font-bold capitalize">{lastReview.grade}</span> · {lastReview.word}</span>
            <button onClick={undoLastReview} className="text-sm font-extrabold text-sky hover:underline">Undo</button>
          </div>
        )}
      </div>
    )
  }

  // ── REVIEW MODE (QUIZ) ──
  if (view === 'review' && reviewMode === 'quiz' && dueWords.length > 0) {
    const word = dueWords[currentIdx]
    const progress = (currentIdx / dueWords.length) * 100
    const correctMeaning = word.meaning

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('home')} className="text-sm text-ink-muted hover:text-sky">← Back</button>
          <h2 className="text-sm font-bold text-brandblue flex-1">Vocabulary Quiz</h2>
          <span className="text-xs text-ink-muted">{currentIdx + 1}/{dueWords.length}</span>
        </div>

        <div className="h-1.5 bg-sky-wash rounded-full overflow-hidden">
          <div className="h-full bg-sky rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Save-failure feedback on the active card (see flip mode). */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs text-red-500">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600 font-bold ml-2">✕</button>
          </div>
        )}

        <div className="bg-white border-2 border-sky rounded-flashcard p-6 text-center">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white mb-3 bg-sky">
            {BOX_LABELS[word.box_level]}
          </span>
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-2xl font-bold text-brandblue">{word.word}</h3>
            <AudioButton text={word.word} />
          </div>
          {word.phonetic && <p className="text-xs text-ink-muted mt-1">{word.phonetic}</p>}
          <p className="text-xs text-ink-muted mt-3">What does this word mean?</p>
        </div>

        <div className="space-y-2">
          {quizOptions.map((opt, i) => {
            const isSelected = quizSelected === i
            const isCorrect = opt === correctMeaning
            let btnClass = 'bg-white border-[1.5px] border-sky-border text-ink-body hover:border-sky'
            if (quizSelected !== null) {
              if (isCorrect) btnClass = 'bg-correct-bg border-[1.5px] border-correct-border text-correct-fg'
              else if (isSelected && !isCorrect) btnClass = 'bg-incorrect-bg border-[1.5px] border-incorrect-border text-incorrect-fg'
              else btnClass = 'bg-white border-[1.5px] border-hairline text-ink-muted opacity-70'
            }
            return (
              <button key={i} onClick={() => handleQuizSelect(i)} disabled={quizSelected !== null}
                className={`w-full py-3 px-4 rounded-xl text-sm font-medium text-left transition-all ${btnClass}`}>
                {opt}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── ADD WORD ──
  if (view === 'add') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('home')} className="text-sm text-ink-muted hover:text-sky">← Back</button>
          <h2 className="text-sm font-bold text-brandblue">Add a Word</h2>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Word *', value: addWord, setter: setAddWord, placeholder: 'e.g. ubiquitous' },
            { label: 'Meaning', value: addMeaning, setter: setAddMeaning, placeholder: 'e.g. found everywhere' },
            { label: 'Phonetic', value: addPhonetic, setter: setAddPhonetic, placeholder: 'e.g. /juːˈbɪkwɪtəs/' },
            { label: 'Example sentence', value: addExample, setter: setAddExample, placeholder: 'e.g. Smartphones are ubiquitous in modern life.' },
            { label: 'Translation (your language, optional)', value: addTranslation, setter: setAddTranslation, placeholder: 'e.g. повсюду, überall…' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">{label}</label>
              <input type="text" value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky" />
            </div>
          ))}
        </div>

        <button onClick={handleAddWord} disabled={!addWord.trim()}
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
          Add Word
        </button>
      </div>
    )
  }

  // ── STAGE WORD LIST ──
  if (stageBox !== null) {
    const label = BOX_LABELS[stageBox]
    const isWeakStage = stageBox <= 3
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStageBox(null)} className="text-sm text-ink-muted hover:text-sky">← Back</button>
          <h2 className="text-sm font-bold text-brandblue flex-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white mr-2 bg-sky">
              {label}
            </span>
            {stageWords.length} word{stageWords.length === 1 ? '' : 's'}
          </h2>
        </div>

        {isWeakStage && stageWords.length > 0 && (
          <button onClick={reviewStage}
            className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors">
            Review these {stageWords.length} word{stageWords.length === 1 ? '' : 's'} now
          </button>
        )}

        {stageLoading ? (
          <div className="text-sm text-ink-muted text-center py-8">Loading…</div>
        ) : stageWords.length === 0 ? (
          <div className="bg-surface rounded-xl border border-hairline p-6 text-center">
            <div className="text-3xl mb-2">{stageBox === 5 ? '🏆' : '📭'}</div>
            <p className="text-xs text-ink-muted">
              {stageBox === 5
                ? "No mastered words yet — keep reviewing and they'll land here."
                : 'No words in this stage right now.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-sky-border shadow-sm overflow-hidden divide-y divide-hairline">
            {stageWords.map((w) =>
              editingId === w.id ? (
                <div key={w.id} className="px-4 py-3 bg-surface space-y-2">
                  {[
                    { key: 'word' as const, label: 'Word', placeholder: '' },
                    { key: 'phonetic' as const, label: 'Phonetic', placeholder: '' },
                    { key: 'meaning' as const, label: 'Meaning', placeholder: '' },
                    { key: 'translation' as const, label: 'Translation (your language)', placeholder: 'e.g. your own-language word' },
                    { key: 'example' as const, label: 'Example', placeholder: '' },
                    { key: 'notes' as const, label: 'My notes (memory tricks, personal associations…)', placeholder: 'e.g. sounds like "ubiquitous" → think of ants everywhere' },
                    { key: 'image_url' as const, label: 'Image URL (optional — paste a direct image link)', placeholder: 'https://…' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-bold text-ink-muted uppercase mb-0.5">{label}</label>
                      <input type="text" value={editForm[key]}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky" />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => saveEdit(w.id)} disabled={editSaving || !editForm.word.trim()}
                      className="flex-1 bg-sky hover:brightness-95 text-white font-bold py-2 rounded-lg text-xs transition-colors disabled:opacity-50">
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={cancelEdit} disabled={editSaving}
                      className="px-4 text-xs font-bold text-ink-muted hover:text-ink-body">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={w.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="text-sm font-bold text-ink-body truncate">{w.word}</h4>
                      <AudioButton text={w.word} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {w.phonetic && <span className="text-xs text-ink-muted">{w.phonetic}</span>}
                      <button onClick={() => startEdit(w)} title="Edit this word (only you see your changes)"
                        className="text-xs text-ink-muted hover:text-sky transition-colors">
                        ✎ Edit
                      </button>
                    </div>
                  </div>
                  {w.meaning && <p className="text-xs text-ink-muted mt-0.5">{w.meaning}</p>}
                  {w.translation && <p className="text-xs text-brandblue mt-0.5">🌐 {w.translation}</p>}
                </div>
              )
            )}
          </div>
        )}
      </div>
    )
  }

  // ── HOME / DASHBOARD ──
  const dueCount = (stats?.review_due ?? 0) + (stats?.new_words ?? 0) || dueWords.length

  return (
    <>
      {/* Pre-review modal */}
      {showReviewModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
          onClick={() => setShowReviewModal(false)}
        >
          <div
            className="bg-white rounded-t-2xl p-6 w-full max-w-lg pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-ink-body mb-5">Start Review</h3>

            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">How many words?</label>
            <div className="flex items-center gap-3 mb-5">
              <input
                type="text"
                inputMode="numeric"
                value={wordCountInput}
                onChange={(e) => setWordCountInput(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => {
                  const n = parseInt(wordCountInput, 10)
                  const clamped = isNaN(n) || n < 1 ? 15 : n
                  setWordCountInput(String(clamped))
                  setReviewWordCount(clamped)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                className="w-20 text-sm text-center text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky"
              />
              <span className="text-xs text-ink-muted">words</span>
            </div>

            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">Which words?</label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {([
                { value: 'due' as ReviewFilter,  label: 'Due today' },
                { value: 'hard' as ReviewFilter, label: 'Hard words' },
                { value: 'easy' as ReviewFilter, label: 'Easy words' },
                { value: 'all' as ReviewFilter,  label: 'All (shuffle)' },
              ]).map(({ value, label }) => (
                <button key={value} onClick={() => setReviewFilter(value)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-colors border-2 ${
                    reviewFilter === value
                      ? 'bg-sky border-sky text-white'
                      : 'bg-white border-sky-border text-ink-body hover:border-sky'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">Mode</label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {([
                { value: 'flip' as ReviewMode, label: '🃏 Flip cards' },
                { value: 'quiz' as ReviewMode, label: '📝 Quiz' },
              ]).map(({ value, label }) => (
                <button key={value} onClick={() => setModalMode(value)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-colors border-2 ${
                    modalMode === value
                      ? 'bg-sky border-sky text-white'
                      : 'bg-white border-sky-border text-ink-body hover:border-sky'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {modalError && <p className="text-xs text-red-500 mb-3">{modalError}</p>}

            <button onClick={startModalReview} disabled={modalLoading}
              className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 mb-2">
              {modalLoading ? 'Loading…' : 'Start →'}
            </button>
            <button onClick={() => setShowReviewModal(false)}
              className="w-full text-sm text-ink-muted hover:text-ink-body py-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-ink-muted hover:text-sky">← Back</button>
          <h2 className="text-sm font-bold text-brandblue flex-1">Vocabulary Trainer</h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs text-red-500">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Streak banner — white card + sky-wash icon tile */}
        {streak > 0 && (
          <div className="bg-white rounded-card border border-hairline p-4 flex items-center gap-3">
            <div className="w-11 h-11 shrink-0 flex items-center justify-center text-2xl bg-sky-wash rounded-tile">🔥</div>
            <div className="flex-1">
              <p className="text-base font-extrabold text-ink-black leading-tight">{streak}-day streak</p>
              <p className="text-[11px] text-ink-muted">
                {reviewedToday
                  ? 'Reviewed today — nice. Keep it going tomorrow!'
                  : `Review today to keep your ${streak}-day streak alive`}
              </p>
            </div>
          </div>
        )}

        {/* Due words card — solid sky */}
        <div className="bg-sky rounded-card p-5 text-white">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/15 rounded-tile p-3">
              <p className="text-[10px] text-white uppercase font-bold tracking-wide">Due for review</p>
              <p className="text-[40px] leading-none font-extrabold mt-1 tracking-hero">{stats?.review_due ?? 0}</p>
              <p className="text-[10px] text-white mt-1">already seen, time to repeat</p>
            </div>
            <div className="bg-white/15 rounded-tile p-3">
              <p className="text-[10px] text-white uppercase font-bold tracking-wide">New words</p>
              <p className="text-[40px] leading-none font-extrabold mt-1 tracking-hero">{stats?.new_words ?? 0}</p>
              <p className="text-[10px] text-white mt-1">waiting to be introduced</p>
            </div>
          </div>
          {dueCount > 0 ? (
            <button onClick={openReviewModal}
              className="w-full bg-white text-ink-body font-extrabold py-2.5 rounded-tile text-sm hover:bg-white/95 transition-colors">
              🃏 Start Review
            </button>
          ) : (
            <p className="text-xs text-white text-center">All caught up! Come back later for more reviews.</p>
          )}
        </div>

        {/* Box distribution */}
        {stats && stats.total > 0 && (
          <div className="bg-white rounded-2xl border border-sky-border p-4">
            <p className="text-xs font-bold text-ink-muted uppercase mb-3">Your words — {stats.total} total</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((box) => {
                const count = stats[box as keyof Stats] as number || 0
                const pctHeight = stats.total > 0 ? Math.max((count / stats.total) * 100, count > 0 ? 10 : 0) : 0
                return (
                  <button key={box} onClick={() => count > 0 && openStage(box)} disabled={count === 0}
                    className={`flex-1 flex flex-col items-center gap-1 rounded-lg p-1 transition-colors ${count > 0 ? 'hover:bg-surface cursor-pointer' : 'cursor-default'}`}
                    title={count > 0 ? `See your ${count} ${BOX_LABELS[box]} word${count === 1 ? '' : 's'}` : undefined}>
                    <div className="w-full h-20 bg-[#eef1f6] rounded-tile relative overflow-hidden">
                      <div className={`absolute bottom-0 w-full rounded-tile ${BOX_COLORS[box]} transition-all duration-500`} style={{ height: `${pctHeight}%` }} />
                    </div>
                    <span className="text-xs font-bold text-ink-muted">{count}</span>
                    <span className="text-[9px] text-ink-muted">{BOX_LABELS[box]}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-ink-muted text-center mt-2">Tap a bar to see those words</p>
          </div>
        )}

        {/* Add word */}
        <button onClick={() => setView('add')}
          className="w-full bg-white border-2 border-sky-border text-ink-body font-bold py-3 rounded-xl text-sm hover:border-sky hover:text-sky transition-colors">
          + Add word
        </button>

        {/* Focus words */}
        {focusWords.length > 0 && (
          <div className="bg-white rounded-2xl border border-sky-border p-4">
            <button onClick={() => setShowFocus((v) => !v)} className="w-full flex items-center justify-between">
              <p className="text-xs font-bold text-ink-muted uppercase flex items-center gap-1.5">
                <span>🎯</span> {focusWords.length} word{focusWords.length === 1 ? '' : 's'} need extra attention
              </p>
              <span className="text-xs text-ink-muted">{showFocus ? '▲' : '▼'}</span>
            </button>
            {showFocus && (
              <div className="mt-3 space-y-1.5">
                {focusWords.map((w) => (
                  <div key={w.id} className="flex items-baseline justify-between gap-2 border-b border-[#f0f4f9] pb-1.5 last:border-b-0">
                    <span className="text-sm font-bold text-ink-body">{w.word}</span>
                    <span className="text-xs text-ink-muted text-right">{w.meaning || '—'}</span>
                  </div>
                ))}
                <p className="text-[10px] text-ink-muted pt-1">
                  These come back often in your reviews until they stick. That&apos;s the system working.
                </p>
              </div>
            )}
          </div>
        )}

        {stats && stats.total === 0 && (
          <div className="bg-surface rounded-xl border border-hairline p-4 text-center">
            <p className="text-xs text-ink-muted">
              No words yet. Your vocabulary imports automatically from your lessons —
              once your teacher publishes lessons with flashcards, they&apos;ll appear
              here. You can also add words manually.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
