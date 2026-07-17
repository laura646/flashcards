'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

// Full-screen presentation viewer (the "audience" window — this is what the
// teacher screen-shares). Teacher/superadmin only. The deck is served with the
// correct text/html content-type by /api/present-deck/[id] and rendered in a
// sandboxed iframe (it ships its own slide nav + bundled audio).
//
// Presenter view: this window also broadcasts the current slide + speaker notes
// to a separate presenter window (BroadcastChannel, same origin) and accepts
// prev/next commands from it. Notes live on each rendered <section> as
// data-speaker-notes (data-label = slide title).
export default function PresentPage() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const wrapRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Deck descriptor: html (proxied iframe + presenter notes), pdf (native
  // browser viewer), or slides (this tab hands over to Google Slides).
  const [meta, setMeta] = useState<{ kind: 'html' | 'pdf' | 'slides'; url: string } | null>(null)

  const id = params?.id
  const title = search?.get('t') || 'Presentation'
  const role = session?.user?.role
  const isStaff = role === 'superadmin' || role === 'teacher'

  useEffect(() => {
    if (status !== 'loading' && !isStaff) router.replace('/home')
  }, [status, isStaff, router])

  useEffect(() => {
    if (!isStaff || !id) return
    let cancelled = false
    fetch(`/api/present-deck/${id}?meta=1`)
      .then((r) => r.json())
      .then((m) => {
        if (cancelled || !m?.kind) return
        if (m.kind === 'slides') {
          // Google's viewer takes over this (already new) tab.
          window.location.replace(m.url)
          return
        }
        setMeta(m)
      })
      .catch(() => { if (!cancelled) setMeta({ kind: 'html', url: `/api/present-deck/${id}` }) })
    return () => { cancelled = true }
  }, [isStaff, id])

  useEffect(() => {
    // Slide-sync + presenter notes only exist for HTML decks.
    if (!isStaff || !id || meta?.kind !== 'html') return
    const bc = new BroadcastChannel(`present-${id}`)
    let lastIndex = -1

    const readSections = () => {
      const ifr = iframeRef.current
      const doc = ifr?.contentDocument
      const win = ifr?.contentWindow
      if (!doc || !win) return null
      const secs = Array.from(doc.querySelectorAll('section'))
      if (!secs.length) return null
      let vis = -1
      secs.forEach((s, i) => {
        const cs = win.getComputedStyle(s)
        if (!(cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0)) vis = i
      })
      if (vis < 0) vis = 0
      const at = (i: number) => {
        const s = secs[i]
        return { label: s?.getAttribute('data-label') || '', note: s?.getAttribute('data-speaker-notes') || '' }
      }
      return { index: vis, total: secs.length, cur: at(vis), next: at(vis + 1) }
    }

    const broadcast = (force: boolean) => {
      const st = readSections()
      if (!st) return
      if (!force && st.index === lastIndex) return
      lastIndex = st.index
      bc.postMessage({
        type: 'state', index: st.index, total: st.total,
        label: st.cur.label, note: st.cur.note,
        nextLabel: st.next.label, nextNote: st.next.note,
      })
    }

    const nav = (dir: string) => {
      // The deck listens on its document AND window; dispatch to only ONE
      // (document) so each command advances exactly one slide.
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const key = dir === 'prev' ? 'ArrowLeft' : 'ArrowRight'
      doc.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      setTimeout(() => broadcast(true), 60)
    }

    bc.onmessage = (e) => {
      const m = e.data
      if (m?.type === 'hello') broadcast(true)
      else if (m?.type === 'nav') nav(m.dir)
    }

    const iv = setInterval(() => broadcast(false), 300)
    return () => { clearInterval(iv); bc.close() }
  }, [isStaff, id, meta])

  const openPresenter = () => {
    window.open(`/present/${id}/presenter?t=${encodeURIComponent(title)}`, `presenter-${id}`, 'width=560,height=740')
  }

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
    <div ref={wrapRef} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#0e0d12', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', background: '#17151d', borderBottom: '1px solid #2a2833', color: '#e9e8ef' }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ fontSize: 12, color: '#a09eb0', whiteSpace: 'nowrap' }}>{meta?.kind === 'pdf' ? 'PDF presentation' : 'presentation'}</span>
        <span style={{ flex: 1 }} />
        {meta?.kind === 'html' && (
          <button onClick={openPresenter} style={btnStyle}>▤ Presenter view</button>
        )}
        <button onClick={toggleFullscreen} style={btnStyle}>⛶ Full screen</button>
        <button onClick={exit} style={btnStyle}>✕ Exit</button>
      </div>
      <div style={{ flex: 1, position: 'relative', background: '#0e0d12' }}>
        {isStaff && meta?.kind === 'pdf' ? (
          <iframe
            src={meta.url}
            title={title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#525659' }}
          />
        ) : isStaff && meta?.kind === 'html' ? (
          <iframe
            ref={iframeRef}
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
