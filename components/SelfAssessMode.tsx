'use client'

import { useState } from 'react'
import { Flashcard } from '@/data/flashcards'
import { recordWordStruggle } from '@/lib/wordStruggle'
import CardFace from './CardFace'
import { CompletionScreen } from './FlipMode'
import { Pill, ProgressBar } from './student-ui'

// "10B" re-skin — behaviour unchanged. Binary self-grading (Still
// learning / Knew it). onComplete(knewCount, total) fires once on the
// last card. recordWordStruggle(userEmail, word, 'self-assess', didKnow)
// fires per answer when userEmail is present. Forward-only flip; rating
// buttons appear only after the flip. NOT the RatingRow (that's the
// 4-grade Vocabulary Review control, a later phase).

interface Props {
  cards: Flashcard[]
  onComplete: (knewCount: number, total: number) => void
  userEmail?: string
}

export default function SelfAssessMode({ cards, onComplete, userEmail }: Props) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knew, setKnew] = useState(0)
  const [done, setDone] = useState(false)

  const current = cards[index]

  const answer = (didKnow: boolean) => {
    if (userEmail) recordWordStruggle(userEmail, current.word, 'self-assess', didKnow)
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
        <ProgressBar value={index} total={cards.length} className="flex-1" />
        <Pill>{index + 1} / {cards.length}</Pill>
      </div>

      {/* Score indicator */}
      <div className="flex gap-4 text-xs text-center">
        <div className="flex-1 bg-sky-wash rounded-tile py-1.5">
          <span className="text-sky-dark font-bold">{knew}</span>
          <span className="text-ink-muted"> knew it</span>
        </div>
        <div className="flex-1 bg-sky-wash rounded-tile py-1.5">
          <span className="text-ink-body">{index - knew}</span>
          <span className="text-ink-muted"> still learning</span>
        </div>
      </div>

      {/* Card */}
      <div
        className="card-flip cursor-pointer select-none"
        style={{ height: '320px' }}
        onClick={() => !flipped && setFlipped(true)}
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

      {/* Self-assess buttons (only show after flip) */}
      {flipped ? (
        <div className="flex gap-3">
          <button
            onClick={() => answer(false)}
            className="flex-1 border-[1.5px] border-incorrect-border text-incorrect-fg bg-white hover:bg-incorrect-bg font-bold py-3 rounded-tile text-sm transition-colors"
          >
            ✗ Still learning
          </button>
          <button
            onClick={() => answer(true)}
            className="flex-1 border-[1.5px] border-correct-border text-correct-fg bg-white hover:bg-correct-bg font-bold py-3 rounded-tile text-sm transition-colors"
          >
            ✓ Knew it!
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-ink-muted">Tap the card to reveal — then rate yourself</p>
      )}
    </div>
  )
}
