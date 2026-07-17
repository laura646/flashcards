import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole, getAccessibleCourseIds, isEditor, type UserRole } from '@/lib/roles'
import { deepCopyLesson } from '@/lib/lesson-copy'

// Access gate for filing a lesson into a folder (assign / remove).
// Superadmins bypass. Content-bank folders are SHARED org structure (the School
// Library shows the whole folder tree to everyone), so any teacher may file into
// ANY folder — the gate is on the CONTENT, not folder ownership. A teacher must
// own the lesson, have access to its course, OR the lesson must be shared to the
// School Library (is_shared). Renaming/deleting folders stays owner-gated.
async function checkFolderAssignAccess(
  user: { email: string; role: UserRole },
  lessonId: string,
  folderId: string
): Promise<NextResponse | null> {
  if (user.role === 'superadmin') return null

  const [{ data: lesson }, { data: folder }] = await Promise.all([
    supabase.from('lessons').select('created_by, course_id, is_shared').eq('id', lessonId).single(),
    supabase.from('content_bank_folders').select('id').eq('id', folderId).single(),
  ])

  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

  // Gate on the content: own the lesson, have access to its course, or it's
  // shared to the School Library. Folder ownership is NOT required (folders are
  // shared org structure).
  const accessible = await getAccessibleCourseIds(user.email, user.role)
  const lessonOk =
    lesson.created_by === user.email ||
    (lesson.course_id && accessible.includes(lesson.course_id)) ||
    lesson.is_shared === true
  if (!lessonOk) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}

