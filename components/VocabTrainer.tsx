'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AudioButton from '@/components/AudioButton'
import { RatingRow } from '@/components/student-ui'

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
  // ?mode=flip|quiz deep-link from Home → preselect that mode in the setup.
  initialAction?: 'flip' | 'quiz' | null
  // "Practice these N" from a My Vocabulary progress bucket → jump straight
  // into a flip review of just that mastery stage (1–5).
  initialStage?: number | null
}

type ReviewMode = 'flip' | 'quiz'
type ReviewFilter = 'due' | 'hard' | 'easy' | 'all'

const BOX_LABELS = ['', 'New', 'Learning', 'Familiar', 'Known', 'Mastered']
// Leitner ramp — used only for the session-summary box chart.
const BOX_COLORS = ['', 'bg-leitner-new', 'bg-leitner-learning', 'bg-leitner-familiar', 'bg-leitner-known', 'bg-leitner-mastered']

const GRADE_CONFIG = [
  { grade: 'again' as Grade, label: 'Again', dot: 'bg-rating-again-fg', pill: 'bg-rating-again-bg text-rating-again-fg' },
  { grade: 'hard'  as Grade, label: 'Hard',  dot: 'bg-rating-hard-fg',  pill: 'bg-rating-hard-bg text-rating-hard-fg'  },
  { grade: 'good'  as Grade, label: 'Good',  dot: 'bg-sky-dark',        pill: 'bg-sky-wash text-sky-dark'              },
  { grade: 'easy'  as Grade, label: 'Easy',  dot: 'bg-sky',             pill: 'bg-sky text-white'                      },
]

