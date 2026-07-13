import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthUser, hasAccessToCourse } from '@/lib/roles'

// ─────────────────────────────────────────────────────────────────
// /api/writing-feedback  (W1 teacher grading + W2 student self-view)
//
// GET ?courseId=…  → teacher/superadmin/HR: every writing submission in the
//                    course + its prompt/student/grade.
// GET ?mine=1       → the current user's OWN grades (student, closing the loop):
//                    latest grade per writing block.
// POST { progress_id, … }        → upsert a grade (teacher/superadmin).
// POST { action:'mark-seen', progress_ids } → student marks own feedback seen.
//
// Fail-safe: the writing_feedback table may not exist yet; reads degrade to
// empty rather than 500.
// ─────────────────────────────────────────────────────────────────

interface WritingBlockContent {
  prompt?: string
  guidelines?: string
  word_limit?: number
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Student self-view: my own feedback (own rows only, any role) ──
  if (req.nextUrl.searchParams.get('mine') === '1') {
    try {
      const { data, error } = await supabase
        .from('writing_feedback')
        .select('progress_id, block_id, score_pct, cefr_band, rubric, feedback, graded_at, student_seen_at')
        .eq('student_email', user.email)
        .order('graded_at', { ascending: false })
      if (error || !data) return NextResponse.json({ feedback: [] })
      const byBlock = new Map<string, unknown>()
      for (const g of data) {
        const b = (g as { block_id: string | null }).block_id
        if (b && !byBlock.has(b)) byBlock.set(b, g)
      }
      return NextResponse.json({ feedback: Array.from(byBlock.values()) })
    } catch {
      return NextResponse.json({ feedback: [] })
    }
  }

  // ── Teacher / HR course queue ──
  if (user.role !== 'teacher' && user.role !== 'superadmin' && user.role !== 'hr') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ submissions: [] })
  if (!(await hasAccessToCourse(user.email, user.role, courseId))) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  try {
    const { data: cs } = await supabase
      .from('course_students')
      .select('student_email')
      .eq('course_id', courseId)
      .is('removed_at', null)
    const emails = (cs || []).map((r: { student_email: string }) => r.student_email).filter(Boolean)
    if (emails.length === 0) return NextResponse.json({ submissions: [] })

    const { data: lessons } = await supabase.from('lessons').select('id, title').eq('course_id', courseId)
    const lessonTitle = new Map((lessons || []).map((l: { id: string; title: string }) => [l.id, l.title]))
    const lessonIds = (lessons || []).map((l: { id: string }) => l.id)
    if (lessonIds.length === 0) return NextResponse.json({ submissions: [] })

    const { data: blocks } = await supabase
      .from('lesson_blocks')
      .select('id, lesson_id, title, content')
      .in('lesson_id', lessonIds)
      .eq('block_type', 'writing')
    const blockById = new Map((blocks || []).map((b: { id: string; lesson_id: string; title: string; content: unknown }) => [b.id, b]))
    const blockIds = (blocks || []).map((b: { id: string }) => b.id)
    if (blockIds.length === 0) return NextResponse.json({ submissions: [] })

    const { data: subs } = await supabase
      .from('progress')
      .select('id, user_email, activity_id, response_text, completed_at')
      .eq('activity_type', 'writing')
      .in('activity_id', blockIds)
      .in('user_email', emails)
      .order('completed_at', { ascending: false })
    const submissions = (subs || []).filter((s: { response_text: string | null }) => (s.response_text || '').trim())

    const { data: users } = await supabase.from('users').select('email, name').in('email', emails)
    const nameByEmail = new Map((users || []).map((u: { email: string; name: string }) => [u.email, u.name]))

    const progressIds = submissions.map((s: { id: string }) => s.id)
    const gradeByProgressId = new Map<string, unknown>()
    if (progressIds.length) {
      const { data: fb, error: fbErr } = await supabase
        .from('writing_feedback')
        .select('progress_id, score_pct, cefr_band, rubric, feedback, graded_by, graded_at')
        .in('progress_id', progressIds)
      if (!fbErr && fb) for (const g of fb) gradeByProgressId.set((g as { progress_id: string }).progress_id, g)
    }

    const out = submissions.map((s: { id: string; user_email: string; activity_id: string; response_text: string; completed_at: string }) => {
      const block = blockById.get(s.activity_id) as { lesson_id: string; title: string; content: WritingBlockContent } | undefined
      const content = (block?.content || {}) as WritingBlockContent
      return {
        progress_id: s.id,
        student_email: s.user_email,
        student_name: nameByEmail.get(s.user_email) || s.user_email,
        block_id: s.activity_id,
        lesson_title: block ? lessonTitle.get(block.lesson_id) || '' : '',
        block_title: block?.title || 'Writing',
        prompt: content.prompt || '',
        guidelines: content.guidelines || '',
        word_limit: content.word_limit || null,
        response_text: s.response_text,
        submitted_at: s.completed_at,
        grade: gradeByProgressId.get(s.id) || null,
      }
    })
    out.sort((a, b) => (a.grade ? 1 : 0) - (b.grade ? 1 : 0) || +new Date(b.submitted_at) - +new Date(a.submitted_at))
    return NextResponse.json({ submissions: out })
  } catch (err) {
    console.error('writing-feedback GET error:', err)
    return NextResponse.json({ error: 'Failed to load writing submissions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Student marks their own feedback seen ──
  if (body.action === 'mark-seen') {
    const ids: string[] = Array.isArray(body.progress_ids) ? body.progress_ids.filter((x: unknown) => typeof x === 'string') : []
    if (ids.length) {
      await supabase
        .from('writing_feedback')
        .update({ student_seen_at: new Date().toISOString() })
        .eq('student_email', user.email)
        .in('progress_id', ids)
        .is('student_seen_at', null)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Teacher / superadmin grade upsert ──
  if (user.role !== 'teacher' && user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { progress_id, student_email, course_id, block_id, score_pct, cefr_band, rubric, feedback } = body
  if (!progress_id || !course_id) {
    return NextResponse.json({ error: 'progress_id and course_id required' }, { status: 400 })
  }
  if (!(await hasAccessToCourse(user.email, user.role, course_id))) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const pct = typeof score_pct === 'number' && Number.isFinite(score_pct) ? Math.max(0, Math.min(100, Math.round(score_pct))) : null

  const { error } = await supabase.from('writing_feedback').upsert(
    {
      progress_id,
      student_email: student_email || null,
      course_id,
      block_id: block_id || null,
      score_pct: pct,
      cefr_band: typeof cefr_band === 'string' && cefr_band ? cefr_band : null,
      rubric: rubric && typeof rubric === 'object' ? rubric : null,
      feedback: typeof feedback === 'string' && feedback.trim() ? feedback.trim() : null,
      graded_by: user.email,
      graded_at: new Date().toISOString(),
    },
    { onConflict: 'progress_id' },
  )

  if (error) {
    console.error('writing-feedback POST error:', error.message)
    return NextResponse.json({ error: 'Could not save the grade. Has the writing_feedback migration been run?' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
