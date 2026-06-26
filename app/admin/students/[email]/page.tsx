'use client'

// Wave 0 — REAL redesigned Student DETAIL page, "new beside old". Same data +
// auth + mutations as the live /admin student-detail view (left untouched);
// new unlinked route. Owns all fetching, POST /api/admin mutations (exact
// legacy action names/payloads — no backend changes) and navigation; the
// presentational StudentDetailView receives data + callbacks.

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import StudentDetailView, {
  StudentDetailData,
  ProgressRow,
  ProfileSaveForm,
} from '@/components/admin-v2/StudentDetailView'

// Shape of the user row returned by /api/admin?action=student-detail
interface StudentUser {
  email: string
  name: string | null
  created_at: string
  level: string | null
  learning_goals: string | null
  company: string | null
  account_type: string | null
  common_issues_tags: string[] | null
  common_issues_comments: string | null
  blocked: boolean | null
  notes: string | null
}

export default function StudentDetailBetaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const email = decodeURIComponent(Array.isArray(params.email) ? params.email[0] : (params.email ?? ''))

  const [student, setStudent] = useState<StudentDetailData | null>(null)
  const [progress, setProgress] = useState<ProgressRow[]>([])
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher' || session?.user?.role === 'hr'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin?action=student-detail&email=${encodeURIComponent(email)}`)
      const data = await res.json()
      const user: StudentUser | null = data.user || null
      const courses: { id: string; name: string }[] = (data.courses || []).map(
        (c: { id: string; name: string }) => ({ id: c.id, name: c.name })
      )
      if (user) {
        setStudent({
          email: user.email,
          name: user.name || '',
          created_at: user.created_at,
          level: user.level ?? null,
          learning_goals: user.learning_goals ?? null,
          company: user.company ?? null,
          account_type: user.account_type ?? null,
          common_issues_tags: user.common_issues_tags ?? [],
          common_issues_comments: user.common_issues_comments ?? null,
          blocked: !!user.blocked,
          notes: user.notes ?? null,
          courses,
        })
      } else {
        setStudent(null)
      }
      setProgress(data.progress || [])
    } catch {
      setStudent(null)
    }
    setLoading(false)
  }, [email])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin && email) load()
  }, [status, isAdmin, email, load])

  const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      let error: string | undefined
      try {
        const data = await res.json()
        error = data?.error
      } catch { /* no JSON body */ }
      return { ok: res.ok, error: res.ok ? undefined : error || 'Request failed' }
    } catch {
      return { ok: false, error: 'Network error' }
    }
  }

  const onSaveProfile = async (f: ProfileSaveForm) => {
    const res = await post({
      action: 'update-student-profile',
      studentEmail: email,
      level: f.level || null,
      learning_goals: f.learning_goals || null,
      company: f.company || null,
      account_type: f.account_type || null,
      common_issues_tags: f.common_issues_tags,
      common_issues_comments: f.common_issues_comments || null,
    })
    if (res.ok) await load()
    return res
  }

  const onSaveNotes = async (notes: string) => post({ action: 'update-notes', email, notes })

  const onSendReminder = async (message: string) =>
    post({ action: 'send-reminder', email, studentName: student?.name || '', message })

  if (status === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  return (
    <StudentDetailView
      student={student}
      progress={progress}
      loading={status === 'loading' || loading}
      onBack={() => router.push('/admin/students')}
      onSaveProfile={onSaveProfile}
      onSaveNotes={onSaveNotes}
      onSendReminder={onSendReminder}
      canEdit={session?.user?.role !== 'hr'}
    />
  )
}
