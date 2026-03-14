'use client'

import { useState, useMemo } from 'react'
import { Flashcard } from '@/data/flashcards'
import AudioButton from './AudioButton'
import { CompletionScreen } from './FlipMode'

interface Props {
  cards: Flashcard[]
  onComplete: (score: number, total: number) => void
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function getOptions(cards: Flashcard[], correct: Flashcard): string[] {
  const wrong = shuffle(cards.filter((c) => c.id !== correct.id))
    .slice(0, 3)
    .map((c) => c.word)
  return shuffle([correct.word, ...wrong])
}

export default function QuizMode({ cards, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const shuffledCards = useMemo(() => shuffle(cards), [cards])
  const current = shuffledCards[index]
  const options = useMemo(() => getOptions(cards, current), [cards, current])
  const progress = (index / shuffledCards.length) * 100

  const handleSelect = (option: string) => {
    if (selected !== null) return
    setSelected(option)
  }

  const next = () => {
    const isCorrect = selected === current.word
    const newScore = isCorrect ? score + 1 : score

    if (index + 1 >= shuffledCards.length) {
      setScore(newScore)
      setDone(true)
      onComplete(newScore, shuffledCards.length)
    } else {
      setScore(newScore)
      setSelected(null)
      setIndex(index + 1)
    }
  }

  const restart = () => {
    setIndex(0)
    setScore(0)
    setSelected(null)
    setDone(false)
  }

  if (done) {
    const pct = Math.round((score / shuffledCards.length) * 100)
    return (
      <CompletionScreen
        total={shuffledCards.length}
        onRestart={restart}
        message={`You scored ${score}/${shuffledCards.length} (${pct}%). ${pct >= 80 ? 'Excellent! 🌟' : pct >= 60 ? 'Good effort! Keep practising.' : 'Keep going — practice makes perfect!'}`}
      />
    )
  }

  const isCorrect = selected === current.word
  const isWrong = selected !== null && !isCorrect

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#416ebe] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{index + 1} / {shuffledCards.length}</span>
      </div>

      {/* Score */}
      <div className="text-center text-xs text-gray-400">
        Score: <span className="font-bold text-[#416ebe]">{score}</span> / {index}
      </div>

      {/* Question card */}
      <div className="bg-white border border-[#cddcf0] rounded-2xl p-6 shadow-sm">
        <p className="text-xs text-[#00aff0] font-bold uppercase tracking-widest mb-3">Which word matches this meaning?</p>
        <p className="text-base text-[#46464b] font-medium leading-relaxed mb-3">{current.meaning}</p>
        <div className="border-t border-[#e6f0fa] pt-3">
          <p className="text-xs text-gray-400 italic mb-1">Example:</p>
          <p className="text-sm text-gray-500 italic">"{current.example}"</p>
          <div className="mt-2">
            <AudioButton text={current.example} />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isThis = selected === option
          const isThisCorrect = option === current.word

          let cls = 'border-2 rounded-xl py-3 px-4 text-sm font-bold transition-all text-left '
          if (selected === null) {
            cls += 'border-[#cddcf0] text-[#46464b] hover:border-[#416ebe] hover:text-[#416ebe] bg-white cursor-pointer'
          } else if (isThisCorrect) {
            cls += 'border-green-400 bg-green-50 text-green-700 cursor-default'
          } else if (isThis && !isThisCorrect) {
            cls += 'border-red-300 bg-red-50 text-red-500 cursor-default'
          } else {
            cls += 'border-[#e6f0fa] text-gray-300 bg-white cursor-default'
          }

          return (
            <button key={option} onClick={() => handleSelect(option)} className={cls}>
              {option}
              {selected !== null && isThisCorrect && ' ✓'}
              {isThis && !isThisCorrect && ' ✗'}
            </button>
          )
        })}
      </div>

      {/* Feedback + Next */}
      {selected !== null && (
        <div className="flex flex-col gap-2">
          {isCorrect ? (
            <p className="text-center text-sm text-green-600 font-bold">Correct! 🎉</p>
          ) : (
            <p className="text-center text-sm text-red-400 font-bold">
              The answer was: <span className="text-[#416ebe]">{current.word}</span>
            </p>
          )}
          <button
            onClick={next}
            className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            {index + 1 >= shuffledCards.length ? 'See Results' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}
