'use client'

import { useState } from 'react'
import { Flashcard } from '@/data/flashcards'
import CardFace from './CardFace'

interface Props {
  cards: Flashcard[]
  onComplete: (total: number) => void
}

export default function FlipMode({ cards, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)

  const current = cards[index]
  const progress = ((index) / cards.length) * 100

  const next = () => {
    if (index + 1 >= cards.length) {
      setDone(true)
      onComplete(cards.length)
    } else {
      setFlipped(false)
      setTimeout(() => setIndex(index + 1), 50)
    }
  }

  const restart = () => {
    setIndex(0)
    setFlipped(false)
    setDone(false)
  }

  if (done) {
    return <CompletionScreen total={cards.length} onRestart={restart} message="You've flipped through all the cards!" />
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

      {/* Flip card */}
      <div
        className="card-flip cursor-pointer select-none"
        style={{ height: '320px' }}
        onClick={() => setFlipped(!flipped)}
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

      {/* Next button */}
      <button
        onClick={next}
        className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors"
      >
        {index + 1 >= cards.length ? 'Finish' : 'Next →'}
      </button>
    </div>
  )
}

function CompletionScreen({ total, onRestart, message }: { total: number; onRestart: () => void; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
      <div className="text-5xl">🎉</div>
      <h2 className="text-xl font-bold text-[#416ebe]">Well done!</h2>
      <p className="text-sm text-gray-500">{message}</p>
      <p className="text-xs text-gray-400">You studied {total} words.</p>
      <button
        onClick={onRestart}
        className="mt-4 bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-2.5 px-8 rounded-xl text-sm transition-colors"
      >
        Start again
      </button>
    </div>
  )
}

export { CompletionScreen }
