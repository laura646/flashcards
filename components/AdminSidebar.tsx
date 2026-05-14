'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

// ─────────── Types ───────────

interface NavItem {
  href: string
  label: string
  icon: string
  // Custom matcher: receives (pathname, searchParams) and returns whether
  // this nav item should be highlighted.
  match: (pathname: string, view: string | null) => boolean
}

// ─────────── Nav config ───────────
// Primary nav (above the divider). Order matters — what teachers
// hit most often goes near the top.
//
// Note: "My Courses" and "My Students" both live on the /admin page
// (legacy tabbed) until we extract them into proper /admin/courses
// and /admin/students routes. The sidebar distinguishes via the
// ?view=students query param.
const PRIMARY_NAV: NavItem[] = [
  {
    href: '/admin',
    label: 'My Courses',
    icon: '📚',
    match: (p, v) => p === '/admin' && v !== 'students',
  },
  {
    href: '/admin?view=students',
    label: 'My Students',
    icon: '👥',
    match: (p, v) => p === '/admin' && v === 'students',
  },
  {
    href: '/admin/lessons',
    label: 'Lessons',
    icon: '📖',
    match: (p) => p?.startsWith('/admin/lessons') ?? false,
  },
  {
    href: '/admin/attendance',
    label: 'Attendance',
    icon: '✅',
    match: (p) => p?.startsWith('/admin/attendance') ?? false,
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: '📊',
    match: (p) => p?.startsWith('/admin/reports') ?? false,
  },
  {
    href: '/admin/content-bank',
    label: 'Content Bank',
    icon: '🗃️',
    match: (p) => p?.startsWith('/admin/content-bank') ?? false,
  },
]

// Superadmin items (below the divider, only shown to superadmins)
const SUPERADMIN_NAV: NavItem[] = [
  {
    href: '/superadmin',
    label: 'Superadmin',
    icon: '🛡️',
    match: (p) => p?.startsWith('/superadmin') ?? false,
  },
]

// ─────────── Component ───────────

export default function AdminSidebar() {
  // useSearchParams must be wrapped in Suspense per Next 14+ rules
  return (
    <Suspense fallback={<aside className="hidden md:block fixed top-0 left-0 bottom-0 w-[240px] bg-white border-r border-[#e6f0fa]" />}>
      <AdminSidebarInner />
    </Suspense>
  )
}

function AdminSidebarInner() {
  const { data: session } = useSession()
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const currentView = searchParams?.get('view') ?? null
  const [mobileOpen, setMobileOpen] = useState(false)

  const role = session?.user?.role
  const isSuperadmin = role === 'superadmin'
  const userName = session?.user?.name || session?.user?.email || ''
  const userEmail = session?.user?.email || ''

  // Auto-close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, currentView])

  const isActive = (item: NavItem) => item.match(pathname, currentView)

  // Inner nav content reused for both desktop sidebar and mobile drawer
  const NavList = (
    <>
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-[#416ebe] text-white font-bold'
                      : 'text-[#46464b] hover:bg-[#e6f0fa] hover:text-[#416ebe]'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
        {isSuperadmin && (
          <>
            <div className="mx-4 my-3 border-t border-[#e6f0fa]" />
            <ul className="space-y-0.5 px-2">
              {SUPERADMIN_NAV.map((item) => {
                const active = isActive(item)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-amber-500 text-white font-bold'
                          : 'text-[#46464b] hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </nav>

      {/* User block at the bottom */}
      <div className="border-t border-[#e6f0fa] p-3">
        <p className="text-sm font-bold text-[#46464b] truncate" title={userName}>
          {userName}
        </p>
        <p className="text-[10px] text-gray-400 truncate" title={userEmail}>
          {userEmail}
        </p>
        <p className="text-[10px] text-gray-400 mt-1 capitalize">
          {role || 'guest'}
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="mt-3 w-full text-left text-xs text-[#416ebe] font-bold hover:underline"
        >
          ↪ Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ─── Mobile hamburger button (visible < md) ─── */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="md:hidden fixed top-3 left-3 z-40 bg-white border border-[#cddcf0] rounded-lg w-9 h-9 flex items-center justify-center shadow-sm text-[#416ebe]"
      >
        <span className="text-lg">☰</span>
      </button>

      {/* ─── Mobile drawer (slides in from left) ─── */}
      {mobileOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setMobileOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/40"
          />
          {/* Drawer */}
          <aside
            className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-[260px] bg-white border-r border-[#e6f0fa] flex flex-col shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e6f0fa]">
              <Link
                href="/admin/courses"
                className="font-bold text-[#416ebe] text-sm flex items-center gap-2"
              >
                <span>✨</span> EwL Admin
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#416ebe]"
              >
                ✕
              </button>
            </div>
            {NavList}
          </aside>
        </>
      )}

      {/* ─── Desktop sidebar (>= md) ─── */}
      <aside className="hidden md:flex md:flex-col fixed top-0 left-0 bottom-0 w-[240px] bg-white border-r border-[#e6f0fa] z-30">
        <div className="px-4 py-4 border-b border-[#e6f0fa]">
          <Link
            href="/admin/courses"
            className="font-bold text-[#416ebe] text-base flex items-center gap-2"
          >
            <span>✨</span> EwL Admin
          </Link>
        </div>
        {NavList}
      </aside>
    </>
  )
}
