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

  // Non-admin can only view their own data
  if (email && email !== session.user.email && session.user.role === 'student') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    let query = supabase
      .from('word_struggles')
      .select('*')
      .order('created_at', { ascending: false })

    if (email) {
      query = query.eq('user_email', email)
    }

    const { data, error } = await query

    if (error) {
      console.error('Word struggles GET error:', error)
      return NextResponse.json({ error: 'Failed to load word struggles' }, { status: 500 })
    }

    return NextResponse.json({ struggles: data })
  } catch (err) {
    console.error('Word struggles error:', err)
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
    const { user_email, word, activity_type, knew } = body

    if (!user_email || !word || !activity_type || knew === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (user_email !== postSession.user.email && postSession.user.role === 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('word_struggles')
      .insert({
        user_email,
        word,
        activity_type,
        knew: !!knew,
      })

    if (error) {
      console.error('Word struggles POST error:', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Word struggles error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
