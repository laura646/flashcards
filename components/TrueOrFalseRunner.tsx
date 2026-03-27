'use client'

import { useState, useEffect } from 'react'

interface TrueOrFalseQuestion {
  id: number
  statement: string
  isTrue: boolean
  explanation?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: TrueOrFalseQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

export default function TrueOrFalseRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<(boolean | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [finished, setFinished] = useState(false)

  const current = exercise.questions[currentIndex]
  const answeredCount = answers.filter((a) => a !== null).length
  const progress = (answeredCount / exercise.questions.length) * 100

  // Auto-advance after feedback
  useEffect(() => {
    if (feedback === null) return
    const timer = setTimeout(() => {
      setFeedback(null)
      if (currentIndex < exercise.questions.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        // Last question answered — show summary
        setFinished(true)
        const score = exercise.questions.reduce((acc, q, i) => {
          return acc + (answers[i] === q.isTrue ? 1 : 0)
        }, 0)
        onComplete(score, exercise.questions.length)
      }
    }, 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback])

  const handleAnswer = (answer: boolean) => {
    if (feedback !== null) return // already answered
    const newAnswers = [...answers]
    newAnswers[currentIndex] = answer
    setAnswers(newAnswers)
    setFeedback(answer === current.isTrue ? 'correct' : 'wrong')
  }

  // Summary screen
  if (finished) {
    const score = exercise.questions.reduce((acc, q, i) => {
      return acc + (answers[i] === q.isTrue ? 1 : 0)
    }, 0)
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
            const isCorrect = answers[i] === q.isTrue
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
                    <p className="text-sm text-[#46464b]">{q.statement}</p>
                    <p className="text-xs mt-1">
                      <span className={`font-bold ${q.isTrue ? 'text-green-600' : 'text-red-500'}`}>
                        {q.isTrue ? 'True' : 'False'}
                      </span>
                      {!isCorrect && (
                        <span className="text-red-400 ml-2">
                          (You said {answers[i] ? 'True' : 'False'})
                        </span>
                      )}
                    </p>
                    {q.explanation && (
                      <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>
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

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#416ebe] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {currentIndex + 1} / {exercise.questions.length}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Statement card */}
      <div
        className={`bg-white border rounded-2xl p-6 shadow-sm transition-colors duration-300 ${
          feedback === 'correct'
            ? 'border-green-400 bg-green-50'
            : feedback === 'wrong'
            ? 'border-red-400 bg-red-50'
            : 'border-[#cddcf0]'
        }`}
      >
        <p className="text-xs text-[#00aff0] font-bold uppercase tracking-widest mb-3">
          Statement {currentIndex + 1}
        </p>
        <p className="text-lg text-[#46464b] font-medium leading-relaxed">
          {current.statement}
        </p>

        {/* Feedback message */}
        {feedback === 'correct' && (
          <div className="mt-4 flex items-center gap-2 text-green-600 animate-pulse">
            <span className="text-xl font-bold">✓</span>
            <span className="font-bold text-sm">Correct!</span>
          </div>
        )}
        {feedback === 'wrong' && (
          <div className="mt-4 space-y-1">
            <div className="flex items-center gap-2 text-red-500 animate-pulse">
              <span className="text-xl font-bold">✗</span>
              <span className="font-bold text-sm">Incorrect</span>
            </div>
            <p className="text-xs text-[#46464b]">
              The answer is <span className="font-bold">{current.isTrue ? 'True' : 'False'}</span>.
              {current.explanation && (
                <span className="text-gray-400 italic ml-1">{current.explanation}</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* True / False buttons */}
      <div className="flex gap-3">
        {/* True button */}
        <button
          onClick={() => handleAnswer(true)}
          disabled={feedback !== null}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-5 rounded-2xl text-lg font-bold transition-all duration-300 border-2 ${
            feedback !== null && answers[currentIndex] === true
              ? feedback === 'correct'
                ? 'border-green-400 bg-green-100 text-green-700 animate-pulse'
                : 'border-red-400 bg-red-100 text-red-600 animate-pulse'
              : feedback !== null
              ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
              : 'border-[#416ebe] bg-[#e6f0fa] text-[#416ebe] hover:bg-[#d0e2f7] active:scale-95 cursor-pointer'
          }`}
        >
          <span className="text-3xl">✓</span>
          <span className="text-sm">True</span>
        </button>

        {/* False button */}
        <button
          onClick={() => handleAnswer(false)}
          disabled={feedback !== null}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-5 rounded-2xl text-lg font-bold transition-all duration-300 border-2 ${
            feedback !== null && answers[currentIndex] === false
              ? feedback === 'correct'
                ? 'border-green-400 bg-green-100 text-green-700 animate-pulse'
                : 'border-red-400 bg-red-100 text-red-600 animate-pulse'
              : feedback !== null
              ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
              : 'border-red-300 bg-red-50 text-red-500 hover:bg-red-100 active:scale-95 cursor-pointer'
          }`}
        >
          <span className="text-3xl">✗</span>
          <span className="text-sm">False</span>
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 py-2">
        {exercise.questions.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-[#416ebe] scale-125'
                : answers[i] !== null
                ? answers[i] === exercise.questions[i].isTrue
                  ? 'bg-green-400'
                  : 'bg-red-400'
                : 'bg-[#cddcf0]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
