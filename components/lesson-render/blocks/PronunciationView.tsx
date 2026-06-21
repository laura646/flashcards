'use client'

import AudioButton from '@/components/AudioButton'
import type { PronunciationContent } from '../types'

// ── Pronunciation Block (student view) ──
// Inner body lifted verbatim from app/lessons/[id]/page.tsx pronunciation
// branch (AudioButton + word + phonetic + tip per word). No score wiring — the
// original branch had none.
export function PronunciationView({
  content,
}: {
  content: PronunciationContent
}) {
  return (
    <div className="space-y-3">
      {content.words.map((w, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border-[1.5px] border-sky-border p-5"
        >
          <div className="flex items-center gap-3 mb-2">
            <AudioButton text={w.word} />
            <div>
              <h3 className="text-base font-bold text-brandblue">{w.word}</h3>
              <p className="text-xs text-ink-muted">{w.phonetic}</p>
            </div>
          </div>
          {w.tips && (
            <div className="bg-sky-wash rounded-lg px-3 py-2 mt-2">
              <p className="text-xs text-ink-body">
                <span className="font-bold text-brandblue">Tip: </span>
                {w.tips}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
