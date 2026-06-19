'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/student-ui'

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
      <main className="font-rubik min-h-screen flex items-center justify-center bg-surface">
        <div className="text-sky-text text-sm">Loading…</div>
      </main>
    )
  }

  if (status === 'authenticated') {
    return null
  }

  const inputCls = 'w-full text-sm text-ink-body border border-hairline rounded-tile px-4 py-3 bg-white placeholder:text-ink-muted focus:outline-none focus:border-sky transition-colors'

  return (
    <main className="font-rubik min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-surface">
      {/* Logo */}
      <img src="/logo.svg" alt="English with Laura" className="h-16 mb-8" />

      {/* Card */}
      <div className="bg-white rounded-card shadow-sm border border-hairline w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-brandblue mb-1 text-center">Welcome 👋</h1>
        <p className="text-sm text-ink-muted mb-6 text-center">Sign in to your account</p>

        {/* Email / password */}
        <form onSubmit={handleCredentialsLogin} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputCls}
          />

          {error && <p className="text-xs text-incorrect-fg font-medium">{error}</p>}

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="text-right mt-2">
          <button
            onClick={() => router.push('/forgot-password')}
            className="text-xs text-ink-muted hover:text-sky-text transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-hairline" />
          <span className="text-xs text-ink-muted">or</span>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        {/* Google */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/home' })}
          className="w-full bg-white hover:border-sky text-ink-body font-bold py-3 rounded-tile text-sm transition-colors border-[1.5px] border-hairline flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>

        {/* Sign up */}
        <p className="text-center text-sm text-ink-muted mt-6">
          New to English with Laura?{' '}
          <button onClick={() => router.push('/signup')} className="text-sky-text font-bold hover:underline">
            Sign up
          </button>
        </p>
      </div>

      <p className="mt-6 text-xs text-ink-muted">englishwithlaura.com</p>
    </main>
  )
}
