import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getAccessibleCourseIds, isEditor, type UserRole } from '@/lib/roles'
import { isTestLessonType } from '@/lib/test-mode'
import { deepCopyLesson } from '@/lib/lesson-copy'

// ═══════════════════════════════════════════════════════════════════
// /api/course-packs — ready-made curricula (Course Packs).
//
//   GET                 → pack list + About info + composition counts
//   GET ?id=            → pack detail: About + ordered items (with shelf)
//   GET ?view=courses   → caller's courses (for the import modal)
//   POST create-pack / update-pack / set-items  → superadmin or editor
//   POST delete-pack                            → superadmin only
//   POST import {pack_id, course_id, lesson_ids[]}
//        → teacher w/ course access or superadmin. Deep-COPIES each chosen
//          lesson into the course as a DRAFT, in pack order (stamps
//          syllabus_order + source_pack_id for the Syllabus tab).
// ═══════════════════════════════════════════════════════════════════

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function staff() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (!session?.user?.email || (role !== 'superadmin' && role !== 'teacher')) return null
  return { email: session.user.email, role: role as UserRole }
}

type Shelf = 'homework' | 'live' | 'tests'

// Same classification the library shelves use, computed server-side.
async function shelfByLessonId(lessonIds: string[]): Promise<Map<string, Shelf>> {
  const map = new Map<string, Shelf>()
  if (lessonIds.length === 0) return map
  const [{ data: lessons }, { data: presBlocks }] = await Promise.all([
    supabase.from('lessons').select('id, lesson_type').in('id', lessonIds),
    supabase
      .from('lesson_blocks')
      .select('lesson_id')
      .in('lesson_id', lessonIds)
      .eq('block_type', 'presentation'),
  ])
  const live = new Set(((presBlocks || []) as { lesson_id: string }[]).map((b) => b.lesson_id))
  ;((lessons || []) as { id: string; lesson_type: string | null }[]).forEach((l) => {
    map.set(l.id, isTestLessonType(l.lesson_type) ? 'tests' : live.has(l.id) ? 'live' : 'homework')
  })
  return map
}

