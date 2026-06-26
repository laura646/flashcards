'use client'

import { useState, useEffect, useRef, useCallback, Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

// ─────────── Types ───────────

interface NavItem {
  href: string
  label: string
  icon: ReactNode
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

// ─────────── Icons ───────────
// 20×20 line icons, stroke=currentColor so they inherit the nav item's text
// colour (white when active, slate when inactive). Paths supplied by Laura's
// new design export.

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const IconCourses = (
  <svg {...iconProps}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const IconStudents = (
  <svg {...iconProps}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconLibrary = (
  <svg {...iconProps}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)

const IconReports = (
  <svg {...iconProps}>
    <path d="M3 3v18h18" />
    <rect x="7" y="12" width="3" height="6" rx="1" />
    <rect x="12" y="8" width="3" height="10" rx="1" />
    <rect x="17" y="4" width="3" height="14" rx="1" />
  </svg>
)

const IconSchoolLibrary = (
  <svg {...iconProps}>
    <path d="M3 21h18" />
    <path d="M5 21V8l7-5 7 5v13" />
    <path d="M9 21v-6h6v6" />
  </svg>
)

const IconHelp = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
)

const IconSuperadmin = (
  <svg {...iconProps}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const IconLogout = (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

// ─────────── Nav config ───────────
// Two groups now (TEACHING / MANAGE) per Laura's new design — same destinations
// as before, just regrouped by meaning. Hrefs and matchers are UNCHANGED.
//
// My Courses and My Students have their own clean routes
// (/admin/courses and /admin/students). Detail-level routes still
// redirect via /admin?courseDetail=… / ?studentDetail=… so the matcher accounts
// for either landing spot. Active-match also still matches the legacy /admin/*
// path so the highlight is correct if a legacy route is hit.

// TEACHING group: My Courses, My Students, My Library, Attendance
const TEACHING_NAV: NavItem[] = [
  {
    href: '/admin/courses',
    label: 'My Courses',
    icon: IconCourses,
    badgeKey: 'course_new',
    match: (p, v) =>
      (p?.startsWith('/admin/courses') ?? false) ||
      (p?.startsWith('/admin/courses') ?? false) ||
      (p === '/admin' && v !== 'students'),
  },
  {
    href: '/admin/students',
    label: 'My Students',
    icon: IconStudents,
    badgeKey: 'student_new',
    match: (p, v) =>
      (p?.startsWith('/admin/students') ?? false) ||
      (p?.startsWith('/admin/students') ?? false) ||
      (p === '/admin' && v === 'students'),
  },
  {
    href: '/admin/lessons',
    label: 'My Library',
    icon: IconLibrary,
    match: (p) =>
      (p?.startsWith('/admin/lessons') ?? false) ||
      (p?.startsWith('/admin/lessons') ?? false),
  },
]

// MANAGE group: Reports, School Library, Help & Docs, Superadmin
// Superadmin is appended at render time only when role === 'superadmin'.
const MANAGE_NAV: NavItem[] = [
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: IconReports,
    match: (p) =>
      (p?.startsWith('/admin/reports') ?? false) ||
      (p?.startsWith('/admin/reports') ?? false),
  },
  {
    href: '/admin/content-bank',
    label: 'School Library',
    icon: IconSchoolLibrary,
    match: (p) =>
      (p?.startsWith('/admin/content-bank') ?? false) ||
      (p?.startsWith('/admin/content-bank') ?? false),
  },
  {
    href: '/admin/help',
    label: 'Help & Docs',
    icon: IconHelp,
    match: (p) =>
      (p?.startsWith('/admin/help') ?? false) ||
      (p?.startsWith('/admin/help') ?? false),
  },
]

// Superadmin item — only shown to superadmins, lives in the MANAGE group.
const SUPERADMIN_ITEM: NavItem = {
  href: '/superadmin',
  label: 'Superadmin',
  icon: IconSuperadmin,
  match: (p) => p?.startsWith('/superadmin') ?? false,
}

// ─────────── Helpers ───────────

// Initials from a display name / email (max 2 chars, uppercase).
function initialsFrom(name: string, email: string): string {
  const source = (name || email || '').trim()
  if (!source) return '?'
  // If it looks like an email, use the part before @.
  const base = source.includes('@') ? source.split('@')[0] : source
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

// ─────────── Component ───────────

export default function AdminSidebar() {
  // useSearchParams must be wrapped in Suspense per Next 14+ rules
  return (
    <Suspense
      fallback={
        <aside className="hidden md:block fixed top-0 left-0 bottom-0 w-[264px] bg-white border-r border-[#e8edf5]" />
      }
    >
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
  const userInitials = initialsFrom(session?.user?.name || '', userEmail)

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

  // Clear-on-open: when the user lands on /admin/courses (or /students),
  // mark that section's notifications read and zero its badge locally. Guarded
  // by clearedRef so it only fires once per entry; the guard resets when the
  // user navigates away so re-entering clears again.
  useEffect(() => {
    const onCourses = pathname?.startsWith('/admin/courses') ?? false
    const onStudents = pathname?.startsWith('/admin/students') ?? false

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

  // Single nav item (shared by both groups). Active/inactive styling and the
  // optional count badge follow Laura's new design exactly.
  const renderItem = (item: NavItem) => {
    const active = isActive(item)
    const count = badgeCount(item)
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          style={
            active
              ? {
                  backgroundColor: '#00aff0',
                  color: '#fff',
                  boxShadow: '0 5px 14px rgba(0,175,240,.28)',
                }
              : undefined
          }
          className={`group flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-[11px] text-[14.5px] font-bold no-underline transition-colors ${
            active
              ? ''
              : 'text-[#5a6577] hover:bg-[#e9f6fd] hover:text-[#0090c9]'
          }`}
        >
          <span className="shrink-0 flex items-center">{item.icon}</span>
          <span className="flex-1 truncate">{item.label}</span>
          {count > 0 && (
            <span
              className={`text-[11px] font-black rounded-full px-2 py-px leading-none ${
                active ? 'text-white' : 'bg-[#dcf1fb] text-[#0090c9]'
              }`}
              style={active ? { backgroundColor: 'rgba(255,255,255,.24)' } : undefined}
              aria-label={`${count} unread`}
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Link>
      </li>
    )
  }

  // Eyebrow group label
  const eyebrow = (text: string) => (
    <li
      className="px-3 pt-2 pb-1.5 text-[10.5px] font-black uppercase text-[#00aff0]"
      style={{ letterSpacing: '.14em' }}
      aria-hidden="true"
    >
      {text}
    </li>
  )

  // MANAGE group items (Superadmin appended only for superadmins).
  // HR is read-only: hide the editing tools (My Library, School Library).
  const isHr = role === 'hr'
  const teachingItems = isHr ? TEACHING_NAV.filter((i) => i.href !== '/admin/lessons') : TEACHING_NAV
  const manageItems = isSuperadmin
    ? [...MANAGE_NAV, SUPERADMIN_ITEM]
    : isHr
    ? MANAGE_NAV.filter((i) => i.href !== '/admin/content-bank')
    : MANAGE_NAV

  // Workspace chip below the logo
  const WorkspaceChip = (
    <div className="px-4 pb-3.5">
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#e9f6fd] border border-[#c3e8fa]">
        <div className="w-[30px] h-[30px] shrink-0 rounded-[9px] bg-[#00aff0] text-white font-bold flex items-center justify-center text-sm">
          A
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#2c3a52] leading-tight truncate">
            Admin workspace
          </p>
          <p className="text-[11px] text-[#8a93a3] leading-tight truncate">
            English with Laura
          </p>
        </div>
      </div>
    </div>
  )

  // User footer (bottom)
  const UserFooter = (
    <div className="border-t border-[#eef2f8] p-3">
      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#f4f8fd] transition-colors">
        <div className="w-[38px] h-[38px] shrink-0 rounded-full bg-[#00aff0] text-white font-bold flex items-center justify-center text-sm">
          {userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-[#2c3a52] truncate" title={userName}>
            {userName}
          </p>
          <p className="text-[11px] text-[#8a93a3] truncate capitalize" title={userEmail}>
            {role || 'guest'}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          aria-label="Sign out"
          className="shrink-0 text-[#b6c0d0] hover:text-[#0090c9] transition-colors"
        >
          {IconLogout}
        </button>
      </div>
    </div>
  )

  // Nav body shared by desktop sidebar and mobile drawer
  const NavBody = (
    <>
      {WorkspaceChip}
      <nav className="flex-1 overflow-y-auto px-4">
        <ul>
          {eyebrow('Teaching')}
          {teachingItems.map(renderItem)}
        </ul>
        <ul>
          {eyebrow('Manage')}
          {manageItems.map(renderItem)}
        </ul>
      </nav>
      {UserFooter}
    </>
  )

  // Logo block (white-background logo asset, already used app-wide on white)
  const Logo = (
    <div className="px-[22px] pt-6 pb-5">
      <Link href="/admin/courses" aria-label="English with Laura">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="English with Laura" className="h-[52px] w-auto" />
      </Link>
    </div>
  )

  return (
    <>
      {/* ─── Mobile hamburger button (visible < md) ─── */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="md:hidden fixed top-3 left-3 z-40 bg-white border border-[#c3e8fa] rounded-lg w-9 h-9 flex items-center justify-center shadow-sm text-[#0090c9]"
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
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-[264px] bg-white border-r border-[#e8edf5] flex flex-col shadow-xl">
            <div className="flex items-start justify-between">
              {Logo}
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="mt-5 mr-4 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#0090c9]"
              >
                ✕
              </button>
            </div>
            {NavBody}
          </aside>
        </>
      )}

      {/* ─── Desktop sidebar (>= md) ─── */}
      <aside className="hidden md:flex md:flex-col sticky top-0 h-screen w-[264px] bg-white border-r border-[#e8edf5] z-30">
        {Logo}
        {NavBody}
      </aside>
    </>
  )
}
