import { Flashcard } from '@/data/flashcards'
import AudioButton from './AudioButton'

interface Props {
  card: Flashcard
  showBack?: boolean
}

export default function CardFace({ card, showBack = false }: Props) {
  if (!showBack) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-xs text-[#00aff0] font-bold uppercase tracking-widest mb-3">Word</p>
        <h2 className="text-4xl font-black text-[#416ebe] mb-3">{card.word}</h2>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400 font-mono">{card.phonetic}</p>
          <AudioButton text={card.word} />
        </div>
        <p className="text-xs text-gray-300 mt-6">tap to flip</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center h-full p-6 gap-4">
      <div>
        <p className="text-xs text-[#00aff0] font-bold uppercase tracking-widest mb-1">Meaning</p>
        <p className="text-base text-[#46464b] font-medium leading-relaxed">{card.meaning}</p>
      </div>
      <div className="border-t border-[#e6f0fa] pt-4">
        <p className="text-xs text-[#416ebe] font-bold uppercase tracking-widest mb-1">Example</p>
        <p className="text-sm text-gray-500 italic leading-relaxed">"{card.example}"</p>
        <div className="mt-2">
          <AudioButton text={card.example} />
        </div>
      </div>
      {card.notes && (
        <div className="bg-[#e6f0fa] rounded-lg p-3">
          <p className="text-xs text-[#416ebe]">💡 {card.notes}</p>
        </div>
      )}
    </div>
  )
}
