'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })

    setSent(true)
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
        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-3">✉️</div>
            <h2 className="text-xl font-bold text-[#46464b] mb-2">Check your email</h2>
            <p className="text-sm text-gray-500 mb-6">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
            </p>
            <button
              onClick={() => router.push('/')}
              className="text-sm text-[#416ebe] font-bold hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-[#46464b] mb-1 text-center">
              Forgot your password?
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full text-sm border border-[#cddcf0] rounded-lg px-4 py-3 focus:outline-none focus:border-[#416ebe] transition-colors text-[#46464b]"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              <button
                onClick={() => router.push('/')}
                className="text-[#416ebe] font-bold hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        englishwithlaura.com
      </p>
    </main>
  )
}
