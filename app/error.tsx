'use client'

import Link from 'next/link'

// Launch hardening: branded error boundary so an unexpected crash shows a
// friendly recover-or-go-home screen instead of a blank/default error.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="font-rubik min-h-screen bg-surface flex flex-col items-center justify-center text-center px-6">
      <div className="text-5xl mb-4" aria-hidden="true">😕</div>
      <h1 className="text-2xl font-bold text-brandblue mb-2">Something went wrong</h1>
      <p className="text-sm text-ink-muted max-w-sm mb-6">
        Sorry — an unexpected error occurred. Try again, or head back home.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="text-sm font-extrabold text-white bg-sky hover:bg-[#0099d6] px-5 py-3 rounded-tile transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-sm font-bold text-sky-text border border-sky-border px-5 py-3 rounded-tile hover:bg-sky-wash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
        >
          Home
        </Link>
      </div>
    </main>
  )
}
