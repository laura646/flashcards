import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireRole } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════
// DELETE /api/students   (superadmin only)
//
// Permanently deletes a STUDENT account and ALL of their data across the
// platform. Irreversible. Only role='student' accounts can be deleted here
// (so a teacher/superadmin can't be wiped by accident), and you can't delete
// yourself. Each dependent table is best-effort — a missing table never blocks
// the account deletion.
//   body: { email }
// ═══════════════════════════════════════════════════════════════

const BY_USER_EMAIL = ['progress', 'vocab_srs', 'word_struggles', 'dialogue_messages']
const BY_STUDENT_EMAIL = ['course_students', 'session_attendance', 'attendance', 'student_notes', 'assessments', 'student_ai_summaries']

export async function DELETE(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('superadmin')
  } catch (err) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = (body.email || '').toLowerCase().trim()
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }
  if (email === auth.email.toLowerCase()) {
    return NextResponse.json({ error: "You can't delete your own account here." }, { status: 400 })
  }

  // Only student accounts may be hard-deleted via this endpoint.
  const { data: target } = await supabase.from('users').select('role').eq('email', email).maybeSingle()
  if (!target) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }
  const role = (target as { role: string | null }).role
  if (role && role !== 'student') {
    return NextResponse.json({ error: 'Only student accounts can be deleted here.' }, { status: 403 })
  }

  // Cascade — best-effort per table (ignore errors so a missing table or column
  // never blocks the final account deletion).
  for (const t of BY_USER_EMAIL) {
    await supabase.from(t).delete().eq('user_email', email)
  }
  for (const t of BY_STUDENT_EMAIL) {
    await supabase.from(t).delete().eq('student_email', email)
  }

  const { error } = await supabase.from('users').delete().eq('email', email)
  if (error) {
    console.error('delete-student failed:', error)
    return NextResponse.json({ error: 'Failed to delete the account' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
