'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
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
  // Which unread-notification count drives this item's count badge (if any).
  badgeKey?: 'course_new' | 'student_new'
}

// Shape returned by GET /api/admin?action=badge-counts
interface BadgeCounts {
  course_new: number
  student_new: number
}

// ─────────── Nav config ───────────
// Primary nav (above the divider). Order matters — what teachers
// hit most often goes near the top.
//
// My Courses and My Students now have their own clean routes
// (/admin/courses and /admin/students). The detail-level routes
// (/admin/courses/[id] and /admin/students/[email]) currently redirect
// to /admin?courseDetail=… / ?studentDetail=… so the legacy detail
// views keep working. The matcher accounts for either landing spot.
// SWITCHED to the 10B redesign at /admin-beta/* (all 7 teacher pages now have
// new versions). Active-match checks the /admin-beta/* path; also still matches
// the old /admin/* path so the highlight is correct if a legacy route is hit.
const PRIMARY_NAV: NavItem[] = [
  {
    href: '/admin-beta/courses',
    label: 'My Courses',
    icon: '📚',
    badgeKey: 'course_new',
    match: (p, v) =>
      (p?.startsWith('/admin-beta/courses') ?? false) ||
      (p?.startsWith('/admin/courses') ?? false) ||
      (p === '/admin' && v !== 'students'),
  },
  {
    href: '/admin-beta/students',
    label: 'My Students',
    icon: '👥',
    badgeKey: 'student_new',
    match: (p, v) =>
      (p?.startsWith('/admin-beta/students') ?? false) ||
      (p?.startsWith('/admin/students') ?? false) ||
      (p === '/admin' && v === 'students'),
  },
  {
    href: '/admin-beta/lessons',
    label: 'My Library',
    icon: '📖',
    match: (p) =>
      (p?.startsWith('/admin-beta/lessons') ?? false) ||
      (p?.startsWith('/admin/lessons') ?? false),
  },
  {
    href: '/admin-beta/attendance',
    label: 'Attendance',
    icon: '✅',
    match: (p) =>
      (p?.startsWith('/admin-beta/attendance') ?? false) ||
      (p?.startsWith('/admin/attendance') ?? false),
  },
  {
    href: '/admin-beta/reports',
    label: 'Reports',
    icon: '📊',
    match: (p) =>
      (p?.startsWith('/admin-beta/reports') ?? false) ||
      (p?.startsWith('/admin/reports') ?? false),
  },
  {
    href: '/admin-beta/content-bank',
    label: 'School Library',
    icon: '🗃️',
    match: (p) =>
      (p?.startsWith('/admin-beta/content-bank') ?? false) ||
      (p?.startsWith('/admin/content-bank') ?? false),
  },
  {
    href: '/admin-beta/help',
    label: 'Help & Docs',
    icon: '❓',
    match: (p) =>
      (p?.startsWith('/admin-beta/help') ?? false) ||
      (p?.startsWith('/admin/help') ?? false),
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

  // ── Notification badge counts ──
  // Unread counts per type for the current user, surfaced as pills on the
  // "My Courses" / "My Students" nav items. Resilient: any failure leaves
  // counts at 0 (no badge) — the sidebar must never crash on a bad fetch.
  const [badges, setBadges] = useState<BadgeCounts>({ course_new: 0, student_new: 0 })
  // Tracks which sections we've already cleared this navigation so the
  // mark-read POST only fires once per entry into a page (not every render).
  const clearedRef = useRef<Set<'courses' | 'students'>>(new Set())

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/admin?action=badge-counts')
      if (!res.ok) return
      const data = (await res.json()) as Partial<BadgeCounts>
      setBadges({
        course_new: Number(data?.course_new) || 0,
        student_new: Number(data?.student_new) || 0,
      })
    } catch {
      // Swallow — show no badge rather than break the sidebar.
    }
  }, [])

  // Fetch on mount and whenever the route changes.
  useEffect(() => {
    fetchBadges()
  }, [fetchBadges, pathname])

  // Auto-close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, currentView])

  // Clear-on-open: when the user lands on /admin-beta/courses (or /students),
  // mark that section's notifications read and zero its badge locally. Guarded
  // by clearedRef so it only fires once per entry; the guard resets when the
  // user navigates away so re-entering clears again.
  useEffect(() => {
    const onCourses = pathname?.startsWith('/admin-beta/courses') ?? false
    const onStudents = pathname?.startsWith('/admin-beta/students') ?? false

    const markRead = async (section: 'courses' | 'students') => {
      if (clearedRef.current.has(section)) return
      clearedRef.current.add(section)
      // Zero the badge immediately for snappy UX.
      setBadges((prev) =>
        section === 'courses'
          ? { ...prev, course_new: 0 }
          : { ...prev, student_new: 0 }
      )
      try {
        await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark-read', section }),
        })
      } catch {
        // Best-effort — local badge is already cleared.
      }
    }

    if (onCourses) markRead('courses')
    else clearedRef.current.delete('courses')

    if (onStudents) markRead('students')
    else clearedRef.current.delete('students')
  }, [pathname])

  const isActive = (item: NavItem) => item.match(pathname, currentView)

  const badgeCount = (item: NavItem): number =>
    item.badgeKey ? badges[item.badgeKey] : 0

  // Inner nav content reused for both desktop sidebar and mobile drawer
  const NavList = (
    <>
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item)
            const count = badgeCount(item)
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
                  {count > 0 && (
                    <span
                      className="ml-auto bg-sky text-white text-[11px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
                      aria-label={`${count} unread`}
                    >
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
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
                href="/admin-beta/courses"
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
            href="/admin-beta/courses"
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
