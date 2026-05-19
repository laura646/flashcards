import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Auto-publishes lessons whose scheduled time has arrived.
//
// A scheduled lesson is status='draft' with a publish_at timestamp.
// This endpoint flips it to 'published' once publish_at <= now(), so
// it becomes visible to students at the teacher's chosen time.
//
// Invoked by Vercel Cron (see vercel.json). When CRON_SECRET is set,
// Vercel sends `Authorization: Bearer <CRON_SECRET>`; we verify it so
// the endpoint can't be triggered by anyone else. If CRON_SECRET is
// unset (e.g. local dev), the check is skipped.

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const nowIso = new Date().toISOString()

  try {
    // Find due scheduled lessons (kept as draft until now)
    const { data: due, error: selErr } = await supabase
      .from('lessons')
      .select('id')
      .eq('status', 'draft')
      .not('publish_at', 'is', null)
      .lte('publish_at', nowIso)

    if (selErr) throw selErr

    const ids = (due || []).map((l: { id: string }) => l.id)
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, published: 0 })
    }

    const { error: updErr } = await supabase
      .from('lessons')
      .update({ status: 'published' })
      .in('id', ids)

    if (updErr) throw updErr

    return NextResponse.json({ ok: true, published: ids.length, ids })
  } catch (err) {
    console.error('publish-scheduled cron error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
