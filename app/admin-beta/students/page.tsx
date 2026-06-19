'use client'

// Wave 0 — REAL redesigned Students page, "new beside old". Same data + auth
// as the live /admin/students (left untouched); new unlinked route. Detail
// links still point at the existing /admin/students/[email].

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import StudentsView, { StudentSummary } from '@/components/admin-v2/StudentsView'

export default function StudentsBetaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

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

  if (status === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  return (
    <StudentsView
      students={students}
      loading={status === 'loading' || loading}
      onOpenStudent={(email) => router.push(`/admin-beta/students/${encodeURIComponent(email)}`)}
    />
  )
}
