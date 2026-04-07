'use client'

import { useState, useRef, useEffect } from 'react'

interface RankOrderQuestion {
  id: number
  criterion: string
  items: string[]
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: RankOrderQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

type QuestionResult = {
  order: string[]
  correct: boolean
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function RankOrderRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [items, setItems] = useState<string[]>([])
  const [results, setResults] = useState<(QuestionResult | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [finished, setFinished] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!exercise.questions || exercise.questions.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">No questions in this exercise.</div>
  }

  const current = exercise.questions[currentIndex]
  const answeredCount = results.filter((r) => r !== null).length
  const progress = (answeredCount / exercise.questions.length) * 100

  // Shuffle items on question change
  useEffect(() => {
    setItems(shuffleArray(current.items))
    setFeedback(null)
    setDragIndex(null)
  }, [currentIndex, current])

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    }
  }, [])

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (feedback !== null) return
    const newItems = [...items]
    const [moved] = newItems.splice(fromIdx, 1)
    newItems.splice(toIdx, 0, moved)
    setItems(newItems)
  }

  const handleCheck = () => {
    const correct = items.every((item, i) => item === current.items[i])
    const result: QuestionResult = { order: [...items], correct }

    const newResults = [...results]
    newResults[currentIndex] = result
    setResults(newResults)
    setFeedback(correct ? 'correct' : 'wrong')

    if (correct) {
      autoAdvanceTimer.current = setTimeout(() => {
        advance(newResults)
      }, 1500)
    }
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

  // Touch-friendly drag via buttons
  const moveUp = (idx: number) => {
    if (idx > 0) moveItem(idx, idx - 1)
  }
  const moveDown = (idx: number) => {
    if (idx < items.length - 1) moveItem(idx, idx + 1)
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
                    <p className="text-xs text-gray-400 mb-1">{q.criterion}</p>
                    {!isCorrect && (
                      <>
                        <p className="text-xs text-gray-400">Your order:</p>
                        <p className="text-sm text-red-400">{result?.order.join(' → ')}</p>
                        <p className="text-xs text-gray-400 mt-1">Correct order:</p>
                      </>
                    )}
                    <p className="text-sm text-green-600 font-medium">{q.items.join(' → ')}</p>
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
          Question {currentIndex + 1}
        </p>
        <p className="text-base text-[#46464b] font-medium mb-4">{current.criterion}</p>

        {/* Sortable items */}
        <div className="space-y-2">
          {items.map((item, idx) => {
            const isInCorrectPosition = feedback !== null && item === current.items[idx]
            const isInWrongPosition = feedback === 'wrong' && item !== current.items[idx]

            return (
              <div
                key={`${item}-${idx}`}
                draggable={feedback === null}
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragIndex !== null && dragIndex !== idx) {
                    moveItem(dragIndex, idx)
                    setDragIndex(idx)
                  }
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  feedback === null
                    ? 'bg-[#f7fafd] border-[#cddcf0] cursor-grab active:cursor-grabbing hover:border-[#416ebe]'
                    : isInCorrectPosition
                    ? 'bg-green-50 border-green-300'
                    : isInWrongPosition
                    ? 'bg-red-50 border-red-300'
                    : 'bg-white border-[#cddcf0]'
                }`}
              >
                {/* Position number */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  feedback === null
                    ? 'bg-[#416ebe] text-white'
                    : isInCorrectPosition
                    ? 'bg-green-500 text-white'
                    : 'bg-red-400 text-white'
                }`}>
                  {idx + 1}
                </span>

                {/* Item text */}
                <span className="flex-1 text-sm text-[#46464b]">{item}</span>

                {/* Move buttons (mobile-friendly) */}
                {feedback === null && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-[#416ebe] disabled:opacity-20 text-xs px-1"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === items.length - 1}
                      className="text-gray-400 hover:text-[#416ebe] disabled:opacity-20 text-xs px-1"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Feedback */}
      {feedback === 'correct' && (
        <p className="text-sm font-bold text-green-600 text-center animate-pulse">
          Perfect order!
        </p>
      )}
      {feedback === 'wrong' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-sm text-red-500 font-bold mb-1">Not quite.</p>
          <p className="text-xs text-gray-500">Correct: {current.items.join(' → ')}</p>
        </div>
      )}

      {/* Action button */}
      {feedback === null ? (
        <button
          onClick={handleCheck}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Check order
        </button>
      ) : feedback === 'wrong' ? (
        <button
          onClick={() => advance(results)}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Next →
        </button>
      ) : null}

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