export async function GET(req: NextRequest) {
  const auth = await staff()
  if (!auth) return err('Unauthorized', 401)

  try {
    // ── courses for the import modal ──
    if (req.nextUrl.searchParams.get('view') === 'courses') {
      const ids = await getAccessibleCourseIds(auth.email, auth.role)
      if (ids.length === 0) return NextResponse.json({ courses: [] })
      const { data } = await supabase
        .from('courses')
        .select('id, name, archived_at')
        .in('id', ids)
        .order('name')
      const courses = ((data || []) as { id: string; name: string; archived_at: string | null }[])
        .filter((c) => !c.archived_at)
        .map((c) => ({ id: c.id, name: c.name }))
      return NextResponse.json({ courses })
    }

    // ── course syllabus: pack-imported lessons in teaching order ──
    // Kept OUT of the course-detail query on purpose: if the pack columns
    // aren't migrated, this endpoint returns empty instead of breaking the
    // whole course page.
    if (req.nextUrl.searchParams.get('view') === 'syllabus') {
      const courseId = req.nextUrl.searchParams.get('course_id')
      if (!courseId) return err('course_id required', 400)
      if (auth.role !== 'superadmin') {
        const accessible = await getAccessibleCourseIds(auth.email, auth.role)
        if (!accessible.includes(courseId)) return err('Forbidden', 403)
      }
      const { data: rows, error: rowsErr } = await supabase
        .from('lessons')
        .select('id, title, status, lesson_type, syllabus_order, source_pack_id')
        .eq('course_id', courseId)
        .not('source_pack_id', 'is', null)
        .order('syllabus_order', { ascending: true })
      if (rowsErr) {
        return NextResponse.json({ available: false, items: [], pack_name: null })
      }
      const items = (rows || []) as {
        id: string; title: string; status: string; lesson_type: string | null
        syllabus_order: number | null; source_pack_id: string | null
      }[]
      const shelves = await shelfByLessonId(items.map((i) => i.id))
      let packName: string | null = null
      const packId = items.find((i) => i.source_pack_id)?.source_pack_id
      if (packId) {
        const { data: pack } = await supabase.from('course_packs').select('name').eq('id', packId).maybeSingle()
        packName = (pack as { name: string } | null)?.name || null
      }
      return NextResponse.json({
        available: true,
        pack_name: packName,
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status === 'published' ? 'published' : 'draft',
          shelf: shelves.get(i.id) || 'homework',
          order: i.syllabus_order ?? 0,
        })),
      })
    }

    // ── pack detail ──
    const id = req.nextUrl.searchParams.get('id')
    if (id) {
      const { data: pack } = await supabase.from('course_packs').select('*').eq('id', id).maybeSingle()
      if (!pack) return err('Pack not found', 404)
      const { data: itemRows } = await supabase
        .from('course_pack_items')
        .select('lesson_id, order_index')
        .eq('pack_id', id)
        .order('order_index')
      const items = (itemRows || []) as { lesson_id: string; order_index: number }[]
      const lessonIds = items.map((i) => i.lesson_id)
      const shelves = await shelfByLessonId(lessonIds)
      const { data: lessons } = lessonIds.length
        ? await supabase.from('lessons').select('id, title').in('id', lessonIds)
        : { data: [] }
      const titleById = new Map(((lessons || []) as { id: string; title: string }[]).map((l) => [l.id, l.title]))
      return NextResponse.json({
        pack,
        items: items.map((i) => ({
          lesson_id: i.lesson_id,
          title: titleById.get(i.lesson_id) || '(deleted lesson)',
          shelf: shelves.get(i.lesson_id) || 'homework',
          missing: !titleById.has(i.lesson_id),
        })),
      })
    }

    // ── pack list ──
    const { data: packRows } = await supabase
      .from('course_packs')
      .select('*')
      .order('created_at', { ascending: false })
    const packs = (packRows || []) as Record<string, unknown>[]
    if (packs.length === 0) return NextResponse.json({ packs: [] })

    const packIds = packs.map((p) => p.id as string)
    const { data: allItems } = await supabase
      .from('course_pack_items')
      .select('pack_id, lesson_id')
      .in('pack_id', packIds)
    const items = (allItems || []) as { pack_id: string; lesson_id: string }[]
    const shelves = await shelfByLessonId(Array.from(new Set(items.map((i) => i.lesson_id))))

    const byPack = new Map<string, { homework: number; live: number; tests: number; total: number }>()
    items.forEach((i) => {
      const c = byPack.get(i.pack_id) || { homework: 0, live: 0, tests: 0, total: 0 }
      const shelf = shelves.get(i.lesson_id) || 'homework'
      c[shelf]++
      c.total++
      byPack.set(i.pack_id, c)
    })

    // Author names (users join — course_students-style lookup).
    const emails = Array.from(new Set(packs.map((p) => p.created_by as string)))
    const nameByEmail = new Map<string, string>()
    if (emails.length > 0) {
      const { data: users } = await supabase.from('users').select('email, name').in('email', emails)
      ;((users || []) as { email: string; name: string | null }[]).forEach((u) => {
        if (u.name) nameByEmail.set(u.email, u.name)
      })
    }

    return NextResponse.json({
      packs: packs.map((p) => ({
        ...p,
        author_name: nameByEmail.get(p.created_by as string) || (p.created_by as string),
        composition: byPack.get(p.id as string) || { homework: 0, live: 0, tests: 0, total: 0 },
      })),
    })
  } catch (e) {
    console.error('course-packs GET error:', e)
    return err('Internal server error — are the course_packs tables migrated?', 500)
  }
}

