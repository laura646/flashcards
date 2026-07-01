'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import SignOutButton from '@/components/SignOutButton'
import { useRouter } from 'next/navigation'
import VocabDueCard, { type SrsStats } from '@/components/VocabDueCard'
import { Button, Pill, Eyebrow, Card, SkyHero, TextField } from '@/components/student-ui'
import BottomTabBar from '@/components/student-ui/BottomTabBar'

interface Course {
  id: string
  name: string
  description: string | null
  lesson_count: number
  level?: string | null
  telegram_link?: string | null
  lesson_link?: string | null
  schedule?: string | null
}

interface Lesson {
  id: string
  title: string
  lesson_date: string
  course_id: string
  flashcard_count: number
  exercise_count: number
  lesson_type?: string
  exercises_completed?: number
  flashcards_studied?: boolean
  points_earned?: number
  item_count?: number
  items_completed?: number
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalPoints, setTotalPoints] = useState(0)
  // Single source of truth for SRS data — fetched once here (sync + stats
  // + streak), surfaced in the hero AND passed into VocabDueCard, so the
  // two never disagree and we don't double-sync.
  const [srsStats, setSrsStats] = useState<SrsStats | null>(null)
  const [srsStreak, setSrsStreak] = useState(0)
  const [srsReviewedToday, setSrsReviewedToday] = useState(false)
  const [srsLoading, setSrsLoading] = useState(true)

  const heroStreak = srsStreak

  // Quick-actions row (Flip / Quiz / Add word) hidden per Laura — kept for later.
  // Flip to true to restore.
  const SHOW_QUICK_ACTIONS = false

  const role = session?.user?.role || 'student'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/')
      return
    }

    if (status === 'authenticated') {
      if (role === 'superadmin') {
        router.replace('/superadmin')
        return
      }
      if (role === 'teacher') {
        router.replace('/admin')
        return
      }
      if (role === 'hr') {
        // HR is a read-only viewer of the admin workspace (My Courses / My Students).
        router.replace('/admin')
        return
      }

      fetch('/api/student/courses')
        .then((res) => res.json())
        .then(async (data) => {
          const studentCourses = data.courses || []
          setCourses(studentCourses)

          if (studentCourses.length === 1) {
            setSelectedCourse(studentCourses[0])
            try {
              const lessonsRes = await fetch(`/api/lessons?course_id=${studentCourses[0].id}`)
              const lessonsData = await lessonsRes.json()
              setLessons(lessonsData.lessons || [])
              setTotalPoints(lessonsData.total_points || 0)
            } catch { /* ignore */ }
            setLoading(false)
          } else {
            setLoading(false)
          }
        })
        .catch(() => setLoading(false))

      // SRS data — sync first (so freshly-enrolled students aren't stale),
      // then read stats + streak once. Feeds both the hero and VocabDueCard.
      ;(async () => {
        try {
          await fetch('/api/vocab-srs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync' }),
          })
        } catch { /* non-blocking */ }
        try {
          const [statsRes, streakRes] = await Promise.all([
            fetch('/api/vocab-srs?action=stats'),
            fetch('/api/vocab-srs?action=streak'),
          ])
          const statsData = await statsRes.json()
          const streakData = await streakRes.json()
          if (statsData.stats) setSrsStats(statsData.stats)
          setSrsStreak(streakData.streak || 0)
          setSrsReviewedToday(!!streakData.reviewedToday)
        } catch { /* leave null → card hides, hero shows dash */ }
        setSrsLoading(false)
      })()
    }
  }, [status, session, router, role])

  const loadLessons = (courseId: string) => {
    setLoading(true)
    fetch(`/api/lessons?course_id=${courseId}`)
      .then((res) => res.json())
      .then((data) => {
        setLessons(data.lessons || [])
        setTotalPoints(data.total_points || 0)
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
        <div className="text-brandblue text-sm">Loading...</div>
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
    return <NoCourses studentName={studentName} onEnrolled={() => {
      fetch('/api/student/courses')
        .then(res => res.json())
        .then(data => {
          const studentCourses = data.courses || []
          setCourses(studentCourses)
          if (studentCourses.length === 1) {
            setSelectedCourse(studentCourses[0])
            loadLessons(studentCourses[0].id)
          }
        })
    }} />
  }

  // ── Course picker (multiple courses) ──
  if (!selectedCourse && courses.length > 1) {
    return (
      <main className="min-h-screen bg-[#f9fafb] flex flex-col">
        <SkyHero>
          <div className="max-w-lg mx-auto w-full">
            <img src="/logo-onblue.png" alt="English with Laura" className="h-12" />
            <p className="text-white mt-3 text-sm">Welcome back, {studentName}!</p>
          </div>
        </SkyHero>
        <div className="w-full max-w-lg mx-auto px-4 py-6 pb-24 flex-1">
          <Eyebrow tone="brand" className="block mb-1">My courses</Eyebrow>
          <h2 className="text-lg font-extrabold text-brandblue mb-4">Choose a course</h2>
          <div className="flex flex-col gap-3">
            {courses.map((course) => (
              <button key={course.id} onClick={() => selectCourse(course)} className="text-left">
                <Card className="hover:border-sky transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-brandblue">{course.name}</h3>
                      {course.description && <p className="text-xs text-ink-muted mt-0.5">{course.description}</p>}
                      <p className="text-xs text-ink-muted mt-1">{course.lesson_count} lesson{course.lesson_count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-[#c8ccd4] text-lg">→</span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
          <Footer />
        </div>
        <BottomTabBar />
      </main>
    )
  }

  // ── Lessons view (single course or selected course) ──
  return (
    <main className="min-h-screen bg-[#f9fafb] pb-24">
      {/* Sky hero */}
      <SkyHero>
        <div className="max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between">
            <img src="/logo-onblue.png" alt="English with Laura" className="h-11" />
            {heroStreak > 0 && (
              <span className="inline-flex items-center gap-1 bg-streak-fill text-streak-ink text-xs font-bold px-3 py-1 rounded-full">
                🔥 {heroStreak}
              </span>
            )}
          </div>
          <p className="text-white mt-3 text-sm">Welcome back, {studentName}!</p>
        </div>
      </SkyHero>

      <div className="w-full max-w-lg mx-auto px-4 py-6">
        {/* Quick actions — HIDDEN per Laura (kept for later); flip SHOW_QUICK_ACTIONS to true to restore */}
        {SHOW_QUICK_ACTIONS && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              // Route into the REAL SRS trainer (the student's own due words),
              // not the static demo deck. The trainer reads ?mode / ?action.
              { emoji: '🔄', label: 'Flip', href: '/vocabulary?mode=flip' },
              { emoji: '🎯', label: 'Quiz', href: '/vocabulary?mode=quiz' },
              { emoji: '➕', label: 'Add word', href: '/vocabulary?action=add' },
            ].map((qa) => (
              <button
                key={qa.label}
                onClick={() => router.push(qa.href)}
                className="flex flex-col items-center gap-1.5 bg-sky-wash rounded-tile py-4 hover:brightness-95 transition-all"
              >
                <span className="text-2xl">{qa.emoji}</span>
                <span className="text-[12px] font-bold text-ink-body">{qa.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Back to courses */}
        {courses.length > 1 && (
          <button
            onClick={() => { setSelectedCourse(null); setLessons([]) }}
            className="text-xs font-bold text-sky hover:underline mb-3"
          >
            ← My courses
          </button>
        )}

        {/* Course heading + points */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span>📚</span>
            <h2 className="text-lg font-extrabold text-brandblue">{selectedCourse?.name || 'My Lessons'}</h2>
          </div>
          {totalPoints > 0 && (
            <span className="inline-flex items-center gap-1 bg-streak-fill text-streak-ink text-xs font-bold px-3 py-1 rounded-full">
              ⭐ {totalPoints.toLocaleString()}
            </span>
          )}
        </div>

        {/* Course Info */}
        {selectedCourse && (selectedCourse.level || selectedCourse.telegram_link || selectedCourse.lesson_link || selectedCourse.schedule) && (
          <Card className="mb-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-body">
              {selectedCourse.level && <span>📊 <strong>Level:</strong> {selectedCourse.level}</span>}
              {selectedCourse.schedule && <span>📅 <strong>Schedule:</strong> {selectedCourse.schedule}</span>}
              {selectedCourse.lesson_link && (
                <a href={selectedCourse.lesson_link} target="_blank" rel="noopener noreferrer" className="text-sky font-bold hover:underline">🔗 Join Lesson</a>
              )}
              {selectedCourse.telegram_link && (
                <a href={selectedCourse.telegram_link} target="_blank" rel="noopener noreferrer" className="text-sky font-bold hover:underline">💬 Telegram Group</a>
              )}
            </div>
          </Card>
        )}

        {/* Daily spaced-repetition nudge — self-contained */}
        <VocabDueCard external={{ stats: srsStats, streak: srsStreak, reviewedToday: srsReviewedToday, loading: srsLoading }} />

        {lessons.length === 0 ? (
          <Card className="text-center py-8">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-sm text-ink-muted">No lessons available yet. Check back soon!</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {lessons.map((lesson, index) => {
              const lessonNumber = lessons.length - index
              const isTest = lesson.lesson_type && lesson.lesson_type !== 'lesson'
              // Items = exercises + interactive blocks + flashcard set, so
              // block-based lessons (no classic exercises) register too.
              // Falls back to exercise counts if the API predates item_count.
              const itemTotal = lesson.item_count ?? lesson.exercise_count
              const itemsDone = lesson.items_completed ?? (lesson.exercises_completed || 0)
              const exDone = itemsDone >= itemTotal && itemTotal > 0
              const pct = itemTotal > 0 ? Math.round((Math.min(itemsDone, itemTotal) / itemTotal) * 100) : 0
              return (
                <button key={lesson.id} onClick={() => router.push(`/lessons/${lesson.id}`)} className="text-left">
                  <Card className="hover:border-sky transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[11px] font-bold text-white px-2 py-0.5 rounded-full ${isTest ? 'bg-[#8b5cf6]' : 'bg-sky'}`}>
                            {lesson.lesson_type === 'mid_course_test' ? '📝 Test' :
                             lesson.lesson_type === 'final_test' ? '🎓 Final Test' :
                             lesson.lesson_type === 'review_test' ? '🔄 Review' :
                             `Lesson ${lessonNumber}`}
                          </span>
                          <span className="text-xs text-ink-muted">{formatDate(lesson.lesson_date)}</span>
                        </div>
                        <h3 className="text-sm font-bold text-brandblue">{lesson.title}</h3>
                        <div className="flex items-center gap-3 mt-2">
                          {(!lesson.lesson_type || lesson.lesson_type === 'lesson') && (
                            <span className="text-xs text-ink-muted flex items-center gap-1">
                              {lesson.flashcards_studied ? '✅' : '🃏'} {lesson.flashcard_count} words
                            </span>
                          )}
                          {itemTotal > 0 && (
                            <span className="text-xs text-ink-muted flex items-center gap-1">
                              {exDone ? '✅' : '✏️'} {Math.min(itemsDone, itemTotal)}/{itemTotal} tasks
                            </span>
                          )}
                          {(lesson.points_earned || 0) > 0 && (
                            <span className="text-xs text-amber-500 font-bold flex items-center gap-0.5">⭐ {lesson.points_earned} pts</span>
                          )}
                        </div>
                        {itemTotal > 0 && (
                          <div className="mt-2 h-1.5 bg-[#eef1f6] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${exDone ? 'bg-correct-fg' : 'bg-sky'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <span className="text-[#c8ccd4] text-lg ml-2">→</span>
                    </div>
                  </Card>
                </button>
              )
            })}
          </div>
        )}

        <Footer />
      </div>

      <BottomTabBar />
    </main>
  )
}

function Footer() {
  return (
    <div className="mt-8 flex items-center justify-center gap-3 text-xs text-ink-muted">
      <a href="https://englishwithlaura.com" target="_blank" rel="noopener noreferrer" className="hover:text-sky transition-colors">englishwithlaura.com</a>
      <span>·</span>
      <SignOutButton />
    </div>
  )
}

function NoCourses({ studentName, onEnrolled }: { studentName: string; onEnrolled: () => void }) {
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setJoining(true)
    setJoinError('')
    setJoinSuccess('')

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      })
      const data = await res.json()
      if (data.error) {
        setJoinError(data.error)
      } else {
        setJoinSuccess('You\'re in! Loading your course...')
        setTimeout(() => onEnrolled(), 1500)
      }
    } catch {
      setJoinError('Failed to join. Please try again.')
    }
    setJoining(false)
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] flex flex-col">
      <SkyHero>
        <div className="max-w-md mx-auto w-full flex flex-col items-center text-center">
          <img src="/logo-onblue.png" alt="English with Laura" className="h-14" />
          <p className="text-white mt-3 text-sm">Welcome, {studentName}!</p>
        </div>
      </SkyHero>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <Card padding="lg" className="text-center max-w-md w-full">
          <div className="text-4xl mb-3">📚</div>
          <h2 className="text-lg font-extrabold text-brandblue mb-2">Get started</h2>
          <p className="text-sm text-ink-muted mb-6">
            You&apos;re not in a course yet. Enter the invite code your teacher gave you — it&apos;s usually in your welcome email or from your school.
          </p>
          <form onSubmit={handleJoin} className="space-y-3 text-left">
            <TextField
              label="Invite code"
              placeholder="e.g. TRAVEL24"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="text-center"
            />
            <Button type="submit" variant="primary" fullWidth disabled={joining || !inviteCode.trim()}>
              {joining ? 'Joining…' : 'Join course'}
            </Button>
          </form>
          {joinError && <p role="alert" className="text-xs text-incorrect-fg mt-3">⚠ {joinError}</p>}
          {joinSuccess && <p role="status" className="text-xs text-correct-fg font-bold mt-3">✓ {joinSuccess}</p>}
          <p className="text-[11px] text-ink-muted mt-4">Don&apos;t have a code? Ask your teacher or school for one.</p>
        </Card>
        <Footer />
      </div>
    </main>
  )
}
