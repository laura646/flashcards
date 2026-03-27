'use client'

import { useState } from 'react'

interface HangmanQuestion {
  id: number
  word: string
  clue: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: HangmanQuestion[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

const MAX_WRONG = 6
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function HangmanSVG({ wrongCount }: { wrongCount: number }) {
  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-[200px] mx-auto">
      {/* Gallows */}
      <line x1="20" y1="210" x2="180" y2="210" stroke="#cddcf0" strokeWidth="4" strokeLinecap="round" />
      <line x1="60" y1="210" x2="60" y2="20" stroke="#cddcf0" strokeWidth="4" strokeLinecap="round" />
      <line x1="60" y1="20" x2="130" y2="20" stroke="#cddcf0" strokeWidth="4" strokeLinecap="round" />
      <line x1="130" y1="20" x2="130" y2="50" stroke="#cddcf0" strokeWidth="4" strokeLinecap="round" />

      {/* Head */}
      {wrongCount >= 1 && (
        <circle cx="130" cy="65" r="15" stroke="#416ebe" strokeWidth="3" fill="none" />
      )}
      {/* Body */}
      {wrongCount >= 2 && (
        <line x1="130" y1="80" x2="130" y2="140" stroke="#416ebe" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* Left arm */}
      {wrongCount >= 3 && (
        <line x1="130" y1="95" x2="100" y2="120" stroke="#416ebe" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* Right arm */}
      {wrongCount >= 4 && (
        <line x1="130" y1="95" x2="160" y2="120" stroke="#416ebe" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* Left leg */}
      {wrongCount >= 5 && (
        <line x1="130" y1="140" x2="105" y2="175" stroke="#416ebe" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* Right leg */}
      {wrongCount >= 6 && (
        <line x1="130" y1="140" x2="155" y2="175" stroke="#416ebe" strokeWidth="3" strokeLinecap="round" />
      )}
    </svg>
  )
}

export default function HangmanRunner({ exercise, onComplete, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<boolean[]>([])
  const [roundOver, setRoundOver] = useState(false)

  const totalWords = exercise.questions.length
  const finished = results.length === totalWords

  const current = exercise.questions[currentIndex]
  const wordUpper = current?.word.toUpperCase() ?? ''
  const uniqueLetters = new Set(wordUpper.replace(/[^A-Z]/g, '').split(''))

  const wrongCount = Array.from(guessedLetters).filter((l) => !uniqueLetters.has(l)).length
  const allRevealed = Array.from(uniqueLetters).every((l) => guessedLetters.has(l))
  const lost = wrongCount >= MAX_WRONG
  const won = allRevealed && !lost

  const isRoundDone = won || lost || roundOver

  const handleGuess = (letter: string) => {
    if (isRoundDone || guessedLetters.has(letter)) return
    const next = new Set(guessedLetters)
    next.add(letter)
    setGuessedLetters(next)

    const newWrongCount = Array.from(next).filter((l) => !uniqueLetters.has(l)).length
    const newAllRevealed = Array.from(uniqueLetters).every((l) => next.has(l))

    if (newAllRevealed || newWrongCount >= MAX_WRONG) {
      setRoundOver(true)
    }
  }

  const handleNext = () => {
    setResults([...results, won])
    if (currentIndex + 1 < totalWords) {
      setCurrentIndex(currentIndex + 1)
      setGuessedLetters(new Set())
      setRoundOver(false)
    } else {
      const finalResults = [...results, won]
      const score = finalResults.filter(Boolean).length
      onComplete(score, totalWords)
    }
  }

  // Summary screen
  if (finished) {
    const score = results.filter(Boolean).length
    const pct = Math.round((score / totalWords) * 100)

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
            You guessed {score}/{totalWords} words correctly ({pct}%)
          </p>
        </div>

        <div className="space-y-3">
          {exercise.questions.map((q, i) => {
            const correct = results[i]
            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  correct ? 'border-green-200' : 'border-red-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 ${correct ? 'text-green-500' : 'text-red-400'}`}>
                    {correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#46464b]">{q.word}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{q.clue}</p>
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

  // Render the word with blanks
  const renderWord = () => {
    return (
      <div className="flex justify-center gap-1.5 flex-wrap py-2">
        {wordUpper.split('').map((char, i) => {
          const isLetter = /[A-Z]/.test(char)
          const revealed = !isLetter || guessedLetters.has(char) || isRoundDone
          return (
            <span
              key={i}
              className={`inline-flex items-center justify-center text-xl font-bold min-w-[2rem] h-10 ${
                isLetter
                  ? 'border-b-2 border-[#416ebe]'
                  : ''
              } ${
                isRoundDone && isLetter && !guessedLetters.has(char)
                  ? 'text-red-400'
                  : 'text-[#46464b]'
              }`}
            >
              {revealed ? (isLetter ? char : char) : '\u00A0'}
            </span>
          )
        })}
      </div>
    )
  }

  const progress = ((currentIndex + (isRoundDone ? 1 : 0)) / totalWords) * 100

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
          {currentIndex + 1} / {totalWords}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Game card */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-6 shadow-sm">
        {/* Clue */}
        <p className="text-xs text-[#416ebe] font-bold uppercase tracking-widest mb-1">
          Clue
        </p>
        <p className="text-sm text-[#46464b] mb-4 leading-relaxed">{current.clue}</p>

        {/* Hangman drawing */}
        <HangmanSVG wrongCount={wrongCount} />

        {/* Wrong guesses counter */}
        <p className="text-xs text-center text-gray-400 mt-2 mb-3">
          Wrong guesses: {wrongCount} / {MAX_WRONG}
        </p>

        {/* Word display */}
        {renderWord()}

        {/* Win/Lose message */}
        {isRoundDone && (
          <div className={`text-center mt-4 py-3 rounded-xl ${
            won ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {won ? (
              <>
                <p className="text-lg font-bold text-green-600">Correct!</p>
                <p className="text-sm text-green-500">You guessed the word!</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-red-500">Game over</p>
                <p className="text-sm text-red-400">
                  The word was: <span className="font-bold">{current.word}</span>
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Alphabet buttons */}
      {!isRoundDone ? (
        <div className="grid grid-cols-7 gap-1.5">
          {ALPHABET.map((letter) => {
            const guessed = guessedLetters.has(letter)
            const isCorrect = guessed && uniqueLetters.has(letter)
            const isWrong = guessed && !uniqueLetters.has(letter)

            return (
              <button
                key={letter}
                onClick={() => handleGuess(letter)}
                disabled={guessed}
                className={`h-11 rounded-lg text-sm font-bold transition-all ${
                  isCorrect
                    ? 'bg-green-100 text-green-600 border border-green-200 cursor-default'
                    : isWrong
                    ? 'bg-gray-100 text-red-400 border border-gray-200 cursor-default'
                    : 'bg-white border-2 border-[#cddcf0] text-[#46464b] hover:border-[#416ebe] hover:text-[#416ebe] active:bg-[#e6f0fa]'
                }`}
              >
                {letter}
              </button>
            )
          })}
        </div>
      ) : (
        <button
          onClick={handleNext}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          {currentIndex + 1 < totalWords ? 'Next Word →' : 'See Results'}
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
                : i < results.length
                ? results[i]
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
