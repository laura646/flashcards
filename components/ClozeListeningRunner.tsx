'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ClozeListeningQuestion {
  id: number
  text: string // "The {{1}} sat on the {{2}}."
  blanks: Record<string, string> // {"1": "cat", "2": "mat"}
  audio_url?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: ClozeListeningQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

type TextPart = { type: 'text'; value: string } | { type: 'blank'; blankId: string }

function parseText(text: string): TextPart[] {
  const parts: TextPart[] = []
  const regex = /\{\{(\w+)\}\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'blank', blankId: match[1] })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return parts
}

export default function ClozeListeningRunner({ exercise, onComplete, onBack }: Props) {
  const [mode, setMode] = useState<'listen_first' | 'read_listen'>('read_listen')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>[]>(
    exercise.questions.map(() => ({}))
  )
  const [submitted, setSubmitted] = useState<boolean[]>(
    new Array(exercise.questions.length).fill(false)
  )
  const [finished, setFinished] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playCount, setPlayCount] = useState(0)
  const [blanksRevealed, setBlanksRevealed] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  if (!exercise.questions || exercise.questions.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">No questions in this exercise.</div>
  }

  const current = exercise.questions[currentIndex]
  const currentAnswers = answers[currentIndex]
  const isSubmitted = submitted[currentIndex]
  const blankIds = Object.keys(current.blanks)
  const allFilled = blankIds.every((id) => (currentAnswers[id] || '').trim() !== '')

  // In listen_first mode, blanks are hidden until first play completes
  const showBlanks = mode === 'read_listen' || blanksRevealed

  // Reset play state on question change
  useEffect(() => {
    setPlayCount(0)
    setBlanksRevealed(false)
  }, [currentIndex])

  // Focus first blank when revealed
  useEffect(() => {
    if (showBlanks && !isSubmitted && blankIds.length > 0) {
      const firstInput = inputRefs.current[blankIds[0]]
      if (firstInput) firstInput.focus()
    }
  }, [showBlanks, currentIndex, isSubmitted, blankIds])

  const playAudio = useCallback(async (slow?: boolean) => {
    if (isPlaying) return
    setIsPlaying(true)

    try {
      if (current.audio_url) {
        const audio = new Audio(current.audio_url)
        audioRef.current = audio
        if (slow) audio.playbackRate = 0.7
        audio.onended = () => {
          setIsPlaying(false)
          if (mode === 'listen_first') setBlanksRevealed(true)
        }
        audio.onerror = () => setIsPlaying(false)
        await audio.play()
      } else {
        // Build full text for TTS (replace blanks with actual words)
        let fullText = current.text
        Object.entries(current.blanks).forEach(([id, word]) => {
          fullText = fullText.replace(`{{${id}}}`, word)
        })

        const res = await fetch('/api/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText }),
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
          if (mode === 'listen_first') setBlanksRevealed(true)
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
  }, [current, isPlaying, mode])

  const handleInputChange = (blankId: string, value: string) => {
    if (isSubmitted) return
    const newAnswers = [...answers]
    newAnswers[currentIndex] = { ...newAnswers[currentIndex], [blankId]: value }
    setAnswers(newAnswers)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, blankId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Move to next blank or submit
      const idx = blankIds.indexOf(blankId)
      if (idx < blankIds.length - 1) {
        const nextInput = inputRefs.current[blankIds[idx + 1]]
        if (nextInput) nextInput.focus()
      } else if (allFilled && !isSubmitted) {
        handleCheck()
      }
    }
  }

  const handleCheck = () => {
    const newSubmitted = [...submitted]
    newSubmitted[currentIndex] = true
    setSubmitted(newSubmitted)
  }

  const handleNext = () => {
    if (currentIndex + 1 < exercise.questions.length) {
      setCurrentIndex(currentIndex + 1)
    } else {
      // Calculate total correct blanks
      let correctBlanks = 0
      let totalBlanks = 0
      exercise.questions.forEach((q, i) => {
        Object.keys(q.blanks).forEach((blankId) => {
          totalBlanks++
          if (
            (answers[i][blankId] || '').trim().toLowerCase() ===
            q.blanks[blankId].trim().toLowerCase()
          ) {
            correctBlanks++
          }
        })
      })
      setFinished(true)
      onComplete(correctBlanks, totalBlanks)
    }
  }

  const progress = (submitted.filter(Boolean).length / exercise.questions.length) * 100

  const parts = parseText(current.text)

  // ── FINISHED ──
  if (finished) {
    let correctBlanks = 0
    let totalBlanks = 0
    exercise.questions.forEach((q, i) => {
      Object.keys(q.blanks).forEach((blankId) => {
        totalBlanks++
        if (
          (answers[i][blankId] || '').trim().toLowerCase() ===
          q.blanks[blankId].trim().toLowerCase()
        ) {
          correctBlanks++
        }
      })
    })
    const pct = Math.round((correctBlanks / totalBlanks) * 100)

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
            {correctBlanks}/{totalBlanks} blanks correct ({pct}%)
          </p>
        </div>

        <div className="space-y-3">
          {exercise.questions.map((q, qi) => {
            const qParts = parseText(q.text)
            const qBlankIds = Object.keys(q.blanks)
            const allCorrect = qBlankIds.every(
              (bid) =>
                (answers[qi][bid] || '').trim().toLowerCase() ===
                q.blanks[bid].trim().toLowerCase()
            )
            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  allCorrect ? 'border-green-200' : 'border-red-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`text-sm font-bold mt-0.5 ${
                      allCorrect ? 'text-green-500' : 'text-red-400'
                    }`}
                  >
                    {allCorrect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 text-sm text-[#46464b] leading-relaxed flex flex-wrap items-baseline gap-x-0.5">
                    {qParts.map((part, pi) => {
                      if (part.type === 'text') return <span key={pi}>{part.value}</span>
                      const bid = part.blankId
                      const placed = (answers[qi][bid] || '').trim()
                      const correct = q.blanks[bid]
                      const isCorrect = placed.toLowerCase() === correct.toLowerCase()
                      return (
                        <span key={pi} className="inline-flex flex-col items-center mx-0.5">
                          {!isCorrect && placed && (
                            <span className="text-xs text-red-400 line-through">{placed}</span>
                          )}
                          <span className="font-bold text-green-600">{correct}</span>
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
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2"
        >
          ← Back to exercises
        </button>
      </div>
    )
  }

  // ── ACTIVE ──
  const getBlankStatus = (blankId: string) => {
    if (!isSubmitted) return 'neutral'
    const placed = (currentAnswers[blankId] || '').trim()
    if (!placed) return 'neutral'
    return placed.toLowerCase() === current.blanks[blankId].toLowerCase() ? 'correct' : 'wrong'
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

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-[#e6f0fa] p-1">
        <button
          onClick={() => { setMode('listen_first'); setBlanksRevealed(false) }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mode === 'listen_first'
              ? 'bg-white text-[#416ebe] shadow-sm'
              : 'text-gray-400 hover:text-[#416ebe]'
          }`}
        >
          Listen First
        </button>
        <button
          onClick={() => { setMode('read_listen'); setBlanksRevealed(true) }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mode === 'read_listen'
              ? 'bg-white text-[#416ebe] shadow-sm'
              : 'text-gray-400 hover:text-[#416ebe]'
          }`}
        >
          Read & Listen
        </button>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Audio controls */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-[#416ebe] font-bold uppercase tracking-widest mb-3">
          Sentence {currentIndex + 1}
        </p>
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-3">
            <button
              onClick={() => playAudio(false)}
              disabled={isPlaying || isSubmitted}
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
              disabled={isPlaying || isSubmitted}
              className="flex items-center gap-2 bg-[#e6f0fa] hover:bg-[#cddcf0] text-[#416ebe] font-bold py-3 px-5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              <span className="text-lg">🐢</span> Slow
            </button>
          </div>
          {playCount === 0 && mode === 'listen_first' && (
            <p className="text-xs text-gray-400">Listen first, then fill in the blanks</p>
          )}
          {playCount === 0 && mode === 'read_listen' && (
            <p className="text-xs text-gray-400">Play audio and fill in the missing words</p>
          )}
          {playCount > 0 && (
            <p className="text-xs text-gray-400">
              Played {playCount} time{playCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Text with blanks */}
      {showBlanks ? (
        <div className="bg-white border border-[#cddcf0] rounded-2xl p-5 shadow-sm">
          <div className="text-base text-[#46464b] leading-loose flex flex-wrap items-center gap-y-2">
            {parts.map((part, pi) => {
              if (part.type === 'text') return <span key={pi}>{part.value}</span>
              const blankId = part.blankId
              const status = getBlankStatus(blankId)
              const value = currentAnswers[blankId] || ''

              return (
                <span key={pi} className="inline-flex flex-col items-center mx-1">
                  <input
                    ref={(el) => { inputRefs.current[blankId] = el }}
                    type="text"
                    value={value}
                    onChange={(e) => handleInputChange(blankId, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, blankId)}
                    disabled={isSubmitted}
                    placeholder="..."
                    autoComplete="off"
                    spellCheck={false}
                    className={`w-24 text-center text-sm font-bold px-2 py-1 rounded-lg border-2 border-dashed outline-none transition-all ${
                      status === 'correct'
                        ? 'border-green-400 bg-green-50 text-green-700'
                        : status === 'wrong'
                        ? 'border-red-400 bg-red-50 text-red-600'
                        : 'border-gray-300 bg-gray-50 text-[#46464b] focus:border-[#416ebe] focus:bg-[#e6f0fa]'
                    } disabled:bg-gray-50 placeholder:text-gray-300`}
                  />
                  {isSubmitted && status === 'wrong' && (
                    <span className="text-xs text-green-600 mt-0.5">
                      {current.blanks[blankId]}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-[#cddcf0] rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-400 italic">
            Listen to the audio first. The blanks will appear after playback.
          </p>
        </div>
      )}

      {/* Action button */}
      {showBlanks && !isSubmitted && (
        <button
          onClick={handleCheck}
          disabled={!allFilled || playCount === 0}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check
        </button>
      )}

      {isSubmitted && (
        <button
          onClick={handleNext}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          {currentIndex + 1 < exercise.questions.length ? 'Next →' : 'See Results'}
        </button>
      )}

      {/* Navigation dots */}
      <div className="flex justify-center gap-1.5 py-1">
        {exercise.questions.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-[#416ebe] scale-125'
                : submitted[i]
                ? Object.keys(exercise.questions[i].blanks).every(
                    (bid) =>
                      (answers[i][bid] || '').trim().toLowerCase() ===
                      exercise.questions[i].blanks[bid].trim().toLowerCase()
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
