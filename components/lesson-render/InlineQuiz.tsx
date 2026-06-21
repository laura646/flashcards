'use client'

import { useState } from 'react'

// ── Inline Quiz Component ──
// Lifted verbatim from app/lessons/[id]/page.tsx (the module-local InlineQuiz).
// Same props, same MCQ check/reveal/try-again behaviour and onComplete wiring.
export function InlineQuiz({
  questions,
  onComplete,
}: {
  questions: { id?: number; prompt: string; options: string[]; correctIndex: number }[]
  onComplete?: (score: number, total: number) => void
}) {
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)
  const [completeFired, setCompleteFired] = useState(false)

  const score = questions.reduce(
    (acc, q, i) => acc + (selected[i] === q.correctIndex ? 1 : 0),
    0
  )
  const allAnswered = Object.keys(selected).length === questions.length

  const handleCheck = () => {
    setShowResults(true)
    if (!completeFired && onComplete) {
      const s = questions.reduce((acc, q, i) => acc + (selected[i] === q.correctIndex ? 1 : 0), 0)
      onComplete(s, questions.length)
      setCompleteFired(true)
    }
  }

  return (
    <div className="space-y-4 mt-4">
      {questions.map((q, qi) => {
        const userAnswer = selected[qi]
        const answered = userAnswer !== undefined
        const isCorrect = userAnswer === q.correctIndex

        return (
          <div key={qi} className="bg-white rounded-xl border-[1.5px] border-sky-border p-4">
            <p className="text-sm font-medium text-ink-body mb-3">{q.prompt}</p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                let btnClass =
                  'w-full text-left border-2 rounded-xl py-2.5 px-4 text-sm transition-all '
                if (showResults && answered) {
                  if (oi === q.correctIndex) {
                    btnClass += 'border-green-400 bg-green-50 text-green-700 font-bold'
                  } else if (oi === userAnswer && !isCorrect) {
                    btnClass += 'border-red-300 bg-red-50 text-red-500 line-through'
                  } else {
                    btnClass += 'border-gray-200 text-ink-muted'
                  }
                } else if (userAnswer === oi) {
                  btnClass += 'border-sky bg-sky-wash text-ink-body font-bold'
                } else {
                  btnClass += 'border-sky-border text-ink-body hover:border-sky bg-white'
                }

                return (
                  <button
                    key={oi}
                    onClick={() => {
                      if (showResults) return
                      setSelected({ ...selected, [qi]: oi })
                    }}
                    className={btnClass}
                  >
                    <span className="text-ink-muted mr-2">
                      {String.fromCharCode(97 + oi)})
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {!showResults && (
        <button
          onClick={handleCheck}
          disabled={!allAnswered}
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check answers
        </button>
      )}

      {showResults && (
        <div className="text-center py-4">
          <div className="text-3xl mb-2">
            {score === questions.length ? '🌟' : score >= questions.length * 0.6 ? '👍' : '💪'}
          </div>
          <p className="text-sm font-bold text-brandblue">
            {score}/{questions.length} correct
          </p>
          <button
            onClick={() => {
              setSelected({})
              setShowResults(false)
            }}
            className="mt-3 text-xs text-brandblue hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
