'use client'

import { useState, useEffect, useCallback } from 'react'

interface SrsWord {
  id: string
  word: string
  meaning: string
  phonetic: string
  example: string
  box_level: number
  next_review_at: string
}

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

  useEffect(() => {
    Promise.all([loadStats(), loadDueWords()])
      .finally(() => setLoading(false))
  }, [loadStats, loadDueWords])

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

  const handleReviewResult = async (correct: boolean) => {
    const word = dueWords[currentIdx]
    if (!word) return

    // Update SRS
    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', word_id: word.id, correct }),
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
      loadStats()
    }
  }

  const handleQuizSelect = (optionIdx: number) => {
    if (quizSelected !== null) return
    setQuizSelected(optionIdx)
    const correct = quizOptions[optionIdx] === dueWords[currentIdx].meaning
    // Auto-advance after delay
    setTimeout(() => handleReviewResult(correct), 1200)
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
          <h3 className="text-2xl font-bold text-[#46464b] mb-1">{word.word}</h3>
          {word.phonetic && <p className="text-xs text-gray-400 mb-4">{word.phonetic}</p>}

          {flipped ? (
            <div className="text-center animate-fade-in">
              <p className="text-base text-[#46464b] font-medium">{word.meaning}</p>
              {word.example && (
                <p className="text-xs text-gray-400 italic mt-2">{word.example}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">Tap to reveal meaning</p>
          )}
        </div>

        {/* Answer buttons */}
        {flipped && (
          <div className="flex gap-3">
            <button
              onClick={() => handleReviewResult(false)}
              className="flex-1 bg-red-50 border-2 border-red-200 text-red-500 font-bold py-3 rounded-xl text-sm hover:bg-red-100 transition-colors"
            >
              ✗ Didn&apos;t know
            </button>
            <button
              onClick={() => handleReviewResult(true)}
              className="flex-1 bg-green-50 border-2 border-green-200 text-green-600 font-bold py-3 rounded-xl text-sm hover:bg-green-100 transition-colors"
            >
              ✓ Knew it
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
          <h3 className="text-2xl font-bold text-[#46464b]">{word.word}</h3>
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
          <p className="text-xs font-bold text-gray-400 uppercase mb-3">Leitner Boxes — {stats.total} words</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((box) => {
              const count = stats[box as keyof Stats] as number || 0
              const pctHeight = stats.total > 0 ? Math.max((count / stats.total) * 100, count > 0 ? 10 : 0) : 0
              return (
                <div key={box} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-20 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div
                      className={`absolute bottom-0 w-full rounded-lg ${BOX_COLORS[box]} transition-all duration-500`}
                      style={{ height: `${pctHeight}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-500">{count}</span>
                  <span className="text-[9px] text-gray-400">{BOX_LABELS[box]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex-1 bg-[#e6f0fa] text-[#416ebe] font-bold py-3 rounded-xl text-sm hover:bg-[#cddcf0] transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : '🔄 Sync from lessons'}
        </button>
        <button
          onClick={() => setView('add')}
          className="flex-1 bg-white border-2 border-[#cddcf0] text-[#46464b] font-bold py-3 rounded-xl text-sm hover:border-[#416ebe] hover:text-[#416ebe] transition-colors"
        >
          + Add word
        </button>
      </div>

      {stats && stats.total === 0 && (
        <div className="bg-[#f7fafd] rounded-xl border border-[#e6f0fa] p-4 text-center">
          <p className="text-xs text-gray-400">
            No words yet. Click &quot;Sync from lessons&quot; to import your vocabulary, or add words manually.
          </p>
        </div>
      )}
    </div>
  )
}
