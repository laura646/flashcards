'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !name) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail: email,
          studentName: name,
          event: 'session_start',
        }),
      })
    } catch {
      // Non-blocking — don't stop the student if email fails
    }

    sessionStorage.setItem('student_email', email)
    sessionStorage.setItem('student_name', name)
    router.push('/flashcards')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo / Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-[#00aff0]" />
          <div className="w-3 h-3 rounded-full bg-[#416ebe]" />
          <div className="w-3 h-3 rounded-full bg-[#ffeb00]" />
        </div>
        <h1 className="text-3xl font-bold text-[#416ebe] tracking-tight">
          English with Laura
        </h1>
        <p className="text-[#46464b] mt-1 text-sm">Vocabulary Flashcards</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#cddcf0] w-full max-w-md p-8">
        <h2 className="text-xl font-bold text-[#46464b] mb-1">
          Ready to practise?
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Enter your name and email to get started. Your progress will be tracked.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#46464b] mb-1">
              Your name
            </label>
            <input
              type="text"
              placeholder="e.g. Ashot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#cddcf0] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#416ebe] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#46464b] mb-1">
              Your email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#cddcf0] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#416ebe] focus:border-transparent"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !name}
            className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting...' : 'Start Flashcards →'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        englishwithlaura.com
      </p>
    </main>
  )
}
