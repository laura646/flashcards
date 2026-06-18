'use client'

import { useState } from 'react'
import { Exercise, ExerciseQuestion } from '@/data/exercises'

interface Props {
  exercise: Exercise
  // perQuestionResults is optional — used by the test-lock flow so the
  // "already submitted" review screen can render right/wrong per question.
  onComplete: (score: number, total: number, perQuestionResults?: boolean[]) => void
  onBack: () => void
}

// An answer is either a single option index (classic single-correct)
// or an array of option indices (multi-select "select all that apply").
type AnswerValue = number | number[] | null

// Multi-select mode is triggered by the presence of correctIndices on the question.
const isMultiSelect = (q: ExerciseQuestion): boolean => Array.isArray(q.correctIndices)

const isQuestionAnswered = (q: ExerciseQuestion, ans: AnswerValue): boolean => {
  if (ans === null) return false
  if (isMultiSelect(q)) return Array.isArray(ans) && ans.length > 0
  return typeof ans === 'number'
}

const isQuestionCorrect = (q: ExerciseQuestion, ans: AnswerValue): boolean => {
  if (ans === null) return false
  if (isMultiSelect(q)) {
    if (!Array.isArray(ans)) return false
    const correct = new Set(q.correctIndices || [])
    if (ans.length !== correct.size) return false
    return ans.every((i) => correct.has(i))
  }
  return typeof ans === 'number' && ans === q.correctIndex
}

