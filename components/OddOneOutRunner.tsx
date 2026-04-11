'use client'

import { useState, useEffect } from 'react'

interface OddOneOutQuestion {
  id: number
  prompt: string       // The keyword (e.g., "clean")
  options: string[]    // The options (e.g., ["the bathroom", "the washing", "the oven"])
  correctIndex: number // Index of the odd one out
  explanation?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: OddOneOutQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

export default function OddOneOutRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [results, setResults] = useState<(boolean | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [finished, setFinished] = useState(false)

  const current = exercise.questions[currentIndex]
  const answeredCount = results.filter(r => r !== null).length
  const progress = (answeredCount / exercise.questions.length) * 100

  useEffect(() => {
    setSelectedIndex(null)
    setFeedback(null)
  }, [currentIndex])

  if (!exercise.questions || exercise.questions.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">No questions in this exercise.</div>
  }

  const handleSelect = (optIndex: number) => {
    if (feedback !== null) return
    setSelectedIndex(optIndex)
  }

  const handleSubmit = () => {
    if (selectedIndex === null || feedback !== null) return
    const isCorrect = selectedIndex === current.correctIndex
    const newResults = [...results]
    newResults[currentIndex] = isCorrect
    setResults(newResults)
    setFeedback(isCorrect ? 'correct' : 'wrong')
  }

  const advance = () => {
    const nextUnanswered = results.findIndex((r, i) => r === null && i > currentIndex)
    if (nextUnanswered !== -1) {
      setCurrentIndex(nextUnanswered)
    } else {
      const wrapAround = results.findIndex(r => r === null)
      if (wrapAround !== -1) {
        setCurrentIndex(wrapAround)
      } else {
        setFinished(true)
        const score = results.filter(r => r === true).length + (feedback === 'correct' ? 0 : 0)
        // Recalculate with latest
        const finalResults = [...results]
        finalResults[currentIndex] = selectedIndex === current.correctIndex
        const finalScore = finalResults.filter(r => r === true).length
        onComplete(finalScore, exercise.questions.length)
      }
    }
  }

  // ── FINISHED ──
  if (finished) {
    const finalResults = results.map((r, i) => r !== null ? r : false)
    const score = finalResults.filter(r => r === true).length
    const pct = Math.round((score / exercise.questions.length) * 100)
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-3">{pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}</div>
          <h2 className="text-xl font-bold text-[#416ebe]">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good effort!' : 'Keep practising!'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            You scored {score}/{exercise.questions.length} ({pct}%)
          </p>
        </div>

        <div className="space-y-3">
          {exercise.questions.map((q, i) => {
            const correct = finalResults[i] === true
            return (
              <div key={q.id} className={`bg-white rounded-xl border-2 p-4 ${correct ? 'border-green-200' : 'border-red-200'}`}>
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 ${correct ? 'text-green-500' : 'text-red-400'}`}>
                    {correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#46464b] mb-1">{q.prompt}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt, oi) => (
                        <span
                          key={oi}
                          className={`text-xs px-2 py-1 rounded-lg ${
                            oi === q.correctIndex
                              ? 'bg-red-100 text-red-600 line-through font-bold'
                              : 'bg-green-50 text-green-700'
                          }`}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-gray-400 mt-1 italic">{q.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={onBack} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2">
          ← Back to exercises
        </button>
      </div>
    )
  }

  // ── ACTIVE ──
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-[#416ebe] transition-colors">← Back</button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-[#416ebe]">{exercise.title}</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
          <div className="h-full bg-[#416ebe] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{answeredCount} / {exercise.questions.length}</span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Question card */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-5 shadow-sm">
        {/* Keyword */}
        <div className="text-center mb-5">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Which one doesn&apos;t belong?</p>
          <p className="text-2xl font-bold text-[#416ebe]">{current.prompt}</p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {current.options.map((opt, oi) => {
            let style = 'border-[#e6f0fa] bg-white hover:border-[#416ebe] hover:bg-[#e6f0fa] cursor-pointer'

            if (feedback !== null) {
              if (oi === current.correctIndex) {
                // The odd one out — show crossed out
                style = 'border-red-300 bg-red-50 line-through text-red-500'
              } else {
                style = 'border-green-200 bg-green-50 text-green-700'
              }
            } else if (selectedIndex === oi) {
              style = 'border-[#416ebe] bg-[#e6f0fa] ring-2 ring-[#416ebe] cursor-pointer'
            }

            return (
              <button
                key={oi}
                onClick={() => handleSelect(oi)}
                disabled={feedback !== null}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${style}`}
              >
                {opt}
                {feedback !== null && oi === current.correctIndex && (
                  <span className="ml-2 text-xs text-red-400 font-bold">✗ odd one out</span>
                )}
                {feedback !== null && oi !== current.correctIndex && (
                  <span className="ml-2 text-xs text-green-500">✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Submit button */}
      {feedback === null && (
        <button
          onClick={handleSubmit}
          disabled={selectedIndex === null}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      )}

      {/* Feedback */}
      {feedback === 'correct' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-sm text-green-600 font-bold">✓ Correct!</p>
          {current.explanation && (
            <p className="text-xs text-gray-500 mt-1">{current.explanation}</p>
          )}
        </div>
      )}

      {feedback === 'wrong' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-sm text-red-500 font-bold mb-1">✗ Not quite.</p>
          <p className="text-xs text-[#46464b]">
            The odd one out is: <span className="font-bold line-through">{current.options[current.correctIndex]}</span>
          </p>
          {current.explanation && (
            <p className="text-xs text-gray-500 mt-1">{current.explanation}</p>
          )}
        </div>
      )}

      {/* Next button */}
      {feedback !== null && (
        <button onClick={advance} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors">
          {answeredCount >= exercise.questions.length ? 'See Results' : 'Next →'}
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
                : results[i] === true
                ? 'bg-green-400'
                : results[i] === false
                ? 'bg-red-400'
                : 'bg-[#cddcf0]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
