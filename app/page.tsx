'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home')
    }
  }, [status, router])

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else if (result?.ok) {
      router.replace('/home')
    }
  }

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    )
  }

  if (status === 'authenticated') {
    return null
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo / Header */}
      <div className="mb-10 text-center">
        <img
          src="/logo.svg"
          alt="English with Laura"
          className="h-16 mx-auto mb-3"
        />
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#cddcf0] w-full max-w-md p-8">
        <h2 className="text-xl font-bold text-[#46464b] mb-1 text-center">
          Welcome back
        </h2>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Sign in to continue learning
        </p>

        {/* Email/Password Form */}
        <form onSubmit={handleCredentialsLogin} className="space-y-3">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full text-sm border border-[#cddcf0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#416ebe] transition-colors text-[#46464b]"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full text-sm border border-[#cddcf0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#416ebe] transition-colors text-[#46464b]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="text-right mt-2">
          <button
            onClick={() => router.push('/forgot-password')}
            className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#cddcf0]" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-[#cddcf0]" />
        </div>

        {/* Google Sign In */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/home' })}
          className="w-full bg-white hover:bg-gray-50 text-[#46464b] font-bold py-3 rounded-lg text-sm transition-colors border-2 border-[#cddcf0] hover:border-[#416ebe] flex items-center justify-center gap-3"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>

        {/* Sign Up Link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <button
            onClick={() => router.push('/signup')}
            className="text-[#416ebe] font-bold hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        englishwithlaura.com
      </p>
    </main>
  )
}
