'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import VocabTrainer from '@/components/VocabTrainer'

interface VocabWord {
  id: string
  word: string
  phonetic: string
  meaning: string
  example: string
  notes?: string
  image_url?: string
  lessons: {
    title: string
    lesson_date: string
  }
}

type Mode = 'browse' | 'trainer'

// useSearchParams requires a Suspense boundary in Next 14+.
export default function VocabularyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center"><div className="text-[#416ebe] text-sm">Loading vocabulary…</div></main>}>
      <VocabularyInner />
    </Suspense>
  )
}

function VocabularyInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [words, setWords] = useState<VocabWord[]>([])
  const [loading, setLoading] = useState(true)
  // Deep-linkable: /vocabulary?mode=trainer jumps straight into the SRS
  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'trainer' ? 'trainer' : 'browse'
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
      return
    }
    if (status === 'authenticated') {
      fetch('/api/lessons?all_vocabulary=true')
        .then((res) => res.json())
        .then((data) => {
          setWords(data.flashcards || [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [status, router])

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading vocabulary…</div>
      </main>
    )
  }

  if (status === 'unauthenticated') return null

  // ── Vocab Trainer (the single SRS practice path) ──
  if (mode === 'trainer') {
    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <VocabTrainer onBack={() => setMode('browse')} />
      </main>
    )
  }

  // ── Browse view — word reference grouped by lesson ──
  const groupedByLesson: Record<string, VocabWord[]> = {}
  words.forEach((w) => {
    const key = w.lessons?.title || 'Other words'
    if (!groupedByLesson[key]) groupedByLesson[key] = []
    groupedByLesson[key].push(w)
  })

  return (
    <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/home')}
            className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1"
          >
            ← Home
          </button>
          <h1 className="text-xl font-bold text-[#416ebe]">My Vocabulary</h1>
          <p className="text-xs text-gray-400">{words.length} words from all your lessons</p>
        </div>
      </div>

      {/* HERO: the one practice path — spaced-repetition trainer */}
      <button
        onClick={() => setMode('trainer')}
        className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white py-5 rounded-2xl text-sm font-bold hover:from-amber-500 hover:to-orange-600 transition-all shadow-sm mb-6"
      >
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl">🧠</span>
          <div className="text-left">
            <div className="text-base">Practice with the Vocabulary Trainer</div>
            <div className="text-[11px] font-normal text-amber-50 mt-0.5">
              Spaced repetition — it shows you the right words at the right time so they stick
            </div>
          </div>
        </div>
      </button>

      {words.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#cddcf0] p-8 text-center">
          <div className="text-4xl mb-3">🦗</div>
          <p className="text-sm font-bold text-[#46464b]">Crickets…</p>
          <p className="text-xs text-gray-400 mt-1">
            No vocabulary yet. Once your teacher publishes lessons with flashcards,
            your words appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
            All your words (reference)
          </p>
          {Object.entries(groupedByLesson).map(([lessonTitle, lessonWords]) => (
            <div key={lessonTitle} className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {lessonTitle}
              </h3>
              <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden divide-y divide-[#e6f0fa]">
                {lessonWords.map((word) => (
                  <div key={word.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-bold text-[#46464b]">{word.word}</h4>
                      <span className="text-xs text-gray-400 shrink-0">{word.phonetic}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{word.meaning}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <p className="mt-4 text-center text-xs text-gray-400">englishwithlaura.com</p>
    </main>
  )
}
