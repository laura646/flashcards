import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Students can only view their own progress; admin can view anyone's
  if (email !== session.user.email && session.user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { data, error } = await supabase
      .from('progress')
      .select('*')
      .eq('user_email', email)
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('Supabase GET error:', error)
      return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
    }

    return NextResponse.json({ progress: data })
  } catch (err) {
    console.error('Progress GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const postSession = await getServerSession(authOptions)
  if (!postSession?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { user_email, activity_type, activity_id, score, total } = body

    if (!user_email || !activity_type || !activity_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Students can only save their own progress
    if (user_email !== postSession.user.email && postSession.user.role === 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('progress')
      .insert({
        user_email,
        activity_type,
        activity_id: String(activity_id),
        score: score ?? null,
        total: total ?? null,
      })

    if (error) {
      console.error('Supabase POST error:', error)
      return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Progress POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
