'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters')
      return
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one letter and one number')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      // Auto sign-in after successful signup
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })

      if (result?.ok) {
        router.replace(redirect || '/home')
      } else {
        setError('Account created! Please sign in.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-10 text-center">
        <img
          src="/logo.svg"
          alt="English with Laura"
          className="h-16 mx-auto mb-3"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#cddcf0] w-full max-w-md p-8">
        <h2 className="text-xl font-bold text-[#46464b] mb-1 text-center">
          Create your account
        </h2>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Sign up to start learning English
        </p>

        <form onSubmit={handleSignUp} className="space-y-3">
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full text-sm border border-[#cddcf0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#416ebe] transition-colors text-[#46464b]"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full text-sm border border-[#cddcf0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#416ebe] transition-colors text-[#46464b]"
          />
          <input
            type="password"
            placeholder="Password (min. 10 chars, letters + numbers)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full text-sm border border-[#cddcf0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#416ebe] transition-colors text-[#46464b]"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full text-sm border border-[#cddcf0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#416ebe] transition-colors text-[#46464b]"
          />

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#cddcf0]" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-[#cddcf0]" />
        </div>

        {/* Google Sign Up */}
        <button
          onClick={() => signIn('google', { callbackUrl: redirect || '/home' })}
          className="w-full bg-white hover:bg-gray-50 text-[#46464b] font-bold py-3 rounded-lg text-sm transition-colors border-2 border-[#cddcf0] hover:border-[#416ebe] flex items-center justify-center gap-3"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign up with Google
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <button
            onClick={() => router.push('/')}
            className="text-[#416ebe] font-bold hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        englishwithlaura.com
      </p>
    </main>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    }>
      <SignUpForm />
    </Suspense>
  )
}
