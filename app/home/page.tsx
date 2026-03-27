'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import SignOutButton from '@/components/SignOutButton'
import { useRouter } from 'next/navigation'

interface Course {
  id: string
  name: string
  description: string | null
  lesson_count: number
}

interface Lesson {
  id: string
  title: string
  lesson_date: string
  course_id: string
  flashcard_count: number
  exercise_count: number
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  const role = session?.user?.role || 'student'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
      return
    }

    if (status === 'authenticated') {
      // Redirect superadmin to superadmin dashboard
      if (role === 'superadmin') {
        router.replace('/superadmin')
        return
      }
      // Redirect teachers to admin
      if (role === 'teacher') {
        router.replace('/admin')
        return
      }

      // Fetch student's courses
      fetch('/api/student/courses')
        .then((res) => res.json())
        .then((data) => {
          const studentCourses = data.courses || []
          setCourses(studentCourses)

          // If only 1 course, auto-select it and load lessons
          if (studentCourses.length === 1) {
            setSelectedCourse(studentCourses[0])
            loadLessons(studentCourses[0].id)
          } else {
            setLoading(false)
          }
        })
        .catch(() => setLoading(false))
    }
  }, [status, session, router, role])

  const loadLessons = (courseId: string) => {
    setLoading(true)
    fetch(`/api/lessons?course_id=${courseId}`)
      .then((res) => res.json())
      .then((data) => {
        setLessons(data.lessons || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const selectCourse = (course: Course) => {
    setSelectedCourse(course)
    loadLessons(course.id)
  }

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#416ebe] text-sm">Loading...</div>
      </main>
    )
  }

  if (status === 'unauthenticated') return null

  const studentName = session?.user?.name?.split(' ')[0] || 'Student'

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // ── No courses enrolled ──
  if (courses.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <img src="/logo.svg" alt="English with Laura" className="h-16 mb-6" />
        <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center max-w-md">
          <div className="text-4xl mb-3">📚</div>
          <h2 className="text-lg font-bold text-[#46464b] mb-2">Welcome, {studentName}!</h2>
          <p className="text-sm text-gray-500">
            You&apos;re not enrolled in any courses yet. Ask your teacher for an invite link to get started.
          </p>
        </div>
        <div className="mt-6 flex items-center gap-3 text-xs text-gray-400">
          <span>englishwithlaura.com</span>
          <span>·</span>
          <SignOutButton />
        </div>
      </main>
    )
  }

  // ── Course picker (multiple courses) ──
  if (!selectedCourse && courses.length > 1) {
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8">
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="English with Laura" className="h-16 mx-auto mb-3" />
          <p className="text-[#46464b] mt-1 text-sm">Welcome back, {studentName}!</p>
        </div>

        <div className="w-full max-w-lg">
          <h2 className="text-lg font-bold text-[#416ebe] mb-4">My Courses</h2>
          <div className="flex flex-col gap-3">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => selectCourse(course)}
                className="bg-white rounded-2xl shadow-sm border-2 border-[#cddcf0] hover:border-[#416ebe] p-5 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#46464b] group-hover:text-[#416ebe] transition-colors">
                      {course.name}
                    </h3>
                    {course.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{course.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {course.lesson_count} lesson{course.lesson_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-gray-300 group-hover:text-[#416ebe] transition-colors text-lg">
                    &rarr;
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3 text-xs text-gray-400">
        <span>englishwithlaura.com</span>
        <span>·</span>
        <SignOutButton />
      </div>
      </main>
    )
  }

  // ── Lessons view (single course or selected course) ──
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <img src="/logo.svg" alt="English with Laura" className="h-16 mx-auto mb-3" />
        <p className="text-[#46464b] mt-1 text-sm">Welcome back, {studentName}!</p>
      </div>

      <div className="w-full max-w-lg">
        {/* Course header with back button if multiple courses */}
        {courses.length > 1 && (
          <button
            onClick={() => { setSelectedCourse(null); setLessons([]) }}
            className="text-xs text-gray-400 hover:text-[#416ebe] transition-colors mb-2"
          >
            &larr; My Courses
          </button>
        )}

        <h2 className="text-lg font-bold text-[#416ebe] mb-4 flex items-center gap-2">
          <span>📚</span> {selectedCourse?.name || 'My Lessons'}
        </h2>

        {lessons.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-[#cddcf0] p-8 text-center">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-sm text-gray-400">No lessons available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-8">
            {lessons.map((lesson, index) => {
              const lessonNumber = lessons.length - index
              return (
                <button
                  key={lesson.id}
                  onClick={() => router.push(`/lessons/${lesson.id}`)}
                  className="bg-white rounded-2xl shadow-sm border-2 border-[#cddcf0] hover:border-[#416ebe] p-5 text-left transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white bg-[#416ebe] px-2 py-0.5 rounded-full">
                          Lesson {lessonNumber}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(lesson.lesson_date)}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#46464b] group-hover:text-[#416ebe] transition-colors">
                        {lesson.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          🃏 {lesson.flashcard_count} words
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          ✏️ {lesson.exercise_count} exercises
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-300 group-hover:text-[#416ebe] transition-colors text-lg">
                      &rarr;
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* All Vocabulary Button */}
        <button
          onClick={() => router.push(`/vocabulary${selectedCourse ? `?course_id=${selectedCourse.id}` : ''}`)}
          className="w-full bg-gradient-to-r from-[#416ebe] to-[#5a8fd4] rounded-2xl shadow-sm p-5 text-left transition-all hover:shadow-md group"
        >
          <div className="flex items-center gap-4">
            <div className="text-3xl">📖</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">All My Vocabulary</h3>
              <p className="text-xs text-blue-100 mt-0.5">Review all words from every lesson</p>
            </div>
            <span className="text-blue-200 group-hover:text-white transition-colors text-lg">&rarr;</span>
          </div>
        </button>
      </div>

      <p className="mt-8 text-xs text-gray-400">englishwithlaura.com</p>
    </main>
  )
}
