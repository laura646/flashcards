'use client'

import { useState, useEffect, useRef } from 'react'

interface ErrorCorrectionQuestion {
  id: number
  incorrect: string
  correct: string
  hints?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: ErrorCorrectionQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

type WordState = {
  word: string
  index: number
  highlighted: boolean
  correction: string
  isError: boolean // from answer key
  expectedCorrection: string
}

type QuestionResult = {
  foundErrors: number
  totalErrors: number
  correctFixes: number
  words: WordState[]
}

function findErrors(incorrect: string, correct: string): Map<number, string> {
  const incWords = incorrect.trim().split(/\s+/)
  const corWords = correct.trim().split(/\s+/)
  const errors = new Map<number, string>()

  // Simple word-by-word comparison
  const maxLen = Math.max(incWords.length, corWords.length)
  for (let i = 0; i < maxLen; i++) {
    const inc = incWords[i] || ''
    const cor = corWords[i] || ''
    if (inc.toLowerCase() !== cor.toLowerCase()) {
      errors.set(i, cor)
    }
  }
  return errors
}

export default function ErrorCorrectionRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<'highlight' | 'correct' | 'feedback'>('highlight')
  const [words, setWords] = useState<WordState[]>([])
  const [results, setResults] = useState<(QuestionResult | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [finished, setFinished] = useState(false)
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null)

  const correctionInputRef = useRef<HTMLInputElement>(null)
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = exercise.questions[currentIndex]
  const answeredCount = results.filter((r) => r !== null).length
  const progress = (answeredCount / exercise.questions.length) * 100

