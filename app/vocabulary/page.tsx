'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import VocabTrainer from '@/components/VocabTrainer'
import AudioButton from '@/components/AudioButton'
import AddWordModal from '@/components/AddWordModal'
import EditWordModal, { type EditWordData } from '@/components/EditWordModal'

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
  1: number; 2: number; 3: number; 4: number; 5: number
  total: number
  due: number
  review_due: number
  new_words: number
}

const STAGE_LABELS = ['', 'New', 'Learning', 'Familiar', 'Known', 'Mastered']
// 10B Leitner ramp — matches the VocabTrainer dashboard bucket colours.
const STAGE_PILLS = ['', 'bg-leitner-new text-ink-black', 'bg-leitner-learning text-streak-ink', 'bg-leitner-familiar text-ink-black', 'bg-leitner-known text-ink-black', 'bg-leitner-mastered text-ink-black']
// Bar fills for the progress buckets (same ramp, solid fill).
const BAR_COLORS = ['', 'bg-leitner-new', 'bg-leitner-learning', 'bg-leitner-familiar', 'bg-leitner-known', 'bg-leitner-mastered']

export default function VocabularyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [words, setWords] = useState<VocabWord[]>([])
  const [srsMap, setSrsMap] = useState<Map<string, number>>(new Map())
  // word (lowercased) → the student's own vocab_srs row, for editing.
  const [srsRows, setSrsRows] = useState<Map<string, EditWordData>>(new Map())
  const [stats, setStats] = useState<SrsStats | null>(null)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showTrainer, setShowTrainer] = useState(false)
  const [trainerAction, setTrainerAction] = useState<'flip' | 'quiz' | null>(null)
  const [editData, setEditData] = useState<EditWordData | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState<number | null>(null)
  const [trainerStage, setTrainerStage] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const savedScrollRef = useRef(0)

  // `silent` refreshes in place (no full-screen loader) — used after adding a
  // word so the list updates without a jarring page flash.
  const loadAll = (silent = false) => {
    if (!silent) setLoading(true)
    Promise.all([
      fetch('/api/lessons?all_vocabulary=true').then((r) => r.json()),
      fetch('/api/vocab-srs?action=all').then((r) => r.json()),
      fetch('/api/vocab-srs?action=stats').then((r) => r.json()),
      fetch('/api/vocab-srs?action=streak').then((r) => r.json()),
      fetch('/api/vocab-srs?action=removed').then((r) => r.json()),
    ])
      .then(([lessonData, srsData, statsData, streakData, removedData]) => {
        // Words the student removed — hide any that still exist as lesson
        // flashcards (their SRS row is already gone).
        const removedSet = new Set<string>(
          ((removedData?.words || []) as string[]).map((w) => w.toLowerCase())
        )
        const srsWords = (srsData.words || []) as Array<{
          id: string; word: string; phonetic?: string; meaning?: string
          example?: string; image_url?: string; notes?: string
          translation?: string; box_level: number
        }>
        const srsByKey = new Map<string, (typeof srsWords)[number]>()
        srsWords.forEach((sw) => { if (sw.word) srsByKey.set(sw.word.toLowerCase(), sw) })

        const seen = new Set<string>()
        const merged: VocabWord[] = []
        // Lesson flashcards, but display the student's OWN copy (their edits to
        // meaning/phonetic/translation) when one exists in their SRS.
        ;(lessonData.flashcards || []).forEach((w: VocabWord) => {
          const key = w.word.toLowerCase()
          if (seen.has(key) || removedSet.has(key)) return
          seen.add(key)
          const sw = srsByKey.get(key)
          merged.push({
            ...w,
            phonetic: (sw?.phonetic || w.phonetic) || '',
            meaning: (sw?.meaning || w.meaning) || '',
            example: (sw?.example || w.example) || '',
          })
        })
        // Student-added words live only in vocab_srs (never in a lesson).
        srsWords.forEach((sw) => {
          const key = (sw.word || '').toLowerCase()
          if (!key || seen.has(key) || removedSet.has(key)) return
          seen.add(key)
          merged.push({
            id: sw.id,
            word: sw.word,
            phonetic: sw.phonetic || '',
            meaning: sw.meaning || '',
            example: sw.example || '',
            notes: sw.notes || undefined,
            image_url: sw.image_url || undefined,
            lessons: { title: 'Added by you', lesson_date: '' },
          })
        })
        setWords(merged)
        const map = new Map<string, number>()
        const rows = new Map<string, EditWordData>()
        srsWords.forEach((w) => {
          map.set(w.word.toLowerCase(), w.box_level)
          rows.set(w.word.toLowerCase(), {
            id: w.id,
            word: w.word,
            phonetic: w.phonetic || '',
            meaning: w.meaning || '',
            example: w.example || '',
            translation: w.translation || '',
            notes: w.notes || '',
          })
        })
        setSrsMap(map)
        setSrsRows(rows)
        if (statsData.stats) setStats(statsData.stats)
        setStreak(streakData.streak || 0)
        if (!silent) setLoading(false)
      })
      .catch(() => { if (!silent) setLoading(false) })
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
      // Sync lesson flashcards into the student's SRS first, so every listed
      // word has a vocab_srs row (needed for stages + editing), then load.
      const init = async () => {
        try {
          await fetch('/api/vocab-srs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync' }),
          })
        } catch { /* non-blocking */ }
        loadAll()
      }
      init()
      // Deep-link from Home quick-action tiles: ?mode=flip|quiz opens the
      // trainer straight into practice with that mode; ?action=add opens the
      // add-word sheet on this page.
      const params = new URLSearchParams(window.location.search)
      const mode = params.get('mode')
      const action = params.get('action')
      if (mode === 'flip' || mode === 'quiz') {
        setTrainerAction(mode)
        setShowTrainer(true)
      } else if (action === 'add') {
        setShowAdd(true)
      }
    }
  }, [status, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const openTrainer = () => {
    savedScrollRef.current = window.scrollY
    setShowTrainer(true)
  }

  // "Practice these N" from a progress bucket — jump straight into a review
  // of just that stage's words.
  const openTrainerStage = (stage: number) => {
    savedScrollRef.current = window.scrollY
    setTrainerStage(stage)
    setShowTrainer(true)
  }

  const closeTrainer = () => {
    setShowTrainer(false)
    setTrainerAction(null)
    setTrainerStage(null)
    refreshStats()
    setTimeout(() => window.scrollTo({ top: savedScrollRef.current }), 0)
  }

  // Open the edit sheet for a word. Prefer the student's own SRS row (has the
  // id + their translation/notes); fall back to the lesson data for a word not
  // yet synced (saved as an upsert).
  const openEdit = (w: VocabWord) => {
    const existing = srsRows.get(w.word.toLowerCase())
    setEditData(existing ?? {
      word: w.word,
      phonetic: w.phonetic || '',
      meaning: w.meaning || '',
      example: w.example || '',
      translation: '',
      notes: '',
    })
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
        <VocabTrainer onBack={closeTrainer} initialAction={trainerAction} initialStage={trainerStage} />
      </main>
    )
  }

  const getStage = (word: string) => srsMap.get(word.toLowerCase()) ?? 0

  const q = searchQuery.trim().toLowerCase()
  const searched = q
    ? words.filter(
        (w) =>
          w.word.toLowerCase().includes(q) ||
          w.meaning.toLowerCase().includes(q) ||
          (w.phonetic || '').toLowerCase().includes(q)
      )
    : words
  // Tapping a progress bucket narrows the list to that mastery stage.
  const filtered = stageFilter
    ? searched.filter((w) => getStage(w.word) === stageFilter)
    : searched

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-brandblue">My Vocabulary</h1>
            <p className="text-xs text-ink-muted">{words.length} words in your vocabulary</p>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 mt-1.5 bg-streak-fill/40 text-streak-ink text-[11px] font-bold px-2 py-0.5 rounded-full">
                🔥 {streak}-day streak
              </span>
            )}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="shrink-0 inline-flex items-center gap-1.5 bg-sky text-white font-bold text-sm px-4 py-2 rounded-full hover:bg-sky-dark transition-colors shadow-sm"
          >
            <span className="text-base leading-none">＋</span> Add word
          </button>
        </div>
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

      {/* Progress buckets — tap a bar to filter the list to that stage */}
      {stats && stats.total > 0 && (
        <div className="bg-white rounded-2xl border border-sky-border p-4 mb-4">
          <p className="text-xs font-bold text-ink-muted uppercase mb-3">Your words — {stats.total} total</p>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as const).map((box) => {
              const count = stats[box] || 0
              const pctHeight = stats.total > 0 ? Math.max((count / stats.total) * 100, count > 0 ? 10 : 0) : 0
              const active = stageFilter === box
              return (
                <button
                  key={box}
                  onClick={() => setStageFilter(active ? null : box)}
                  disabled={count === 0}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-lg p-1 transition-colors ${count > 0 ? 'hover:bg-surface cursor-pointer' : 'cursor-default'} ${active ? 'bg-surface ring-1 ring-sky' : ''}`}
                  title={count > 0 ? `See your ${count} ${STAGE_LABELS[box]} word${count === 1 ? '' : 's'}` : undefined}
                >
                  <div className="w-full h-20 bg-[#eef1f6] rounded-tile relative overflow-hidden">
                    <div className={`absolute bottom-0 w-full rounded-tile ${BAR_COLORS[box]} transition-all duration-500`} style={{ height: `${pctHeight}%` }} />
                  </div>
                  <span className="text-xs font-bold text-ink-muted">{count}</span>
                  <span className="text-[9px] text-ink-muted">{STAGE_LABELS[box]}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-ink-muted text-center mt-2">
            {stageFilter ? 'Tap the highlighted bar again to clear' : 'Tap a bar to see those words'}
          </p>
        </div>
      )}

      {/* Stage filter banner */}
      {stageFilter !== null && (
        <div className="flex items-center justify-between gap-3 bg-sky-wash border border-sky-border rounded-xl px-3 py-2.5 mb-4">
          <p className="text-xs font-bold text-ink-body">
            Showing <span className="text-sky-dark">{STAGE_LABELS[stageFilter]}</span> words
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {(stats?.[stageFilter as 1 | 2 | 3 | 4 | 5] ?? 0) > 0 && (
              <button
                onClick={() => openTrainerStage(stageFilter)}
                className="bg-sky text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-sky-dark transition-colors"
              >
                🧠 Practice these {stats?.[stageFilter as 1 | 2 | 3 | 4 | 5] ?? 0}
              </button>
            )}
            <button onClick={() => setStageFilter(null)} className="text-xs font-bold text-ink-muted hover:text-ink-body">
              Clear
            </button>
          </div>
        </div>
      )}

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
                            <button onClick={() => openEdit(word)} title="Edit this word (only you see your changes)"
                              className="text-xs font-bold text-ink-muted hover:text-sky transition-colors whitespace-nowrap">
                              ✎ Edit
                            </button>
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
                                <button onClick={() => openEdit(word)} title="Edit this word (only you see your changes)"
                                  className="text-xs font-bold text-ink-muted hover:text-sky transition-colors whitespace-nowrap">
                                  ✎ Edit
                                </button>
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

      {showAdd && (
        <AddWordModal
          onClose={() => setShowAdd(false)}
          onSaved={(w) => {
            setShowAdd(false)
            loadAll(true)
            setToast(`“${w}” added to your vocabulary`)
            setTimeout(() => setToast(null), 2400)
          }}
        />
      )}

      {editData && (
        <EditWordModal
          existing={editData}
          onClose={() => setEditData(null)}
          onSaved={() => {
            setEditData(null)
            loadAll(true)
            setToast('Changes saved')
            setTimeout(() => setToast(null), 2400)
          }}
          onDeleted={(w) => {
            setEditData(null)
            loadAll(true)
            setToast(`“${w}” removed from your vocabulary`)
            setTimeout(() => setToast(null), 2400)
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-correct-fg text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <span>✓</span>{toast}
        </div>
      )}
    </main>
  )
}
