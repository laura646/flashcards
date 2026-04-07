'use client'

import { useState, useEffect, useRef } from 'react'

interface DictationQuestion {
  id: number
  text: string
  audio_url?: string
  speed?: 'normal' | 'slow'
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: DictationQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

type QuestionResult = {
  typed: string
  correct: boolean
  diff: DiffSegment[]
}

type DiffSegment = {
  type: 'correct' | 'wrong' | 'missing'
  text: string
  expected?: string
}

function computeDiff(typed: string, expected: string): DiffSegment[] {
  const typedWords = typed.trim().split(/\s+/)
  const expectedWords = expected.trim().split(/\s+/)
  const segments: DiffSegment[] = []

  const maxLen = Math.max(typedWords.length, expectedWords.length)
  for (let i = 0; i < maxLen; i++) {
    const tw = typedWords[i] || ''
    const ew = expectedWords[i] || ''

    if (!tw && ew) {
      segments.push({ type: 'missing', text: ew })
    } else if (tw.toLowerCase() === ew.toLowerCase()) {
      segments.push({ type: 'correct', text: tw })
    } else {
      segments.push({ type: 'wrong', text: tw, expected: ew })
    }
  }
  return segments
}

function isExactMatch(typed: string, expected: string): boolean {
  // Normalize: lowercase, collapse whitespace, strip trailing punctuation differences
  const normalize = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalize(typed) === normalize(expected)
}

export default function DictationRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [results, setResults] = useState<(QuestionResult | null)[]>(
    new Array(exercise.questions.length).fill(null)
  )
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [finished, setFinished] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playCount, setPlayCount] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const current = exercise.questions[currentIndex]
  const answeredCount = results.filter((r) => r !== null).length
  const progress = (answeredCount / exercise.questions.length) * 100

  useEffect(() => {
    if (!finished && feedback === null) {
      inputRef.current?.focus()
    }
  }, [currentIndex, finished, feedback])

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    }
  }, [])

  // Reset play count on question change
  useEffect(() => {
    setPlayCount(0)
  }, [currentIndex])

  const playAudio = async (slow?: boolean) => {
    if (isPlaying) return
    setIsPlaying(true)

    try {
      if (current.audio_url) {
        // Teacher-uploaded audio
        const audio = new Audio(current.audio_url)
        audioRef.current = audio
        if (slow) audio.playbackRate = 0.7
        audio.onended = () => setIsPlaying(false)
        audio.onerror = () => setIsPlaying(false)
        await audio.play()
      } else {
        // Generate via TTS
        const res = await fetch('/api/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: current.text }),
        })
        if (!res.ok) {
          setIsPlaying(false)
          return
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        if (slow) audio.playbackRate = 0.7
        audio.onended = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(url)
        }
        await audio.play()
      }
      setPlayCount((c) => c + 1)
    } catch {
      setIsPlaying(false)
    }
  }

  const handleSubmitAnswer = () => {
    if (feedback !== null || inputValue.trim() === '') return

    const correct = isExactMatch(inputValue, current.text)
    const diff = computeDiff(inputValue, current.text)
    const result: QuestionResult = { typed: inputValue.trim(), correct, diff }

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
    setInputValue('')
    setFeedback(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (feedback === 'wrong') {
        advance(results)
      } else if (feedback === null) {
        handleSubmitAnswer()
      }
    }
  }

  const renderDiff = (diff: DiffSegment[]) => (
    <span>
      {diff.map((seg, i) => {
        if (seg.type === 'correct') {
          return <span key={i} className="text-green-600">{seg.text} </span>
        }
        if (seg.type === 'wrong') {
          return (
            <span key={i}>
              <span className="text-red-400 line-through">{seg.text}</span>
              <span className="text-green-600 font-bold"> {seg.expected} </span>
            </span>
          )
        }
        // missing
        return (
          <span key={i} className="text-amber-500 font-bold underline">{seg.text} </span>
        )
      })}
    </span>
  )

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
                    <p className="text-xs text-gray-400 mb-1">Expected:</p>
                    <p className="text-sm text-[#46464b] font-medium">{q.text}</p>
                    {!isCorrect && result && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-400 mb-1">Your answer:</p>
                        <p className="text-sm">{renderDiff(result.diff)}</p>
                      </div>
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

      {/* Question card with audio buttons */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-[#416ebe] font-bold uppercase tracking-widest mb-4">
          Sentence {currentIndex + 1}
        </p>

        <div className="flex flex-col items-center gap-3">
          {/* Play buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => playAudio(false)}
              disabled={isPlaying || feedback !== null}
              className="flex items-center gap-2 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {isPlaying ? (
                <span className="animate-pulse">Playing...</span>
              ) : (
                <>
                  <span className="text-lg">🔊</span> Play
                </>
              )}
            </button>
            <button
              onClick={() => playAudio(true)}
              disabled={isPlaying || feedback !== null}
              className="flex items-center gap-2 bg-[#e6f0fa] hover:bg-[#cddcf0] text-[#416ebe] font-bold py-3 px-5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              <span className="text-lg">🐢</span> Slow
            </button>
          </div>

          {playCount === 0 && (
            <p className="text-xs text-gray-400">Press play to listen, then type what you hear</p>
          )}
          {playCount > 0 && (
            <p className="text-xs text-gray-400">
              Played {playCount} time{playCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-2">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={feedback !== null}
          placeholder="Type what you hear..."
          rows={2}
          className={`w-full border-2 ${borderColor} rounded-xl py-3 px-4 text-sm text-[#46464b] bg-white outline-none transition-colors focus:border-[#416ebe] disabled:bg-gray-50 placeholder:text-gray-300 resize-none`}
          autoComplete="off"
          spellCheck={false}
        />

        {feedback === 'correct' && (
          <p className="text-sm font-bold text-green-600 text-center animate-pulse">
            Perfect!
          </p>
        )}

        {feedback === 'wrong' && results[currentIndex] && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-500 font-bold mb-2 text-center">Not quite.</p>
            <p className="text-xs text-gray-400 mb-1">Comparison:</p>
            <p className="text-sm">{renderDiff(results[currentIndex]!.diff)}</p>
            <p className="text-xs text-gray-400 mt-2">Correct:</p>
            <p className="text-sm text-[#46464b] font-medium">{current.text}</p>
          </div>
        )}
      </div>

      {/* Action button */}
      {feedback === null ? (
        <button
          onClick={handleSubmitAnswer}
          disabled={inputValue.trim() === '' || playCount === 0}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check
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
