'use client'

// Phase B verification harness — mounts the REAL redesigned flashcard
// components (FlipMode / SelfAssessMode / QuizMode) with a mock deck, plus
// the 10B mode-switcher chrome, so the actual card can be eyeballed
// outside the auth-gated lesson page. Not linked anywhere; delete after
// the redesign ships.

import { useState } from 'react'
import FlipMode from '@/components/FlipMode'
import SelfAssessMode from '@/components/SelfAssessMode'
import QuizMode from '@/components/QuizMode'

const MOCK = [
  { id: 1, word: 'mercury', phonetic: 'ˈmɜːkjʊri', meaning: 'The smallest planet in the Solar System and closest to the Sun.', example: 'Mercury orbits the Sun faster than any other planet.', notes: 'Also the name of a metal and a Roman god.' },
  { id: 2, word: 'orbit', phonetic: 'ˈɔːbɪt', meaning: 'The curved path of an object around a star, planet, or moon.', example: 'The Earth completes one orbit of the Sun each year.' },
  { id: 3, word: 'galaxy', phonetic: 'ˈɡaləksi', meaning: 'A huge system of stars, gas, and dust held together by gravity.', example: 'Our galaxy is called the Milky Way.' },
]

type Mode = 'flip' | 'self-assess' | 'quiz'

export default function FlashcardPreview() {
  const [mode, setMode] = useState<Mode>('flip')
  const buttons: { key: Mode; label: string; description: string }[] = [
    { key: 'flip', label: 'Flip', description: 'Tap to reveal' },
    { key: 'self-assess', label: 'Self-Assess', description: 'Know it or not?' },
    { key: 'quiz', label: 'Quiz', description: 'Multiple choice' },
  ]
  return (
    <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto bg-[#f9fafb]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-brandblue">New Words</h1>
          <p className="text-xs text-ink-muted">Phase B preview — Space lesson</p>
        </div>
        <span className="text-[11px] font-bold text-ink-body bg-sky-wash px-3 py-1 rounded-full">{MOCK.length} words</span>
      </div>

      <div className="flex gap-1 mb-6 bg-sky-wash p-1 rounded-full">
        {buttons.map(({ key, label, description }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 py-2.5 px-2 rounded-full text-xs font-bold transition-all ${
              mode === key ? 'bg-white text-brandblue shadow-[0_1px_2px_rgba(15,22,40,0.08)]' : 'text-ink-body hover:text-ink-black'
            }`}
          >
            <div>{label}</div>
            <div className="font-normal mt-0.5 text-ink-muted">{description}</div>
          </button>
        ))}
      </div>

      {mode === 'flip' && <FlipMode cards={MOCK} onComplete={() => {}} />}
      {mode === 'self-assess' && <SelfAssessMode cards={MOCK} onComplete={() => {}} />}
      {mode === 'quiz' && <QuizMode cards={MOCK} onComplete={() => {}} />}
    </main>
  )
}
