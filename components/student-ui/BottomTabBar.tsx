'use client'

// Student-app "10B" bottom tab bar (brief §1). Pinned bottom, hairline
// top border. Active tab = sky; inactive label = #6b7280 (AA-legible).
//
// Tabs route ONLY to real-content destinations: Home (the course/lesson
// hub) and Vocabulary (the SRS trainer over the student's own words).
// The earlier /flashcards + /exercises tabs were removed — they render
// STATIC DEMO decks, not the student's course, so routing primary nav
// there was misleading. Whether more top-level sections belong here is a
// deliberate IA question (pending usage instrumentation), not a default.

import { usePathname, useRouter } from 'next/navigation'

interface Tab {
  label: string
  href: string
  icon: (active: boolean) => React.ReactNode
}

const stroke = (active: boolean) => (active ? '#00aff0' : '#c8ccd4')

const TABS: Tab[] = [
  {
    label: 'Home',
    href: '/home',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 12 3l9 6.5" /><path d="M5 9v11h14V9" />
      </svg>
    ),
  },
  {
    label: 'Vocabulary',
    href: '/vocabulary',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(a)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M19 17H6a2 2 0 0 0-2 2" />
      </svg>
    ),
  },
]

export default function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-hairline pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
            >
              {tab.icon(active)}
              <span className={`text-[10px] font-bold ${active ? 'text-sky' : 'text-[#6b7280]'}`}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
