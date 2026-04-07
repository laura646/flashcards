'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { flashcards } from '@/data/flashcards'
import FlipMode from '@/components/FlipMode'
import SelfAssessMode from '@/components/SelfAssessMode'
import QuizMode from '@/components/QuizMode'

type Mode = 'flip' | 'self-assess' | 'quiz'

export default function FlashcardsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('flip')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    )
  }

  if (status === 'unauthenticated') return null

  const studentName = session?.user?.name?.split(' ')[0] || 'Student'
  const studentEmail = session?.user?.email || ''

  const handleSessionComplete = async (results: {
    mode: string
    score?: number
    total: number
    knewCount?: number
  }) => {
    // Save to Supabase
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
    } catch {
      // Non-blocking
    }

    // Notify teacher
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
    } catch {
      // Non-blocking
    }
  }

  const modeButtons: { key: Mode; label: string; description: string }[] = [
    { key: 'flip', label: 'Flip', description: 'Tap to reveal' },
    { key: 'self-assess', label: 'Self-Assess', description: 'Know it or not?' },
    { key: 'quiz', label: 'Quiz', description: 'Multiple choice' },
  ]

  return (
    <main className="min-h-screen flex flex-col px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/home')}
            className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-1"
          >
            &larr; Home
          </button>
          <h1 className="text-xl font-bold text-[#416ebe]">New Words</h1>
          <p className="text-xs text-gray-400">Hi, {studentName}!</p>
        </div>
        <span className="text-xs text-gray-400 bg-[#e6f0fa] px-3 py-1 rounded-full">
          {flashcards.length} words
        </span>
      </div>

      {/* Mode selector */}
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
            <div className={`font-normal mt-0.5 text-gray-400`}>
              {description}
            </div>
          </button>
        ))}
      </div>

      {/* Mode content */}
      {mode === 'flip' && (
        <FlipMode
          cards={flashcards}
          onComplete={(total) => handleSessionComplete({ mode: 'flip', total })}
        />
      )}
      {mode === 'self-assess' && (
        <SelfAssessMode
          cards={flashcards}
          userEmail={studentEmail}
          onComplete={(knewCount, total) =>
            handleSessionComplete({ mode: 'self-assess', knewCount, total })
          }
        />
      )}
      {mode === 'quiz' && (
        <QuizMode
          cards={flashcards}
          userEmail={studentEmail}
          onComplete={(score, total) =>
            handleSessionComplete({ mode: 'quiz', score, total })
          }
        />
      )}
    </main>
  )
}
