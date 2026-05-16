'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import AudioButton from '@/components/AudioButton'

interface SrsWord {
  id: string
  word: string
  meaning: string
  phonetic: string
  example: string
  translation?: string | null
  image_url?: string | null
  box_level: number
  next_review_at: string
}

type Grade = 'again' | 'hard' | 'good' | 'easy'

interface Stats {
  1: number; 2: number; 3: number; 4: number; 5: number
  total: number; due: number
}

interface Props {
  onBack: () => void
}

type ReviewMode = 'flip' | 'quiz'

const BOX_LABELS = ['', 'New', 'Learning', 'Familiar', 'Known', 'Mastered']
const BOX_COLORS = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-400']

export default function VocabTrainer({ onBack }: Props) {
  const { data: session } = useSession()
  const studentEmail = session?.user?.email || ''
  const [view, setView] = useState<'home' | 'review' | 'add'>('home')
  const [stats, setStats] = useState<Stats | null>(null)
  const [dueWords, setDueWords] = useState<SrsWord[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState<ReviewMode>('flip')

  // Review state
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [quizOptions, setQuizOptions] = useState<string[]>([])
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const [sessionResults, setSessionResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 })
  const [sessionDone, setSessionDone] = useState(false)

  // Add word state
  const [addWord, setAddWord] = useState('')
  const [addMeaning, setAddMeaning] = useState('')
  const [addPhonetic, setAddPhonetic] = useState('')
  const [addExample, setAddExample] = useState('')

  // Phase 3: streak + focus words
  const [streak, setStreak] = useState(0)
  const [reviewedToday, setReviewedToday] = useState(false)
  const [focusWords, setFocusWords] = useState<{ id: string; word: string; meaning: string }[]>([])
  const [showFocus, setShowFocus] = useState(false)

  // Clickable stage browser: which box (1–5) is being viewed + its words
  const [stageBox, setStageBox] = useState<number | null>(null)
  const [stageWords, setStageWords] = useState<SrsWord[]>([])
  const [stageLoading, setStageLoading] = useState(false)

  // Inline edit state (student editing their own word in the stage list)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ word: '', phonetic: '', meaning: '', example: '', translation: '' })
  const [editSaving, setEditSaving] = useState(false)

  const startEdit = (w: SrsWord) => {
    setEditingId(w.id)
    setEditForm({
      word: w.word || '',
      phonetic: w.phonetic || '',
      meaning: w.meaning || '',
      example: w.example || '',
      translation: w.translation || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

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
          translation: editForm.translation,
        }),
      })
      if (res.ok) {
        // Patch the row in place so the list reflects the edit immediately
        setStageWords((prev) =>
          prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  word: editForm.word.trim(),
                  phonetic: editForm.phonetic,
                  meaning: editForm.meaning,
                  example: editForm.example,
                  translation: editForm.translation || null,
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
      setStageWords(
        all
          .filter((w) => (w.box_level || 1) === box)
          .sort((a, b) => a.word.localeCompare(b.word))
      )
    } catch {
      /* leave empty — the view shows an empty state */
    }
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
    // Auto-sync on mount so the SRS self-populates from the student's
    // lessons — no manual button click required. Silent + best-effort:
    // if it fails we still show whatever's already in the box.
    const init = async () => {
      try {
        await fetch('/api/vocab-srs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync' }),
        })
      } catch {
        /* non-blocking — fall through to load whatever exists */
      }
      await Promise.all([loadStats(), loadDueWords(), loadStreak(), loadFocus()])
      setLoading(false)
    }
    init()
  }, [loadStats, loadDueWords, loadStreak, loadFocus])

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      const data = await res.json()
      if (data.ok) {
        await Promise.all([loadStats(), loadDueWords()])
      } else {
        setError('Sync failed. Please try again.')
      }
    } catch {
      setError('Network error — could not sync.')
    }
    setSyncing(false)
  }

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
        }),
      })
      if (!res.ok) {
        setError('Failed to add word. Please try again.')
        return
      }
      setAddWord('')
      setAddMeaning('')
      setAddPhonetic('')
      setAddExample('')
      await Promise.all([loadStats(), loadDueWords()])
      setView('home')
    } catch {
      setError('Network error — could not add word.')
    }
  }

  // Generate quiz options for current word
  const generateQuizOptions = useCallback((idx: number) => {
    if (dueWords.length === 0) return
    const correct = dueWords[idx]
    const wrongPool = dueWords
      .filter((_, i) => i !== idx)
      .map((w) => w.meaning)
      .filter((m) => m && m.length > 0)

    // Shuffle and pick up to 3 wrong answers
    const shuffled = [...wrongPool].sort(() => Math.random() - 0.5).slice(0, 3)
    const options = [...shuffled, correct.meaning].sort(() => Math.random() - 0.5)

    setQuizOptions(options)
  }, [dueWords])

  const startReview = (mode: ReviewMode) => {
    setReviewMode(mode)
    setCurrentIdx(0)
    setFlipped(false)
    setQuizSelected(null)
    setSessionResults({ correct: 0, total: 0 })
    setSessionDone(false)
    // Fall back to flip if not enough words for quiz (need at least 2 for meaningful options)
    const effectiveMode = mode === 'quiz' && dueWords.length < 2 ? 'flip' : mode
    setReviewMode(effectiveMode)
    setView('review')
    if (effectiveMode === 'quiz') generateQuizOptions(0)
  }

  // Drill the currently-open stage's words as a focused review session
  const reviewStage = () => {
    if (stageWords.length === 0) return
    setDueWords(stageWords)
    setStageBox(null)
    // Always flip mode for a stage drill (quiz needs a due-word pool)
    setReviewMode('flip')
    setCurrentIdx(0)
    setFlipped(false)
    setQuizSelected(null)
    setSessionResults({ correct: 0, total: 0 })
    setSessionDone(false)
    setView('review')
  }

  const handleReviewResult = async (grade: Grade) => {
    const word = dueWords[currentIdx]
    if (!word) return

    // "again" is the only grade that counts as a miss for the session tally
    const correct = grade !== 'again'

    // Update SRS with the SM-2 grade
    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', word_id: word.id, grade }),
      })
      if (!res.ok) setError('Failed to save review. Progress may be lost.')
    } catch {
      setError('Network error — review not saved.')
    }

    const newResults = {
      correct: sessionResults.correct + (correct ? 1 : 0),
      total: sessionResults.total + 1,
    }
    setSessionResults(newResults)

    // Next word or done
    if (currentIdx + 1 < dueWords.length) {
      const nextIdx = currentIdx + 1
      setCurrentIdx(nextIdx)
      setFlipped(false)
      setQuizSelected(null)
      if (reviewMode === 'quiz') generateQuizOptions(nextIdx)
    } else {
      setSessionDone(true)
      // Log this completed review session to the progress table so the
      // consecutive-day streak can be computed. Best-effort.
      const finalCorrect = newResults.correct
      const finalTotal = newResults.total
      if (studentEmail) {
        fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_email: studentEmail,
            activity_type: 'vocab_review',
            activity_id: 'srs',
            score: finalCorrect,
            total: finalTotal,
          }),
        }).catch(() => { /* non-blocking */ })
      }
      loadStats()
      loadStreak()
    }
  }

  const handleQuizSelect = (optionIdx: number) => {
    if (quizSelected !== null) return
    setQuizSelected(optionIdx)
    const correct = quizOptions[optionIdx] === dueWords[currentIdx].meaning
    // In quiz mode there's no self-grade — a right pick is "good",
    // a wrong pick is "again" (SM-2 resets it).
    setTimeout(() => handleReviewResult(correct ? 'good' : 'again'), 1200)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#416ebe] text-sm">Loading trainer...</div>
      </div>
    )
  }

  // ── SESSION DONE ──
  if (view === 'review' && sessionDone) {
    const pct = sessionResults.total > 0
      ? Math.round((sessionResults.correct / sessionResults.total) * 100)
      : 0

    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-3">
            {pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}
          </div>
          <h2 className="text-xl font-bold text-[#416ebe]">Session Complete!</h2>
          <p className="text-sm text-gray-500 mt-1">
            {sessionResults.correct}/{sessionResults.total} correct ({pct}%)
          </p>
        </div>

        {/* Box distribution */}
        {stats && (
          <div className="bg-white rounded-2xl border border-[#cddcf0] p-4">
            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Your vocabulary boxes</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((box) => {
                const count = stats[box as keyof Stats] as number || 0
                const pctWidth = stats.total > 0 ? Math.max((count / stats.total) * 100, count > 0 ? 8 : 0) : 0
                return (
                  <div key={box} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-16 bg-gray-100 rounded-lg relative overflow-hidden">
                      <div
                        className={`absolute bottom-0 w-full rounded-lg ${BOX_COLORS[box]} transition-all`}
                        style={{ height: `${pctWidth}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-500">{count}</span>
                    <span className="text-[9px] text-gray-400">{BOX_LABELS[box]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => { setView('home'); loadDueWords() }}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Done
        </button>
      </div>
    )
  }

  // ── REVIEW MODE (FLIP) ──
  if (view === 'review' && reviewMode === 'flip' && dueWords.length > 0) {
    const word = dueWords[currentIdx]
    const progress = ((currentIdx) / dueWords.length) * 100

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('home')} className="text-sm text-gray-400 hover:text-[#416ebe]">← Back</button>
          <h2 className="text-sm font-bold text-[#416ebe] flex-1">Vocabulary Review</h2>
          <span className="text-xs text-gray-400">{currentIdx + 1}/{dueWords.length}</span>
        </div>

        <div className="h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
          <div className="h-full bg-[#416ebe] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Card */}
        <div
          onClick={() => !flipped && setFlipped(true)}
          className="bg-white border-2 border-[#cddcf0] rounded-2xl p-8 shadow-sm min-h-[200px] flex flex-col items-center justify-center cursor-pointer hover:border-[#416ebe] transition-colors"
        >
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white mb-3 ${BOX_COLORS[word.box_level]}`}>
            {BOX_LABELS[word.box_level]}
          </span>
          {word.image_url && (
            <img
              src={word.image_url}
              alt=""
              className="max-h-28 max-w-[200px] object-contain rounded-xl mb-3"
            />
          )}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-2xl font-bold text-[#46464b]">{word.word}</h3>
            {/* stopPropagation so tapping audio doesn't flip the card */}
            <span onClick={(e) => e.stopPropagation()}>
              <AudioButton text={word.word} />
            </span>
          </div>
          {word.phonetic && <p className="text-xs text-gray-400 mb-4">{word.phonetic}</p>}

          {flipped ? (
            <div className="text-center animate-fade-in">
              <p className="text-base text-[#46464b] font-medium">{word.meaning}</p>
              {word.translation && (
                <p className="text-sm text-[#416ebe] font-medium mt-1">🌐 {word.translation}</p>
              )}
              {word.example && (
                <p className="text-xs text-gray-400 italic mt-2">{word.example}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">Tap to reveal meaning</p>
          )}
        </div>

        {/* SM-2 grade buttons — how well did you recall it? */}
        {flipped && (
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleReviewResult('again')}
              className="bg-red-50 border-2 border-red-200 text-red-500 font-bold py-3 rounded-xl text-xs hover:bg-red-100 transition-colors"
            >
              Again
              <span className="block text-[9px] font-normal text-red-400 mt-0.5">forgot</span>
            </button>
            <button
              onClick={() => handleReviewResult('hard')}
              className="bg-orange-50 border-2 border-orange-200 text-orange-500 font-bold py-3 rounded-xl text-xs hover:bg-orange-100 transition-colors"
            >
              Hard
              <span className="block text-[9px] font-normal text-orange-400 mt-0.5">barely</span>
            </button>
            <button
              onClick={() => handleReviewResult('good')}
              className="bg-green-50 border-2 border-green-200 text-green-600 font-bold py-3 rounded-xl text-xs hover:bg-green-100 transition-colors"
            >
              Good
              <span className="block text-[9px] font-normal text-green-500 mt-0.5">got it</span>
            </button>
            <button
              onClick={() => handleReviewResult('easy')}
              className="bg-blue-50 border-2 border-blue-200 text-blue-500 font-bold py-3 rounded-xl text-xs hover:bg-blue-100 transition-colors"
            >
              Easy
              <span className="block text-[9px] font-normal text-blue-400 mt-0.5">too easy</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── REVIEW MODE (QUIZ) ──
  if (view === 'review' && reviewMode === 'quiz' && dueWords.length > 0) {
    const word = dueWords[currentIdx]
    const progress = ((currentIdx) / dueWords.length) * 100
    const correctMeaning = word.meaning

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('home')} className="text-sm text-gray-400 hover:text-[#416ebe]">← Back</button>
          <h2 className="text-sm font-bold text-[#416ebe] flex-1">Vocabulary Quiz</h2>
          <span className="text-xs text-gray-400">{currentIdx + 1}/{dueWords.length}</span>
        </div>

        <div className="h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
          <div className="h-full bg-[#416ebe] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Word */}
        <div className="bg-white border-2 border-[#cddcf0] rounded-2xl p-6 shadow-sm text-center">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white mb-3 ${BOX_COLORS[word.box_level]}`}>
            {BOX_LABELS[word.box_level]}
          </span>
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-2xl font-bold text-[#46464b]">{word.word}</h3>
            <AudioButton text={word.word} />
          </div>
          {word.phonetic && <p className="text-xs text-gray-400 mt-1">{word.phonetic}</p>}
          <p className="text-xs text-gray-400 mt-3">What does this word mean?</p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {quizOptions.map((opt, i) => {
            const isSelected = quizSelected === i
            const isCorrect = opt === correctMeaning
            let btnClass = 'bg-white border-2 border-[#cddcf0] text-[#46464b] hover:border-[#416ebe]'

            if (quizSelected !== null) {
              if (isCorrect) {
                btnClass = 'bg-green-50 border-2 border-green-400 text-green-700'
              } else if (isSelected && !isCorrect) {
                btnClass = 'bg-red-50 border-2 border-red-400 text-red-500'
              } else {
                btnClass = 'bg-gray-50 border-2 border-gray-200 text-gray-400'
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleQuizSelect(i)}
                disabled={quizSelected !== null}
                className={`w-full py-3 px-4 rounded-xl text-sm font-medium text-left transition-all ${btnClass}`}
              >
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
          <button onClick={() => setView('home')} className="text-sm text-gray-400 hover:text-[#416ebe]">← Back</button>
          <h2 className="text-sm font-bold text-[#416ebe]">Add a Word</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Word *</label>
            <input type="text" value={addWord} onChange={(e) => setAddWord(e.target.value)}
              placeholder="e.g. ubiquitous"
              className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Meaning</label>
            <input type="text" value={addMeaning} onChange={(e) => setAddMeaning(e.target.value)}
              placeholder="e.g. found everywhere"
              className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Phonetic</label>
            <input type="text" value={addPhonetic} onChange={(e) => setAddPhonetic(e.target.value)}
              placeholder="e.g. /juːˈbɪkwɪtəs/"
              className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Example sentence</label>
            <input type="text" value={addExample} onChange={(e) => setAddExample(e.target.value)}
              placeholder="e.g. Smartphones are ubiquitous in modern life."
              className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe]" />
          </div>
        </div>

        <button
          onClick={handleAddWord}
          disabled={!addWord.trim()}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          Add Word
        </button>
      </div>
    )
  }

  // ── STAGE WORD LIST (clicked a bar on the dashboard) ──
  if (stageBox !== null) {
    const label = BOX_LABELS[stageBox]
    const isWeakStage = stageBox <= 3 // New / Learning / Familiar — worth drilling
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStageBox(null)} className="text-sm text-gray-400 hover:text-[#416ebe]">← Back</button>
          <h2 className="text-sm font-bold text-[#416ebe] flex-1">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white mr-2 ${BOX_COLORS[stageBox]}`}>
              {label}
            </span>
            {stageWords.length} word{stageWords.length === 1 ? '' : 's'}
          </h2>
        </div>

        {isWeakStage && stageWords.length > 0 && (
          <button
            onClick={reviewStage}
            className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Review these {stageWords.length} word{stageWords.length === 1 ? '' : 's'} now
          </button>
        )}

        {stageLoading ? (
          <div className="text-sm text-gray-400 text-center py-8">Loading…</div>
        ) : stageWords.length === 0 ? (
          <div className="bg-[#f7fafd] rounded-xl border border-[#e6f0fa] p-6 text-center">
            <div className="text-3xl mb-2">{stageBox === 5 ? '🏆' : '📭'}</div>
            <p className="text-xs text-gray-400">
              {stageBox === 5
                ? "No mastered words yet — keep reviewing and they'll land here."
                : 'No words in this stage right now.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden divide-y divide-[#e6f0fa]">
            {stageWords.map((w) =>
              editingId === w.id ? (
                // ── Inline edit form ──
                <div key={w.id} className="px-4 py-3 bg-[#f7fafd] space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Word</label>
                    <input
                      type="text"
                      value={editForm.word}
                      onChange={(e) => setEditForm((f) => ({ ...f, word: e.target.value }))}
                      className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#416ebe]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Phonetic</label>
                    <input
                      type="text"
                      value={editForm.phonetic}
                      onChange={(e) => setEditForm((f) => ({ ...f, phonetic: e.target.value }))}
                      className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#416ebe]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Meaning</label>
                    <input
                      type="text"
                      value={editForm.meaning}
                      onChange={(e) => setEditForm((f) => ({ ...f, meaning: e.target.value }))}
                      className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#416ebe]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                      Translation <span className="text-gray-300 normal-case">(your language)</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.translation}
                      onChange={(e) => setEditForm((f) => ({ ...f, translation: e.target.value }))}
                      placeholder="e.g. your own-language word"
                      className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#416ebe]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Example</label>
                    <input
                      type="text"
                      value={editForm.example}
                      onChange={(e) => setEditForm((f) => ({ ...f, example: e.target.value }))}
                      className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#416ebe]"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(w.id)}
                      disabled={editSaving || !editForm.word.trim()}
                      className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-2 rounded-lg text-xs transition-colors disabled:opacity-50"
                    >
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={editSaving}
                      className="px-4 text-xs font-bold text-gray-400 hover:text-[#46464b]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // ── Read-only row ──
                <div key={w.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="text-sm font-bold text-[#46464b] truncate">{w.word}</h4>
                      <AudioButton text={w.word} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {w.phonetic && <span className="text-xs text-gray-400">{w.phonetic}</span>}
                      <button
                        onClick={() => startEdit(w)}
                        title="Edit this word (only you see your changes)"
                        className="text-xs text-gray-300 hover:text-[#416ebe] transition-colors"
                      >
                        ✎ Edit
                      </button>
                    </div>
                  </div>
                  {w.meaning && <p className="text-xs text-gray-500 mt-0.5">{w.meaning}</p>}
                  {w.translation && (
                    <p className="text-xs text-[#416ebe] mt-0.5">🌐 {w.translation}</p>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    )
  }

  // ── HOME / DASHBOARD ──
  const dueCount = stats?.due || dueWords.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-[#416ebe]">← Back</button>
        <h2 className="text-sm font-bold text-[#416ebe] flex-1">Vocabulary Trainer</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-xs text-red-500">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Streak banner — loss-aversion nudge */}
      {streak > 0 && (
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <div className="flex-1">
            <p className="text-lg font-bold leading-tight">{streak}-day streak</p>
            <p className="text-[11px] text-amber-50">
              {reviewedToday
                ? 'Reviewed today — nice. Keep it going tomorrow!'
                : `Review today to keep your ${streak}-day streak alive`}
            </p>
          </div>
        </div>
      )}

      {/* Due words card */}
      <div className="bg-gradient-to-r from-[#416ebe] to-[#5a8fd4] rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-100">Words due for review</p>
            <p className="text-3xl font-bold mt-1">{dueCount}</p>
          </div>
          <div className="text-4xl">📚</div>
        </div>
        {dueCount > 0 && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => startReview('flip')}
              className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              🃏 Flip Review
            </button>
            <button
              onClick={() => startReview('quiz')}
              className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              📝 Quiz Review
            </button>
          </div>
        )}
        {dueCount === 0 && (
          <p className="text-xs text-blue-100 mt-3">All caught up! Come back later for more reviews.</p>
        )}
      </div>

      {/* Box distribution */}
      {stats && stats.total > 0 && (
        <div className="bg-white rounded-2xl border border-[#cddcf0] p-4">
          <p className="text-xs font-bold text-gray-400 uppercase mb-3">Your words — {stats.total} total</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((box) => {
              const count = stats[box as keyof Stats] as number || 0
              const pctHeight = stats.total > 0 ? Math.max((count / stats.total) * 100, count > 0 ? 10 : 0) : 0
              return (
                <button
                  key={box}
                  onClick={() => count > 0 && openStage(box)}
                  disabled={count === 0}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-lg p-1 transition-colors ${
                    count > 0 ? 'hover:bg-[#f7fafd] cursor-pointer' : 'cursor-default'
                  }`}
                  title={count > 0 ? `See your ${count} ${BOX_LABELS[box]} word${count === 1 ? '' : 's'}` : undefined}
                >
                  <div className="w-full h-20 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div
                      className={`absolute bottom-0 w-full rounded-lg ${BOX_COLORS[box]} transition-all duration-500`}
                      style={{ height: `${pctHeight}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-500">{count}</span>
                  <span className="text-[9px] text-gray-400">{BOX_LABELS[box]}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-300 text-center mt-2">Tap a bar to see those words</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex-1 bg-[#e6f0fa] text-[#416ebe] font-bold py-3 rounded-xl text-sm hover:bg-[#cddcf0] transition-colors disabled:opacity-50"
          title="Your words sync automatically — use this only if something looks out of date"
        >
          {syncing ? 'Syncing...' : '🔄 Refresh'}
        </button>
        <button
          onClick={() => setView('add')}
          className="flex-1 bg-white border-2 border-[#cddcf0] text-[#46464b] font-bold py-3 rounded-xl text-sm hover:border-[#416ebe] hover:text-[#416ebe] transition-colors"
        >
          + Add word
        </button>
      </div>

      {/* Focus words — the ones the student keeps struggling with */}
      {focusWords.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#cddcf0] p-4">
          <button
            onClick={() => setShowFocus((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
              <span>🎯</span> {focusWords.length} word{focusWords.length === 1 ? '' : 's'} need extra attention
            </p>
            <span className="text-xs text-gray-400">{showFocus ? '▲' : '▼'}</span>
          </button>
          {showFocus && (
            <div className="mt-3 space-y-1.5">
              {focusWords.map((w) => (
                <div key={w.id} className="flex items-baseline justify-between gap-2 border-b border-[#f0f4f9] pb-1.5 last:border-b-0">
                  <span className="text-sm font-bold text-[#46464b]">{w.word}</span>
                  <span className="text-xs text-gray-400 text-right">{w.meaning || '—'}</span>
                </div>
              ))}
              <p className="text-[10px] text-gray-300 pt-1">
                These come back often in your reviews until they stick. That&apos;s the system working.
              </p>
            </div>
          )}
        </div>
      )}

      {stats && stats.total === 0 && (
        <div className="bg-[#f7fafd] rounded-xl border border-[#e6f0fa] p-4 text-center">
          <p className="text-xs text-gray-400">
            No words yet. Your vocabulary imports automatically from your lessons —
            once your teacher publishes lessons with flashcards, they&apos;ll appear
            here. You can also add words manually.
          </p>
        </div>
      )}
    </div>
  )
}
