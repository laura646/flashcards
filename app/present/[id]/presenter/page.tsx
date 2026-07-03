'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

// Presenter view — opened in a separate window from the audience (/present/[id]).
// The teacher keeps this on their own screen (does NOT share it). It shows the
// current slide's speaker notes + the next slide, synced live over
// BroadcastChannel, and can drive prev/next on the shared deck window.
type St = { index: number; total: number; label: string; note: string; nextLabel: string; nextNote: string }

export default function PresenterPage() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const { data: session, status } = useSession()
  const bcRef = useRef<BroadcastChannel | null>(null)

  const id = params?.id
  const title = search?.get('t') || 'Presentation'
  const role = session?.user?.role
  const isStaff = role === 'superadmin' || role === 'teacher'
  const [st, setSt] = useState<St | null>(null)

  useEffect(() => {
    if (!isStaff || !id) return
    const ch = new BroadcastChannel(`present-${id}`)
    ch.onmessage = (e) => { if (e.data?.type === 'state') setSt(e.data as St) }
    ch.postMessage({ type: 'hello' })
    bcRef.current = ch
    return () => { ch.close(); bcRef.current = null }
  }, [isStaff, id])

  const nav = (dir: 'prev' | 'next') => bcRef.current?.postMessage({ type: 'nav', dir })

  return (
    <div style={page}>
      <div style={{ fontSize: 12, color: '#8a8880' }}>Presenter view — keep on your screen, don&apos;t share this window</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1f1e1c', marginTop: 2, marginBottom: 14 }}>{title}</div>

      {!isStaff ? (
        <div style={{ color: '#8a8880', fontSize: 14 }}>{status === 'loading' ? 'Loading…' : 'Not authorized.'}</div>
      ) : (
        <>
          <div style={pos}>
            {st ? `Slide ${st.index + 1} of ${st.total}` : 'Waiting for the presentation window…'}
            {st?.label ? `  ·  ${st.label}` : ''}
          </div>

          <div style={notesBox}>
            {st ? (st.note || 'No notes for this slide.') : ''}
          </div>

          {st && (st.nextLabel || st.nextNote) && (
            <div style={nextBox}>
              <div style={{ fontSize: 11, letterSpacing: '.05em', color: '#8a8880', marginBottom: 4 }}>
                NEXT{st.nextLabel ? `  ·  ${st.nextLabel}` : ''}
              </div>
              <div style={{ fontSize: 14, color: '#5f5e5a', lineHeight: 1.5 }}>{st.nextNote || '—'}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 16 }}>
            <button style={navBtn} onClick={() => nav('prev')}>‹ Prev</button>
            <button style={{ ...navBtn, flex: 1, background: '#00aff0', color: '#fff', border: '1px solid #00aff0' }} onClick={() => nav('next')}>Next ›</button>
          </div>
        </>
      )}
    </div>
  )
}

const page: React.CSSProperties = {
  position: 'fixed', inset: 0, background: '#f6f5f1', color: '#1f1e1c',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  padding: '18px 20px', display: 'flex', flexDirection: 'column',
}
const pos: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#5f5e5a', marginBottom: 10 }
const notesBox: React.CSSProperties = {
  background: '#fff', border: '1px solid #e7e5df', borderRadius: 12, padding: '16px 18px',
  fontSize: 20, lineHeight: 1.55, color: '#1f1e1c', flex: 1, overflowY: 'auto', minHeight: 120,
}
const nextBox: React.CSSProperties = { marginTop: 12, background: '#efeee9', borderRadius: 12, padding: '12px 14px' }
const navBtn: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#1f1e1c', background: '#fff',
  border: '1px solid #d8d6cf', borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
}
