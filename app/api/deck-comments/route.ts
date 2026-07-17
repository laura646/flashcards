import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════════
// /api/deck-comments — teacher comments on Live Session Content decks
// ("Anna, 12 Sept: slide 8 has a typo"). Staff-only, keyed by the
// deck's lesson id.
//
//   GET    ?lesson_id=       → list, oldest first, with author names
//   POST   {lesson_id, text} → add a comment (any teacher/superadmin)
//   DELETE {id}              → author or superadmin
//
// Reads fail OPEN if deck_comments is absent (migration-deck-comments.sql
// not yet run) — the panel just shows no comments; writes report an error.
// ═══════════════════════════════════════════════════════════════════

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function staffSession() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (!session?.user?.email || (role !== 'superadmin' && role !== 'teacher')) return null
  return { email: session.user.email, role: role as string }
}

export async function GET(req: NextRequest) {
  const auth = await staffSession()
  if (!auth) return err('Unauthorized', 401)
  const lessonId = req.nextUrl.searchParams.get('lesson_id')
  if (!lessonId) return err('lesson_id required', 400)

  const { data: rows } = await supabase
    .from('deck_comments')
    .select('id, author_email, text, created_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true })

  const list = (rows || []) as { id: string; author_email: string; text: string; created_at: string }[]
  // Names live on users (course_students-style lookups all join users).
  const emails = Array.from(new Set(list.map((c) => c.author_email)))
  const nameByEmail = new Map<string, string>()
  if (emails.length > 0) {
    const { data: users } = await supabase.from('users').select('email, name').in('email', emails)
    ;((users || []) as { email: string; name: string | null }[]).forEach((u) => {
      if (u.name) nameByEmail.set(u.email, u.name)
    })
  }
  return NextResponse.json({
    comments: list.map((c) => ({
      id: c.id,
      author_email: c.author_email,
      author_name: nameByEmail.get(c.author_email) || c.author_email,
      text: c.text,
      created_at: c.created_at,
      can_delete: auth.role === 'superadmin' || c.author_email === auth.email,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await staffSession()
  if (!auth) return err('Unauthorized', 401)
  let body: { lesson_id?: string; text?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }
  const lessonId = body.lesson_id
  const text = (body.text || '').trim()
  if (!lessonId || !text) return err('lesson_id and text required', 400)
  if (text.length > 2000) return err('Comment is too long (2000 characters max)', 400)

  const { error } = await supabase
    .from('deck_comments')
    .insert({ lesson_id: lessonId, author_email: auth.email, text })
  if (error) {
    console.error('deck-comments POST error (migration pending?):', error.message)
    return err('Could not save the comment — the comments table may not exist yet.', 500)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await staffSession()
  if (!auth) return err('Unauthorized', 401)
  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }
  if (!body.id) return err('id required', 400)

  let del = supabase.from('deck_comments').delete().eq('id', body.id)
  if (auth.role !== 'superadmin') del = del.eq('author_email', auth.email)
  const { error } = await del
  if (error) return err('Could not delete the comment', 500)
  return NextResponse.json({ ok: true })
}
