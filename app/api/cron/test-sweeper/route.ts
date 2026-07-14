import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { finalizeTestSession, type TestSessionRow } from '@/lib/test-session'

// Auto-submits expired test attempts (exam mode requirement: "the test is
// submitted automatically when time runs out, even if the student is not
// on the platform").
//
// Backstop only — sessions also finalize lazily the moment anyone touches
// them (student reload, teacher results view). Score integrity never
// depends on this cadence: answer saves are rejected after the deadline
// regardless of when the row is finalized.
//
// Invoked by Vercel Cron (see vercel.json). Same auth pattern as the other
// crons: when CRON_SECRET is set, Vercel sends `Authorization: Bearer <secret>`.

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const { data: expired, error } = await supabase
      .from('test_sessions')
      .select('*')
      .is('submitted_at', null)
      .lt('deadline', new Date().toISOString())
      .limit(50)

    if (error) throw error

    let finalized = 0
    for (const s of (expired || []) as TestSessionRow[]) {
      try {
        await finalizeTestSession(s, { auto: true })
        finalized++
      } catch (e) {
        console.error('test-sweeper: failed to finalize session', s.id, e)
      }
    }
    return NextResponse.json({ ok: true, finalized })
  } catch (e) {
    console.error('test-sweeper error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
