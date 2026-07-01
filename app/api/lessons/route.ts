import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getAccessibleCourseIds, requireRole } from '@/lib/roles'
import { isCompletableBlock, CONDITIONAL_BLOCK_TYPES } from '@/lib/block-completion'

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

    // Archive map (students only): course_id → archived_at. An archived learner
    // keeps everything up to the archive date but doesn't see lessons dated
    // after it. Fail-safe: if the column/query errors, nobody is hidden.
    const archivedAtByCourse: Record<string, string> = {}
    if (role === 'student') {
      const { data: enr, error: enrErr } = await supabase
        .from('course_students')
        .select('course_id, archived_at')
        .eq('student_email', email)
        .not('archived_at', 'is', null)
      if (!enrErr && enr) {
        for (const e of enr as { course_id: string; archived_at: string | null }[]) {
          if (e.archived_at) archivedAtByCourse[e.course_id] = e.archived_at
        }
      }
    }
    const isHiddenByArchive = (cId: string | null | undefined, lessonDate: string | null | undefined): boolean => {
      if (!cId) return false
      const arch = archivedAtByCourse[cId]
      if (!arch || !lessonDate) return false
      return new Date(lessonDate).getTime() > new Date(arch).getTime()
    }

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

      // Archived learners can't open lessons dated after their archive date.
      if (role === 'student' && isHiddenByArchive(lessonRes.data?.course_id, lessonRes.data?.lesson_date)) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      }

      // Resolve author display name for the editor header.
      let author_name: string | null = null
      const creator = lessonRes.data?.created_by
      if (creator) {
        const { data: u } = await supabase
          .from('users')
          .select('name')
          .eq('email', creator)
          .maybeSingle()
        if (u?.name) author_name = u.name
      }

      // Issue #6: students never see unpublished content even if they
      // poke at the API. Staff see everything so they can manage in the
      // editor.
      const flashcardsBlockHidden = lessonRes.data?.flashcards_published === false
      const safeExercises = isStaff
        ? exercisesRes.data || []
        : (exercisesRes.data || []).filter((ex: { published?: boolean }) => ex.published !== false)
      const safeBlocks = isStaff
        ? blocksRes.data || []
        : (blocksRes.data || []).filter((b: { published?: boolean }) => b.published !== false)
      const safeFlashcards = !isStaff && flashcardsBlockHidden ? [] : flashcardsRes.data || []

      return NextResponse.json({
        lesson: { ...lessonRes.data, author_name },
        flashcards: safeFlashcards,
        exercises: safeExercises,
        blocks: safeBlocks,
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

    // Hide lessons dated after a student's archive date for that course.
    const visibleLessons = (lessons || []).filter(
      (l: { course_id?: string | null; lesson_date?: string | null }) => !isHiddenByArchive(l.course_id, l.lesson_date)
    )

    // Get flashcard and exercise counts per lesson
    const lessonIds = visibleLessons.map((l: { id: string }) => l.id)

    if (lessonIds.length === 0) {
      return NextResponse.json({ lessons: [] })
    }

    const [flashcardCountsRes, exerciseCountsRes, blockCountsRes, exerciseIdsRes, folderLinksRes] = await Promise.all([
      supabase.from('lesson_flashcards').select('lesson_id').in('lesson_id', lessonIds),
      supabase.from('lesson_exercises').select('lesson_id, is_mandatory').in('lesson_id', lessonIds),
      supabase.from('lesson_blocks').select('id, lesson_id, block_type, published').in('lesson_id', lessonIds),
      // Pre-fetch exercise IDs for progress query (students only, but cheap to run always)
      supabase.from('lesson_exercises').select('id, lesson_id, is_mandatory, published').in('lesson_id', lessonIds),
      // Folder membership for My Library: bulk lesson→folder links, grouped
      // client-side into folder_ids[] per lesson (avoids per-lesson N+1).
      supabase.from('lesson_folders').select('lesson_id, folder_id').in('lesson_id', lessonIds),
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
    // Completable blocks count toward a lesson's items so block-based lessons
    // register progress. A block qualifies only if a student can actually see
    // AND finish it: published, and either an always-completable type
    // (dialogue/writing/ielts_reading — credited here via isCompletableBlock
    // with no content) or a media/grammar/mistakes block whose content carries
    // practice items (checked in the student branch, where content is loaded).
    const completableBlockIdsByLesson: Record<string, string[]> = {}
    ;(blockCountsRes.data || []).forEach((b: { id: string; lesson_id: string; block_type: string; published?: boolean | null }) => {
      if (!blockCounts[b.lesson_id]) blockCounts[b.lesson_id] = {}
      blockCounts[b.lesson_id][b.block_type] = (blockCounts[b.lesson_id][b.block_type] || 0) + 1
      if (b.published !== false && isCompletableBlock(b.block_type, undefined)) {
        if (!completableBlockIdsByLesson[b.lesson_id]) completableBlockIdsByLesson[b.lesson_id] = []
        completableBlockIdsByLesson[b.lesson_id].push(b.id)
      }
    })

    // Group folder links into folder_ids[] per lesson for My Library.
    const folderIdsByLesson: Record<string, string[]> = {}
    ;(folderLinksRes.data || []).forEach((l: { lesson_id: string; folder_id: string }) => {
      if (!folderIdsByLesson[l.lesson_id]) folderIdsByLesson[l.lesson_id] = []
      folderIdsByLesson[l.lesson_id].push(l.folder_id)
    })

    // For students, also fetch their progress to show completion indicators
    let exerciseCompletedCounts: Record<string, number> = {}
    let mandatoryCompletedCounts: Record<string, number> = {}
    let bonusCompletedCounts: Record<string, number> = {}
    let blocksCompletedCounts: Record<string, number> = {}
    let flashcardCompleted: Record<string, boolean> = {}
    let pointsPerLesson: Record<string, number> = {}
    let totalPoints = 0
    // Item denominators (student home) use only content the student can SEE:
    // published exercises/blocks, flashcards unless the lesson hides them.
    let visibleExerciseCounts: Record<string, number> = {}
    let visibleExerciseCompletedCounts: Record<string, number> = {}

    if (role === 'student') {
      // exerciseIdsRes already fetched in the Promise.all above
      const exerciseIdsByLesson: Record<string, string[]> = {}
      const mandatoryIdsByLesson: Record<string, string[]> = {}
      const bonusIdsByLesson: Record<string, string[]> = {}
      const visibleExerciseIdsByLesson: Record<string, string[]> = {}
      ;(exerciseIdsRes.data || []).forEach((e: { id: string; lesson_id: string; is_mandatory?: boolean; published?: boolean | null }) => {
        if (!exerciseIdsByLesson[e.lesson_id]) exerciseIdsByLesson[e.lesson_id] = []
        exerciseIdsByLesson[e.lesson_id].push(e.id)
        if (e.published !== false) {
          if (!visibleExerciseIdsByLesson[e.lesson_id]) visibleExerciseIdsByLesson[e.lesson_id] = []
          visibleExerciseIdsByLesson[e.lesson_id].push(e.id)
        }
        if (e.is_mandatory === false) {
          if (!bonusIdsByLesson[e.lesson_id]) bonusIdsByLesson[e.lesson_id] = []
          bonusIdsByLesson[e.lesson_id].push(e.id)
        } else {
          if (!mandatoryIdsByLesson[e.lesson_id]) mandatoryIdsByLesson[e.lesson_id] = []
          mandatoryIdsByLesson[e.lesson_id].push(e.id)
        }
      })
      for (const [lid, ids] of Object.entries(visibleExerciseIdsByLesson)) {
        visibleExerciseCounts[lid] = ids.length
      }

      // Conditional block types (media/grammar/mistakes) only complete via
      // practice items in their content — load content to tell bare blocks
      // (no completion path, excluded) from ones with questions (included).
      if (lessonIds.length > 0) {
        const { data: condRows } = await supabase
          .from('lesson_blocks')
          .select('id, lesson_id, block_type, published, content')
          .in('lesson_id', lessonIds)
          .in('block_type', CONDITIONAL_BLOCK_TYPES)
        ;(condRows || []).forEach((b: { id: string; lesson_id: string; block_type: string; published?: boolean | null; content?: unknown }) => {
          if (b.published !== false && isCompletableBlock(b.block_type, b.content)) {
            if (!completableBlockIdsByLesson[b.lesson_id]) completableBlockIdsByLesson[b.lesson_id] = []
            completableBlockIdsByLesson[b.lesson_id].push(b.id)
          }
        })
      }

      const allExerciseIds = (exerciseIdsRes.data || []).map((e: { id: string }) => e.id)
      const allBlockIds = Object.values(completableBlockIdsByLesson).flat()
      // Flashcard completions are written as "<lessonId>:<mode>" — enumerate
      // the three modes per lesson so the .in() filter matches them exactly.
      const flashcardIds = lessonIds
        .filter((lid: string) => (flashcardCounts[lid] || 0) > 0)
        .flatMap((lid: string) => [`${lid}:flip`, `${lid}:self-assess`, `${lid}:quiz`])
      const allActivityIds = [...allExerciseIds, ...allBlockIds, ...flashcardIds]

      if (allActivityIds.length > 0) {
        // Filter progress at DB level — only fetch records for items in these
        // lessons. Chunked: the id list (exercises + blocks + 3 flashcard ids
        // per lesson) can approach PostgREST's URL cap on large courses.
        const progressRows: { activity_type: string; activity_id: string; points_earned: number | null }[] = []
        for (let i = 0; i < allActivityIds.length; i += 150) {
          const { data: rows, error: chunkErr } = await supabase
            .from('progress')
            .select('activity_type, activity_id, points_earned')
            .eq('user_email', email)
            .in('activity_type', ['exercise', 'flashcard', 'block', 'writing'])
            .in('activity_id', allActivityIds.slice(i, i + 150))
          // A failed chunk only UNDER-counts completion for this request;
          // log it so degradation is observable instead of silent.
          if (chunkErr) console.error('lessons progress chunk failed:', chunkErr.message)
          progressRows.push(...((rows || []) as typeof progressRows))
        }
        const progressRes = { data: progressRows }

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

        // Interactive blocks completed ('block' rows, or 'writing' submissions).
        const doneBlockIds = new Set(
          (progressRes.data || [])
            .filter((p: { activity_type: string }) => p.activity_type === 'block' || p.activity_type === 'writing')
            .map((p: { activity_id: string }) => p.activity_id)
        )

        // Flashcards done per lesson — matched by the "<lessonId>:<mode>" id,
        // so ONLY that lesson's set is credited (previously any flashcard
        // activity anywhere marked every lesson's flashcards as studied).
        ;(progressRes.data || [])
          .filter((p: { activity_type: string }) => p.activity_type === 'flashcard')
          .forEach((p: { activity_id: string }) => {
            const lid = p.activity_id.split(':')[0]
            if ((flashcardCounts[lid] || 0) > 0) flashcardCompleted[lid] = true
          })

        // Count completed exercises per lesson + aggregate points
        for (const [lid, exIds] of Object.entries(exerciseIdsByLesson)) {
          exerciseCompletedCounts[lid] = exIds.filter(id => completedActivityIds.has(id)).length
          mandatoryCompletedCounts[lid] = (mandatoryIdsByLesson[lid] || []).filter(id => completedActivityIds.has(id)).length
          bonusCompletedCounts[lid] = (bonusIdsByLesson[lid] || []).filter(id => completedActivityIds.has(id)).length
          visibleExerciseCompletedCounts[lid] = (visibleExerciseIdsByLesson[lid] || []).filter(id => completedActivityIds.has(id)).length
          let lessonPts = 0
          exIds.forEach(id => { lessonPts += pointsByActivityId[id] || 0 })
          pointsPerLesson[lid] = lessonPts
          totalPoints += lessonPts
        }

        // Count completed blocks per lesson
        for (const [lid, blockIds] of Object.entries(completableBlockIdsByLesson)) {
          blocksCompletedCounts[lid] = blockIds.filter(id => doneBlockIds.has(id)).length
        }
      }
    }

    const lessonsWithCounts = visibleLessons.map((lesson: { id: string; flashcards_published?: boolean | null }) => ({
      ...lesson,
      flashcard_count: flashcardCounts[lesson.id] || 0,
      exercise_count: exerciseCounts[lesson.id] || 0,
      mandatory_exercise_count: mandatoryExerciseCounts[lesson.id] || 0,
      bonus_exercise_count: bonusExerciseCounts[lesson.id] || 0,
      block_counts: blockCounts[lesson.id] || {},
      folder_ids: folderIdsByLesson[lesson.id] || [],
      exercises_completed: exerciseCompletedCounts[lesson.id] || 0,
      mandatory_completed: mandatoryCompletedCounts[lesson.id] || 0,
      bonus_completed: bonusCompletedCounts[lesson.id] || 0,
      flashcards_studied: flashcardCompleted[lesson.id] || false,
      points_earned: pointsPerLesson[lesson.id] || 0,
      // All completable items (exercises + interactive blocks + flashcard set)
      // so block-based lessons (no lesson_exercises) still register progress.
      // Students: only items they can SEE and FINISH count (published rows,
      // blocks with a completion path, flashcards unless the lesson hides
      // them) — otherwise the lesson could never reach 100%.
      item_count:
        (role === 'student' ? visibleExerciseCounts[lesson.id] || 0 : exerciseCounts[lesson.id] || 0) +
        (completableBlockIdsByLesson[lesson.id]?.length || 0) +
        ((flashcardCounts[lesson.id] || 0) > 0 && lesson.flashcards_published !== false ? 1 : 0),
      items_completed:
        (visibleExerciseCompletedCounts[lesson.id] || 0) +
        (blocksCompletedCounts[lesson.id] || 0) +
        (flashcardCompleted[lesson.id] && lesson.flashcards_published !== false ? 1 : 0),
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

    // ── Lightweight ASSIGN action ──
    // Sets ONLY course_id on an existing lesson (assign to a course, or
    // unassign with null). Returns early so we never run the heavy
    // create/update upsert that deletes + reinserts all child content.
    if (body.action === 'assign-course') {
      const { lessonId, course_id: targetCourseId } = body
      if (!lessonId) {
        return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })
      }

      // Access check: superadmin always allowed. Teacher allowed only if
      // they own the lesson OR have access to the target course.
      if (user.role === 'teacher') {
        const { data: existing } = await supabase
          .from('lessons')
          .select('created_by')
          .eq('id', lessonId)
          .single()
        if (!existing) {
          return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
        }
        const accessible = await getAccessibleCourseIds(user.email, user.role)
        const hasAccess =
          existing.created_by === user.email ||
          (targetCourseId && accessible.includes(targetCourseId))
        if (!hasAccess) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      const { error } = await supabase
        .from('lessons')
        .update({ course_id: targetCourseId || null, updated_at: new Date().toISOString() })
        .eq('id', lessonId)
      if (error) throw error

      return NextResponse.json({ ok: true })
    }

    const {
      lessonId: existingLessonId,
      title,
      lesson_date,
      lesson_type,
      summary,
      status: newStatus,
      is_template,
      is_shared,
      template_category,
      template_level,
      course_id,
      flashcards,
      exercises,
      blocks,
      flashcards_published,
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
          is_shared: is_shared || false,
          template_category: template_category || null,
          template_level: template_level || null,
          course_id: course_id || null,
          flashcards_published: flashcards_published !== false,
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
          is_shared: is_shared || false,
          template_category: template_category || null,
          template_level: template_level || null,
          course_id: course_id || null,
          flashcards_published: flashcards_published !== false,
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
      const exRows = exercises.map((ex: { title: string; subtitle: string; icon: string; instructions: string; exercise_type: string; questions: unknown; groupData?: unknown; order_index: number; points_per_answer?: number; completion_bonus?: number; is_mandatory?: boolean; skills?: string[] | null; cefr_level?: string | null; test_type?: string | null; published?: boolean }) => ({
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
        skills: ex.skills && ex.skills.length > 0 ? ex.skills : null,
        cefr_level: ex.cefr_level || null,
        test_type: ex.test_type || null,
        published: ex.published !== false,
      }))
      const { error: exError } = await supabase.from('lesson_exercises').insert(exRows)
      if (exError) throw exError
    }

    // Save content blocks
    await supabase.from('lesson_blocks').delete().eq('lesson_id', lessonId)
    if (blocks && blocks.length > 0) {
      const blockRows = blocks.map((b: { block_type: string; title: string; content: unknown; order_index: number; published?: boolean }) => ({
        lesson_id: lessonId,
        block_type: b.block_type,
        title: b.title,
        content: b.content,
        order_index: b.order_index,
        published: b.published !== false,
      }))
      const { error: blockError } = await supabase.from('lesson_blocks').insert(blockRows)
      if (blockError) throw blockError
    }

    return NextResponse.json({ ok: true, lessonId })
  } catch (err) {
    console.error('Lesson save error:', err)
    // Supabase errors aren't standard Error instances — they're plain
    // objects with { message, details, hint, code }. Pull the relevant
    // fields out so the browser sees a useful message.
    let detail: string = '(unknown)'
    if (err && typeof err === 'object') {
      const e = err as { message?: string; details?: string; hint?: string; code?: string }
      detail = e.message || e.details || e.hint || JSON.stringify(err)
      if (e.code) detail = `[${e.code}] ${detail}`
    } else if (typeof err === 'string') {
      detail = err
    }
    return NextResponse.json({ error: 'Failed to save lesson', detail }, { status: 500 })
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