// The Vocabulary Trainer is now purely the PRACTICE surface: a setup screen
// (how many · which words · mode) → a flip/quiz session → a summary. Word
// browsing, adding and editing live on the My Vocabulary page.
export default function VocabTrainer({ onBack, initialAction = null, initialStage = null }: Props) {
  const { data: session } = useSession()
  const studentEmail = session?.user?.email || ''
  const initialDone = useRef(false)
  // Guard so a fast double-tap on the one-tap RatingRow can't rate two cards
  // from a single render (each tap commits an irreversible SRS write).
  const ratingInFlight = useRef(false)

  const [view, setView] = useState<'setup' | 'review'>('setup')
  const [stats, setStats] = useState<Stats | null>(null)
  const [dueWords, setDueWords] = useState<SrsWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState<ReviewMode>('flip')

  // Review state
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [hasFlipped, setHasFlipped] = useState(false)
  const [quizOptions, setQuizOptions] = useState<string[]>([])
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const [sessionResults, setSessionResults] = useState<SessionResults>({ again: 0, hard: 0, good: 0, easy: 0, total: 0 })
  const [sessionDone, setSessionDone] = useState(false)

  // Setup
  const [setupCount, setSetupCount] = useState(15)
  const [setupCountInput, setSetupCountInput] = useState('15')
  const [setupFilter, setSetupFilter] = useState<ReviewFilter>('due')
  const [setupMode, setSetupMode] = useState<ReviewMode>('flip')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/vocab-srs?action=stats')
      const data = await res.json()
      if (data.stats) setStats(data.stats)
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
      await loadStats()
      setLoading(false)
    }
    init()
  }, [loadStats])

  const generateQuizOptions = useCallback((idx: number, words: SrsWord[]) => {
    if (words.length === 0) return
    const correct = words[idx]
    // Distinct wrong meanings, excluding any that match the correct answer.
    const wrongPool = Array.from(new Set(
      words
        .filter((_, i) => i !== idx)
        .map((w) => w.meaning)
        .filter((m) => m && m.length > 0 && m !== correct.meaning)
    ))
    const shuffled = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3)
    setQuizOptions([...shuffled, correct.meaning].sort(() => Math.random() - 0.5))
  }, [])

  const startReview = useCallback((mode: ReviewMode, words: SrsWord[]) => {
    setReviewMode(mode)
    setDueWords(words)
    setCurrentIdx(0)
    setFlipped(false)
    setHasFlipped(false)
    setQuizSelected(null)
    setSessionResults({ again: 0, hard: 0, good: 0, easy: 0, total: 0 })
    setSessionDone(false)
    setView('review')
    if (mode === 'quiz') generateQuizOptions(0, words)
  }, [generateQuizOptions])

  const startSetupReview = async () => {
    setSetupLoading(true)
    setSetupError('')
    try {
      const actionMap: Record<ReviewFilter, string> = { due: 'due', hard: 'focus', easy: 'easy', all: 'all' }
      const res = await fetch(`/api/vocab-srs?action=${actionMap[setupFilter]}`)
      const data = await res.json()
      let words: SrsWord[] = data.words || []
      if (setupFilter === 'all') words = [...words].sort(() => Math.random() - 0.5)
      words = words.slice(0, setupCount)
      if (words.length === 0) {
        setSetupError('No words match this filter. Try a different one.')
        setSetupLoading(false)
        return
      }
      startReview(setupMode, words)
    } catch {
      setSetupError('Could not load words. Please try again.')
    }
    setSetupLoading(false)
  }

  // Entry: a direct stage review ("Practice these N"), or a mode preset.
  useEffect(() => {
    if (loading || initialDone.current) return
    initialDone.current = true
    if (initialStage != null) {
      ;(async () => {
        try {
          const res = await fetch('/api/vocab-srs?action=all')
          const data = await res.json()
          const all: SrsWord[] = data.words || []
          const inStage = all
            .filter((w) => (w.box_level || 1) === initialStage)
            .sort(() => Math.random() - 0.5)
          if (inStage.length > 0) startReview('flip', inStage)
          else onBack()
        } catch {
          onBack()
        }
      })()
      return
    }
    if (initialAction === 'flip' || initialAction === 'quiz') setSetupMode(initialAction)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialAction, initialStage])

  const handleReviewResult = async (grade: Grade) => {
    if (ratingInFlight.current) return
    const word = dueWords[currentIdx]
    if (!word) return
    ratingInFlight.current = true

    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', word_id: word.id, grade }),
      })
      if (!res.ok) setError('Failed to save review. Progress may be lost.')
      else setError(null)
    } catch {
      setError('Network error — review not saved.')
    }

    const newResults: SessionResults = {
      ...sessionResults,
      [grade]: sessionResults[grade] + 1,
      total: sessionResults.total + 1,
    }
    setSessionResults(newResults)

    // Re-queue failed words at the end so they come back this session.
    let queue = dueWords
    if (grade === 'again') {
      queue = [...dueWords, word]
      setDueWords(queue)
    }

    if (currentIdx + 1 < queue.length) {
      setCurrentIdx(currentIdx + 1)
      setFlipped(false)
      setHasFlipped(false)
      setQuizSelected(null)
      if (reviewMode === 'quiz') generateQuizOptions(currentIdx + 1, queue)
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
    }
    ratingInFlight.current = false
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
          <div className="text-5xl mb-3" aria-hidden="true">{pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}</div>
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

        <div className="flex gap-2">
          <button
            onClick={() => { setSessionDone(false); setView('setup') }}
            className="flex-1 bg-white border-2 border-sky-border text-ink-body font-bold py-3 rounded-xl text-sm hover:border-sky hover:text-sky transition-colors"
          >
            Practice more
          </button>
          <button
            onClick={onBack}
            className="flex-1 bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Done
          </button>
        </div>
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
          <button onClick={onBack} className="text-sm text-ink-muted hover:text-sky">← Back</button>
          <h2 className="text-sm font-bold text-brandblue flex-1">Vocabulary Review</h2>
          <span className="text-xs text-ink-muted">{currentIdx + 1}/{dueWords.length}</span>
        </div>

        <div className="h-1.5 bg-sky-wash rounded-full overflow-hidden">
          <div className="h-full bg-sky rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs text-red-500">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-600 font-bold ml-2">✕</button>
          </div>
        )}

        {/* 3D flip card — auto-height so long backs never clip. */}
        <div className="card-flip w-full" style={{ minHeight: '280px' }}>
          <div className={`card-flip-inner flip-autoheight w-full h-full${flipped ? ' flipped' : ''}`}>
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

        {hasFlipped && (
          <RatingRow
            onRate={(r) => handleReviewResult(r as Grade)}
            captions={{ again: 'forgot', hard: 'barely', good: 'got it', easy: 'too easy' }}
          />
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
          <button onClick={onBack} className="text-sm text-ink-muted hover:text-sky">← Back</button>
          <h2 className="text-sm font-bold text-brandblue flex-1">Vocabulary Quiz</h2>
          <span className="text-xs text-ink-muted">{currentIdx + 1}/{dueWords.length}</span>
        </div>

        <div className="h-1.5 bg-sky-wash rounded-full overflow-hidden">
          <div className="h-full bg-sky rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

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

  // ── SETUP (default entry) ──
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-ink-muted hover:text-sky">← Back</button>
        <h2 className="text-sm font-bold text-brandblue flex-1">Set up your practice</h2>
      </div>

      {stats && (
        <p className="text-xs text-ink-muted -mt-1">
          {stats.review_due} due for review · {stats.new_words} new waiting
        </p>
      )}

      <div>
        <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">How many words?</label>
        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="numeric"
            value={setupCountInput}
            onChange={(e) => setSetupCountInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const n = parseInt(setupCountInput, 10)
              const clamped = isNaN(n) || n < 1 ? 15 : n
              setSetupCountInput(String(clamped))
              setSetupCount(clamped)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="w-20 text-sm text-center text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky"
          />
          <span className="text-xs text-ink-muted">words</span>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">Which words?</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'due' as ReviewFilter,  label: 'Due today' },
            { value: 'hard' as ReviewFilter, label: 'Hard words' },
            { value: 'easy' as ReviewFilter, label: 'Easy words' },
            { value: 'all' as ReviewFilter,  label: 'All (shuffle)' },
          ]).map(({ value, label }) => (
            <button key={value} onClick={() => setSetupFilter(value)}
              className={`py-2.5 rounded-xl text-sm font-bold transition-colors border-2 ${
                setupFilter === value ? 'bg-sky border-sky text-white' : 'bg-white border-sky-border text-ink-body hover:border-sky'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'flip' as ReviewMode, label: '🃏 Flip cards' },
            { value: 'quiz' as ReviewMode, label: '📝 Quiz' },
          ]).map(({ value, label }) => (
            <button key={value} onClick={() => setSetupMode(value)}
              className={`py-2.5 rounded-xl text-sm font-bold transition-colors border-2 ${
                setupMode === value ? 'bg-sky border-sky text-white' : 'bg-white border-sky-border text-ink-body hover:border-sky'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {setupError && <p className="text-xs text-red-500">{setupError}</p>}

      <button onClick={startSetupReview} disabled={setupLoading}
        className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
        {setupLoading ? 'Loading…' : 'Start practice →'}
      </button>
    </div>
  )
}
