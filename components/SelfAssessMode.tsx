'use client'

import { useState } from 'react'
import { Flashcard } from '@/data/flashcards'
import CardFace from './CardFace'
import { CompletionScreen } from './FlipMode'

interface Props {
  cards: Flashcard[]
  onComplete: (knewCount: number, total: number) => void
}

export default function SelfAssessMode({ cards, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knew, setKnew] = useState(0)
  const [done, setDone] = useState(false)

  const current = cards[index]
  const progress = (index / cards.length) * 100

  const answer = (didKnow: boolean) => {
    const newKnew = didKnow ? knew + 1 : knew
    if (index + 1 >= cards.length) {
      setKnew(newKnew)
      setDone(true)
      onComplete(newKnew, cards.length)
    } else {
      setKnew(newKnew)
      setFlipped(false)
      setTimeout(() => setIndex(index + 1), 50)
    }
  }

  const restart = () => {
    setIndex(0)
    setFlipped(false)
    setKnew(0)
    setDone(false)
  }

  if (done) {
    const pct = Math.round((knew / cards.length) * 100)
    return (
      <CompletionScreen
        total={cards.length}
        onRestart={restart}
        message={`You knew ${knew} out of ${cards.length} words (${pct}%). Great work!`}
      />
    )
  }

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
        <span className="text-xs text-gray-400 whitespace-nowrap">{index + 1} / {cards.length}</span>
      </div>

      {/* Score indicator */}
      <div className="flex gap-4 text-xs text-center">
        <div className="flex-1 bg-[#e6f0fa] rounded-lg py-1.5">
          <span className="text-[#416ebe] font-bold">{knew}</span>
          <span className="text-gray-400"> knew it</span>
        </div>
        <div className="flex-1 bg-[#e6f0fa] rounded-lg py-1.5">
          <span className="text-gray-400">{index - knew}</span>
          <span className="text-gray-400"> still learning</span>
        </div>
      </div>

      {/* Card */}
      <div
        className="card-flip cursor-pointer select-none"
        style={{ height: '320px' }}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div className={`card-flip-inner w-full h-full ${flipped ? 'flipped' : ''}`}>
          <div className="card-front w-full h-full bg-white border border-[#cddcf0] rounded-2xl shadow-sm">
            <CardFace card={current} showBack={false} />
          </div>
          <div className="card-back w-full h-full bg-white border border-[#416ebe] rounded-2xl shadow-sm">
            <CardFace card={current} showBack={true} />
          </div>
        </div>
      </div>

      {/* Self-assess buttons (only show after flip) */}
      {flipped ? (
        <div className="flex gap-3">
          <button
            onClick={() => answer(false)}
            className="flex-1 border-2 border-red-200 text-red-400 hover:bg-red-50 font-bold py-3 rounded-xl text-sm transition-colors"
          >
            ✗ Still learning
          </button>
          <button
            onClick={() => answer(true)}
            className="flex-1 border-2 border-green-300 text-green-600 hover:bg-green-50 font-bold py-3 rounded-xl text-sm transition-colors"
          >
            ✓ Knew it!
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-gray-400">Tap the card to reveal — then rate yourself</p>
      )}
    </div>
  )
}
