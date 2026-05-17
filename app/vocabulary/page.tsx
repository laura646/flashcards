'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import VocabTrainer from '@/components/VocabTrainer'
import AudioButton from '@/components/AudioButton'

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
type ViewMode = 'all' | 'by-lesson'

const STAGE_LABELS = ['', 'New', 'Learning', 'Familiar', 'Known', 'Mastered']
const STAGE_PILLS = ['', 'bg-red-100 text-red-500', 'bg-orange-100 text-orange-500', 'bg-yellow-100 text-yellow-600', 'bg-blue-100 text-blue-500', 'bg-green-100 text-green-600']

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
  const [srsMap, setSrsMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [browseLoaded, setBrowseLoaded] = useState(false)
  const [savedScroll, setSavedScroll] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'trainer' ? 'trainer' : 'browse'
  )

  const loadWords = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/lessons?all_vocabulary=true').then((r) => r.json()),
      fetch('/api/vocab-srs?action=all').then((r) => r.json()),
    ])
      .then(([lessonData, srsData]) => {
        setWords(lessonData.flashcards || [])
        const map = new Map<string, number>()
        ;(srsData.words || []).forEach((w: { word: string; box_level: number }) => {
          map.set(w.word.toLowerCase(), w.box_level)
        })
        setSrsMap(map)
        setBrowseLoaded(true)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
      return
    }
    if (status === 'authenticated' && mode === 'browse') {
      loadWords()
    }
  }, [status, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToTrainer = () => {
    setSavedScroll(window.scrollY)
    setMode('trainer')
  }

  const goToBrowse = () => {
    if (!browseLoaded) loadWords()
    setMode('browse')
    setTimeout(() => window.scrollTo({ top: savedScroll }), 0)
  }

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading vocabulary…</div>
      </main>
    )
  }

  if (status === 'unauthenticated') return null

  if (mode === 'trainer') {
    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <VocabTrainer onBack={goToBrowse} />
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading vocabulary…</div>
      </main>
    )
  }

  const getStage = (word: string) => srsMap.get(word.toLowerCase()) ?? 0

  const q = searchQuery.trim().toLowerCase()
  const filtered = q
    ? words.filter(
        (w) =>
          w.word.toLowerCase().includes(q) ||
          w.meaning.toLowerCase().includes(q) ||
          (w.phonetic || '').toLowerCase().includes(q)
      )
    : words

  const sortedAll = [...filtered].sort((a, b) => a.word.localeCompare(b.word))

  const groupedByLesson: Record<string, VocabWord[]> = {}
  filtered.forEach((w) => {
    const key = w.lessons?.title || 'Other'
    if (!groupedByLesson[key]) groupedByLesson[key] = []
    groupedByLesson[key].push(w)
  })

  return (
    <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-4">
        <button
          onClick={() => router.push('/home')}
          className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1"
        >
          ← Home
        </button>
        <h1 className="text-xl font-bold text-[#416ebe]">My Vocabulary</h1>
        <p className="text-xs text-gray-400">{words.length} words from all your lessons</p>
      </div>

      {/* Practice button */}
      <button
        onClick={goToTrainer}
        className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white py-5 rounded-2xl text-sm font-bold hover:from-amber-500 hover:to-orange-600 transition-all shadow-sm mb-5"
      >
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl">🧠</span>
          <div className="text-left">
            <div className="text-base">Practice with the Vocabulary Trainer</div>
            <div className="text-[11px] font-normal text-amber-50 mt-0.5">
              Spaced repetition — the right words at the right time
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
          {/* Search bar */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search words, meanings…"
              className="w-full pl-9 pr-9 py-2.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-xl focus:outline-none focus:border-[#416ebe] bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                ✕
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex gap-2 mb-4">
            {(['all', 'by-lesson'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                  viewMode === v
                    ? 'bg-[#416ebe] border-[#416ebe] text-white'
                    : 'bg-white border-[#cddcf0] text-gray-400 hover:border-[#416ebe]'
                }`}
              >
                {v === 'all' ? 'All words' : 'By lesson'}
              </button>
            ))}
            {searchQuery && (
              <span className="ml-auto text-xs text-gray-400 self-center">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── ALL WORDS (flat alphabetical) ── */}
          {viewMode === 'all' && (
            <>
              {sortedAll.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#cddcf0] p-6 text-center">
                  <p className="text-sm text-gray-400">No words match &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden divide-y divide-[#e6f0fa]">
                  {sortedAll.map((word) => {
                    const stage = getStage(word.word)
                    return (
                      <div key={word.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="text-sm font-bold text-[#46464b]">{word.word}</h4>
                            <AudioButton text={word.word} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {word.phonetic && (
                              <span className="text-xs text-gray-400">{word.phonetic}</span>
                            )}
                            {stage > 0 && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_PILLS[stage]}`}>
                                {STAGE_LABELS[stage]}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{word.meaning}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── BY LESSON ── */}
          {viewMode === 'by-lesson' && (
            <>
              {Object.keys(groupedByLesson).length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#cddcf0] p-6 text-center">
                  <p className="text-sm text-gray-400">No words match &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : (
                Object.entries(groupedByLesson).map(([lessonTitle, lessonWords]) => (
                  <div key={lessonTitle} className="mb-5">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                      {lessonTitle}
                    </h3>
                    <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden divide-y divide-[#e6f0fa]">
                      {lessonWords.map((word) => {
                        const stage = getStage(word.word)
                        return (
                          <div key={word.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <h4 className="text-sm font-bold text-[#46464b]">{word.word}</h4>
                                <AudioButton text={word.word} />
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {word.phonetic && (
                                  <span className="text-xs text-gray-400">{word.phonetic}</span>
                                )}
                                {stage > 0 && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_PILLS[stage]}`}>
                                    {STAGE_LABELS[stage]}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{word.meaning}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </>
      )}

      <p className="mt-6 text-center text-xs text-gray-400">englishwithlaura.com</p>
    </main>
  )
}
