import Link from 'next/link'

// Launch hardening: branded 404 so mistyped / stale links (e.g. from an old
// email) land somewhere friendly instead of the default Next.js page.
export default function NotFound() {
  return (
    <main className="font-rubik min-h-screen bg-surface flex flex-col items-center justify-center text-center px-6">
      <div className="text-5xl mb-4" aria-hidden="true">🧭</div>
      <h1 className="text-2xl font-bold text-brandblue mb-2">Page not found</h1>
      <p className="text-sm text-ink-muted max-w-sm mb-6">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="text-sm font-extrabold text-white bg-sky hover:bg-[#0099d6] px-5 py-3 rounded-tile transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
      >
        Go to sign in
      </Link>
    </main>
  )
}