// Access gate for MUTATING a lesson's content (editing/deleting its exercises,
// or copying/adding content INTO it as a target). Superadmin bypasses. A
// teacher may mutate if they own the lesson, have access to its course, OR
// they're an Editor AND the lesson is SHARED to the School Library. Editors are
// scoped to shared content only — a private (is_shared=false) lesson or
// template is NOT editable by an editor.
async function checkLessonEditAccess(
  user: { email: string; role: UserRole },
  lessonId: string
): Promise<NextResponse | null> {
  if (user.role === 'superadmin') return null
  const { data: lesson } = await supabase
    .from('lessons')
    .select('created_by, course_id, is_shared')
    .eq('id', lessonId)
    .single()
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  const accessible = await getAccessibleCourseIds(user.email, user.role)
  const editorOk = lesson.is_shared === true && (await isEditor(user.email))
  const ok =
    lesson.created_by === user.email ||
    (lesson.course_id && accessible.includes(lesson.course_id)) ||
    editorOk
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// Access gate for READING a SOURCE lesson/template whose content is about to be
// copied into caller-owned content (clone/save/copy actions). Superadmin
// bypasses. Broader than the edit gate: library content is meant to be
// reusable, so a source is viewable if the caller owns it, has access to its
// course, OR it's shared to the School Library (is_shared) OR it's a template
// (is_template). Only someone else's PRIVATE, unshared, non-template lesson is
// forbidden — closes a read-exposure where a teacher could exfiltrate another
// teacher's private lesson content by cloning it into their own library.
async function checkSourceReadAccess(
  user: { email: string; role: UserRole },
  lessonId: string
): Promise<NextResponse | null> {
  if (user.role === 'superadmin') return null
  const { data: lesson } = await supabase
    .from('lessons')
    .select('created_by, course_id, is_shared, is_template')
    .eq('id', lessonId)
    .single()
  if (!lesson) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  const accessible = await getAccessibleCourseIds(user.email, user.role)
  const ok =
    lesson.created_by === user.email ||
    (lesson.course_id && accessible.includes(lesson.course_id)) ||
    lesson.is_shared === true ||
    lesson.is_template === true
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// Resolve an exercise to its lesson, then apply the lesson-edit gate. Closes a
// pre-existing hole where update/delete-exercise had no ownership check.
async function checkExerciseEditAccess(
  user: { email: string; role: UserRole },
  exerciseId: string
): Promise<NextResponse | null> {
  if (user.role === 'superadmin') return null
  const { data: exRow } = await supabase.from('lesson_exercises').select('lesson_id').eq('id', exerciseId).single()
  if (!exRow) return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  return checkLessonEditAccess(user, exRow.lesson_id)
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('superadmin', 'teacher')
    const action = req.nextUrl.searchParams.get('action') || 'list'

    // ── List content (with optional filters + scope) ──
    // scope controls WHICH content is listed:
    //   'school' (DEFAULT) → is_shared = true. The School Library page.
    //   'mine'             → created_by = session email (the caller's own content).
    //   'all'              → legacy behaviour: is_template = true (flat template lib).
    // folder_id / level / category filters apply on top of the scope.
    if (action === 'list') {
      const level = req.nextUrl.searchParams.get('level')
      const category = req.nextUrl.searchParams.get('category')
      const folderId = req.nextUrl.searchParams.get('folder_id')
      const scope = req.nextUrl.searchParams.get('scope') || 'school'

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
        .select('id, title, lesson_date, lesson_type, summary, is_template, is_shared, template_category, template_level, created_at, updated_at, created_by')
        .order('updated_at', { ascending: false })

      // Scope filter
      if (scope === 'mine') query = query.eq('created_by', user.email)
      else if (scope === 'all') query = query.eq('is_template', true)
      else query = query.eq('is_shared', true) // 'school' (default)

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

      // Batch-resolve author display names from the users table.
      const authorEmails = Array.from(
        new Set(
          (templates || [])
            .map((t: { created_by: string | null }) => t.created_by)
            .filter((e: string | null): e is string => !!e)
        )
      )
      const authorNames: Record<string, string> = {}
      if (authorEmails.length > 0) {
        const { data: userRows } = await supabase
          .from('users')
          .select('email, name')
          .in('email', authorEmails)
        for (const u of (userRows || []) as { email: string; name: string | null }[]) {
          if (u.name) authorNames[u.email] = u.name
        }
      }

      const templatesWithCounts = (templates || []).map(
        (t: { id: string; created_by: string | null }) => ({
          ...t,
          flashcard_count: fcCounts[t.id] || 0,
          exercise_count: exCounts[t.id] || 0,
          block_counts: blockCounts[t.id] || {},
          author_email: t.created_by || null,
          author_name: t.created_by ? authorNames[t.created_by] || 'Unknown' : 'Unknown',
        })
      )

      return NextResponse.json({ templates: templatesWithCounts })
    }

    // ── List folders (tree structure) ──
    // Default: returns ALL folders (legacy content-bank behaviour, unchanged).
    // With ?mine=true: returns ONLY the caller's own folders (created_by =
    // session email). My Library uses mine=true so folders are personal per
    // teacher. Applies to superadmins too — "mine" means the caller's folders.
    if (action === 'list-folders') {
      const mine = req.nextUrl.searchParams.get('mine') === 'true'

      let folderQuery = supabase
        .from('content_bank_folders')
        .select('id, name, parent_id, created_by, created_at')
        .order('name')

      if (mine) folderQuery = folderQuery.eq('created_by', user.email)

      const { data: folders, error } = await folderQuery

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

      // Resolve author display name
      let author_name = 'Unknown'
      const tplCreator = (lessonRes.data as { created_by: string | null }).created_by
      if (tplCreator) {
        const { data: userRow } = await supabase
          .from('users')
          .select('name')
          .eq('email', tplCreator)
          .maybeSingle()
        if (userRow?.name) author_name = userRow.name
      }

      return NextResponse.json({
        template: { ...lessonRes.data, author_email: tplCreator || null, author_name },
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

    // ── Share own content to the School Library ──
    // Gate: caller must OWN the content (created_by === session email) OR be a
    // superadmin. Any trainer can share THEIR OWN content. 403 otherwise.
    if (action === 'share-to-school') {
      const { lesson_id } = body
      if (!lesson_id) return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })

      const { data: lesson } = await supabase
        .from('lessons')
        .select('created_by')
        .eq('id', lesson_id)
        .single()
      if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      if (user.role !== 'superadmin' && lesson.created_by !== user.email) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { error } = await supabase
        .from('lessons')
        .update({ is_shared: true })
        .eq('id', lesson_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Unshare content from the School Library ──
    // Gate: owner (created_by === session email) OR superadmin. 403 otherwise.
    if (action === 'unshare-from-school') {
      const { lesson_id } = body
      if (!lesson_id) return NextResponse.json({ error: 'Lesson ID required' }, { status: 400 })

      const { data: lesson } = await supabase
        .from('lessons')
        .select('created_by')
        .eq('id', lesson_id)
        .single()
      if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      if (user.role !== 'superadmin' && lesson.created_by !== user.email) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { error } = await supabase
        .from('lessons')
        .update({ is_shared: false })
        .eq('id', lesson_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── Clone entire lesson into a course ──
    if (action === 'clone-lesson') {
      const { template_id, course_id } = body
      // Batch import: teacher picks publish-now / save-as-draft / schedule
      // for the whole selection. A scheduled lesson stays 'draft' + carries
      // publish_at; the cron flips it to 'published' at that time (so it
      // stays hidden from students until then).
      const publishAt: string | null =
        typeof body.publish_at === 'string' && body.publish_at ? body.publish_at : null
      const cloneStatus = publishAt
        ? 'draft'
        : body.status === 'published'
        ? 'published'
        : 'draft'
      const cloneDate =
        typeof body.lesson_date === 'string' && body.lesson_date
          ? body.lesson_date
          : new Date().toISOString().split('T')[0]
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

      // Gate the SOURCE: caller must be allowed to view the template being cloned.
      const srcGate = await checkSourceReadAccess(user, template_id)
      if (srcGate) return srcGate

      // Field-complete deep copy (lib/lesson-copy) — carries flashcard
      // images, exercise points/skills/mandatory/test_type, block published
      // states and the exam settings (time limit / reveal / language), which
      // the old inline clone silently dropped.
      let newId: string
      try {
        const copied = await deepCopyLesson(template_id, {
          courseId: course_id,
          status: cloneStatus as 'draft' | 'published',
          lessonDate: cloneDate,
          publishAt,
        })
        newId = copied.lessonId
      } catch (e) {
        if (e instanceof Error && e.message === 'Template not found') {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }
        throw e
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

      // Gate the SOURCE: caller must be allowed to view the template items come from.
      const srcGate = await checkSourceReadAccess(user, template_id)
      if (srcGate) return srcGate

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
          .eq('lesson_id', template_id)
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
          .eq('lesson_id', template_id)
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

    // ── Finalize a presentation upload (superadmin only) ──
    // The deck HTML is uploaded browser→Storage directly (Vercel caps API
    // bodies at 4.5MB); this creates the shared library lesson + presentation
    // block and files it into the Presentations folder tree.
    if (action === 'create-presentation') {
      // Live Session Content comes in three kinds:
      //   html   — uploaded deck file. Superadmin/editor only (an HTML file
      //            is a little web page; keep the XSS surface closed).
      //   pdf    — uploaded file, rendered natively in the /present tab.
      //   slides — a Google Slides link (no upload).
      // Any teacher may add pdf/slides.
      const kind = body.kind === 'pdf' ? 'pdf' : body.kind === 'slides' ? 'slides' : 'html'
      if (kind === 'html') {
        const editorOk = user.role === 'superadmin' || (await isEditor(user.email))
        if (!editorOk) {
          return NextResponse.json({ error: 'HTML decks can only be uploaded by a superadmin or editor' }, { status: 403 })
        }
      } else if (user.role !== 'superadmin' && user.role !== 'teacher') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { title, level, deck_path, folder_id, new_folder_name, external_url } = body
      if (!title?.trim()) {
        return NextResponse.json({ error: 'Title required' }, { status: 400 })
      }
      if (kind === 'slides') {
        const u = String(external_url || '')
        if (!/^https:\/\/docs\.google\.com\/presentation\//.test(u)) {
          return NextResponse.json({ error: 'Paste a Google Slides link (it starts with https://docs.google.com/presentation/…)' }, { status: 400 })
        }
      } else if (!deck_path) {
        return NextResponse.json({ error: 'Deck file required' }, { status: 400 })
      }

      const ensurePresentationsRoot = async (): Promise<string> => {
        const { data: root } = await supabase
          .from('content_bank_folders')
          .select('id')
          .eq('name', 'Presentations')
          .is('parent_id', null)
          .limit(1)
          .maybeSingle()
        if (root) return root.id
        const { data: made, error: mkErr } = await supabase
          .from('content_bank_folders')
          .insert({ name: 'Presentations', parent_id: null, created_by: user.email })
          .select('id')
          .single()
        if (mkErr) throw mkErr
        return made.id
      }

      // Resolve target folder — always inside the Presentations tree.
      let targetFolderId: string
      if (new_folder_name?.trim()) {
        const presId = await ensurePresentationsRoot()
        const { data: made, error: fErr } = await supabase
          .from('content_bank_folders')
          .insert({ name: new_folder_name.trim(), parent_id: presId, created_by: user.email })
          .select('id')
          .single()
        if (fErr) throw fErr
        targetFolderId = made.id
      } else if (folder_id) {
        targetFolderId = folder_id
      } else {
        targetFolderId = await ensurePresentationsRoot()
      }

      const deckUrl = deck_path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/exercise-images/${deck_path}`
        : null
      const today = new Date().toISOString().split('T')[0]
      const summaryByKind: Record<string, string> = {
        html: 'Class presentation (Claude Design) — full-screen slides. Present in class; share your screen on Zoom.',
        pdf: 'Class presentation (PDF) — opens full-screen in a new tab. Present in class; share your screen on Zoom.',
        slides: 'Class presentation (Google Slides) — opens in a new tab. Present in class; share your screen on Zoom.',
      }

      const { data: lesson, error: lErr } = await supabase
        .from('lessons')
        .insert({
          title: title.trim(),
          summary: summaryByKind[kind],
          lesson_date: today,
          status: 'published',
          lesson_type: 'lesson',
          is_template: true,
          is_shared: true,
          template_level: level || null,
          course_id: null,
          created_by: user.email,
        })
        .select('id')
        .single()
      if (lErr) throw lErr

      const { error: bErr } = await supabase.from('lesson_blocks').insert({
        lesson_id: lesson.id,
        block_type: 'presentation',
        title: 'Presentation deck',
        order_index: 0,
        published: true,
        content:
          kind === 'slides'
            ? { kind, external_url: String(external_url) }
            : kind === 'pdf'
              ? { kind, deck_url: deckUrl }
              : { kind, deck_url: deckUrl, source: 'claude-design', audio_bundled: true },
      })
      if (bErr) throw bErr

      await supabase.from('lesson_folders').insert({ lesson_id: lesson.id, folder_id: targetFolderId })

      return NextResponse.json({ ok: true, lesson_id: lesson.id })
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

    // ── Assign a lesson to a folder (any lesson: draft / assigned / published /
    // template — NOT restricted to is_template). Owner/access-gated for teachers:
    // they must own the lesson (created_by) or have access to its course, AND
    // own the target folder (folders are personal). Superadmins bypass. ──
    if (action === 'assign-to-folder') {
      const { lesson_id, folder_id } = body
      if (!lesson_id || !folder_id) return NextResponse.json({ error: 'Lesson ID and folder ID required' }, { status: 400 })

      const denied = await checkFolderAssignAccess(user, lesson_id, folder_id)
      if (denied) return denied

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

    // ── Remove a lesson from a folder. Same owner/access gate as assign. ──
    if (action === 'remove-from-folder') {
      const { lesson_id, folder_id } = body
      if (!lesson_id || !folder_id) return NextResponse.json({ error: 'Lesson ID and folder ID required' }, { status: 400 })

      const denied = await checkFolderAssignAccess(user, lesson_id, folder_id)
      if (denied) return denied

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
      const gate = await checkExerciseEditAccess(user, exercise_id)
      if (gate) return gate

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
      const gate = await checkExerciseEditAccess(user, exercise_id)
      if (gate) return gate

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

      // Gate the SOURCE: caller must be allowed to view the lesson being saved.
      const srcGate = await checkSourceReadAccess(user, lesson_id)
      if (srcGate) return srcGate

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

    // ── Copy template content to existing lesson ──
    if (action === 'copy-to-lesson') {
      const { template_id, target_lesson_id } = body
      if (!template_id || !target_lesson_id) {
        return NextResponse.json({ error: 'Template ID and target lesson ID required' }, { status: 400 })
      }
      // Must be allowed to mutate the TARGET lesson (was ungated).
      const gate = await checkLessonEditAccess(user, target_lesson_id)
      if (gate) return gate

      // Gate the SOURCE: caller must be allowed to view the template being copied.
      const srcGate = await checkSourceReadAccess(user, template_id)
      if (srcGate) return srcGate

      // Fetch template content
      const [fcRes, exRes, blockRes] = await Promise.all([
        supabase.from('lesson_flashcards').select('*').eq('lesson_id', template_id).order('order_index'),
        supabase.from('lesson_exercises').select('*').eq('lesson_id', template_id).order('order_index'),
        supabase.from('lesson_blocks').select('*').eq('lesson_id', template_id).order('order_index'),
      ])

      // Get current max order_index in target lesson for each content type
      const [existingFc, existingEx, existingBlocks] = await Promise.all([
        supabase.from('lesson_flashcards').select('order_index').eq('lesson_id', target_lesson_id).order('order_index', { ascending: false }).limit(1),
        supabase.from('lesson_exercises').select('order_index').eq('lesson_id', target_lesson_id).order('order_index', { ascending: false }).limit(1),
        supabase.from('lesson_blocks').select('order_index').eq('lesson_id', target_lesson_id).order('order_index', { ascending: false }).limit(1),
      ])

      const fcOffset = ((existingFc.data?.[0]?.order_index as number) ?? -1) + 1
      const exOffset = ((existingEx.data?.[0]?.order_index as number) ?? -1) + 1
      const blockOffset = ((existingBlocks.data?.[0]?.order_index as number) ?? -1) + 1

      let copied = 0

      // Copy flashcards
      const flashcards = fcRes.data || []
      if (flashcards.length > 0) {
        const rows = flashcards.map((fc: Record<string, unknown>, i: number) => ({
          lesson_id: target_lesson_id,
          word: fc.word, phonetic: fc.phonetic,
          meaning: fc.meaning, example: fc.example, notes: fc.notes,
          order_index: fcOffset + i,
        }))
        const { error } = await supabase.from('lesson_flashcards').insert(rows)
        if (error) throw error
        copied += flashcards.length
      }

      // Copy exercises
      const exercises = exRes.data || []
      if (exercises.length > 0) {
        const rows = exercises.map((ex: Record<string, unknown>, i: number) => ({
          lesson_id: target_lesson_id,
          title: ex.title, subtitle: ex.subtitle,
          icon: ex.icon, instructions: ex.instructions,
          exercise_type: ex.exercise_type,
          questions: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.questions,
          order_index: exOffset + i,
          points_per_answer: ex.points_per_answer ?? 10,
          completion_bonus: ex.completion_bonus ?? 0,
          is_mandatory: ex.is_mandatory !== false,
        }))
        const { error } = await supabase.from('lesson_exercises').insert(rows)
        if (error) throw error
        copied += exercises.length
      }

      // Copy blocks
      const blocks = blockRes.data || []
      if (blocks.length > 0) {
        const rows = blocks.map((b: Record<string, unknown>, i: number) => ({
          lesson_id: target_lesson_id,
          block_type: b.block_type,
          title: b.title, content: b.content,
          order_index: blockOffset + i,
        }))
        const { error } = await supabase.from('lesson_blocks').insert(rows)
        if (error) throw error
        copied += blocks.length
      }

      return NextResponse.json({ ok: true, copied })
    }

    // ── Create empty template lesson (for Save to Bank flow) ──
    if (action === 'create-template') {
      const { title: tTitle, template_category, template_level, folder_id } = body
      if (!tTitle) return NextResponse.json({ error: 'Title required' }, { status: 400 })

      const { data: newLesson, error: insertErr } = await supabase
        .from('lessons')
        .insert({
          title: tTitle,
          lesson_date: new Date().toISOString().split('T')[0],
          lesson_type: 'lesson',
          summary: null,
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

      if (folder_id) {
        await supabase.from('lesson_folders').insert({ lesson_id: newLesson.id, folder_id })
      }

      return NextResponse.json({ ok: true, template_id: newLesson.id })
    }

    // ── Add content (exercises, flashcards, blocks) to existing template ──
    if (action === 'add-content-to-template') {
      const { template_id, exercises = [], flashcards = [], blocks = [] } = body
      if (!template_id) return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
      // Must be allowed to mutate the TARGET template (was ungated).
      const gate = await checkLessonEditAccess(user, template_id)
      if (gate) return gate

      // Get current max order_index for each content type
      const [existingFc, existingEx, existingBlocks] = await Promise.all([
        supabase.from('lesson_flashcards').select('order_index').eq('lesson_id', template_id).order('order_index', { ascending: false }).limit(1),
        supabase.from('lesson_exercises').select('order_index').eq('lesson_id', template_id).order('order_index', { ascending: false }).limit(1),
        supabase.from('lesson_blocks').select('order_index').eq('lesson_id', template_id).order('order_index', { ascending: false }).limit(1),
      ])

      const fcOffset = ((existingFc.data?.[0]?.order_index as number) ?? -1) + 1
      const exOffset = ((existingEx.data?.[0]?.order_index as number) ?? -1) + 1
      const blockOffset = ((existingBlocks.data?.[0]?.order_index as number) ?? -1) + 1

      let added = 0

      // Add flashcards
      if (flashcards.length > 0) {
        const rows = flashcards.map((fc: Record<string, unknown>, i: number) => ({
          lesson_id: template_id,
          word: fc.word || '', phonetic: fc.phonetic || '',
          meaning: fc.meaning || '', example: fc.example || '',
          notes: fc.notes || '',
          order_index: fcOffset + i,
        }))
        const { error } = await supabase.from('lesson_flashcards').insert(rows)
        if (error) throw error
        added += flashcards.length
      }

      // Add exercises
      if (exercises.length > 0) {
        const rows = exercises.map((ex: Record<string, unknown>, i: number) => ({
          lesson_id: template_id,
          title: ex.title || ex.exercise_type || 'Exercise',
          subtitle: ex.subtitle || '',
          icon: ex.icon || '',
          instructions: ex.instructions || '',
          exercise_type: ex.exercise_type,
          questions: ex.exercise_type === 'group_sort' ? (ex.groupData || ex.questions) : ex.questions,
          order_index: exOffset + i,
          points_per_answer: ex.points_per_answer ?? 10,
          completion_bonus: ex.completion_bonus ?? 0,
          is_mandatory: ex.is_mandatory !== false,
        }))
        const { error } = await supabase.from('lesson_exercises').insert(rows)
        if (error) throw error
        added += exercises.length
      }

      // Add blocks
      if (blocks.length > 0) {
        const rows = blocks.map((b: Record<string, unknown>, i: number) => ({
          lesson_id: template_id,
          block_type: b.block_type || 'article',
          title: b.title || '',
          content: b.content || {},
          order_index: blockOffset + i,
        }))
        const { error } = await supabase.from('lesson_blocks').insert(rows)
        if (error) throw error
        added += blocks.length
      }

      return NextResponse.json({ ok: true, added })
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
