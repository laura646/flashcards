'use client'

import { useState, useMemo } from 'react'
import { Flashcard } from '@/data/flashcards'
import { recordWordStruggle } from '@/lib/wordStruggle'
import { CompletionScreen } from './FlipMode'
import { Button, Card, Eyebrow, Pill, ProgressBar } from './student-ui'

// "10B" re-skin — behaviour unchanged. 4-option MCQ (which word matches
// the meaning). onComplete(score, total) fires once on the final answer.
// recordWordStruggle(userEmail, word, 'quiz', correct) fires at selection
// when userEmail is present. Answer locks after first pick.

interface Props {
  cards: Flashcard[]
  onComplete: (score: number, total: number) => void
  userEmail?: string
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

export default function QuizMode({ cards, onComplete, userEmail }: Props) {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const shuffledCards = useMemo(() => shuffle(cards), [cards])
  const current = shuffledCards[index]
  const options = useMemo(() => getOptions(cards, current), [cards, current])

  const handleSelect = (option: string) => {
    if (selected !== null) return
    setSelected(option)
    if (userEmail) recordWordStruggle(userEmail, current.word, 'quiz', option === current.word)
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

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <ProgressBar value={index} total={shuffledCards.length} className="flex-1" />
        <Pill>{index + 1} / {shuffledCards.length}</Pill>
      </div>

      {/* Score */}
      <div className="text-center text-xs text-ink-muted">
        Score: <span className="font-bold text-brandblue">{score}</span> / {index}
      </div>

      {/* Question card */}
      <Card padding="lg">
        <Eyebrow tone="sky" className="mb-3 block">Which word matches this meaning?</Eyebrow>
        <p className="text-base text-ink-body font-medium leading-relaxed">{current.meaning}</p>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isThis = selected === option
          const isThisCorrect = option === current.word

          let cls = 'border-[1.5px] rounded-tile py-3 px-4 text-sm font-bold transition-all text-left '
          if (selected === null) {
            cls += 'border-sky-border text-ink-body hover:border-sky hover:text-sky bg-white cursor-pointer'
          } else if (isThisCorrect) {
            cls += 'border-correct-border bg-correct-bg text-correct-fg cursor-default'
          } else if (isThis && !isThisCorrect) {
            cls += 'border-incorrect-border bg-incorrect-bg text-incorrect-fg cursor-default'
          } else {
            cls += 'border-hairline text-ink-muted bg-white cursor-default opacity-70'
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
            <p className="text-center text-sm text-correct-fg font-bold">Correct! 🎉</p>
          ) : (
            <p className="text-center text-sm text-incorrect-fg font-bold">
              The answer was: <span className="text-brandblue">{current.word}</span>
            </p>
          )}
          <Button variant="primary" fullWidth onClick={next}>
            {index + 1 >= shuffledCards.length ? 'See Results' : 'Next →'}
          </Button>
        </div>
      )}
    </div>
  )
}
