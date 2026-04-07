'use client'

import { useState } from 'react'
import { Exercise } from '@/data/exercises'

interface Props {
  exercise: Exercise
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

export default function ExerciseRunner({ exercise, onComplete, onBack }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const current = exercise.questions[currentIndex]
  const allAnswered = answers.every((a) => a !== null)
  const progress = (answers.filter((a) => a !== null).length / exercise.questions.length) * 100

  const selectAnswer = (optionIndex: number) => {
    if (submitted) return
    const newAnswers = [...answers]
    newAnswers[currentIndex] = optionIndex
    setAnswers(newAnswers)
  }

  const goNext = () => {
    if (currentIndex < exercise.questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const score = exercise.questions.reduce((acc, q, i) => {
      return acc + (answers[i] === q.correctIndex ? 1 : 0)
    }, 0)
    onComplete(score, exercise.questions.length)
    setCurrentIndex(0)
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

  if (submitted) {
    const score = exercise.questions.reduce((acc, q, i) => {
      return acc + (answers[i] === q.correctIndex ? 1 : 0)
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
            const isCorrect = answers[i] === q.correctIndex
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
                    <p className="text-sm text-[#46464b]">{formatPrompt(q.prompt)}</p>
                    {!isCorrect && (
                      <p className="text-xs mt-1">
                        <span className="text-red-400 line-through">
                          {q.options[answers[i]!]}
                        </span>
                        {' → '}
                        <span className="text-green-600 font-bold">
                          {q.options[q.correctIndex]}
                        </span>
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
          {currentIndex + 1} / {exercise.questions.length}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Question card */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-[#00aff0] font-bold uppercase tracking-widest mb-3">
          Question {currentIndex + 1}
        </p>
        <p className="text-lg text-[#46464b] font-medium leading-relaxed">
          {formatPrompt(current.prompt)}
        </p>
        {current.hint && (
          <p className="text-xs text-gray-400 mt-2 italic">{current.hint}</p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {current.options.map((option, i) => {
          const isSelected = answers[currentIndex] === i
          return (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              className={`w-full text-left border-2 rounded-xl py-3 px-4 text-sm font-bold transition-all ${
                isSelected
                  ? 'border-[#416ebe] bg-[#e6f0fa] text-[#416ebe]'
                  : 'border-[#cddcf0] text-[#46464b] hover:border-[#416ebe] bg-white'
              }`}
            >
              <span className="text-gray-400 mr-2">
                {String.fromCharCode(97 + i)})
              </span>
              {option}
            </button>
          )
        })}
      </div>

      {/* Question navigation dots */}
      <div className="flex justify-center gap-1 py-2">
        {exercise.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className="p-1.5"
          >
            <div className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-[#416ebe] scale-125'
                : answers[i] !== null
                ? 'bg-[#00aff0]'
                : 'bg-[#cddcf0]'
            }`} />
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex-1 border-2 border-[#cddcf0] text-[#46464b] font-bold py-3 rounded-xl text-sm transition-colors hover:border-[#416ebe] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        {currentIndex < exercise.questions.length - 1 ? (
          <button
            onClick={goNext}
            className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="flex-1 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit answers
          </button>
        )}
      </div>
      {!allAnswered && currentIndex === exercise.questions.length - 1 && (
        <p className="text-xs text-gray-400 text-center">
          Answer all questions to submit
        </p>
      )}
    </div>
  )
}
