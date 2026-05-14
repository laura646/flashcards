'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─── Types ───

interface Course {
  id: string
  name: string
  description: string
  invite_code: string
  created_at: string
  course_type: string | null
  level: string | null
  student_count: number
  lesson_count: number
}

// ─── Page: My Courses (list) ───

export default function CoursesListPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.user?.role === 'superadmin' || session?.user?.role === 'teacher'

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
  }, [status, router])

  // Load courses
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin?action=my-courses')
      const data = await res.json()
      setCourses(data.courses || [])
    } catch { /* swallow */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) load()
  }, [status, isAdmin, load])

  // States
  if (status === 'loading' || loading) {
    return (
      <div className="px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-[#416ebe] mb-6">My Courses</h1>
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#cddcf0] p-5">
                <div className="h-5 w-48 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-72 bg-gray-100 rounded animate-pulse" />
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
        <h1 className="text-2xl font-bold text-[#416ebe] mb-6">
          My Courses <span className="text-sm font-normal text-gray-400">({courses.length})</span>
        </h1>

        {courses.length === 0 ? (
          <EmptyStateCourses />
        ) : (
          <div className="grid gap-3">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => router.push(`/admin/courses/${course.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-5 hover:border-[#416ebe] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#46464b]">{course.name}</h3>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{course.description || 'No description'}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {course.level && (
                        <span className="text-[10px] bg-[#e6f0fa] text-[#416ebe] px-2 py-0.5 rounded-full font-bold">
                          {course.level}
                        </span>
                      )}
                      {course.course_type && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                          {course.course_type}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-6 text-center shrink-0">
                    <div>
                      <p className="text-xl font-bold text-[#416ebe]">{course.student_count}</p>
                      <p className="text-[10px] text-gray-400">students</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-[#416ebe]">{course.lesson_count}</p>
                      <p className="text-[10px] text-gray-400">lessons</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyStateCourses() {
  return (
    <div className="bg-white rounded-2xl border border-[#cddcf0] shadow-sm p-12 text-center">
      <div className="text-5xl mb-3">🦗</div>
      <p className="text-sm font-bold text-[#46464b]">Crickets…</p>
      <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
        No courses assigned to you yet. Ask a superadmin to add you as a teacher of a course.
      </p>
    </div>
  )
}
