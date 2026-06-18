'use client'

import { useState, useCallback } from 'react'

interface CompleteSentenceQuestion {
  id: number
  text: string // "I {{1}} to the store and {{2}} some milk."
  blanks: Record<string, string> // {"1": "went", "2": "bought"}
  wordBank: string[] // ["went", "bought", "gone", "buyed"]
  image_url?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: CompleteSentenceQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

export default function CompleteSentenceRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  // For each question, track which word is placed in which blank
  const [placements, setPlacements] = useState<Record<string, string>[]>(
    exercise.questions.map(() => ({}))
  )
  const [submitted, setSubmitted] = useState<boolean[]>(
    new Array(exercise.questions.length).fill(false)
  )
  const [draggedWord, setDraggedWord] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)

  const current = exercise.questions[currentIndex]
  const currentPlacements = placements[currentIndex]
  const isSubmitted = submitted[currentIndex]

  // Parse text into segments: text and blanks
  const parseText = useCallback((text: string) => {
    const parts: { type: 'text' | 'blank'; value: string; blankId?: string }[] = []
    const regex = /\{\{(\w+)\}\}/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
      }
      parts.push({ type: 'blank', value: match[1], blankId: match[1] })
      lastIndex = regex.lastIndex
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIndex) })
    }
    return parts
  }, [])

  const blankIds = Object.keys(current.blanks)
  const usedWords = new Set(Object.values(currentPlacements))
  const availableWords = current.wordBank.filter((w) => !usedWords.has(w))

  const handleDragStart = (word: string) => {
    setDraggedWord(word)
  }

  const handleDrop = (blankId: string) => {
    if (!draggedWord || isSubmitted) return
    const newPlacements = [...placements]
    const current = { ...newPlacements[currentIndex] }

    // If this blank already has a word, release it back
    // Remove the dragged word from any other blank it may be in
    Object.keys(current).forEach((key) => {
      if (current[key] === draggedWord) {
        delete current[key]
      }
    })

    current[blankId] = draggedWord
    newPlacements[currentIndex] = current
    setPlacements(newPlacements)
    setDraggedWord(null)
  }

  const handleRemoveFromBlank = (blankId: string) => {
    if (isSubmitted) return
    const newPlacements = [...placements]
    const current = { ...newPlacements[currentIndex] }
    delete current[blankId]
    newPlacements[currentIndex] = current
    setPlacements(newPlacements)
  }

  // Tap to place: tap a word, then tap a blank
  const [selectedWord, setSelectedWord] = useState<string | null>(null)

  const handleWordTap = (word: string) => {
    if (isSubmitted) return
    setSelectedWord(selectedWord === word ? null : word)
  }

  const handleBlankTap = (blankId: string) => {
    if (isSubmitted) return
    if (selectedWord) {
      const newPlacements = [...placements]
      const current = { ...newPlacements[currentIndex] }
      // Remove from any other blank
      Object.keys(current).forEach((key) => {
        if (current[key] === selectedWord) delete current[key]
      })
      current[blankId] = selectedWord
      newPlacements[currentIndex] = current
      setPlacements(newPlacements)
      setSelectedWord(null)
    } else if (currentPlacements[blankId]) {
      // Tap a filled blank to remove it
      handleRemoveFromBlank(blankId)
    }
  }

  const allBlanksFilled = blankIds.every((id) => currentPlacements[id])

  const handleCheck = () => {
    const newSubmitted = [...submitted]
    newSubmitted[currentIndex] = true
    setSubmitted(newSubmitted)
  }

  // Per-blank scoring: a 3-blank sentence with 2 right is worth 2/3, not 0/1.
  const computeScore = () => {
    let score = 0
    let total = 0
    exercise.questions.forEach((q, i) => {
      Object.keys(q.blanks).forEach((blankId) => {
        total++
        if (placements[i][blankId]?.toLowerCase() === q.blanks[blankId].toLowerCase()) {
          score++
        }
      })
    })
    return { score, total }
  }

  const handleNext = () => {
    if (currentIndex + 1 < exercise.questions.length) {
      setCurrentIndex(currentIndex + 1)
      setSelectedWord(null)
    } else {
      const { score, total } = computeScore()
      setFinished(true)
      onComplete(score, total)
    }
  }

  const progress = ((submitted.filter(Boolean).length) / exercise.questions.length) * 100

  // Summary screen
  if (finished) {
    const { score, total } = computeScore()
    const pct = total > 0 ? Math.round((score / total) * 100) : 0

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
            You scored {score}/{total} blanks ({pct}%)
          </p>
        </div>

        <div className="space-y-3">
          {exercise.questions.map((q, i) => {
            const allCorrect = Object.keys(q.blanks).every(
              (blankId) => placements[i][blankId]?.toLowerCase() === q.blanks[blankId].toLowerCase()
            )
            const parts = parseText(q.text)
            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  allCorrect ? 'border-green-200' : 'border-red-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 ${allCorrect ? 'text-green-500' : 'text-red-400'}`}>
                    {allCorrect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 text-sm text-ink-body leading-relaxed flex flex-wrap items-baseline gap-x-0.5">
                    {parts.map((part, pi) => {
                      if (part.type === 'text') return <span key={pi}>{part.value}</span>
                      const blankId = part.blankId!
                      const placed = placements[i][blankId]
                      const correct = q.blanks[blankId]
                      const isCorrect = placed?.toLowerCase() === correct.toLowerCase()
                      return (
                        <span key={pi} className="inline-flex flex-col items-center mx-0.5">
                          {!isCorrect && placed && (
                            <span className="text-xs text-red-400 line-through">{placed}</span>
                          )}
                          <span className={`font-bold ${isCorrect ? 'text-green-600' : 'text-green-600'}`}>
                            {correct}
                          </span>
                        </span>
                      )
                    })}
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

  // Active view
  const parts = parseText(current.text)

  // Check correctness for submitted view
  const getBlankStatus = (blankId: string) => {
    if (!isSubmitted) return 'neutral'
    const placed = currentPlacements[blankId]
    if (!placed) return 'neutral'
    return placed.toLowerCase() === current.blanks[blankId].toLowerCase() ? 'correct' : 'wrong'
  }

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
          <div className="h-full bg-sky rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-ink-muted whitespace-nowrap">
          {currentIndex + 1} / {exercise.questions.length}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-ink-muted italic">{exercise.instructions}</p>

      {/* Question image */}
      {current.image_url && (
        <div className="flex justify-center">
          <img
            src={current.image_url}
            alt=""
            className="max-h-48 rounded-card border border-sky-border shadow-sm object-contain"
          />
        </div>
      )}

      {/* Sentence with blanks */}
      <div className="bg-white border border-sky-border rounded-card p-6 shadow-sm">
        <p className="text-xs text-brandblue font-bold uppercase tracking-widest mb-4">
          Sentence {currentIndex + 1}
        </p>
        <div className="text-base text-ink-body leading-loose flex flex-wrap items-center gap-y-2">
          {parts.map((part, pi) => {
            if (part.type === 'text') return <span key={pi}>{part.value}</span>
            const blankId = part.blankId!
            const placed = currentPlacements[blankId]
            const status = getBlankStatus(blankId)

            return (
              <span
                key={pi}
                onClick={() => handleBlankTap(blankId)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(blankId)}
                className={`inline-flex items-center justify-center min-w-[5rem] mx-1 px-3 py-1 rounded-lg border-2 border-dashed cursor-pointer transition-all text-sm font-bold ${
                  status === 'correct'
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : status === 'wrong'
                    ? 'border-red-400 bg-red-50 text-red-600'
                    : placed
                    ? 'border-sky bg-sky-wash text-ink-body'
                    : selectedWord
                    ? 'border-sky bg-sky-wash/50 text-ink-muted animate-pulse'
                    : 'border-gray-300 bg-gray-50 text-ink-muted'
                }`}
              >
                {placed || '___'}
                {isSubmitted && status === 'wrong' && (
                  <span className="ml-1 text-xs text-green-600">→ {current.blanks[blankId]}</span>
                )}
              </span>
            )
          })}
        </div>
      </div>

      {/* Word bank */}
      {!isSubmitted && (
        <div>
          <p className="text-xs font-bold text-ink-muted mb-2">Word bank</p>
          <div className="flex flex-wrap gap-2">
            {current.wordBank.map((word, wi) => {
              const isUsed = usedWords.has(word)
              const isSelected = selectedWord === word
              return (
                <button
                  key={wi}
                  draggable={!isUsed}
                  onDragStart={() => handleDragStart(word)}
                  onClick={() => !isUsed && handleWordTap(word)}
                  disabled={isUsed}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isUsed
                      ? 'bg-gray-100 text-[#c8ccd4] border border-gray-200 cursor-default'
                      : isSelected
                      ? 'bg-sky text-white border-2 border-sky scale-105 shadow-md'
                      : 'bg-white text-ink-body border-2 border-sky-border hover:border-sky hover:text-sky cursor-grab active:cursor-grabbing'
                  }`}
                >
                  {word}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Action button */}
      {!isSubmitted ? (
        <button
          onClick={handleCheck}
          disabled={!allBlanksFilled}
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check answer
        </button>
      ) : (
        <button
          onClick={handleNext}
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          {currentIndex + 1 < exercise.questions.length ? 'Next Sentence →' : 'See Results'}
        </button>
      )}

      {/* Navigation dots */}
      <div className="flex justify-center gap-1.5 py-1">
        {exercise.questions.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-sky scale-125'
                : submitted[i]
                ? Object.keys(exercise.questions[i].blanks).every(
                    (blankId) =>
                      placements[i][blankId]?.toLowerCase() === exercise.questions[i].blanks[blankId].toLowerCase()
                  )
                  ? 'bg-green-400'
                  : 'bg-red-300'
                : 'bg-[#cddcf0]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
