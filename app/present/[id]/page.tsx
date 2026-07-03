'use client'

import { useEffect, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

// Full-screen presentation viewer. Teacher/superadmin only (client-side gate for
// UX; the deck itself is non-sensitive teaching material). The deck is served —
// with the correct text/html content-type — by /api/present-deck/[id], and
// rendered in a sandboxed iframe. The deck ships its own slide navigation
// (arrow keys) and bundled audio, so this is a thin wrapper.
export default function PresentPage() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const wrapRef = useRef<HTMLDivElement>(null)

  const id = params?.id
  const title = search?.get('t') || 'Presentation'
  const role = session?.user?.role
  const isStaff = role === 'superadmin' || role === 'teacher'

  useEffect(() => {
    if (status !== 'loading' && !isStaff) router.replace('/home')
  }, [status, isStaff, router])

  const toggleFullscreen = () => {
    const el = wrapRef.current
    if (!el) return
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  const exit = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    router.push('/admin/content-bank')
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#0e0d12', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', background: '#17151d', borderBottom: '1px solid #2a2833', color: '#e9e8ef' }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ fontSize: 12, color: '#a09eb0', whiteSpace: 'nowrap' }}>presentation</span>
        <span style={{ flex: 1 }} />
        <button onClick={toggleFullscreen} style={btnStyle}>⛶ Full screen</button>
        <button onClick={exit} style={btnStyle}>✕ Exit</button>
      </div>
      <div style={{ flex: 1, position: 'relative', background: '#0e0d12' }}>
        {isStaff ? (
          <iframe
            src={`/api/present-deck/${id}`}
            title={title}
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            allow="fullscreen; autoplay; encrypted-media"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#fff' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8f8da0', fontSize: 14 }}>
            Loading…
          </div>
        )}
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 13, color: '#e9e8ef', background: '#252333',
  border: '1px solid #35323f', borderRadius: 8, padding: '7px 13px', cursor: 'pointer',
}
