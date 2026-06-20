'use client'

// Wave 0 — REAL redesigned Course Detail page, "new beside old".
//
// Same data + auth + mutations as the live /admin course-detail view (which
// is left 100% untouched); this is a NEW unlinked route (/admin-beta/courses/[id])
// rendered through the 10B CourseDetailView. This page owns ALL fetching,
// the update-course / telegram-test mutations (exact existing action names +
// payloads — no backend changes) and navigation; the View stays presentational.
// Lesson links point at the new /admin-beta/lessons editor (the switch).

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import CourseDetailView, {
  CourseDetailData,
  CourseStudentRow,
  CourseLessonRow,
  CourseSaveForm,
} from '@/components/admin-v2/CourseDetailView'
import ContentBankImportModal from '@/components/ContentBankImportModal'

export default function CourseDetailBetaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [course, setCourse] = useState<CourseDetailData | null>(null)
  const [students, setStudents] = useState<CourseStudentRow[]>([])
  const [lessons, setLessons] = useState<CourseLessonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showLessonChooser, setShowLessonChooser] = useState(false)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin?action=course-detail&course_id=${encodeURIComponent(id)}`)
      const data = await res.json()
      setCourse(data.course || null)
      setStudents(data.students || [])
      setLessons(data.lessons || [])
    } catch { /* swallow */ }
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) load()
  }, [status, isAdmin, load])

  const onSaveCourse = useCallback(async (form: CourseSaveForm): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-course',
          course_id: id,
          name: form.name,
          description: form.description,
          level: form.level || null,
          course_type: form.course_type || null,
          telegram_chat_id: form.telegram_chat_id || null,
          invite_code: form.invite_code.trim() ? form.invite_code.trim() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: data.error || 'Failed to update course' }
      await load()
      return { ok: true }
    } catch {
      return { ok: false, error: 'Failed to update course' }
    }
  }, [id, load])

  const onSendTelegramTest = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'telegram-test', course_id: id }),
      })
      const data = await res.json().catch(() => ({}))
      return { ok: !!data.ok, error: data.ok ? undefined : (data.error || 'Failed to send') }
    } catch {
      return { ok: false, error: 'Failed to send test message' }
    }
  }, [id])

  if (status === 'authenticated' && !isAdmin) {
    return <div className="p-8 text-sm text-incorrect-fg font-rubik">Access denied — admin or teacher only.</div>
  }

  return (
    <>
      <CourseDetailView
        course={course}
        students={students}
        lessons={lessons}
        loading={status === 'loading' || loading}
        onBack={() => router.push('/admin-beta/courses')}
        onOpenLesson={(lid) =>
          router.push(
            `/admin-beta/lessons?id=${lid}&course_id=${id}&course_name=${encodeURIComponent(course?.name || '')}`
          )
        }
        onOpenStudent={(email) => router.push(`/admin-beta/students/${encodeURIComponent(email)}`)}
        onCreateLesson={() => setShowLessonChooser(true)}
        onSaveCourse={onSaveCourse}
        onSendTelegramTest={onSendTelegramTest}
      />

      {showLessonChooser && (
        <ContentBankImportModal
          courseId={id}
          existingTitles={lessons.map((l) => l.title)}
          onClose={() => setShowLessonChooser(false)}
          onCreateOwn={() =>
            router.push(`/admin-beta/lessons?course_id=${id}&course_name=${encodeURIComponent(course?.name || '')}`)
          }
          onImported={() => { setShowLessonChooser(false); load() }}
        />
      )}
    </>
  )
}
