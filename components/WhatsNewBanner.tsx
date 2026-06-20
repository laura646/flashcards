'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Dismissable announcement banner shown across admin pages once per
// release. Dismissal lives in localStorage, keyed by the release tag
// below. To re-announce on the next release, bump the version constant
// — every browser sees the banner again the next time they load any
// /admin page.

const RELEASE = 'v1.2.0'
const STORAGE_KEY = `whats-new-dismissed:${RELEASE}`

export default function WhatsNewBanner() {
  // Start hidden to avoid an SSR/client mismatch flash.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') setVisible(true)
    } catch {
      // localStorage blocked (e.g. private mode) — just show every time.
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* best-effort only */
    }
  }

  if (!visible) return null

  return (
    <div className="mx-4 mt-3 mb-1 md:mx-6 md:mt-4">
      <div className="bg-gradient-to-r from-[#e6f0fa] to-white border border-[#cddcf0] rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm">
        <span className="text-xl shrink-0 leading-none mt-0.5">✨</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#416ebe]">
            What&apos;s new — {RELEASE}
          </p>
          <p className="text-xs text-[#46464b] mt-0.5 leading-relaxed">
            <span className="font-bold">🎙 Speak to AI</span> — students can now talk to the
            dialogue partner with a real mic + hear replies out loud. New{' '}
            <span className="font-bold">AI Reading</span> + <span className="font-bold">AI Grammar</span>{' '}
            rich forms, automatic <span className="font-bold">CEFR-level adaptation</span>,{' '}
            <span className="font-bold">per-block publish toggle</span>, editable course invite
            codes, Telegram lesson notifications, and a much cheaper TTS backend.{' '}
            <Link
              href="/admin-beta/help#whats-new"
              className="text-[#416ebe] font-bold hover:underline"
            >
              See all updates →
            </Link>
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-gray-400 hover:text-[#46464b] shrink-0 text-lg leading-none px-1"
          aria-label="Dismiss"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
