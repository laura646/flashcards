'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!token || !email) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#cddcf0] w-full max-w-md p-8 text-center">
          <h2 className="text-lg font-bold text-[#46464b] mb-2">Invalid Reset Link</h2>
          <p className="text-sm text-gray-500 mb-4">This password reset link is invalid or has expired.</p>
          <button
            onClick={() => router.push('/forgot-password')}
            className="text-sm text-[#416ebe] font-bold hover:underline"
          >
            Request a new link
          </button>
        </div>
      </main>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
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
        {success ? (
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-[#46464b] mb-2">Password reset!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-lg text-sm transition-colors"
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-[#46464b] mb-1 text-center">
              Set a new password
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="password"
                placeholder="New password (min. 10 chars, letters + numbers)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full text-sm border border-[#cddcf0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#416ebe] transition-colors text-[#46464b]"
              />
              <input
                type="password"
                placeholder="Confirm new password"
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
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        englishwithlaura.com
      </p>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
