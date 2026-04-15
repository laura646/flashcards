import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP — 5 reset attempts per minute
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`reset:${ip}`, 5)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 })
    }

    const { email, token, password } = await req.json()

    if (!email || !token || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (password.length < 10) {
      return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 })
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least one letter and one number' }, { status: 400 })
    }

    const trimmedEmail = email.toLowerCase().trim()

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Look up user and verify token + expiry
    const { data: user } = await supabase
      .from('users')
      .select('email, reset_token, reset_token_expires_at')
      .eq('email', trimmedEmail)
      .maybeSingle()

    if (!user || !user.reset_token || user.reset_token !== hashedToken) {
      return NextResponse.json({ error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 })
    }

    if (!user.reset_token_expires_at || new Date(user.reset_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 })
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12)

    // ATOMIC token invalidation: only update if the token still matches.
    // If two requests arrive with the same token, only the first wins.
    // The second's UPDATE will affect zero rows because reset_token is now NULL.
    const { data: updated, error } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires_at: null,
      })
      .eq('email', trimmedEmail)
      .eq('reset_token', hashedToken)
      .select('email')

    if (error) throw error
    if (!updated || updated.length === 0) {
      // Token was already consumed by a concurrent request
      return NextResponse.json({ error: 'This reset link has already been used. Please request a new one.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