  // Initialize words for current question
  useEffect(() => {
    const errors = findErrors(current.incorrect, current.correct)
    const incWords = current.incorrect.trim().split(/\s+/)
    setWords(
      incWords.map((word, i) => ({
        word,
        index: i,
        highlighted: false,
        correction: '',
        isError: errors.has(i),
        expectedCorrection: errors.get(i) || word,
      }))
    )
    setPhase('highlight')
    setEditingWordIndex(null)
  }, [currentIndex, current])

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    }
  }, [])

  useEffect(() => {
    if (editingWordIndex !== null) {
      correctionInputRef.current?.focus()
    }
  }, [editingWordIndex])

  const toggleHighlight = (index: number) => {
    if (phase !== 'highlight') return
    setWords((prev) =>
      prev.map((w) =>
        w.index === index ? { ...w, highlighted: !w.highlighted } : w
      )
    )
  }

  const moveToCorrectPhase = () => {
    const highlighted = words.filter((w) => w.highlighted)
    if (highlighted.length === 0) return
    setPhase('correct')
    // Auto-open first highlighted word for correction
    setEditingWordIndex(highlighted[0].index)
  }

  const setCorrection = (index: number, correction: string) => {
    setWords((prev) =>
      prev.map((w) =>
        w.index === index ? { ...w, correction } : w
      )
    )
  }

  const handleSubmitCorrections = () => {
    const highlighted = words.filter((w) => w.highlighted)
    const errors = words.filter((w) => w.isError)

    // Score: how many real errors were found AND correctly fixed
    let correctFixes = 0
    let foundErrors = 0

    for (const w of words) {
      if (w.highlighted && w.isError) {
        foundErrors++
        if (w.correction.trim().toLowerCase() === w.expectedCorrection.toLowerCase()) {
          correctFixes++
        }
      }
    }

    const result: QuestionResult = {
      foundErrors,
      totalErrors: errors.length,
      correctFixes,
      words: [...words],
    }

    const newResults = [...results]
    newResults[currentIndex] = result
    setResults(newResults)
    setPhase('feedback')

    // Perfect = found all errors and fixed them all
    const perfect = foundErrors === errors.length && correctFixes === errors.length
    if (perfect) {
      autoAdvanceTimer.current = setTimeout(() => {
        advance(newResults)
      }, 2000)
    }
  }

  const advance = (latestResults: (QuestionResult | null)[]) => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current)
      autoAdvanceTimer.current = null
    }

    const allDone = latestResults.every((r) => r !== null)
    if (allDone) {
      const score = latestResults.filter(
        (r) => r && r.correctFixes === r.totalErrors && r.foundErrors === r.totalErrors
      ).length
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

  const allHighlightedHaveCorrections = () => {
    return words
      .filter((w) => w.highlighted)
      .every((w) => w.correction.trim().length > 0)
  }

  // ---------- FINISHED ----------
  if (finished) {
    const perfectCount = results.filter(
      (r) => r && r.correctFixes === r.totalErrors && r.foundErrors === r.totalErrors
    ).length
    const pct = Math.round((perfectCount / exercise.questions.length) * 100)

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
            {perfectCount}/{exercise.questions.length} sentences fully corrected ({pct}%)
          </p>
        </div>

        <div className="space-y-3">
          {exercise.questions.map((q, i) => {
            const result = results[i]
            if (!result) return null
            const perfect = result.correctFixes === result.totalErrors && result.foundErrors === result.totalErrors

            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  perfect ? 'border-green-200' : 'border-red-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 ${perfect ? 'text-green-500' : 'text-red-400'}`}>
                    {perfect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Original (with errors):</p>
                    <p className="text-sm text-red-400 line-through">{q.incorrect}</p>
                    <p className="text-xs text-gray-400 mt-2 mb-1">Correct version:</p>
                    <p className="text-sm text-green-600 font-medium">{q.correct}</p>
                    {!perfect && (
                      <p className="text-xs text-gray-400 mt-2">
                        Found {result.foundErrors}/{result.totalErrors} errors, fixed {result.correctFixes} correctly
                      </p>
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

      {/* Phase indicator */}
      <div className="flex gap-2">
        <div className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold ${
          phase === 'highlight' ? 'bg-[#416ebe] text-white' : 'bg-[#e6f0fa] text-[#416ebe]'
        }`}>
          Step 1: Find errors
        </div>
        <div className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold ${
          phase === 'correct' ? 'bg-[#416ebe] text-white' : phase === 'feedback' ? 'bg-[#e6f0fa] text-[#416ebe]' : 'bg-gray-100 text-gray-400'
        }`}>
          Step 2: Fix them
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-[#416ebe] font-bold uppercase tracking-widest mb-3">
          Sentence {currentIndex + 1}
        </p>

        {current.hints && phase === 'highlight' && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-3">
            Hint: {current.hints}
          </p>
        )}

        {/* Words display */}
        <div className="flex flex-wrap gap-1.5 leading-relaxed">
          {words.map((w) => {
            const isEditing = editingWordIndex === w.index

            if (phase === 'highlight') {
              return (
                <button
                  key={w.index}
                  onClick={() => toggleHighlight(w.index)}
                  className={`px-2 py-1 rounded-lg text-base transition-all border-2 ${
                    w.highlighted
                      ? 'bg-red-100 border-red-300 text-red-700 font-bold'
                      : 'bg-white border-transparent text-[#46464b] hover:bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  {w.word}
                </button>
              )
            }

            if (phase === 'correct' && w.highlighted) {
              return (
                <div key={w.index} className="flex flex-col items-center">
                  <span className="text-xs text-red-400 line-through mb-0.5">{w.word}</span>
                  {isEditing ? (
                    <input
                      ref={correctionInputRef}
                      type="text"
                      value={w.correction}
                      onChange={(e) => setCorrection(w.index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          // Move to next highlighted word or close
                          const highlighted = words.filter((w2) => w2.highlighted)
                          const currentIdx = highlighted.findIndex((h) => h.index === w.index)
                          if (currentIdx < highlighted.length - 1) {
                            setEditingWordIndex(highlighted[currentIdx + 1].index)
                          } else {
                            setEditingWordIndex(null)
                          }
                        }
                      }}
                      onBlur={() => setEditingWordIndex(null)}
                      className="w-24 text-center border-2 border-[#416ebe] rounded-lg px-2 py-1 text-sm text-[#46464b] outline-none bg-blue-50"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingWordIndex(w.index)}
                      className={`px-2 py-1 rounded-lg text-sm border-2 transition-all ${
                        w.correction
                          ? 'bg-green-50 border-green-300 text-green-700 font-bold'
                          : 'bg-amber-50 border-amber-300 text-amber-700'
                      }`}
                    >
                      {w.correction || 'tap to fix'}
                    </button>
                  )}
                </div>
              )
            }

            if (phase === 'feedback') {
              let style = 'text-[#46464b]'
              if (w.isError && w.highlighted && w.correction.trim().toLowerCase() === w.expectedCorrection.toLowerCase()) {
                style = 'text-green-600 font-bold bg-green-50 px-1 rounded'
              } else if (w.isError && w.highlighted) {
                style = 'text-amber-600 font-bold bg-amber-50 px-1 rounded'
              } else if (w.isError && !w.highlighted) {
                style = 'text-red-500 font-bold bg-red-50 px-1 rounded underline'
              } else if (!w.isError && w.highlighted) {
                style = 'text-gray-400 line-through'
              }

              return (
                <span key={w.index} className={`inline-block px-1 py-0.5 text-base ${style}`}>
                  {phase === 'feedback' && w.isError && w.highlighted && w.correction
                    ? w.correction
                    : phase === 'feedback' && w.isError && !w.highlighted
                    ? `${w.word} → ${w.expectedCorrection}`
                    : w.word}
                </span>
              )
            }

            // Phase correct but not highlighted
            return (
              <span key={w.index} className="px-2 py-1 text-base text-[#46464b]">
                {w.word}
              </span>
            )
          })}
        </div>

        {/* Feedback summary */}
        {phase === 'feedback' && results[currentIndex] && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            {(() => {
              const r = results[currentIndex]!
              const perfect = r.correctFixes === r.totalErrors && r.foundErrors === r.totalErrors
              return perfect ? (
                <p className="text-sm text-green-600 font-bold text-center animate-pulse">
                  Perfect! All errors found and corrected!
                </p>
              ) : (
                <div className="text-sm text-center space-y-1">
                  <p className="text-gray-500">
                    Found {r.foundErrors} of {r.totalErrors} error{r.totalErrors !== 1 ? 's' : ''}
                  </p>
                  <p className="text-gray-500">
                    Correctly fixed: {r.correctFixes}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Correct version: <span className="text-green-600 font-medium">{current.correct}</span>
                  </p>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Action button */}
      {phase === 'highlight' && (
        <button
          onClick={moveToCorrectPhase}
          disabled={words.filter((w) => w.highlighted).length === 0}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          I found the errors → Now let me fix them
        </button>
      )}

      {phase === 'correct' && (
        <button
          onClick={handleSubmitCorrections}
          disabled={!allHighlightedHaveCorrections()}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check my corrections
        </button>
      )}

      {phase === 'feedback' && (
        <button
          onClick={() => advance(results)}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          Next →
        </button>
      )}

      {/* Navigation dots */}
      <div className="flex justify-center gap-1.5 py-2">
        {exercise.questions.map((_, i) => {
          const r = results[i]
          const perfect = r && r.correctFixes === r.totalErrors && r.foundErrors === r.totalErrors
          return (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'bg-[#416ebe] scale-125'
                  : perfect
                  ? 'bg-green-400'
                  : r !== null
                  ? 'bg-red-400'
                  : 'bg-[#cddcf0]'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
