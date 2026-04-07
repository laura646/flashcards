'use client'

import { useState, useEffect, useRef } from 'react'

interface AnagramQuestion {
  id: number
  word: string
  clue?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: AnagramQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

type LetterTile = {
  char: string
  originalIndex: number
  used: boolean
}

type QuestionResult = {
  answer: string
  correct: boolean
}

function scrambleWord(word: string): LetterTile[] {
  const letters = word.toUpperCase().split('').map((char, i) => ({
    char,
    originalIndex: i,
    used: false,
  }))

  // Fisher-Yates shuffle
  const shuffled = [...letters]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // Ensure it's not in the original order
  const isOriginal = shuffled.every((l, i) => l.char === word.toUpperCase()[i])
  if (isOriginal && shuffled.length > 1) {
    ;[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
  }

  return shuffled
}

export default function AnagramRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [tiles, setTiles] = useState<LetterTile[]>([])
  const [answer, setAnswer] = useState<LetterTile[]>([])
  const [results, setResults] = useState<(QuestionResult | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [finished, setFinished] = useState(false)
  const [shake, setShake] = useState(false)

  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentIndexRef = useRef(currentIndex)
  const resultsRef = useRef(results)
  const feedbackRef = useRef(feedback)
  currentIndexRef.current = currentIndex
  resultsRef.current = results
  feedbackRef.current = feedback

  if (!exercise.questions || exercise.questions.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">No questions in this exercise.</div>
  }

  const current = exercise.questions[currentIndex]
  const answeredCount = results.filter((r) => r !== null).length
  const progress = (answeredCount / exercise.questions.length) * 100

  useEffect(() => {
    setTiles(scrambleWord(current.word))
    setAnswer([])
    setFeedback(null)
    setShake(false)
  }, [currentIndex, current])

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    }
  }, [])

  // Auto-check when all letters are placed
  useEffect(() => {
    const curWord = exercise.questions[currentIndexRef.current]?.word
    if (!curWord || answer.length !== curWord.length || feedbackRef.current !== null) return

    const typed = answer.map((t) => t.char).join('')
    const correct = typed === curWord.toUpperCase()
    const result: QuestionResult = { answer: typed, correct }

    const newResults = [...resultsRef.current]
    newResults[currentIndexRef.current] = result
    setResults(newResults)
    setFeedback(correct ? 'correct' : 'wrong')

    if (correct) {
      autoAdvanceTimer.current = setTimeout(() => {
        advance(newResults)
      }, 1500)
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.length])

  const selectTile = (tileIdx: number) => {
    if (feedback !== null) return
    const tile = tiles[tileIdx]
    if (tile.used) return

    setTiles((prev) =>
      prev.map((t, i) => (i === tileIdx ? { ...t, used: true } : t))
    )
    setAnswer((prev) => [...prev, tile])
  }

  const removeLast = () => {
    if (feedback !== null || answer.length === 0) return
    const last = answer[answer.length - 1]
    setAnswer((prev) => prev.slice(0, -1))
    // Find and un-use the tile
    setTiles((prev) =>
      prev.map((t) =>
        t.originalIndex === last.originalIndex && t.used ? { ...t, used: false } : t
      )
    )
  }

  const clearAnswer = () => {
    if (feedback !== null) return
    setAnswer([])
    setTiles((prev) => prev.map((t) => ({ ...t, used: false })))
  }

  const advance = (latestResults: (QuestionResult | null)[]) => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current)
      autoAdvanceTimer.current = null
    }

    const allDone = latestResults.every((r) => r !== null)
    if (allDone) {
      const score = latestResults.filter((r) => r?.correct).length
      setFinished(true)
      onComplete(score, exercise.questions.length)
      return
    }

    let next = currentIndex + 1
    while (next < exercise.questions.length && latestResults[next] !== null) next++
    if (next >= exercise.questions.length) {
      next = 0
      while (next < exercise.questions.length && latestResults[next] !== null) next++
    }
    setCurrentIndex(next)
  }

  // ---------- FINISHED ----------
  if (finished) {
    const score = results.filter((r) => r?.correct).length
    const pct = Math.round((score / exercise.questions.length) * 100)

    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-3">
            {pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}
          </div>
          <h2 className="text-xl font-bold text-[#416ebe]">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good effort!' : 'Keep practising!'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            You scored {score}/{exercise.questions.length} ({pct}%)
          </p>
        </div>

        <div className="space-y-3">
          {exercise.questions.map((q, i) => {
            const result = results[i]
            const isCorrect = result?.correct ?? false
            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  isCorrect ? 'border-green-200' : 'border-red-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 ${isCorrect ? 'text-green-500' : 'text-red-400'}`}>
                    {isCorrect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    {q.clue && <p className="text-xs text-gray-400 mb-1">{q.clue}</p>}
                    {!isCorrect && result && (
                      <p className="text-sm">
                        <span className="text-red-400 line-through">{result.answer}</span>
                        {' → '}
                        <span className="text-green-600 font-bold">{q.word.toUpperCase()}</span>
                      </p>
                    )}
                    {isCorrect && (
                      <p className="text-sm text-green-600 font-bold">{q.word.toUpperCase()}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={onBack}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2"
        >
          ← Back to exercises
        </button>
      </div>
    )
  }

  // ---------- ACTIVE ----------
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-[#416ebe] transition-colors">
          ← Back
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-[#416ebe]">{exercise.title}</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#416ebe] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {answeredCount} / {exercise.questions.length}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Question card */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-[#416ebe] font-bold uppercase tracking-widest mb-2">
          Word {currentIndex + 1}
        </p>

        {current.clue && (
          <p className="text-sm text-[#46464b] mb-4 bg-[#e6f0fa] rounded-lg p-3">
            {current.clue}
          </p>
        )}

        {/* Answer area */}
        <div className={`flex justify-center gap-1.5 mb-6 min-h-[52px] ${shake ? 'animate-bounce' : ''}`}>
          {Array.from({ length: current.word.length }).map((_, i) => {
            const placed = answer[i]
            return (
              <div
                key={i}
                className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all ${
                  placed
                    ? feedback === 'correct'
                      ? 'bg-green-100 border-green-400 text-green-700'
                      : feedback === 'wrong'
                      ? 'bg-red-100 border-red-400 text-red-700'
                      : 'bg-[#e6f0fa] border-[#416ebe] text-[#416ebe]'
                    : 'bg-gray-50 border-dashed border-gray-300 text-gray-300'
                }`}
              >
                {placed?.char || ''}
              </div>
            )
          })}
        </div>

        {/* Letter tiles */}
        <div className="flex flex-wrap justify-center gap-2">
          {tiles.map((tile, idx) => (
            <button
              key={`${tile.char}-${tile.originalIndex}`}
              onClick={() => selectTile(idx)}
              disabled={tile.used || feedback !== null}
              className={`w-11 h-12 rounded-xl text-lg font-bold transition-all ${
                tile.used
                  ? 'bg-gray-100 border-2 border-gray-200 text-gray-300 cursor-default'
                  : 'bg-[#416ebe] border-2 border-[#3560b0] text-white hover:bg-[#3560b0] active:scale-95 shadow-sm'
              }`}
            >
              {tile.char}
            </button>
          ))}
        </div>

        {/* Clear/Undo buttons */}
        {feedback === null && answer.length > 0 && (
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={removeLast}
              className="text-xs text-gray-400 hover:text-[#416ebe] font-bold px-3 py-1.5 rounded-lg hover:bg-[#e6f0fa] transition-colors"
            >
              Undo last
            </button>
            <button
              onClick={clearAnswer}
              className="text-xs text-gray-400 hover:text-red-400 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback === 'correct' && (
        <p className="text-sm font-bold text-green-600 text-center animate-pulse">
          Correct!
        </p>
      )}

      {feedback === 'wrong' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-sm text-red-500 font-bold mb-1">Not quite.</p>
          <p className="text-sm text-[#46464b]">
            The word is: <span className="font-bold text-green-600">{current.word.toUpperCase()}</span>
          </p>
        </div>
      )}

      {/* Next button after wrong */}
      {feedback === 'wrong' && (
        <button
          onClick={() => advance(results)}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Next →
        </button>
      )}

      {/* Navigation dots */}
      <div className="flex justify-center gap-1.5 py-2">
        {exercise.questions.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-[#416ebe] scale-125'
                : results[i]?.correct
                ? 'bg-green-400'
                : results[i] !== null
                ? 'bg-red-400'
                : 'bg-[#cddcf0]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
