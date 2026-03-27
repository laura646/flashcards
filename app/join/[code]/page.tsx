'use client'

import { useEffect, useState, use } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [courseName, setCourseName] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [enrolled, setEnrolled] = useState(false)

  // Fetch course info by invite code
  useEffect(() => {
    fetch(`/api/join?code=${encodeURIComponent(code)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setCourseName(data.course_name)
        }
      })
      .catch(() => setError('Failed to load course info'))
  }, [code])

  // Auto-enroll when authenticated
  useEffect(() => {
    if (status === 'authenticated' && courseName && !enrolled && !enrolling) {
      setEnrolling(true)
      fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error)
          } else {
            setEnrolled(true)
            // Redirect to home after 2 seconds
            setTimeout(() => router.push('/home'), 2000)
          }
          setEnrolling(false)
        })
        .catch(() => {
          setError('Failed to enroll')
          setEnrolling(false)
        })
    }
  }, [status, courseName, enrolled, enrolling, code, router])

  // Error state
  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#cddcf0] w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-lg font-bold text-[#46464b] mb-2">Oops!</h2>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-sm text-[#416ebe] hover:underline"
          >
            Go to home page
          </button>
        </div>
      </main>
    )
  }

  // Loading course info
  if (!courseName) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    )
  }

  // Success - enrolled
  if (enrolled) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#cddcf0] w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-lg font-bold text-[#416ebe] mb-2">You&apos;re in!</h2>
          <p className="text-sm text-gray-500">
            You&apos;ve been enrolled in <strong>{courseName}</strong>.
          </p>
          <p className="text-xs text-gray-400 mt-2">Redirecting to your lessons...</p>
        </div>
      </main>
    )
  }

  // Enrolling in progress
  if (status === 'authenticated' && enrolling) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Enrolling you in {courseName}...</div>
      </main>
    )
  }

  // Not signed in - show sign in prompt
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <img
          src="/logo.svg"
          alt="English with Laura"
          className="h-16 mx-auto mb-3"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#cddcf0] w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-3">📚</div>
        <h2 className="text-lg font-bold text-[#46464b] mb-1">
          Join {courseName}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Sign in with your Google account to join this course.
        </p>

        <button
          onClick={() => signIn('google', { callbackUrl: `/join/${code}` })}
          className="w-full bg-white hover:bg-gray-50 text-[#46464b] font-bold py-3 rounded-lg text-sm transition-colors border-2 border-[#cddcf0] hover:border-[#416ebe] flex items-center justify-center gap-3"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>
      </div>

      <p className="mt-6 text-xs text-gray-400">englishwithlaura.com</p>
    </main>
  )
}
