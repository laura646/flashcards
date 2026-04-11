import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, getAccessibleCourseIds } from '@/lib/roles'

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('superadmin', 'teacher')
    const action = req.nextUrl.searchParams.get('action') || 'list'

    // ── List all templates (with optional filters) ──
    if (action === 'list') {
      const level = req.nextUrl.searchParams.get('level')
      const category = req.nextUrl.searchParams.get('category')
      const folderId = req.nextUrl.searchParams.get('folder_id')

      // If filtering by folder, get lesson IDs in that folder first
      let folderLessonIds: string[] | null = null
      if (folderId) {
        const { data: folderLinks } = await supabase
          .from('lesson_folders')
          .select('lesson_id')
          .eq('folder_id', folderId)
        folderLessonIds = (folderLinks || []).map((l: { lesson_id: string }) => l.lesson_id)
        if (folderLessonIds.length === 0) {
          return NextResponse.json({ templates: [] })
        }
      }

      let query = supabase
        .from('lessons')
        .select('id, title, lesson_date, lesson_type, summary, is_template, template_category, template_level, created_at, updated_at')
        .eq('is_template', true)
        .order('updated_at', { ascending: false })

      if (level) query = query.eq('template_level', level)
      if (category) query = query.eq('template_category', category)
      if (folderLessonIds) query = query.in('id', folderLessonIds)

      const { data: templates, error } = await query
      if (error) throw error

      // Get content counts for each template
      const templateIds = (templates || []).map((t: { id: string }) => t.id)
      if (templateIds.length === 0) {
        return NextResponse.json({ templates: [] })
      }

      const [fcRes, exRes, blockRes] = await Promise.all([
        supabase.from('lesson_flashcards').select('lesson_id').in('lesson_id', templateIds),
        supabase.from('lesson_exercises').select('lesson_id').in('lesson_id', templateIds),
        supabase.from('lesson_blocks').select('lesson_id, block_type').in('lesson_id', templateIds),
      ])

      const fcCounts: Record<string, number> = {}
      const exCounts: Record<string, number> = {}
      const blockCounts: Record<string, Record<string, number>> = {}

      for (const f of (fcRes.data || []) as { lesson_id: string }[]) {
        fcCounts[f.lesson_id] = (fcCounts[f.lesson_id] || 0) + 1
      }
      for (const e of (exRes.data || []) as { lesson_id: string }[]) {
        exCounts[e.lesson_id] = (exCounts[e.lesson_id] || 0) + 1
      }
      for (const b of (blockRes.data || []) as { lesson_id: string; block_type: string }[]) {
        if (!blockCounts[b.lesson_id]) blockCounts[b.lesson_id] = {}
        blockCounts[b.lesson_id][b.block_type] = (blockCounts[b.lesson_id][b.block_type] || 0) + 1
      }

      const templatesWithCounts = (templates || []).map((t: { id: string }) => ({
        ...t,
        flashcard_count: fcCounts[t.id] || 0,
        exercise_count: exCounts[t.id] || 0,
        block_counts: blockCounts[t.id] || {},
      }))

      return NextResponse.json({ templates: templatesWithCounts })
    }

    // ── List all folders (tree structure) ──
    if (action === 'list-folders') {
      const { data: folders, error } = await supabase
        .from('content_bank_folders')
        .select('id, name, parent_id, created_by, created_at')
        .order('name')

      if (error) throw error

      // Also get template counts per folder
      const { data: folderCounts } = await supabase
        .from('lesson_folders')
        .select('folder_id')

      const counts: Record<string, number> = {}
      for (const fc of (folderCounts || []) as { folder_id: string }[]) {
        counts[fc.folder_id] = (counts[fc.folder_id] || 0) + 1
      }

      const foldersWithCounts = (folders || []).map((f: { id: string; name: string; parent_id: string | null; created_by: string; created_at: string }) => ({
        ...f,
        template_count: counts[f.id] || 0,
      }))

      return NextResponse.json({ folders: foldersWithCounts })
    }

    // ── Get folders for a specific template ──
    if (action === 'template-folders') {
      const lessonId = req.nextUrl.searchParams.get('lesson_id')
      if (!lessonId) return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })

      const { data, error } = await supabase
        .from('lesson_folders')
        .select('folder_id')
        .eq('lesson_id', lessonId)
      if (error) throw error

      return NextResponse.json({ folder_ids: (data || []).map((d: { folder_id: string }) => d.folder_id) })
    }

    // ── Get template detail (full content for preview / cherry-pick) ──
    if (action === 'detail') {
      const templateId = req.nextUrl.searchParams.get('id')
      if (!templateId) {
        return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
      }

      const [lessonRes, fcRes, exRes, blockRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('id', templateId).eq('is_template', true).single(),
        supabase.from('lesson_flashcards').select('*').eq('lesson_id', templateId).order('order_index'),
        supabase.from('lesson_exercises').select('*').eq('lesson_id', templateId).order('order_index'),
        supabase.from('lesson_blocks').select('*').eq('lesson_id', templateId).order('order_index'),
      ])

      if (lessonRes.error || !lessonRes.data) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      return NextResponse.json({
        template: lessonRes.data,
        flashcards: fcRes.data || [],
        exercises: exRes.data || [],
        blocks: blockRes.data || [],
      })
    }

    void user
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    const e = err as { status?: number; message?: string }
    if (e.status === 401 || e.status === 403) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('Content Bank GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('superadmin', 'teacher')
    const body = await req.json()
    const { action } = body

    // ── Toggle template status ──
    if (action === 'toggle-template') {
      const { lesson_id, is_template, template_category, template_level } = body
      if (!lesson_id) {
        return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })
      }

      // Teachers can only toggle templates for lessons they own or in their courses
      if (user.role === 'teacher') {
        const { data: lesson } = await supabase.from('lessons').select('created_by, course_id').eq('id', lesson_id).single()
        if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
        const accessible = await getAccessibleCourseIds(user.email, user.role)
        if (lesson.created_by !== user.email && !(lesson.course_id && accessible.includes(lesson.course_id))) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      const updateData: Record<string, unknown> = {
        is_template: !!is_template,
      }
      if (is_template) {
        updateData.template_category = template_category || null
        updateData.template_level = template_level || null
      } else {
        updateData.template_category = null
        updateData.template_level = null
      }

      const { error } = await supabase.from('lessons').update(updateData).eq('id', lesson_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Clone entire lesson into a course ──
    if (action === 'clone-lesson') {
      const { template_id, course_id } = body
      if (!template_id || !course_id) {
        return NextResponse.json({ error: 'Template ID and course ID required' }, { status: 400 })
      }

      // Verify teacher has access to the target course
      if (user.role === 'teacher') {
        const accessible = await getAccessibleCourseIds(user.email, user.role)
        if (!accessible.includes(course_id)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      // Fetch template and all its content
      const [lessonRes, fcRes, exRes, blockRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('id', template_id).single(),
        supabase.from('lesson_flashcards').select('*').eq('lesson_id', template_id).order('order_index'),
        supabase.from('lesson_exercises').select('*').eq('lesson_id', template_id).order('order_index'),
        supabase.from('lesson_blocks').select('*').eq('lesson_id', template_id).order('order_index'),
      ])

      if (lessonRes.error || !lessonRes.data) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      const template = lessonRes.data

      // Create new lesson as draft in the target course
      const { data: newLesson, error: insertErr } = await supabase
        .from('lessons')
        .insert({
          title: template.title + ' (from template)',
          lesson_date: new Date().toISOString().split('T')[0],
          lesson_type: template.lesson_type || 'lesson',
          summary: template.summary,
          status: 'draft',
          course_id: course_id,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr
      const newId = newLesson.id

      // Copy flashcards
      const flashcards = fcRes.data || []
      if (flashcards.length > 0) {
        const fcRows = flashcards.map((fc: { word: string; phonetic: string; meaning: string; example: string; notes: string; order_index: number }) => ({
          lesson_id: newId,
          word: fc.word,
          phonetic: fc.phonetic,
          meaning: fc.meaning,
          example: fc.example,
          notes: fc.notes,
          order_index: fc.order_index,
        }))
        const { error } = await supabase.from('lesson_flashcards').insert(fcRows)
        if (error) throw error
      }

      // Copy exercises
      const exercises = exRes.data || []
      if (exercises.length > 0) {
        const exRows = exercises.map((ex: { title: string; subtitle: string; icon: string; instructions: string; exercise_type: string; questions: unknown; order_index: number }) => ({
          lesson_id: newId,
          title: ex.title,
          subtitle: ex.subtitle,
          icon: ex.icon,
          instructions: ex.instructions,
          exercise_type: ex.exercise_type,
          questions: ex.questions,
          order_index: ex.order_index,
        }))
        const { error } = await supabase.from('lesson_exercises').insert(exRows)
        if (error) throw error
      }

      // Copy blocks (skip dialogue — those are interactive and shouldn't be cloned)
      const blocks = blockRes.data || []
      if (blocks.length > 0) {
        const blockRows = blocks.map((b: { block_type: string; title: string; content: unknown; order_index: number }) => ({
          lesson_id: newId,
          block_type: b.block_type,
          title: b.title,
          content: b.content,
          order_index: b.order_index,
        }))
        const { error } = await supabase.from('lesson_blocks').insert(blockRows)
        if (error) throw error
      }

      return NextResponse.json({ ok: true, lesson_id: newId })
    }

    // ── Copy selected items into an existing lesson ──
    if (action === 'copy-items') {
      const { template_id, target_lesson_id, item_ids } = body as {
        template_id: string
        target_lesson_id: string
        item_ids: { flashcards: boolean; exercise_ids: string[]; block_ids: string[] }
      }

      if (!template_id || !target_lesson_id || !item_ids) {
        return NextResponse.json({ error: 'Template ID, target lesson ID, and item_ids required' }, { status: 400 })
      }

      // Verify teacher has access to the target lesson
      if (user.role === 'teacher') {
        const { data: targetLesson } = await supabase.from('lessons').select('created_by, course_id').eq('id', target_lesson_id).single()
        if (!targetLesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
        const accessible = await getAccessibleCourseIds(user.email, user.role)
        if (targetLesson.created_by !== user.email && !(targetLesson.course_id && accessible.includes(targetLesson.course_id))) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      // Get current max order_index in target lesson to append after existing content
      const [fcMax, exMax, blockMax] = await Promise.all([
        supabase.from('lesson_flashcards').select('order_index').eq('lesson_id', target_lesson_id).order('order_index', { ascending: false }).limit(1),
        supabase.from('lesson_exercises').select('order_index').eq('lesson_id', target_lesson_id).order('order_index', { ascending: false }).limit(1),
        supabase.from('lesson_blocks').select('order_index').eq('lesson_id', target_lesson_id).order('order_index', { ascending: false }).limit(1),
      ])

      const maxOrder = Math.max(
        (fcMax.data?.[0]?.order_index ?? -1),
        (exMax.data?.[0]?.order_index ?? -1),
        (blockMax.data?.[0]?.order_index ?? -1),
      ) + 1

      let nextOrder = maxOrder

      // Copy flashcards if selected
      if (item_ids.flashcards) {
        const { data: flashcards } = await supabase
          .from('lesson_flashcards')
          .select('*')
          .eq('lesson_id', template_id)
          .order('order_index')

        if (flashcards && flashcards.length > 0) {
          const fcRows = flashcards.map((fc: { word: string; phonetic: string; meaning: string; example: string; notes: string }, i: number) => ({
            lesson_id: target_lesson_id,
            word: fc.word,
            phonetic: fc.phonetic,
            meaning: fc.meaning,
            example: fc.example,
            notes: fc.notes,
            order_index: nextOrder * 1000 + i,
          }))
          const { error } = await supabase.from('lesson_flashcards').insert(fcRows)
          if (error) throw error
          nextOrder++
        }
      }

      // Copy selected exercises
      if (item_ids.exercise_ids && item_ids.exercise_ids.length > 0) {
        const { data: exercises } = await supabase
          .from('lesson_exercises')
          .select('*')
          .in('id', item_ids.exercise_ids)

        if (exercises && exercises.length > 0) {
          const exRows = exercises.map((ex: { title: string; subtitle: string; icon: string; instructions: string; exercise_type: string; questions: unknown }) => ({
            lesson_id: target_lesson_id,
            title: ex.title,
            subtitle: ex.subtitle,
            icon: ex.icon,
            instructions: ex.instructions,
            exercise_type: ex.exercise_type,
            questions: ex.questions,
            order_index: nextOrder++,
          }))
          const { error } = await supabase.from('lesson_exercises').insert(exRows)
          if (error) throw error
        }
      }

      // Copy selected blocks
      if (item_ids.block_ids && item_ids.block_ids.length > 0) {
        const { data: blocks } = await supabase
          .from('lesson_blocks')
          .select('*')
          .in('id', item_ids.block_ids)

        if (blocks && blocks.length > 0) {
          const blockRows = blocks.map((b: { block_type: string; title: string; content: unknown }) => ({
            lesson_id: target_lesson_id,
            block_type: b.block_type,
            title: b.title,
            content: b.content,
            order_index: nextOrder++,
          }))
          const { error } = await supabase.from('lesson_blocks').insert(blockRows)
          if (error) throw error
        }
      }

      return NextResponse.json({ ok: true })
    }

    // ── Create folder ──
    if (action === 'create-folder') {
      const { name, parent_id } = body
      if (!name?.trim()) return NextResponse.json({ error: 'Folder name required' }, { status: 400 })

      const { data, error } = await supabase
        .from('content_bank_folders')
        .insert({ name: name.trim(), parent_id: parent_id || null, created_by: user.email })
        .select('id, name, parent_id, created_by, created_at')
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, folder: data })
    }

    // ── Rename folder ──
    if (action === 'rename-folder') {
      const { folder_id, name } = body
      if (!folder_id || !name?.trim()) return NextResponse.json({ error: 'Folder ID and name required' }, { status: 400 })

      // Teachers can only rename their own folders
      if (user.role === 'teacher') {
        const { data: folder } = await supabase.from('content_bank_folders').select('created_by').eq('id', folder_id).single()
        if (!folder || folder.created_by !== user.email) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      const { error } = await supabase
        .from('content_bank_folders')
        .update({ name: name.trim() })
        .eq('id', folder_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Delete folder (cascade deletes children + lesson_folders links) ──
    if (action === 'delete-folder') {
      const { folder_id } = body
      if (!folder_id) return NextResponse.json({ error: 'Folder ID required' }, { status: 400 })

      // Teachers can only delete their own folders
      if (user.role === 'teacher') {
        const { data: folder } = await supabase.from('content_bank_folders').select('created_by').eq('id', folder_id).single()
        if (!folder || folder.created_by !== user.email) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      const { error } = await supabase
        .from('content_bank_folders')
        .delete()
        .eq('id', folder_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Assign template to folder ──
    if (action === 'assign-to-folder') {
      const { lesson_id, folder_id } = body
      if (!lesson_id || !folder_id) return NextResponse.json({ error: 'Lesson ID and folder ID required' }, { status: 400 })

      // Check if already assigned
      const { data: existing } = await supabase
        .from('lesson_folders')
        .select('id')
        .eq('lesson_id', lesson_id)
        .eq('folder_id', folder_id)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({ ok: true, message: 'Already in folder' })
      }

      const { error } = await supabase
        .from('lesson_folders')
        .insert({ lesson_id, folder_id })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Remove template from folder ──
    if (action === 'remove-from-folder') {
      const { lesson_id, folder_id } = body
      if (!lesson_id || !folder_id) return NextResponse.json({ error: 'Lesson ID and folder ID required' }, { status: 400 })

      const { error } = await supabase
        .from('lesson_folders')
        .delete()
        .eq('lesson_id', lesson_id)
        .eq('folder_id', folder_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Copy template to folder (clones the template and assigns to folder) ──
    if (action === 'copy-to-folder') {
      const { lesson_id, folder_id } = body
      if (!lesson_id || !folder_id) return NextResponse.json({ error: 'Lesson ID and folder ID required' }, { status: 400 })

      // Just assign the existing template to the folder (many-to-many)
      const { data: existing } = await supabase
        .from('lesson_folders')
        .select('id')
        .eq('lesson_id', lesson_id)
        .eq('folder_id', folder_id)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({ ok: true, message: 'Already in folder' })
      }

      const { error } = await supabase
        .from('lesson_folders')
        .insert({ lesson_id, folder_id })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Update exercise ──
    if (action === 'update-exercise') {
      const { exercise_id, title, subtitle, icon, instructions, exercise_type, questions, groupData } = body
      if (!exercise_id) return NextResponse.json({ error: 'Exercise ID required' }, { status: 400 })

      const updateData: Record<string, unknown> = {}
      if (title !== undefined) updateData.title = title
      if (subtitle !== undefined) updateData.subtitle = subtitle
      if (icon !== undefined) updateData.icon = icon
      if (instructions !== undefined) updateData.instructions = instructions
      if (exercise_type !== undefined) updateData.exercise_type = exercise_type
      if (questions !== undefined) updateData.questions = questions
      if (groupData !== undefined) updateData.questions = groupData

      const { error } = await supabase
        .from('lesson_exercises')
        .update(updateData)
        .eq('id', exercise_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Delete exercise ──
    if (action === 'delete-exercise') {
      const { exercise_id } = body
      if (!exercise_id) return NextResponse.json({ error: 'Exercise ID required' }, { status: 400 })

      const { error } = await supabase
        .from('lesson_exercises')
        .delete()
        .eq('id', exercise_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Save entire lesson to content bank as template ──
    if (action === 'save-lesson-to-bank') {
      const { lesson_id, template_category, template_level, folder_id } = body
      if (!lesson_id) return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })

      // Fetch source lesson and all content
      const [lessonRes, fcRes, exRes, blockRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('id', lesson_id).single(),
        supabase.from('lesson_flashcards').select('*').eq('lesson_id', lesson_id).order('order_index'),
        supabase.from('lesson_exercises').select('*').eq('lesson_id', lesson_id).order('order_index'),
        supabase.from('lesson_blocks').select('*').eq('lesson_id', lesson_id).order('order_index'),
      ])

      if (lessonRes.error || !lessonRes.data) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      }

      const src = lessonRes.data

      // Create template lesson
      const { data: newLesson, error: insertErr } = await supabase
        .from('lessons')
        .insert({
          title: src.title,
          lesson_date: src.lesson_date || new Date().toISOString().split('T')[0],
          lesson_type: src.lesson_type || 'lesson',
          summary: src.summary,
          status: 'draft',
          is_template: true,
          template_category: template_category || null,
          template_level: template_level || null,
          course_id: null,
          created_by: user.email,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr
      const newId = newLesson.id

      try {
        // Copy flashcards (match columns from clone-lesson)
        const flashcards = fcRes.data || []
        if (flashcards.length > 0) {
          const rows = flashcards.map((fc: Record<string, unknown>) => ({
            lesson_id: newId, word: fc.word, phonetic: fc.phonetic,
            meaning: fc.meaning, example: fc.example, notes: fc.notes,
            order_index: fc.order_index,
          }))
          const { error } = await supabase.from('lesson_flashcards').insert(rows)
          if (error) throw error
        }

        // Copy exercises (match columns from lessons API)
        const exercises = exRes.data || []
        if (exercises.length > 0) {
          const rows = exercises.map((ex: Record<string, unknown>) => ({
            lesson_id: newId, title: ex.title, subtitle: ex.subtitle,
            icon: ex.icon, instructions: ex.instructions,
            exercise_type: ex.exercise_type,
            questions: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.questions,
            order_index: ex.order_index,
            points_per_answer: ex.points_per_answer ?? 10,
            completion_bonus: ex.completion_bonus ?? 0,
            is_mandatory: ex.is_mandatory !== false,
          }))
          const { error } = await supabase.from('lesson_exercises').insert(rows)
          if (error) throw error
        }

        // Copy blocks
        const blocks = blockRes.data || []
        if (blocks.length > 0) {
          const rows = blocks.map((b: Record<string, unknown>) => ({
            lesson_id: newId, block_type: b.block_type,
            title: b.title, content: b.content, order_index: b.order_index,
          }))
          const { error } = await supabase.from('lesson_blocks').insert(rows)
          if (error) throw error
        }
      } catch (copyErr) {
        // Clean up the empty lesson shell if content copy fails
        await supabase.from('lessons').delete().eq('id', newId)
        throw copyErr
      }

      // Assign to folder if specified
      if (folder_id) {
        await supabase.from('lesson_folders').insert({ lesson_id: newId, folder_id })
      }

      return NextResponse.json({ ok: true, template_id: newId })
    }

    // ── Save single exercise to content bank ──
    if (action === 'save-exercise-to-bank') {
      const { exercise, template_category, template_level, folder_id } = body
      if (!exercise) return NextResponse.json({ error: 'Exercise data required' }, { status: 400 })

      const exTitle = exercise.title || exercise.exercise_type || 'Exercise'

      // Create a mini template lesson to hold the exercise
      const { data: newLesson, error: insertErr } = await supabase
        .from('lessons')
        .insert({
          title: exTitle,
          lesson_date: new Date().toISOString().split('T')[0],
          lesson_type: 'lesson',
          summary: `Saved exercise: ${exTitle}`,
          status: 'draft',
          is_template: true,
          template_category: template_category || null,
          template_level: template_level || null,
          course_id: null,
          created_by: user.email,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      // Insert the exercise
      const { error: exErr } = await supabase.from('lesson_exercises').insert({
        lesson_id: newLesson.id,
        title: exercise.title,
        subtitle: exercise.subtitle || '',
        icon: exercise.icon || '',
        instructions: exercise.instructions || '',
        exercise_type: exercise.exercise_type,
        questions: exercise.questions,
        order_index: 0,
        points_per_answer: exercise.points_per_answer ?? 10,
        completion_bonus: exercise.completion_bonus ?? 0,
        is_mandatory: exercise.is_mandatory !== false,
      })
      if (exErr) throw exErr

      // Assign to folder if specified
      if (folder_id) {
        await supabase.from('lesson_folders').insert({ lesson_id: newLesson.id, folder_id })
      }

      return NextResponse.json({ ok: true, template_id: newLesson.id })
    }

    // ── Save flashcards to content bank ──
    if (action === 'save-flashcards-to-bank') {
      const { flashcards, lesson_title, template_category, template_level, folder_id } = body
      if (!flashcards?.length) return NextResponse.json({ error: 'Flashcards required' }, { status: 400 })

      const { data: newLesson, error: insertErr } = await supabase
        .from('lessons')
        .insert({
          title: lesson_title || 'Vocabulary',
          lesson_date: new Date().toISOString().split('T')[0],
          lesson_type: 'lesson',
          summary: `Vocabulary: ${flashcards.length} flashcards`,
          status: 'draft',
          is_template: true,
          template_category: template_category || null,
          template_level: template_level || null,
          course_id: null,
          created_by: user.email,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      const rows = flashcards.map((fc: Record<string, unknown>, i: number) => ({
        lesson_id: newLesson.id,
        word: fc.word || '',
        phonetic: fc.phonetic || '',
        meaning: fc.meaning || '',
        example: fc.example || '',
        notes: fc.notes || '',
        order_index: i,
      }))
      const { error: fcErr } = await supabase.from('lesson_flashcards').insert(rows)
      if (fcErr) {
        await supabase.from('lessons').delete().eq('id', newLesson.id)
        throw fcErr
      }

      if (folder_id) {
        await supabase.from('lesson_folders').insert({ lesson_id: newLesson.id, folder_id })
      }

      return NextResponse.json({ ok: true, template_id: newLesson.id })
    }

    // ── Save content block to content bank ──
    if (action === 'save-block-to-bank') {
      const { block, template_category, template_level, folder_id } = body
      if (!block) return NextResponse.json({ error: 'Block data required' }, { status: 400 })

      const blockType = block.block_type || 'article'
      const { data: newLesson, error: insertErr } = await supabase
        .from('lessons')
        .insert({
          title: block.title || blockType,
          lesson_date: new Date().toISOString().split('T')[0],
          lesson_type: 'lesson',
          summary: `Content block: ${blockType}`,
          status: 'draft',
          is_template: true,
          template_category: template_category || null,
          template_level: template_level || null,
          course_id: null,
          created_by: user.email,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      const { error: blkErr } = await supabase.from('lesson_blocks').insert({
        lesson_id: newLesson.id,
        block_type: blockType,
        title: block.title || '',
        content: block.content || {},
        order_index: 0,
      })
      if (blkErr) {
        await supabase.from('lessons').delete().eq('id', newLesson.id)
        throw blkErr
      }

      if (folder_id) {
        await supabase.from('lesson_folders').insert({ lesson_id: newLesson.id, folder_id })
      }

      return NextResponse.json({ ok: true, template_id: newLesson.id })
    }

    void user
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    const e = err as { status?: number; message?: string }
    if (e.status === 401 || e.status === 403) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('Content Bank POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
