import { Flashcard } from '@/data/flashcards'
import AudioButton from './AudioButton'
import { Eyebrow } from './student-ui'

// Student-app "10B" flashcard face. Pure presentational — renders the
// front (showBack=false) or back (showBack=true) of one card. Mounted
// twice (both faces) inside the parent mode's CSS flip wrapper; holds no
// state and no scoring/SRS/navigation logic.
//
// AudioButton is intentionally kept (NOT swapped for the kit AudioCircle):
// it owns the /api/audio fetch + play + loading state and calls
// stopPropagation so a tap on the speaker doesn't bubble to the parent's
// card-flip onClick. Swapping it would risk breaking the flip.

interface Props {
  card: Flashcard
  showBack?: boolean
}

export default function CardFace({ card, showBack = false }: Props) {
  if (!showBack) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Eyebrow tone="sky" className="mb-3">Word</Eyebrow>
        <h2 className="text-[40px] leading-none font-black text-brandblue tracking-word mb-3">{card.word}</h2>
        <div className="flex items-center gap-2">
          <p className="text-[13px] text-ink-muted font-mono">{card.phonetic}</p>
          <AudioButton text={card.word} />
        </div>
        <p className="text-[13px] text-ink-muted mt-6">tap to flip</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center h-full p-6 gap-4">
      {card.image_url && (
        <div className="flex justify-center">
          <img src={card.image_url} alt={card.word} className="max-h-32 rounded-card object-contain" />
        </div>
      )}
      <div>
        <Eyebrow tone="sky" className="mb-1 block">Meaning</Eyebrow>
        <p className="text-base text-ink-black font-medium leading-relaxed">{card.meaning}</p>
      </div>
      <div className="border-t border-hairline pt-4">
        <Eyebrow tone="brand" className="mb-1 block">Example</Eyebrow>
        <p className="text-sm text-ink-muted italic leading-relaxed">&ldquo;{card.example}&rdquo;</p>
        <div className="mt-2">
          <AudioButton text={card.example} />
        </div>
      </div>
      {card.notes && (
        // Locked colour rule: text on sky-wash is ink-body, never brand-blue.
        <div className="bg-sky-wash rounded-tile p-3">
          <p className="text-xs text-ink-body">💡 {card.notes}</p>
        </div>
      )}
    </div>
  )
}
