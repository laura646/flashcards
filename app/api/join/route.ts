import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET: Look up course by invite code (no auth required — used on the join page before sign-in)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name')
      .eq('invite_code', code.toUpperCase())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid invite link. Please check with your teacher.' }, { status: 404 })
    }

    return NextResponse.json({ course_name: data.name, course_id: data.id })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST: Enroll the signed-in user in the course
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Please sign in first' }, { status: 401 })
  }

  try {
    const { code } = await req.json()
    if (!code) {
      return NextResponse.json({ error: 'Invite code required' }, { status: 400 })
    }

    // Find the course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name')
      .eq('invite_code', code.toUpperCase())
      .single()

    if (courseError || !course) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }

    // Check if student was previously enrolled (possibly soft-deleted)
    const { data: existing } = await supabase
      .from('course_students')
      .select('id, removed_at')
      .eq('course_id', course.id)
      .eq('student_email', session.user.email)
      .maybeSingle()

    if (existing) {
      if (existing.removed_at) {
        // Re-activate soft-deleted enrollment
        const { error: reactivateError } = await supabase
          .from('course_students')
          .update({ removed_at: null })
          .eq('id', existing.id)
        if (reactivateError) throw reactivateError
      }
      // Already enrolled and active — no-op
    } else {
      // New enrollment
      const { error: enrollError } = await supabase
        .from('course_students')
        .insert({ course_id: course.id, student_email: session.user.email })
      if (enrollError) throw enrollError
    }

    return NextResponse.json({ ok: true, course_name: course.name })
  } catch (err) {
    console.error('Join error:', err)
    return NextResponse.json({ error: 'Failed to enroll' }, { status: 500 })
  }
}
