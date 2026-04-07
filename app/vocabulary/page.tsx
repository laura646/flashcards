'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import FlipMode from '@/components/FlipMode'
import SelfAssessMode from '@/components/SelfAssessMode'
import QuizMode from '@/components/QuizMode'
import VocabTrainer from '@/components/VocabTrainer'

interface VocabWord {
  id: string
  word: string
  phonetic: string
  meaning: string
  example: string
  notes?: string
  lessons: {
    title: string
    lesson_date: string
  }
}

type Mode = 'browse' | 'flip' | 'self-assess' | 'quiz' | 'trainer'

export default function VocabularyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [words, setWords] = useState<VocabWord[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('browse')

  const studentName = session?.user?.name?.split(' ')[0] || 'Student'
  const studentEmail = session?.user?.email || ''

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

  const handleSessionComplete = async (results: {
    mode: string
    score?: number
    total: number
    knewCount?: number
  }) => {
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: studentEmail,
          activity_type: 'flashcard',
          activity_id: results.mode,
          score: results.score ?? results.knewCount ?? null,
          total: results.total,
        }),
      })
    } catch {}

    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail,
          studentName,
          event: 'session_complete',
          ...results,
        }),
      })
    } catch {}
  }

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading vocabulary...</div>
      </main>
    )
  }

  if (status === 'unauthenticated') return null

  const flashcardsForMode = words.map((w, i) => ({
    id: i + 1,
    word: w.word,
    phonetic: w.phonetic,
    meaning: w.meaning,
    example: w.example,
    notes: w.notes,
  }))

  // Vocab Trainer (SRS)
  if (mode === 'trainer') {
    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <VocabTrainer onBack={() => setMode('browse')} />
      </main>
    )
  }

  // Study modes
  if (mode === 'flip' || mode === 'self-assess' || mode === 'quiz') {
    const modeButtons: { key: 'flip' | 'self-assess' | 'quiz'; label: string; description: string }[] = [
      { key: 'flip', label: 'Flip', description: 'Tap to reveal' },
      { key: 'self-assess', label: 'Self-Assess', description: 'Know it or not?' },
      { key: 'quiz', label: 'Quiz', description: 'Multiple choice' },
    ]

    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => setMode('browse')}
              className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1"
            >
              ← Back to vocabulary
            </button>
            <h1 className="text-xl font-bold text-[#416ebe]">All My Vocabulary</h1>
            <p className="text-xs text-gray-400">Review all words from every lesson</p>
          </div>
          <span className="text-xs text-gray-400 bg-[#e6f0fa] px-3 py-1 rounded-full">
            {words.length} words
          </span>
        </div>

        <div className="flex gap-2 mb-6 bg-[#e6f0fa] p-1.5 rounded-xl">
          {modeButtons.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 py-3 px-2 rounded-lg text-xs font-bold transition-all ${
                mode === key
                  ? 'bg-white text-[#416ebe] shadow-sm'
                  : 'text-[#46464b] hover:text-[#416ebe]'
              }`}
            >
              <div>{label}</div>
              <div className="font-normal mt-0.5 text-gray-400">{description}</div>
            </button>
          ))}
        </div>

        {mode === 'flip' && (
          <FlipMode
            cards={flashcardsForMode}
            onComplete={(total) => handleSessionComplete({ mode: 'flip', total })}
          />
        )}
        {mode === 'self-assess' && (
          <SelfAssessMode
            cards={flashcardsForMode}
            userEmail={studentEmail}
            onComplete={(knewCount, total) =>
              handleSessionComplete({ mode: 'self-assess', knewCount, total })
            }
          />
        )}
        {mode === 'quiz' && (
          <QuizMode
            cards={flashcardsForMode}
            userEmail={studentEmail}
            onComplete={(score, total) =>
              handleSessionComplete({ mode: 'quiz', score, total })
            }
          />
        )}
      </main>
    )
  }

  // Browse view - word list grouped by lesson
  const groupedByLesson: Record<string, VocabWord[]> = {}
  words.forEach((w) => {
    const key = w.lessons?.title || 'Unknown Lesson'
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
          <h1 className="text-xl font-bold text-[#416ebe]">All My Vocabulary</h1>
          <p className="text-xs text-gray-400">{words.length} words from all lessons</p>
        </div>
      </div>

      {/* Vocab Trainer CTA */}
      <button
        onClick={() => setMode('trainer')}
        className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white py-4 rounded-2xl text-sm font-bold hover:from-amber-500 hover:to-orange-600 transition-all shadow-sm mb-3"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">🧠</span>
          <div>
            <div>Vocabulary Trainer</div>
            <div className="text-[10px] font-normal text-amber-100">Spaced repetition — review words at the right time</div>
          </div>
        </div>
      </button>

      {/* Study mode buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('flip')}
          className="flex-1 bg-[#416ebe] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#3560b0] transition-colors"
        >
          🃏 Study All
        </button>
        <button
          onClick={() => setMode('quiz')}
          className="flex-1 bg-white text-[#416ebe] border-2 border-[#416ebe] py-3 rounded-xl text-sm font-bold hover:bg-[#e6f0fa] transition-colors"
        >
          📝 Quiz All
        </button>
      </div>

      {/* Word list grouped by lesson */}
      {Object.entries(groupedByLesson).map(([lessonTitle, lessonWords]) => (
        <div key={lessonTitle} className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
            {lessonTitle}
          </h3>
          <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden divide-y divide-[#e6f0fa]">
            {lessonWords.map((word) => (
              <div key={word.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-sm font-bold text-[#46464b]">{word.word}</h4>
                  <span className="text-xs text-gray-400">{word.phonetic}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{word.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="mt-4 text-center text-xs text-gray-400">
        englishwithlaura.com
      </p>
    </main>
  )
}
