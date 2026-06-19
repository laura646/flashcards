'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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

type ViewMode = 'all' | 'by-lesson'

interface SrsStats {
  total: number
  due: number
  review_due: number
  new_words: number
}

const STAGE_LABELS = ['', 'New', 'Learning', 'Familiar', 'Known', 'Mastered']
// 10B Leitner ramp — matches the VocabTrainer dashboard bucket colours.
const STAGE_PILLS = ['', 'bg-leitner-new text-ink-black', 'bg-leitner-learning text-streak-ink', 'bg-leitner-familiar text-ink-black', 'bg-leitner-known text-ink-black', 'bg-leitner-mastered text-ink-black']

export default function VocabularyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [words, setWords] = useState<VocabWord[]>([])
  const [srsMap, setSrsMap] = useState<Map<string, number>>(new Map())
  const [stats, setStats] = useState<SrsStats | null>(null)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showTrainer, setShowTrainer] = useState(false)
  const [trainerAction, setTrainerAction] = useState<'flip' | 'quiz' | 'add' | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const savedScrollRef = useRef(0)

  const loadAll = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/lessons?all_vocabulary=true').then((r) => r.json()),
      fetch('/api/vocab-srs?action=all').then((r) => r.json()),
      fetch('/api/vocab-srs?action=stats').then((r) => r.json()),
      fetch('/api/vocab-srs?action=streak').then((r) => r.json()),
    ])
      .then(([lessonData, srsData, statsData, streakData]) => {
        const seen = new Set<string>()
        const unique = (lessonData.flashcards || []).filter((w: VocabWord) => {
          const key = w.word.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setWords(unique)
        const map = new Map<string, number>()
        ;(srsData.words || []).forEach((w: { word: string; box_level: number }) => {
          map.set(w.word.toLowerCase(), w.box_level)
        })
        setSrsMap(map)
        if (statsData.stats) setStats(statsData.stats)
        setStreak(streakData.streak || 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const refreshStats = () => {
    Promise.all([
      fetch('/api/vocab-srs?action=stats').then((r) => r.json()),
      fetch('/api/vocab-srs?action=streak').then((r) => r.json()),
      fetch('/api/vocab-srs?action=all').then((r) => r.json()),
    ]).then(([statsData, streakData, srsData]) => {
      if (statsData.stats) setStats(statsData.stats)
      setStreak(streakData.streak || 0)
      const map = new Map<string, number>()
      ;(srsData.words || []).forEach((w: { word: string; box_level: number }) => {
        map.set(w.word.toLowerCase(), w.box_level)
      })
      setSrsMap(map)
    }).catch(() => {})
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
      return
    }
    if (status === 'authenticated') {
      loadAll()
      // Deep-link from Home quick-action tiles: ?mode=flip|quiz opens the
      // trainer straight into Start-Review with that mode; ?action=add opens
      // the add-word view. Always over the student's real SRS words.
      const params = new URLSearchParams(window.location.search)
      const mode = params.get('mode')
      const action = params.get('action')
      if (mode === 'flip' || mode === 'quiz') {
        setTrainerAction(mode)
        setShowTrainer(true)
      } else if (action === 'add') {
        setTrainerAction('add')
        setShowTrainer(true)
      }
    }
  }, [status, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const openTrainer = () => {
    savedScrollRef.current = window.scrollY
    setShowTrainer(true)
  }

  const closeTrainer = () => {
    setShowTrainer(false)
    setTrainerAction(null)
    refreshStats()
    setTimeout(() => window.scrollTo({ top: savedScrollRef.current }), 0)
  }

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-brandblue text-sm">Loading vocabulary…</div>
      </main>
    )
  }

  if (status === 'unauthenticated') return null

  if (showTrainer) {
    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <VocabTrainer onBack={closeTrainer} initialAction={trainerAction} />
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

  const reviewDue = stats?.review_due ?? 0
  const newWords = stats?.new_words ?? 0

  const practiceSubtext = () => {
    if (!stats || stats.total === 0) return 'Spaced repetition — the right words at the right time'
    if (reviewDue > 0 && newWords > 0) return `${reviewDue} due for review · ${newWords} new words`
    if (reviewDue > 0) return `${reviewDue} word${reviewDue === 1 ? '' : 's'} due for review${streak > 0 ? ` · 🔥 ${streak}-day streak` : ''}`
    if (newWords > 0) return `${newWords} new word${newWords === 1 ? '' : 's'} to learn`
    return 'All caught up! Keep the streak going'
  }

  return (
    <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-4">
        <button
          onClick={() => router.push('/home')}
          className="text-xs text-ink-muted hover:text-sky transition-colors mb-1"
        >
          ← Home
        </button>
        <h1 className="text-xl font-bold text-brandblue">My Vocabulary</h1>
        <p className="text-xs text-ink-muted">{words.length} words from all your lessons</p>
      </div>

      {/* Practice button */}
      <button
        onClick={openTrainer}
        className="w-full bg-sky text-white py-5 rounded-card text-sm font-bold hover:bg-sky-dark transition-all shadow-sm mb-5"
      >
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl">🧠</span>
          <div className="text-left">
            <div className="text-base">Practice with the Vocabulary Trainer</div>
            <div className="text-[11px] font-normal text-white/85 mt-0.5">
              {practiceSubtext()}
            </div>
          </div>
        </div>
      </button>

      {words.length === 0 ? (
        <div className="bg-white rounded-2xl border border-sky-border p-8 text-center">
          <div className="text-4xl mb-3">🦗</div>
          <p className="text-sm font-bold text-ink-body">Crickets…</p>
          <p className="text-xs text-ink-muted mt-1">
            No vocabulary yet. Once your teacher publishes lessons with flashcards,
            your words appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c8ccd4] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search words, meanings…"
              className="w-full pl-9 pr-9 py-2.5 text-sm text-ink-body border border-sky-border rounded-xl focus:outline-none focus:border-sky bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c8ccd4] hover:text-ink-muted"
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
                    ? 'bg-sky border-sky text-white'
                    : 'bg-white border-sky-border text-ink-muted hover:border-sky'
                }`}
              >
                {v === 'all' ? 'All words' : 'By lesson'}
              </button>
            ))}
            {searchQuery && (
              <span className="ml-auto text-xs text-ink-muted self-center">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── ALL WORDS (flat alphabetical) ── */}
          {viewMode === 'all' && (
            <>
              {sortedAll.length === 0 ? (
                <div className="bg-white rounded-2xl border border-sky-border p-6 text-center">
                  <p className="text-sm text-ink-muted">No words match &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-sky-border shadow-sm overflow-hidden divide-y divide-hairline">
                  {sortedAll.map((word) => {
                    const stage = getStage(word.word)
                    return (
                      <div key={word.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="text-sm font-bold text-ink-body">{word.word}</h4>
                            <AudioButton text={word.word} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {word.phonetic && (
                              <span className="text-xs text-ink-muted">{word.phonetic}</span>
                            )}
                            {stage > 0 && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_PILLS[stage]}`}>
                                {STAGE_LABELS[stage]}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-ink-muted mt-0.5">{word.meaning}</p>
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
                <div className="bg-white rounded-2xl border border-sky-border p-6 text-center">
                  <p className="text-sm text-ink-muted">No words match &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : (
                Object.entries(groupedByLesson).map(([lessonTitle, lessonWords]) => (
                  <div key={lessonTitle} className="mb-5">
                    <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 px-1">
                      {lessonTitle}
                    </h3>
                    <div className="bg-white rounded-2xl border border-sky-border shadow-sm overflow-hidden divide-y divide-hairline">
                      {lessonWords.map((word) => {
                        const stage = getStage(word.word)
                        return (
                          <div key={word.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <h4 className="text-sm font-bold text-ink-body">{word.word}</h4>
                                <AudioButton text={word.word} />
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {word.phonetic && (
                                  <span className="text-xs text-ink-muted">{word.phonetic}</span>
                                )}
                                {stage > 0 && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_PILLS[stage]}`}>
                                    {STAGE_LABELS[stage]}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-ink-muted mt-0.5">{word.meaning}</p>
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

      <p className="mt-6 text-center text-xs text-ink-muted">englishwithlaura.com</p>
    </main>
  )
}
