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
    test_type?: string | null
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

// LCS-based diff: only the incorrect-sentence positions that are NOT part
// of the longest common subsequence with the correct sentence count as
// errors. This means inserting/deleting a single word in the correction
// no longer cascades into "every subsequent word is wrong".
function findErrors(incorrect: string, correct: string): Map<number, string> {
  const inc = incorrect.trim().split(/\s+/)
  const cor = correct.trim().split(/\s+/)
  const n = inc.length
  const m = cor.length

  // LCS length DP (case-insensitive)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (inc[i - 1].toLowerCase() === cor[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find which inc positions are part of the LCS, and the
  // cor position each maps to.
  const matched = new Set<number>()
  const matchToJ = new Map<number, number>()
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (inc[i - 1].toLowerCase() === cor[j - 1].toLowerCase()) {
      matched.add(i - 1)
      matchToJ.set(i - 1, j - 1)
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  // For each unmatched inc position, pick a suggested replacement from the
  // cor words that sit between its surrounding matched anchors.
  const errors = new Map<number, string>()
  for (let k = 0; k < n; k++) {
    if (matched.has(k)) continue
    let prevJ = -1
    for (let p = k - 1; p >= 0; p--) {
      if (matched.has(p)) { prevJ = matchToJ.get(p)!; break }
    }
    let nextJ = m
    for (let p = k + 1; p < n; p++) {
      if (matched.has(p)) { nextJ = matchToJ.get(p)!; break }
    }
    const startJ = prevJ + 1
    const endJ = nextJ
    if (startJ < endJ) {
      // Distribute by position within the unmatched stretch in inc.
      let stretchStart = k
      while (stretchStart > 0 && !matched.has(stretchStart - 1)) stretchStart--
      const offset = k - stretchStart
      const corPick = Math.min(startJ + offset, endJ - 1)
      errors.set(k, cor[corPick])
    }
    // else: no corresponding cor word for this position. The UI can't
    // represent "delete this word", so we skip — better than asking the
    // student to perform an impossible correction.
  }
  return errors
}

export default function ErrorCorrectionRunner({ exercise, onComplete, onBack }: Props) {
  // Exam mode: suppress ALL correctness feedback until the whole test is submitted.
  const isTestMode = !!exercise.test_type
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

    // Exam mode: record and advance — the per-sentence corrections stay hidden.
    if (isTestMode) {
      advance(newResults)
      return
    }

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
      // Per-error scoring: one point for each correctly-fixed error, out
      // of the total errors across all sentences. A sentence with 2 of 3
      // errors fixed is worth 2 — used to be worth 0.
      let score = 0
      let total = 0
      for (const r of latestResults) {
        if (!r) continue
        score += r.correctFixes
        total += r.totalErrors
      }
      setFinished(true)
      onComplete(score, total)
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
    let totalErrors = 0
    let totalCorrect = 0
    for (const r of results) {
      if (!r) continue
      totalErrors += r.totalErrors
      totalCorrect += r.correctFixes
    }
    const perfectCount = results.filter(
      (r) => r && r.correctFixes === r.totalErrors && r.foundErrors === r.totalErrors
    ).length
    const pct = totalErrors > 0 ? Math.round((totalCorrect / totalErrors) * 100) : 0

    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-3">
            {pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}
          </div>
          <h2 className="text-xl font-bold text-brandblue">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good effort!' : 'Keep practising!'}
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            {totalCorrect}/{totalErrors} errors fixed ({pct}%) · {perfectCount}/{exercise.questions.length} sentences fully corrected
          </p>
        </div>

        <div className="space-y-3">
          {exercise.questions.map((q, i) => {
            const result = results[i]
            if (!result) return null
            const perfect = result.correctFixes === result.totalErrors && result.foundErrors === result.totalErrors
            const falsePositives = result.words.filter((w) => w.highlighted && !w.isError).length
            // "Truly perfect" = real errors handled AND no over-marking
            const cleanPerfect = perfect && falsePositives === 0

            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  cleanPerfect ? 'border-green-200' : 'border-red-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 ${cleanPerfect ? 'text-green-500' : 'text-red-400'}`}>
                    {cleanPerfect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-ink-muted mb-1">Original (with errors):</p>
                    <p className="text-sm text-red-400 line-through">{q.incorrect}</p>
                    <p className="text-xs text-ink-muted mt-2 mb-1">Correct version:</p>
                    <p className="text-sm text-green-600 font-medium">{q.correct}</p>
                    {(!perfect || falsePositives > 0) && (
                      <p className="text-xs text-ink-muted mt-2">
                        Found {result.foundErrors}/{result.totalErrors} errors, fixed {result.correctFixes} correctly
                        {falsePositives > 0 && (
                          <>
                            {' · '}
                            <span className="text-orange-600">
                              ⚠ also marked {falsePositives} word{falsePositives !== 1 ? 's' : ''} that
                              {falsePositives === 1 ? ' was' : ' were'} already correct
                            </span>
                          </>
                        )}
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
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2"
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
        <button onClick={onBack} className="text-sm text-ink-muted hover:text-sky transition-colors">
          ← Back
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-brandblue">{exercise.title}</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-sky-wash rounded-full overflow-hidden">
          <div
            className="h-full bg-sky rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-ink-muted whitespace-nowrap">
          {answeredCount} / {exercise.questions.length}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-ink-muted italic">{exercise.instructions}</p>

      {/* Phase indicator */}
      <div className="flex gap-2">
        <div className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold ${
          phase === 'highlight' ? 'bg-sky text-white' : 'bg-sky-wash text-ink-body'
        }`}>
          Step 1: Find errors
        </div>
        <div className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold ${
          phase === 'correct' ? 'bg-sky text-white' : phase === 'feedback' ? 'bg-sky-wash text-ink-body' : 'bg-gray-100 text-ink-muted'
        }`}>
          Step 2: Fix them
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white border border-sky-border rounded-card p-5 shadow-sm">
        <p className="text-xs text-brandblue font-bold uppercase tracking-widest mb-3">
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
                      : 'bg-white border-transparent text-ink-body hover:bg-gray-50 hover:border-gray-200'
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
                      className="w-24 text-center border-2 border-sky rounded-lg px-2 py-1 text-sm text-ink-body outline-none bg-blue-50"
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
              const fixedRight =
                w.isError &&
                w.highlighted &&
                w.correction.trim().toLowerCase() === w.expectedCorrection.toLowerCase()
              const triedButWrong = w.isError && w.highlighted && !fixedRight
              const missed = w.isError && !w.highlighted
              const falsePositive = !w.isError && w.highlighted

              // Real error, fixed correctly
              if (fixedRight) {
                return (
                  <span
                    key={w.index}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 font-bold text-base"
                  >
                    ✓ {w.correction}
                  </span>
                )
              }
              // Real error, attempted but wrong fix
              if (triedButWrong) {
                return (
                  <span
                    key={w.index}
                    className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 font-bold text-base"
                  >
                    {w.correction || w.word}
                    <span className="text-[10px] font-normal text-amber-600">
                      should be {w.expectedCorrection}
                    </span>
                  </span>
                )
              }
              // Real error, missed entirely
              if (missed) {
                return (
                  <span
                    key={w.index}
                    className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-600 font-bold text-base"
                  >
                    {w.word}
                    <span className="text-[10px] font-normal text-red-500">
                      → {w.expectedCorrection}
                    </span>
                  </span>
                )
              }
              // False positive — flagged a word that was actually correct
              if (falsePositive) {
                return (
                  <span
                    key={w.index}
                    className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded border border-orange-200 bg-orange-50 text-orange-700 text-base"
                    title="This word was already correct"
                  >
                    <span className="line-through">{w.word}</span>
                    <span className="text-[10px] font-bold">⚠ already correct</span>
                  </span>
                )
              }
              // Plain word — not an error, not flagged
              return (
                <span key={w.index} className="inline-block px-1 py-0.5 text-base text-ink-body">
                  {w.word}
                </span>
              )
            }

            // Phase correct but not highlighted
            return (
              <span key={w.index} className="px-2 py-1 text-base text-ink-body">
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
              // Words the student flagged that weren't actually errors.
              const falsePositives = r.words.filter((w) => w.highlighted && !w.isError).length
              return (
                <div className="text-sm text-center space-y-1">
                  {perfect && falsePositives === 0 ? (
                    <p className="text-green-600 font-bold animate-pulse">
                      Perfect! All errors found and corrected!
                    </p>
                  ) : (
                    <>
                      <p className="text-ink-muted">
                        Found {r.foundErrors} of {r.totalErrors} error
                        {r.totalErrors !== 1 ? 's' : ''}
                      </p>
                      <p className="text-ink-muted">Correctly fixed: {r.correctFixes}</p>
                    </>
                  )}
                  {falsePositives > 0 && (
                    <p className="text-orange-600 text-xs font-medium">
                      ⚠ Also marked {falsePositives} word{falsePositives !== 1 ? 's' : ''} that
                      {falsePositives === 1 ? ' was' : ' were'} already correct.
                    </p>
                  )}
                  <p className="text-xs text-ink-muted mt-2">
                    Correct version:{' '}
                    <span className="text-green-600 font-medium">{current.correct}</span>
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
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          I found the errors → Now let me fix them
        </button>
      )}

      {phase === 'correct' && (
        <button
          onClick={handleSubmitCorrections}
          disabled={!allHighlightedHaveCorrections()}
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check my corrections
        </button>
      )}

      {phase === 'feedback' && (
        <button
          onClick={() => advance(results)}
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors"
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
                  ? 'bg-sky scale-125'
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
