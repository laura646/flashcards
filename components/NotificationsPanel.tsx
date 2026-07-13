'use client'

// ─────────────────────────────────────────────────────────────────
// Notifications bell + dropdown panel (P3.5).
//
// Lists the current user's recent notifications (read AND unread, so the detail
// survives the sidebar's clear-on-open badge behaviour). Clicking an item marks
// it read and jumps to the relevant course (→ the Progress tab shows the flagged
// students). "Mark all read" clears everything. Resilient: any fetch failure
// leaves the bell quiet — it must never crash the sidebar.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Notif {
  id: string
  type: string
  course_id: string | null
  student_email: string | null
  title: string
  read_at: string | null
  created_at: string
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

const Bell = (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

export default function NotificationsPanel() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/admin?action=notifications-list')
      if (!res.ok) return
      const d = await res.json()
      setItems(Array.isArray(d?.notifications) ? d.notifications : [])
      setUnread(Number(d?.unread) || 0)
      setLoaded(true)
    } catch {
      /* keep quiet */
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => {
    const iv = setInterval(fetchList, 60000)
    return () => clearInterval(iv)
  }, [fetchList])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggle = () => { const next = !open; setOpen(next); if (next) fetchList() }

  const openItem = (n: Notif) => {
    setOpen(false)
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      setUnread((u) => Math.max(0, u - 1))
      fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notification-read', id: n.id }) }).catch(() => {})
    }
    if (n.course_id) router.push(`/admin/courses/${n.course_id}`)
  }

  const markAll = () => {
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })))
    setUnread(0)
    fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notifications-read-all' }) }).catch(() => {})
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative w-9 h-9 flex items-center justify-center rounded-[10px] text-[#5a6577] hover:bg-[#dcf1fb] hover:text-[#0090c9] transition-colors"
      >
        {Bell}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ff5964] text-white text-[10px] font-black flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[320px] max-w-[calc(100vw-2rem)] bg-white rounded-[14px] border border-[#e2e9f2] shadow-[0_12px_34px_rgba(20,30,55,0.16)] z-[60] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#eef2f8]">
            <span className="text-[13px] font-bold text-[#2c3a52]">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11.5px] font-semibold text-[#0090c9] hover:underline">Mark all read</button>
            )}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {!loaded ? (
              <div className="px-4 py-8 text-center text-[12.5px] text-[#8a93a3]">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-[13px] font-semibold text-[#2c3a52]">You're all caught up</div>
                <div className="text-[12px] text-[#8a93a3] mt-1">New alerts about your courses and students show up here.</div>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left flex items-start gap-2.5 px-4 py-2.5 border-b border-[#f4f6f9] last:border-b-0 transition-colors hover:bg-[#f4f9fe] ${n.read_at ? '' : 'bg-[#f0f9ff]'}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-[#00aff0]'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[12.5px] leading-snug ${n.read_at ? 'text-[#5a6577]' : 'text-[#2c3a52] font-semibold'}`}>{n.title}</span>
                    <span className="block text-[11px] text-[#a0a9b8] mt-0.5">{timeAgo(n.created_at)}{n.course_id ? ' · open course' : ''}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
