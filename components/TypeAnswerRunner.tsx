'use client'

import { useState, useEffect, useRef } from 'react'

interface TypeAnswerQuestion {
  id: number
  prompt: string
  answer: string
  hint?: string
  image_url?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: TypeAnswerQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

type QuestionResult = {
  typed: string
  correct: boolean
}

export default function TypeAnswerRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [results, setResults] = useState<(QuestionResult | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [finished, setFinished] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = exercise.questions[currentIndex]
  const answeredCount = results.filter((r) => r !== null).length
  const progress = (answeredCount / exercise.questions.length) * 100

  // Auto-focus input on question change
  useEffect(() => {
    if (!finished && feedback === null) {
      inputRef.current?.focus()
    }
  }, [currentIndex, finished, feedback])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    }
  }, [])

  const handleSubmitAnswer = () => {
    if (feedback !== null || inputValue.trim() === '') return

    const stripPunctuation = (s: string) => s.replace(/[.,!?;:'"()\-\u2014\u2013\u2026]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const isCorrect =
      stripPunctuation(inputValue) === stripPunctuation(current.answer)

    const result: QuestionResult = {
      typed: inputValue.trim(),
      correct: isCorrect,
    }

    const newResults = [...results]
    newResults[currentIndex] = result
    setResults(newResults)
    setFeedback(isCorrect ? 'correct' : 'wrong')

    if (isCorrect) {
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

    // Move to next unanswered question
    let next = currentIndex + 1
    while (next < exercise.questions.length && latestResults[next] !== null) {
      next++
    }
    if (next >= exercise.questions.length) {
      next = 0
      while (next < exercise.questions.length && latestResults[next] !== null) {
        next++
      }
    }

    setCurrentIndex(next)
    setInputValue('')
    setFeedback(null)
  }

  const handleNextAfterWrong = () => {
    advance(results)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (feedback === 'wrong') {
        handleNextAfterWrong()
      } else if (feedback === null) {
        handleSubmitAnswer()
      }
    }
  }

  // Format prompt: turn *word* into highlighted text
  const formatPrompt = (text: string) => {
    const parts = text.split(/\*([^*]+)\*/)
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className="bg-red-100 text-red-600 px-1 rounded font-bold">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    )
  }

  // ---------- FINISHED: Score Summary ----------
  if (finished) {
    const score = results.filter((r) => r?.correct).length
    const pct = Math.round((score / exercise.questions.length) * 100)

    return (
      <div className="flex flex-col gap-4">
        {/* Results header */}
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

        {/* Review all answers */}
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
                  <span
                    className={`text-sm font-bold mt-0.5 ${
                      isCorrect ? 'text-green-500' : 'text-red-400'
                    }`}
                  >
                    {isCorrect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-[#46464b]">{formatPrompt(q.prompt)}</p>
                    {!isCorrect && result && (
                      <p className="text-xs mt-1">
                        <span className="text-red-400 line-through">
                          {result.typed}
                        </span>
                        {' → '}
                        <span className="text-green-600 font-bold">
                          {q.answer}
                        </span>
                      </p>
                    )}
                    {isCorrect && (
                      <p className="text-xs mt-1 text-green-600 font-bold">
                        {q.answer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2"
        >
          ← Back to exercises
        </button>
      </div>
    )
  }

  // ---------- ACTIVE: Question View ----------
  const borderColor =
    feedback === 'correct'
      ? 'border-green-400'
      : feedback === 'wrong'
      ? 'border-red-400'
      : 'border-[#cddcf0]'

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-[#416ebe] transition-colors"
        >
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
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-[#416ebe] font-bold uppercase tracking-widest mb-3">
          Question {currentIndex + 1}
        </p>
        {current.image_url && (
          <img src={current.image_url} alt="" className="max-h-48 max-w-full object-contain rounded-xl mb-3" />
        )}
        <p className="text-lg text-[#46464b] font-medium leading-relaxed">
          {formatPrompt(current.prompt)}
        </p>
        {current.hint && (
          <p className="text-xs text-gray-400 mt-2 italic">
            Hint: {current.hint}
          </p>
        )}
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={feedback !== null}
          placeholder="Type your answer..."
          className={`w-full border-2 ${borderColor} rounded-xl py-3 px-4 text-sm text-[#46464b] bg-white outline-none transition-colors focus:border-[#416ebe] disabled:bg-gray-50 placeholder:text-gray-300`}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Feedback messages */}
        {feedback === 'correct' && (
          <p className="text-sm font-bold text-green-600 text-center animate-pulse">
            Correct!
          </p>
        )}

        {feedback === 'wrong' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-sm text-red-500 font-bold mb-1">
              Not quite.
            </p>
            <p className="text-sm text-[#46464b]">
              Correct answer:{' '}
              <span className="font-bold text-green-600">{current.answer}</span>
            </p>
          </div>
        )}
      </div>

      {/* Action button */}
      {feedback === null ? (
        <button
          onClick={handleSubmitAnswer}
          disabled={inputValue.trim() === ''}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check answer
        </button>
      ) : feedback === 'wrong' ? (
        <button
          onClick={handleNextAfterWrong}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Next →
        </button>
      ) : null}

      {/* Question navigation dots */}
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