export async function POST(req: NextRequest) {
  const auth = await staff()
  if (!auth) return err('Unauthorized', 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }
  const action = body.action as string

  try {
    const editorOk = auth.role === 'superadmin' || (await isEditor(auth.email))

    // ── create / update pack (About info) ──
    if (action === 'create-pack' || action === 'update-pack') {
      if (!editorOk) return err('Only a superadmin or editor can manage Course Packs', 403)
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (action === 'create-pack' && !name) return err('Pack name required', 400)

      const fields: Record<string, unknown> = {}
      if (name) fields.name = name
      for (const k of ['description', 'time_frame', 'level', 'audience', 'prerequisites', 'outcomes', 'materials']) {
        if (typeof body[k] === 'string') fields[k] = (body[k] as string).trim() || null
      }

      if (action === 'create-pack') {
        const { data, error } = await supabase
          .from('course_packs')
          .insert({ ...fields, created_by: auth.email })
          .select('id')
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, pack_id: (data as { id: string }).id })
      }
      const packId = body.pack_id as string
      if (!packId) return err('pack_id required', 400)
      const { error } = await supabase
        .from('course_packs')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', packId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── set-items (replace ordered list) ──
    if (action === 'set-items') {
      if (!editorOk) return err('Only a superadmin or editor can manage Course Packs', 403)
      const packId = body.pack_id as string
      const lessonIds = Array.isArray(body.lesson_ids) ? (body.lesson_ids as string[]) : null
      if (!packId || !lessonIds) return err('pack_id and lesson_ids required', 400)
      await supabase.from('course_pack_items').delete().eq('pack_id', packId)
      if (lessonIds.length > 0) {
        const { error } = await supabase.from('course_pack_items').insert(
          lessonIds.map((lid, i) => ({ pack_id: packId, lesson_id: lid, order_index: i }))
        )
        if (error) throw error
      }
      await supabase.from('course_packs').update({ updated_at: new Date().toISOString() }).eq('id', packId)
      return NextResponse.json({ ok: true })
    }

    // ── delete-pack ──
    if (action === 'delete-pack') {
      if (auth.role !== 'superadmin') return err('Only a superadmin can delete a Course Pack', 403)
      const packId = body.pack_id as string
      if (!packId) return err('pack_id required', 400)
      await supabase.from('course_pack_items').delete().eq('pack_id', packId)
      await supabase.from('pack_comments').delete().eq('pack_id', packId)
      await supabase.from('course_packs').delete().eq('id', packId)
      return NextResponse.json({ ok: true })
    }

    // ── publish / unpublish one syllabus lesson ──
    if (action === 'set-lesson-status') {
      const lessonId = body.lesson_id as string
      const status = body.status === 'published' ? 'published' : 'draft'
      if (!lessonId) return err('lesson_id required', 400)
      const { data: lesson } = await supabase
        .from('lessons')
        .select('id, course_id')
        .eq('id', lessonId)
        .maybeSingle()
      if (!lesson) return err('Lesson not found', 404)
      const courseId = (lesson as { course_id: string | null }).course_id
      if (auth.role !== 'superadmin') {
        const accessible = await getAccessibleCourseIds(auth.email, auth.role)
        if (!courseId || !accessible.includes(courseId)) return err('Forbidden', 403)
      }
      // Publishing stamps today's date so the lesson sorts as "assigned now"
      // on the student's home; unpublishing leaves the date alone.
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
      if (status === 'published') patch.lesson_date = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('lessons').update(patch).eq('id', lessonId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // ── import: deep-copy chosen lessons into a course as ordered drafts ──
    if (action === 'import') {
      const packId = body.pack_id as string
      const courseId = body.course_id as string
      const lessonIds = Array.isArray(body.lesson_ids) ? (body.lesson_ids as string[]) : null
      if (!packId || !courseId || !lessonIds || lessonIds.length === 0) {
        return err('pack_id, course_id and lesson_ids required', 400)
      }
      if (auth.role !== 'superadmin') {
        const accessible = await getAccessibleCourseIds(auth.email, auth.role)
        if (!accessible.includes(courseId)) return err('Forbidden', 403)
      }
      // Only lessons that are actually in the pack, in PACK order.
      const { data: itemRows } = await supabase
        .from('course_pack_items')
        .select('lesson_id, order_index')
        .eq('pack_id', packId)
        .order('order_index')
      const packOrder = ((itemRows || []) as { lesson_id: string }[]).map((i) => i.lesson_id)
      const chosen = packOrder.filter((lid) => lessonIds.includes(lid))
      if (chosen.length === 0) return err('None of the chosen lessons are in this pack', 400)

      const today = new Date().toISOString().split('T')[0]
      let imported = 0
      const failed: string[] = []
      for (let i = 0; i < chosen.length; i++) {
        try {
          await deepCopyLesson(chosen[i], {
            courseId,
            status: 'draft',
            lessonDate: today,
            createdBy: auth.email,
            syllabusOrder: i + 1,
            sourcePackId: packId,
          })
          imported++
        } catch (e) {
          console.error('course-packs import: lesson copy failed', chosen[i], e)
          failed.push(chosen[i])
        }
      }
      return NextResponse.json({ ok: true, imported, failed: failed.length })
    }

    return err('Invalid action', 400)
  } catch (e) {
    console.error('course-packs POST error:', e)
    return err('Internal server error — are the course_packs tables migrated?', 500)
  }
}