export default function ExerciseRunner({ exercise, onComplete, onBack }: Props) {
  // Test exercises (test_type set on the lesson_exercises row) keep the
  // original batch-then-review flow — no feedback during the run, only
  // the summary at the end. Practice exercises get instant per-question
  // feedback, which is the new default.
  const isTestMode = !!exercise.test_type

  const [answers, setAnswers] = useState<AnswerValue[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const current = exercise.questions[currentIndex]
  const allAnswered = answers.every((a, i) => isQuestionAnswered(exercise.questions[i], a))
  const allChecked = checked.size === exercise.questions.length
  const showFeedback = !isTestMode && checked.has(currentIndex)
  const currentCorrect = showFeedback && isQuestionCorrect(current, answers[currentIndex])
  const isLastQuestion = currentIndex === exercise.questions.length - 1
  const progress =
    (answers.filter((a, i) => isQuestionAnswered(exercise.questions[i], a)).length /
      exercise.questions.length) *
    100

  const selectAnswer = (optionIndex: number) => {
    if (submitted) return
    if (showFeedback) return // locked once feedback is shown in practice mode
    const newAnswers = [...answers]

    if (isMultiSelect(current)) {
      // Multi-select: toggle the option in/out of the selection set
      const existing = (answers[currentIndex] as number[] | null) || []
      if (existing.includes(optionIndex)) {
        newAnswers[currentIndex] = existing.filter((i) => i !== optionIndex)
      } else {
        newAnswers[currentIndex] = [...existing, optionIndex].sort((a, b) => a - b)
      }
    } else {
      // Single-select: just set the index
      newAnswers[currentIndex] = optionIndex
    }

    setAnswers(newAnswers)

    // Practice mode + single-select: auto-reveal feedback on click. For
    // multi-select the student needs a "Check" button (see render below)
    // so they can pick multiple options before locking the answer.
    if (!isTestMode && !isMultiSelect(current)) {
      setChecked((prev) => {
        const next = new Set(prev)
        next.add(currentIndex)
        return next
      })
    }
  }

  const checkCurrent = () => {
    if (isTestMode || showFeedback) return
    if (!isQuestionAnswered(current, answers[currentIndex])) return
    setChecked((prev) => {
      const next = new Set(prev)
      next.add(currentIndex)
      return next
    })
  }

  const finishPractice = () => {
    // Practice-mode equivalent of test-mode handleSubmit: report score
    // and transition to the summary screen.
    handleSubmit()
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

  const computeScore = (): number =>
    exercise.questions.reduce(
      (acc, q, i) => acc + (isQuestionCorrect(q, answers[i]) ? 1 : 0),
      0
    )

  const handleSubmit = () => {
    setSubmitted(true)
    const perQuestionResults = exercise.questions.map((q, i) => isQuestionCorrect(q, answers[i]))
    onComplete(computeScore(), exercise.questions.length, perQuestionResults)
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

  // Render the chosen answer(s) as a readable string for the review screen
  const renderChosenAnswer = (q: ExerciseQuestion, ans: AnswerValue): string => {
    if (ans === null) return '(no answer)'
    if (Array.isArray(ans)) return ans.map((i) => q.options[i]).join(', ') || '(nothing selected)'
    return q.options[ans as number] ?? '(no answer)'
  }

  const renderCorrectAnswer = (q: ExerciseQuestion): string => {
    if (isMultiSelect(q)) {
      return (q.correctIndices || []).map((i) => q.options[i]).join(', ')
    }
    return q.options[q.correctIndex]
  }

  if (submitted) {
    const score = computeScore()
    const pct = Math.round((score / exercise.questions.length) * 100)

    return (
      <div className="flex flex-col gap-4">
        {/* Results header */}
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center text-4xl bg-sky-wash rounded-card">
            {pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}
          </div>
          <h2 className="text-xl font-extrabold text-brandblue">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good effort!' : 'Keep practising!'}
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            You scored {score}/{exercise.questions.length} ({pct}%)
          </p>
        </div>

        {/* Review all answers */}
        <div className="space-y-3">
          {exercise.questions.map((q, i) => {
            const isCorrect = isQuestionCorrect(q, answers[i])
            return (
              <div
                key={q.id}
                className={`bg-white rounded-card border-[1.5px] p-4 ${
                  isCorrect ? 'border-correct-border' : 'border-incorrect-border'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 ${isCorrect ? 'text-correct-fg' : 'text-incorrect-fg'}`}>
                    {isCorrect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-ink-body">{formatPrompt(q.prompt)}</p>
                    {!isCorrect && (
                      <p className="text-xs mt-1">
                        <span className="text-incorrect-fg line-through">
                          {renderChosenAnswer(q, answers[i])}
                        </span>
                        {' → '}
                        <span className="text-correct-fg font-bold">
                          {renderCorrectAnswer(q)}
                        </span>
                      </p>
                    )}
                    {q.explanation && (
                      <p className="text-xs text-ink-muted mt-1.5 italic leading-relaxed">
                        {q.explanation}
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
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2"
        >
          ← Back to exercises
        </button>
      </div>
    )
  }

  const currentMulti = isMultiSelect(current)
  const currentSelected = answers[currentIndex]
  const isOptionSelected = (i: number): boolean => {
    if (currentSelected === null) return false
    if (Array.isArray(currentSelected)) return currentSelected.includes(i)
    return currentSelected === i
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-ink-muted hover:text-sky transition-colors"
        >
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
          {currentIndex + 1} / {exercise.questions.length}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-ink-muted italic">{exercise.instructions}</p>

      {/* Question card */}
      <div className="bg-white border border-sky-border rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-sky font-extrabold uppercase tracking-eyebrow mb-3">
          Question {currentIndex + 1}
          {currentMulti && (
            <span className="ml-2 text-brandblue normal-case tracking-normal">
              · Select all that apply
            </span>
          )}
        </p>
        <p className="text-lg text-ink-body font-medium leading-relaxed">
          {formatPrompt(current.prompt)}
        </p>
        {current.hint && (
          <p className="text-xs text-ink-muted mt-2 italic">{current.hint}</p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {current.options.map((option, i) => {
          const selected = isOptionSelected(i)
          const isCorrectOption = currentMulti
            ? (current.correctIndices || []).includes(i)
            : i === current.correctIndex

          // After feedback is shown (practice mode), recolour each option:
          // correct answers go green; the student's wrong picks go red.
          let stateClass: string
          if (showFeedback) {
            if (isCorrectOption) {
              // Locked motion: correct → pulse + green glow ring.
              stateClass = 'border-correct-border bg-correct-bg text-correct-fg animate-correct-pulse'
            } else if (selected) {
              // Locked motion: wrong → shake.
              stateClass = 'border-incorrect-border bg-incorrect-bg text-incorrect-fg animate-wrong-shake'
            } else {
              stateClass = 'border-sky-border bg-white text-ink-muted opacity-70'
            }
          } else {
            stateClass = selected
              ? 'border-sky bg-sky-wash text-brandblue'
              : 'border-sky-border text-ink-body hover:border-sky bg-white'
          }
          return (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              disabled={showFeedback}
              className={`w-full text-left border-2 rounded-xl py-3 px-4 text-sm font-bold transition-all flex items-center gap-3 disabled:cursor-default ${stateClass}`}
            >
              {/* Radio-style or checkbox-style indicator */}
              <span
                className={`flex-shrink-0 w-5 h-5 border-2 flex items-center justify-center transition-colors ${
                  currentMulti ? 'rounded' : 'rounded-full'
                } ${selected ? 'border-sky bg-sky' : 'border-sky-border'}`}
              >
                {selected && (
                  currentMulti ? (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  )
                )}
              </span>
              <span className="text-ink-muted">{String.fromCharCode(97 + i)})</span>
              <span className="flex-1">{option}</span>
            </button>
          )
        })}
      </div>

      {/* Practice-mode feedback panel (shown once the student has checked) */}
      {showFeedback && (
        <div
          className={`rounded-xl border-2 p-3 ${
            currentCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <p
            className={`text-sm font-bold ${
              currentCorrect ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {currentCorrect ? '✓ Correct!' : '✗ Not quite.'}
          </p>
          {!currentCorrect && (
            <p className="text-xs text-gray-600 mt-1">
              Correct answer:{' '}
              <span className="font-bold text-ink-body">{renderCorrectAnswer(current)}</span>
            </p>
          )}
          {current.explanation && (
            <p className="text-xs text-ink-body mt-2 leading-relaxed">
              {current.explanation}
            </p>
          )}
        </div>
      )}

      {/* Question navigation dots */}
      <div className="flex justify-center gap-1 py-2">
        {exercise.questions.map((q, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className="p-1.5"
          >
            <div className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-sky scale-125'
                : isQuestionAnswered(q, answers[i])
                ? 'bg-[#00aff0]'
                : 'bg-[#cddcf0]'
            }`} />
          </button>
        ))}
      </div>

      {/* Navigation — differs between practice and test mode */}
      {isTestMode ? (
        <>
          <div className="flex gap-3">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="flex-1 border-2 border-sky-border text-ink-body font-bold py-3 rounded-xl text-sm transition-colors hover:border-sky disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            {!isLastQuestion ? (
              <button
                onClick={goNext}
                className="flex-1 bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className="flex-1 bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit answers
              </button>
            )}
          </div>
          {!allAnswered && isLastQuestion && (
            <p className="text-xs text-ink-muted text-center">
              Answer all questions to submit
            </p>
          )}
        </>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex-1 border-2 border-sky-border text-ink-body font-bold py-3 rounded-xl text-sm transition-colors hover:border-sky disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          {!showFeedback ? (
            currentMulti ? (
              <button
                onClick={checkCurrent}
                disabled={!isQuestionAnswered(current, answers[currentIndex])}
                className="flex-1 bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check
              </button>
            ) : (
              <span className="flex-1 text-xs text-ink-muted text-center self-center">
                Choose an answer to see feedback
              </span>
            )
          ) : isLastQuestion ? (
            <button
              onClick={finishPractice}
              disabled={!allChecked}
              className="flex-1 bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Finish
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex-1 bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
