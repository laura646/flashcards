'use client'

import { useState, useEffect } from 'react'

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
    test_type?: string | null
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

const MAX_WRONG = 6
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// The "interesting twist" on classic Hangman: a flower that wilts.
// Each wrong guess removes one of six petals (in a balanced alternating
// order so the loss looks dramatic, not just clockwise), the centre face
// gets sadder, and on six wrongs the flower droops and sheds a tear. On
// solve, the remaining petals stay and the face beams. Friendly visual
// that fits an English-learning app — no gallows.
function FlowerSVG({ wrongCount, won }: { wrongCount: number; won: boolean }) {
  const lost = wrongCount >= MAX_WRONG
  // Petal disappearance order: alternating opposite sides for visual balance.
  // Index i = the wrongCount value at which petal i first hides.
  const petalThresholds = [1, 4, 2, 5, 3, 6]
  // Six petal angles around the centre (0° = top, then clockwise).
  const angles = [0, 60, 120, 180, 240, 300]

  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-[180px] mx-auto">
      {/* Stem */}
      <line
        x1="100"
        y1="140"
        x2="100"
        y2="200"
        stroke="#86c47a"
        strokeWidth="4"
        strokeLinecap="round"
        transform={lost ? 'rotate(-12 100 200)' : undefined}
      />
      {/* Leaf */}
      <ellipse
        cx="118"
        cy="175"
        rx="14"
        ry="6"
        fill="#86c47a"
        transform={`rotate(25 118 175)${lost ? ' translate(-6 0)' : ''}`}
      />

      {/* Petals — translated to centre, rotated outward */}
      <g transform={`translate(100 110)${lost ? ' rotate(-12)' : ''}`}>
        {angles.map(
          (angle, i) =>
            wrongCount < petalThresholds[i] && (
              <g key={i} transform={`rotate(${angle})`}>
                <ellipse cx="0" cy="-32" rx="13" ry="22" fill="#416ebe" opacity="0.85" />
              </g>
            )
        )}
      </g>

      {/* Centre disc */}
      <g transform={lost ? 'rotate(-12 100 110)' : undefined}>
        <circle cx="100" cy="110" r="17" fill="#FFCC00" stroke="#e6b400" strokeWidth="1.5" />
        {/* Eyes (closed half-moons when lost, dots otherwise) */}
        {lost ? (
          <>
            <path d="M 90 108 Q 93 111 96 108" stroke="#46464b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M 104 108 Q 107 111 110 108" stroke="#46464b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="93" cy="107" r="2" fill="#46464b" />
            <circle cx="107" cy="107" r="2" fill="#46464b" />
          </>
        )}
        {/* Mouth — smiles, then flattens, then frowns; grins when won */}
        {won ? (
          <path d="M 90 116 Q 100 125 110 116" stroke="#46464b" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : lost ? (
          <path d="M 90 120 Q 100 112 110 120" stroke="#46464b" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : wrongCount >= 4 ? (
          <line x1="92" y1="118" x2="108" y2="118" stroke="#46464b" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M 92 115 Q 100 121 108 115" stroke="#46464b" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
      </g>

      {/* Tear on loss */}
      {lost && (
        <path d="M 89 114 Q 87 121 90 123 Q 93 121 91 114 Z" fill="#5a8fd4" />
      )}

      {/* Sparkles on win */}
      {won && (
        <g fill="#FFCC00" stroke="#e6b400" strokeWidth="1">
          <path d="M 50 60 l 3 -10 l 3 10 l 10 3 l -10 3 l -3 10 l -3 -10 l -10 -3 z" />
          <path d="M 155 80 l 2 -7 l 2 7 l 7 2 l -7 2 l -2 7 l -2 -7 l -7 -2 z" />
          <path d="M 160 145 l 2 -6 l 2 6 l 6 2 l -6 2 l -2 6 l -2 -6 l -6 -2 z" />
        </g>
      )}
    </svg>
  )
}

export default function HangmanRunner({ exercise, onComplete, onBack }: Props) {
  // Exam mode: suppress ALL correctness feedback until the whole test is submitted.
  const isTestMode = !!exercise.test_type
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

  // Physical-keyboard input: A–Z keys also guess letters. Touch-friendly
  // grid below still works on every device.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isRoundDone) return
      // Ignore when typing in an input/textarea elsewhere on the page.
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toUpperCase()
      if (k.length === 1 && k >= 'A' && k <= 'Z') {
        handleGuess(k)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // handleGuess closes over guessedLetters/uniqueLetters/isRoundDone, so
    // re-bind when any of those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoundDone, guessedLetters, currentIndex])

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
          <h2 className="text-xl font-bold text-brandblue">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good effort!' : 'Keep practising!'}
          </h2>
          <p className="text-sm text-ink-muted mt-1">
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
                    <p className="text-sm font-bold text-ink-body">{q.word}</p>
                    <p className="text-xs text-ink-muted mt-0.5">{q.clue}</p>
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
                  ? 'border-b-2 border-sky'
                  : ''
              } ${
                isRoundDone && isLetter && !guessedLetters.has(char)
                  ? 'text-red-400'
                  : 'text-ink-body'
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
          {currentIndex + 1} / {totalWords}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-ink-muted italic">{exercise.instructions}</p>

      {/* Game card */}
      <div className="bg-white border border-sky-border rounded-card p-6 shadow-sm">
        {/* Clue */}
        <p className="text-xs text-brandblue font-bold uppercase tracking-widest mb-1">
          Clue
        </p>
        <p className="text-sm text-ink-body mb-4 leading-relaxed">{current.clue}</p>

        {/* Wilting-flower visual (replaces classic gallows) */}
        <FlowerSVG wrongCount={wrongCount} won={won} />

        {/* Petals remaining */}
        <p className="text-xs text-center text-ink-muted mt-2 mb-3">
          {MAX_WRONG - wrongCount} petal{MAX_WRONG - wrongCount === 1 ? '' : 's'} left
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
                  The word was: <span className="font-bold">{isTestMode ? '\u2022'.repeat(current.word.length) : current.word}</span>
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
                    : 'bg-white border-2 border-sky-border text-ink-body hover:border-sky hover:text-sky active:bg-sky-wash'
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
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors"
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
                ? 'bg-sky scale-125'
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
