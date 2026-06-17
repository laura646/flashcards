'use client'

import { useState } from 'react'
import { Flashcard } from '@/data/flashcards'
import CardFace from './CardFace'
import { Button, Pill, ProgressBar } from './student-ui'

// "10B" re-skin — behaviour unchanged. Passive flip-through review with
// no scoring/SRS. onComplete(total) fires exactly once when advancing
// past the last card. CompletionScreen is exported for QuizMode +
// SelfAssessMode to reuse.

interface Props {
  cards: Flashcard[]
  onComplete: (total: number) => void
}

export default function FlipMode({ cards, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)

  const current = cards[index]

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
      {/* Progress (trailing fill — value={index}, not index+1) */}
      <div className="flex items-center gap-3">
        <ProgressBar value={index} total={cards.length} className="flex-1" />
        <Pill>{index + 1} / {cards.length}</Pill>
      </div>

      {/* Flip card */}
      <div
        className="card-flip cursor-pointer select-none"
        style={{ height: '320px' }}
        onClick={() => setFlipped(!flipped)}
      >
        <div className={`card-flip-inner w-full h-full ${flipped ? 'flipped' : ''}`}>
          <div className="card-front w-full h-full bg-white border-2 border-sky rounded-flashcard">
            <CardFace card={current} showBack={false} />
          </div>
          <div className="card-back w-full h-full bg-white border-2 border-sky rounded-flashcard">
            <CardFace card={current} showBack={true} />
          </div>
        </div>
      </div>

      {/* Next button */}
      <Button variant="primary" fullWidth onClick={next}>
        {index + 1 >= cards.length ? 'Finish' : 'Next →'}
      </Button>
    </div>
  )
}

function CompletionScreen({ total, onRestart, message }: { total: number; onRestart: () => void; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
      <div className="text-5xl">🎉</div>
      <h2 className="text-xl font-extrabold text-brandblue">Well done!</h2>
      <p className="text-sm text-ink-muted">{message}</p>
      <p className="text-xs text-ink-muted">You studied {total} words.</p>
      <Button variant="primary" onClick={onRestart} className="mt-4 !px-8">
        Start again
      </Button>
    </div>
  )
}

export { CompletionScreen }
