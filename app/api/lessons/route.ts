import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getAccessibleCourseIds, requireRole } from '@/lib/roles'

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

    // Filter by specific course if provided — but still enforce access control
    if (courseId) {
      // Verify the user has access to this course
      if (role !== 'superadmin' && !accessibleCourseIds.includes(courseId)) {
        return NextResponse.json({ lessons: [] })
      }
      query = query.eq('course_id', courseId)
    } else if (role === 'teacher') {
      // Teachers see: lessons in their courses OR lessons they created
      const conditions = []
      if (accessibleCourseIds.length > 0) {
        conditions.push(`course_id.in.(${accessibleCourseIds.join(',')})`)
      }
      conditions.push(`created_by.eq.${email}`)
      query = query.or(conditions.join(','))
    } else if (role === 'student') {
      // Students only see lessons in their enrolled courses
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
      supabase.from('lesson_exercises').select('lesson_id, is_mandatory').in('lesson_id', lessonIds),
      supabase.from('lesson_blocks').select('lesson_id, block_type').in('lesson_id', lessonIds),
    ])

    const flashcardCounts: Record<string, number> = {}
    const exerciseCounts: Record<string, number> = {}
    const mandatoryExerciseCounts: Record<string, number> = {}
    const bonusExerciseCounts: Record<string, number> = {}
    const blockCounts: Record<string, Record<string, number>> = {}

    ;(flashcardCountsRes.data || []).forEach((f: { lesson_id: string }) => {
      flashcardCounts[f.lesson_id] = (flashcardCounts[f.lesson_id] || 0) + 1
    })
    ;(exerciseCountsRes.data || []).forEach((e: { lesson_id: string; is_mandatory?: boolean }) => {
      exerciseCounts[e.lesson_id] = (exerciseCounts[e.lesson_id] || 0) + 1
      if (e.is_mandatory === false) {
        bonusExerciseCounts[e.lesson_id] = (bonusExerciseCounts[e.lesson_id] || 0) + 1
      } else {
        mandatoryExerciseCounts[e.lesson_id] = (mandatoryExerciseCounts[e.lesson_id] || 0) + 1
      }
    })
    ;(blockCountsRes.data || []).forEach((b: { lesson_id: string; block_type: string }) => {
      if (!blockCounts[b.lesson_id]) blockCounts[b.lesson_id] = {}
      blockCounts[b.lesson_id][b.block_type] = (blockCounts[b.lesson_id][b.block_type] || 0) + 1
    })

    // For students, also fetch their progress to show completion indicators
    let exerciseCompletedCounts: Record<string, number> = {}
    let mandatoryCompletedCounts: Record<string, number> = {}
    let bonusCompletedCounts: Record<string, number> = {}
    let flashcardCompleted: Record<string, boolean> = {}
    let pointsPerLesson: Record<string, number> = {}
    let totalPoints = 0

    if (role === 'student') {
      // Get all exercise IDs grouped by lesson
      const exerciseIdsRes = await supabase
        .from('lesson_exercises')
        .select('id, lesson_id, is_mandatory')
        .in('lesson_id', lessonIds)

      const exerciseIdsByLesson: Record<string, string[]> = {}
      const mandatoryIdsByLesson: Record<string, string[]> = {}
      const bonusIdsByLesson: Record<string, string[]> = {}
      ;(exerciseIdsRes.data || []).forEach((e: { id: string; lesson_id: string; is_mandatory?: boolean }) => {
        if (!exerciseIdsByLesson[e.lesson_id]) exerciseIdsByLesson[e.lesson_id] = []
        exerciseIdsByLesson[e.lesson_id].push(e.id)
        if (e.is_mandatory === false) {
          if (!bonusIdsByLesson[e.lesson_id]) bonusIdsByLesson[e.lesson_id] = []
          bonusIdsByLesson[e.lesson_id].push(e.id)
        } else {
          if (!mandatoryIdsByLesson[e.lesson_id]) mandatoryIdsByLesson[e.lesson_id] = []
          mandatoryIdsByLesson[e.lesson_id].push(e.id)
        }
      })

      const allExerciseIds = (exerciseIdsRes.data || []).map((e: { id: string }) => e.id)

      if (allExerciseIds.length > 0) {
        const progressRes = await supabase
          .from('progress')
          .select('activity_type, activity_id, points_earned')
          .eq('user_email', email)
          .in('activity_type', ['exercise', 'flashcard'])

        const completedActivityIds = new Set(
          (progressRes.data || [])
            .filter((p: { activity_type: string }) => p.activity_type === 'exercise')
            .map((p: { activity_id: string }) => p.activity_id)
        )

        // Build points lookup: activity_id → points_earned (latest attempt)
        const pointsByActivityId: Record<string, number> = {}
        ;(progressRes.data || [])
          .filter((p: { activity_type: string }) => p.activity_type === 'exercise')
          .forEach((p: { activity_id: string; points_earned: number | null }) => {
            if (p.points_earned != null) {
              pointsByActivityId[p.activity_id] = p.points_earned
            }
          })

        const flashcardActivityIds = new Set(
          (progressRes.data || [])
            .filter((p: { activity_type: string }) => p.activity_type === 'flashcard')
            .map((p: { activity_id: string }) => p.activity_id)
        )

        // Count completed exercises per lesson + aggregate points
        for (const [lid, exIds] of Object.entries(exerciseIdsByLesson)) {
          exerciseCompletedCounts[lid] = exIds.filter(id => completedActivityIds.has(id)).length
          mandatoryCompletedCounts[lid] = (mandatoryIdsByLesson[lid] || []).filter(id => completedActivityIds.has(id)).length
          bonusCompletedCounts[lid] = (bonusIdsByLesson[lid] || []).filter(id => completedActivityIds.has(id)).length
          let lessonPts = 0
          exIds.forEach(id => { lessonPts += pointsByActivityId[id] || 0 })
          pointsPerLesson[lid] = lessonPts
          totalPoints += lessonPts
        }

        // Check if student has done any flashcard activity (modes: flip, self-assess, quiz)
        // Flashcard progress activity_id is the mode name, not lesson-specific
        // So we just check if they have any flashcard progress at all
        if (flashcardActivityIds.size > 0) {
          lessonIds.forEach((lid: string) => {
            if (flashcardCounts[lid] > 0) {
              flashcardCompleted[lid] = true
            }
          })
        }
      }
    }

    const lessonsWithCounts = (lessons || []).map((lesson: { id: string }) => ({
      ...lesson,
      flashcard_count: flashcardCounts[lesson.id] || 0,
      exercise_count: exerciseCounts[lesson.id] || 0,
      mandatory_exercise_count: mandatoryExerciseCounts[lesson.id] || 0,
      bonus_exercise_count: bonusExerciseCounts[lesson.id] || 0,
      block_counts: blockCounts[lesson.id] || {},
      exercises_completed: exerciseCompletedCounts[lesson.id] || 0,
      mandatory_completed: mandatoryCompletedCounts[lesson.id] || 0,
      bonus_completed: bonusCompletedCounts[lesson.id] || 0,
      flashcards_studied: flashcardCompleted[lesson.id] || false,
      points_earned: pointsPerLesson[lesson.id] || 0,
    }))

    return NextResponse.json({ lessons: lessonsWithCounts, total_points: totalPoints })
  } catch (err) {
    console.error('Lessons API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Save (create or update) a lesson with all its content ──

export async function POST(req: NextRequest) {
  let user
  try {
    user = await requireRole('superadmin', 'teacher')
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const body = await req.json()
    const {
      lessonId: existingLessonId,
      title,
      lesson_date,
      lesson_type,
      summary,
      status: newStatus,
      is_template,
      template_category,
      template_level,
      course_id,
      flashcards,
      exercises,
      blocks,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    let lessonId = existingLessonId

    // If teacher, verify they have access to the course (if one is specified)
    if (course_id && user.role === 'teacher') {
      const accessible = await getAccessibleCourseIds(user.email, user.role)
      if (!accessible.includes(course_id)) {
        return NextResponse.json({ error: 'You do not have access to this course' }, { status: 403 })
      }
    }

    if (lessonId) {
      // Update existing lesson — verify ownership for teachers
      if (user.role === 'teacher') {
        const { data: existing } = await supabase.from('lessons').select('created_by, course_id').eq('id', lessonId).single()
        if (!existing) {
          return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
        }
        const accessible = await getAccessibleCourseIds(user.email, user.role)
        const hasAccess = existing.created_by === user.email || (existing.course_id && accessible.includes(existing.course_id))
        if (!hasAccess) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      const { error } = await supabase
        .from('lessons')
        .update({
          title: title.trim(),
          lesson_date,
          lesson_type,
          summary: summary?.trim() || null,
          status: newStatus,
          is_template: is_template || false,
          template_category: template_category || null,
          template_level: template_level || null,
          course_id: course_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lessonId)
      if (error) throw error
    } else {
      // Create new lesson
      const { data, error } = await supabase
        .from('lessons')
        .insert({
          title: title.trim(),
          lesson_date,
          lesson_type,
          summary: summary?.trim() || null,
          status: newStatus,
          is_template: is_template || false,
          template_category: template_category || null,
          template_level: template_level || null,
          course_id: course_id || null,
          created_by: user.email,
        })
        .select('id')
        .single()
      if (error) throw error
      lessonId = data.id
    }

    // Save flashcards
    await supabase.from('lesson_flashcards').delete().eq('lesson_id', lessonId)
    if (flashcards && flashcards.length > 0) {
      const fcRows = flashcards.map((fc: { word: string; phonetic: string; meaning: string; example: string; notes: string; image_url?: string }, i: number) => ({
        lesson_id: lessonId,
        word: fc.word,
        phonetic: fc.phonetic,
        meaning: fc.meaning,
        example: fc.example,
        notes: fc.notes,
        image_url: fc.image_url || null,
        order_index: fc.hasOwnProperty('globalOrder') ? (fc as unknown as { globalOrder: number }).globalOrder * 1000 + i : i,
      }))
      const { error: fcError } = await supabase.from('lesson_flashcards').insert(fcRows)
      if (fcError) throw fcError
    }

    // Save exercises
    await supabase.from('lesson_exercises').delete().eq('lesson_id', lessonId)
    if (exercises && exercises.length > 0) {
      const exRows = exercises.map((ex: { title: string; subtitle: string; icon: string; instructions: string; exercise_type: string; questions: unknown; groupData?: unknown; order_index: number; points_per_answer?: number; completion_bonus?: number; is_mandatory?: boolean }) => ({
        lesson_id: lessonId,
        title: ex.title,
        subtitle: ex.subtitle,
        icon: ex.icon,
        instructions: ex.instructions,
        exercise_type: ex.exercise_type,
        questions: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.questions,
        order_index: ex.order_index,
        points_per_answer: ex.points_per_answer ?? 10,
        completion_bonus: ex.completion_bonus ?? 0,
        is_mandatory: ex.is_mandatory !== false,
      }))
      const { error: exError } = await supabase.from('lesson_exercises').insert(exRows)
      if (exError) throw exError
    }

    // Save content blocks
    await supabase.from('lesson_blocks').delete().eq('lesson_id', lessonId)
    if (blocks && blocks.length > 0) {
      const blockRows = blocks.map((b: { block_type: string; title: string; content: unknown; order_index: number }) => ({
        lesson_id: lessonId,
        block_type: b.block_type,
        title: b.title,
        content: b.content,
        order_index: b.order_index,
      }))
      const { error: blockError } = await supabase.from('lesson_blocks').insert(blockRows)
      if (blockError) throw blockError
    }

    return NextResponse.json({ ok: true, lessonId })
  } catch (err) {
    console.error('Lesson save error:', err)
    return NextResponse.json({ error: 'Failed to save lesson' }, { status: 500 })
  }
}

// ── Delete a lesson and all its content ──

export async function DELETE(req: NextRequest) {
  let user
  try {
    user = await requireRole('superadmin', 'teacher')
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const { lessonId } = await req.json()
    if (!lessonId) {
      return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })
    }

    // Teachers can only delete their own lessons or lessons in their courses
    if (user.role === 'teacher') {
      const { data: existing } = await supabase.from('lessons').select('created_by, course_id').eq('id', lessonId).single()
      if (!existing) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      }
      const accessible = await getAccessibleCourseIds(user.email, user.role)
      const hasAccess = existing.created_by === user.email || (existing.course_id && accessible.includes(existing.course_id))
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Clean up dialogue messages for blocks in this lesson
    const { data: blockData } = await supabase.from('lesson_blocks').select('id').eq('lesson_id', lessonId)
    if (blockData && blockData.length > 0) {
      const blockIds = blockData.map((b: { id: string }) => b.id)
      await supabase.from('dialogue_messages').delete().in('block_id', blockIds)
    }

    // Delete all related content, then the lesson itself
    await supabase.from('lesson_flashcards').delete().eq('lesson_id', lessonId)
    await supabase.from('lesson_exercises').delete().eq('lesson_id', lessonId)
    await supabase.from('lesson_blocks').delete().eq('lesson_id', lessonId)
    await supabase.from('lessons').delete().eq('id', lessonId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Lesson delete error:', err)
    return NextResponse.json({ error: 'Failed to delete lesson' }, { status: 500 })
  }
}
