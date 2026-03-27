import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getAccessibleCourseIds } from '@/lib/roles'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lessonId = req.nextUrl.searchParams.get('id')
  const allVocabulary = req.nextUrl.searchParams.get('all_vocabulary')
  const includeAll = req.nextUrl.searchParams.get('include_all') // for admin - include drafts
  const courseId = req.nextUrl.searchParams.get('course_id')

  const role = session.user.role || 'student'
  const email = session.user.email

  try {
    // Get courses this user can access
    const accessibleCourseIds = await getAccessibleCourseIds(email, role)

    // Get all vocabulary across all published lessons the user has access to
    if (allVocabulary === 'true') {
      let query = supabase
        .from('lesson_flashcards')
        .select('*, lessons!inner(status, title, lesson_date, course_id)')
        .eq('lessons.status', 'published')
        .order('order_index')

      // Scope to accessible courses (unless superadmin)
      if (role !== 'superadmin' && accessibleCourseIds.length > 0) {
        query = query.in('lessons.course_id', accessibleCourseIds)
      } else if (role !== 'superadmin' && accessibleCourseIds.length === 0) {
        return NextResponse.json({ flashcards: [] })
      }

      // If specific course requested, further filter
      if (courseId) {
        query = query.eq('lessons.course_id', courseId)
      }

      const { data: flashcards, error } = await query
      if (error) throw error
      return NextResponse.json({ flashcards: flashcards || [] })
    }

    // Get a specific lesson with its flashcards, exercises, and content blocks
    if (lessonId) {
      const isStaff = role === 'superadmin' || role === 'teacher'

      const [lessonRes, flashcardsRes, exercisesRes, blocksRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('id', lessonId).single(),
        supabase.from('lesson_flashcards').select('*').eq('lesson_id', lessonId).order('order_index'),
        supabase.from('lesson_exercises').select('*').eq('lesson_id', lessonId).order('order_index'),
        supabase.from('lesson_blocks').select('*').eq('lesson_id', lessonId).order('order_index'),
      ])

      if (lessonRes.error) throw lessonRes.error

      // Check course access
      const lessonCourseId = lessonRes.data?.course_id
      if (lessonCourseId && role !== 'superadmin' && !accessibleCourseIds.includes(lessonCourseId)) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      }

      // Non-staff users can only view published lessons
      if (!isStaff && lessonRes.data?.status !== 'published') {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      }

      return NextResponse.json({
        lesson: lessonRes.data,
        flashcards: flashcardsRes.data || [],
        exercises: exercisesRes.data || [],
        blocks: blocksRes.data || [],
      })
    }

    // Get lessons list - scoped by course
    let query = supabase.from('lessons').select('*').order('lesson_date', { ascending: false })

    // Filter by specific course if provided
    if (courseId) {
      query = query.eq('course_id', courseId)
    } else if (role !== 'superadmin') {
      // Scope to accessible courses
      if (accessibleCourseIds.length > 0) {
        query = query.in('course_id', accessibleCourseIds)
      } else {
        return NextResponse.json({ lessons: [] })
      }
    }

    // Published only for students, all for staff
    if (includeAll !== 'true' || role === 'student') {
      query = query.eq('status', 'published')
    }

    const { data: lessons, error } = await query
    if (error) throw error

    // Get flashcard and exercise counts per lesson
    const lessonIds = (lessons || []).map((l: { id: string }) => l.id)

    if (lessonIds.length === 0) {
      return NextResponse.json({ lessons: [] })
    }

    const [flashcardCountsRes, exerciseCountsRes, blockCountsRes] = await Promise.all([
      supabase.from('lesson_flashcards').select('lesson_id').in('lesson_id', lessonIds),
      supabase.from('lesson_exercises').select('lesson_id').in('lesson_id', lessonIds),
      supabase.from('lesson_blocks').select('lesson_id, block_type').in('lesson_id', lessonIds),
    ])

    const flashcardCounts: Record<string, number> = {}
    const exerciseCounts: Record<string, number> = {}
    const blockCounts: Record<string, Record<string, number>> = {}

    ;(flashcardCountsRes.data || []).forEach((f: { lesson_id: string }) => {
      flashcardCounts[f.lesson_id] = (flashcardCounts[f.lesson_id] || 0) + 1
    })
    ;(exerciseCountsRes.data || []).forEach((e: { lesson_id: string }) => {
      exerciseCounts[e.lesson_id] = (exerciseCounts[e.lesson_id] || 0) + 1
    })
    ;(blockCountsRes.data || []).forEach((b: { lesson_id: string; block_type: string }) => {
      if (!blockCounts[b.lesson_id]) blockCounts[b.lesson_id] = {}
      blockCounts[b.lesson_id][b.block_type] = (blockCounts[b.lesson_id][b.block_type] || 0) + 1
    })

    const lessonsWithCounts = (lessons || []).map((lesson: { id: string }) => ({
      ...lesson,
      flashcard_count: flashcardCounts[lesson.id] || 0,
      exercise_count: exerciseCounts[lesson.id] || 0,
      block_counts: blockCounts[lesson.id] || {},
    }))

    return NextResponse.json({ lessons: lessonsWithCounts })
  } catch (err) {
    console.error('Lessons API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
