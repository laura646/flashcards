'use client'

// Wave 0 — REAL redesigned Courses page, "new beside old".
//
// Same data + auth as the live /admin/courses (which is left 100% untouched),
// just rendered through the 10B CoursesView. Lives at a NEW route
// (/admin-beta/courses) and is not linked from the live nav, so nothing
// changes for teachers until we deliberately switch them over. Detail links
// still point at the existing /admin/courses/[id] (not yet migrated).

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import CoursesView, { CourseSummary } from '@/components/admin-v2/CoursesView'

export default function CoursesBetaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin?action=my-courses&include_archived=true')
      const data = await res.json()
      setCourses(data.courses || [])
    } catch { /* swallow */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) load()
  }, [status, isAdmin, load])

  if (status === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  return (
    <CoursesView
      courses={courses}
      loading={status === 'loading' || loading}
      onOpenCourse={(id) => router.push(`/admin-beta/courses/${id}`)}
    />
  )
}
