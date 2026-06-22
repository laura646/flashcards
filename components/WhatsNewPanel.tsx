'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Dismissible "What's new" banner shown at the top of /admin/courses.
// Bump the VERSION constant when you ship a new round of changes —
// users who dismissed the previous version will see the next one again.

const VERSION = 'v1.1.0'
const STORAGE_KEY = `whatsNew:${VERSION}:dismissed`

interface WhatsNewItem {
  icon: string
  title: string
  description: string
  href?: string
  hrefLabel?: string
}

const ITEMS: WhatsNewItem[] = [
  {
    icon: '🧭',
    title: 'New sidebar nav',
    description: 'Persistent left-side navigation across every admin page. Hamburger menu on mobile.',
  },
  {
    icon: '📊',
    title: 'Reports rebuild + heatmap + AI summary',
    description: 'Per-course scoping, latest+best scores, attendance %, streak, skill breakdown, CEFR performance, plus a class heatmap and an AI-generated 2-3 sentence summary.',
    href: '/admin/reports',
    hrefLabel: 'Open Reports',
  },
  {
    icon: '✅',
    title: 'Attendance UI',
    description: 'Mark Present / Absent / Late / Excused per student per lesson. Notes, audit trail, "Mark all present" shortcut.',
    href: '/admin/attendance',
    hrefLabel: 'Open Attendance',
  },
  {
    icon: '📝',
    title: 'Tests with strict single-attempt',
    description: 'Tag exercises as Review / Mid-course / End-of-course tests. Students get one shot. Teachers can reset attempts.',
  },
  {
    icon: '🗒️',
    title: 'Teacher notes per student',
    description: 'Dated log with 5 tag categories (homework, behaviour, parent contact, academic concern, general). Private to teachers + superadmin.',
  },
  {
    icon: '❓',
    title: 'Help & Docs',
    description: 'A new documentation page covering every admin feature with mockups, tips, and FAQs.',
    href: '/admin/help',
    hrefLabel: 'Open Help',
  },
]

export default function WhatsNewPanel() {
  // Default to true so it doesn't flash open during SSR/hydration. We
  // flip to false on mount if it hasn't been dismissed.
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      const flag = localStorage.getItem(STORAGE_KEY)
      if (flag !== 'true') setDismissed(false)
    } catch {
      // localStorage might be unavailable (e.g. private mode); just show it
      setDismissed(false)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="bg-gradient-to-br from-[#e6f0fa] via-white to-amber-50 border border-[#cddcf0] rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider">What&apos;s new — {VERSION}</p>
          <h2 className="text-base font-bold text-[#46464b] mt-0.5">A bunch of new things shipped recently 🎉</h2>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-gray-300 hover:text-gray-500 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      <ul className="space-y-2">
        {ITEMS.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#46464b]">{item.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {item.description}
                {item.href && (
                  <>
                    {' '}
                    <Link href={item.href} className="text-[#416ebe] hover:underline font-bold">
                      {item.hrefLabel || 'Open'} →
                    </Link>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 pt-3 border-t border-[#cddcf0]/60 flex items-center justify-between">
        <Link
          href="/admin/help#whats-new"
          className="text-[11px] text-[#416ebe] font-bold hover:underline"
        >
          See the full changelog in Help &amp; Docs →
        </Link>
        <button
          onClick={dismiss}
          className="text-[11px] text-gray-400 hover:text-gray-600 font-bold"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
