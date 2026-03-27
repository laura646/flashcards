'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { exercises, Exercise } from '@/data/exercises'
import ExerciseRunner from '@/components/ExerciseRunner'

export default function ExercisesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set())

  const studentName = session?.user?.name?.split(' ')[0] || 'Student'
  const studentEmail = session?.user?.email || ''

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
      return
    }

    if (status === 'authenticated' && session?.user?.email) {
      // Load completed exercises from Supabase
      fetch(`/api/progress?email=${encodeURIComponent(session.user.email)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.progress) {
            const exerciseCompletedIds = new Set<number>(
              data.progress
                .filter((p: { activity_type: string }) => p.activity_type === 'exercise')
                .map((p: { activity_id: string }) => parseInt(p.activity_id, 10))
            )
            setCompletedIds(exerciseCompletedIds)
          }
        })
        .catch(() => {
          // Non-blocking
        })
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    )
  }

  if (status === 'unauthenticated') return null

  const handleComplete = async (score: number, total: number) => {
    if (!selectedExercise) return

    // Mark as completed locally
    const newCompleted = new Set(completedIds)
    newCompleted.add(selectedExercise.id)
    setCompletedIds(newCompleted)

    // Save to Supabase
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: studentEmail,
          activity_type: 'exercise',
          activity_id: String(selectedExercise.id),
          score,
          total,
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
          event: 'exercise_complete',
          exerciseTitle: selectedExercise.title,
          score,
          total,
        }),
      })
    } catch {
      // Non-blocking
    }
  }

  // Exercise selector view
  if (!selectedExercise) {
    const completedCount = completedIds.size

    return (
      <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/home')}
            className="text-sm text-gray-400 hover:text-[#416ebe] transition-colors"
          >
            &larr; Home
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#416ebe]">Practice Exercises</h1>
            <p className="text-xs text-gray-400">Hi, {studentName}! Choose an exercise.</p>
          </div>
          {completedCount > 0 && (
            <span className="text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full font-bold">
              {completedCount}/{exercises.length} done
            </span>
          )}
        </div>

        {/* Exercise cards */}
        <div className="flex flex-col gap-3">
          {exercises.map((ex) => {
            const isDone = completedIds.has(ex.id)
            return (
              <button
                key={ex.id}
                onClick={() => setSelectedExercise(ex)}
                className={`bg-white rounded-2xl border-2 p-5 text-left transition-all group flex items-center gap-4 ${
                  isDone
                    ? 'border-green-300 hover:border-green-400'
                    : 'border-[#cddcf0] hover:border-[#416ebe]'
                }`}
              >
                <div className="text-3xl">{isDone ? '\u2705' : ex.icon}</div>
                <div className="flex-1">
                  <h3 className={`text-sm font-bold group-hover:text-[#3560b0] ${
                    isDone ? 'text-green-600' : 'text-[#416ebe]'
                  }`}>
                    {ex.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isDone ? 'Completed \u2014 tap to redo' : ex.subtitle}
                  </p>
                </div>
                <div className={`text-xs px-2.5 py-1 rounded-full ${
                  isDone
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-300 bg-[#e6f0fa]'
                }`}>
                  {isDone ? 'Done' : `${ex.questions.length} Qs`}
                </div>
              </button>
            )
          })}
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          englishwithlaura.com
        </p>
      </main>
    )
  }

  // Exercise runner view
  return (
    <main className="min-h-screen flex flex-col px-4 py-8 max-w-2xl mx-auto">
      <ExerciseRunner
        exercise={selectedExercise}
        onComplete={handleComplete}
        onBack={() => setSelectedExercise(null)}
      />
    </main>
  )
}
