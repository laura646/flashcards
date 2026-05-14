'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─── Types ───

interface MyStudent {
  email: string
  name: string
  created_at: string
  level: string | null
  learning_goals: string | null
  company: string | null
  common_issues_tags: string[]
  common_issues_comments: string | null
  blocked: boolean
  notes: string | null
  courses: { course_id: string; course_name: string }[]
}

// ─── Page: My Students (list) ───

export default function StudentsListPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [students, setStudents] = useState<MyStudent[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  // Load students
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin?action=my-students')
      const data = await res.json()
      setStudents(data.students || [])
    } catch { /* swallow */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) load()
  }, [status, isAdmin, load])

  const filtered = students.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (s.name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  // States
  if (status === 'loading' || loading) {
    return (
      <div className="px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-[#416ebe] mb-6">My Students</h1>
          {/* Skeleton rows */}
          <div className="bg-white rounded-2xl border border-[#cddcf0] overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="px-6 py-4 border-b border-[#e6f0fa] last:border-b-0">
                <div className="h-4 w-40 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-56 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <div className="p-8 text-sm text-red-500">Access denied — admin or teacher only.</div>
  }

  // Render
  return (
    <div className="px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#416ebe]">
            My Students <span className="text-sm font-normal text-gray-400">({students.length})</span>
          </h1>
          <input
            type="text"
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-[#cddcf0] rounded-lg px-3 py-2 w-64 focus:outline-none focus:border-[#416ebe] bg-white"
          />
        </div>

        <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyStateStudents hasAnyStudents={students.length > 0} hasSearch={!!search} />
          ) : (
            <div className="divide-y divide-[#e6f0fa]">
              {filtered.map((student) => (
                <button
                  key={student.email}
                  onClick={() => router.push(`/admin/students/${encodeURIComponent(student.email)}`)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-[#f7fafd] transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#46464b]">{student.name || 'Unknown'}</p>
                      {student.level && (
                        <span className="text-[10px] bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                          {student.level}
                        </span>
                      )}
                      {student.blocked && (
                        <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-bold">
                          BLOCKED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{student.email}</p>
                    {student.courses.length > 0 && (
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {student.courses.map((c) => (
                          <span key={c.course_id} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            {c.course_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {student.company && <p className="text-xs text-gray-400">{student.company}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ───

function EmptyStateStudents({ hasAnyStudents, hasSearch }: { hasAnyStudents: boolean; hasSearch: boolean }) {
  if (hasAnyStudents && hasSearch) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm font-bold text-[#46464b]">No matches</p>
        <p className="text-xs text-gray-400 mt-1">Try a different name or email.</p>
      </div>
    )
  }
  return (
    <div className="px-6 py-12 text-center">
      <div className="text-5xl mb-3">🦗</div>
      <p className="text-sm font-bold text-[#46464b]">Crickets…</p>
      <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
        No students in your courses yet. Once a student signs up with your course&apos;s invite code, they&apos;ll appear here.
      </p>
    </div>
  )
}
