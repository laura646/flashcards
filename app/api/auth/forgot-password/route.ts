import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'
import crypto from 'crypto'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP — 3 forgot-password requests per minute
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`forgot:${ip}`, 3)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 })
    }

    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const trimmedEmail = email.toLowerCase().trim()

    // Always return success to avoid revealing account existence
    const successResponse = NextResponse.json({ ok: true })

    // Look up user
    const { data: user } = await supabase
      .from('users')
      .select('email, name, password_hash')
      .eq('email', trimmedEmail)
      .single()

    // If no user or no password (Google-only), silently succeed
    if (!user || !user.password_hash) return successResponse

    // Generate reset token — hash before storing so DB leak doesn't expose tokens
    const resetToken = crypto.randomUUID()
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await supabase
      .from('users')
      .update({ reset_token: hashedToken, reset_token_expires_at: expiresAt.toISOString() })
      .eq('email', trimmedEmail)

    // Send email via Resend
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('RESEND_API_KEY not configured')
      return successResponse
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://flashcards-app-navy.vercel.app'
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(trimmedEmail)}`

    const esc = (await import('@/lib/html')).escHtml
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: 'English with Laura <noreply@learn.englishwithlaura.com>',
      to: trimmedEmail,
      subject: 'Reset your password — English with Laura',
      html: `
        <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
          <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura</h1>
          </div>
          <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 15px; margin-top: 0;">Hi ${esc(user.name) || 'there'},</p>
            <p style="font-size: 15px; line-height: 1.6;">
              We received a request to reset your password. Click the button below to choose a new one.
            </p>
            <div style="margin: 24px 0;">
              <a href="${resetUrl}"
                 style="display: inline-block; background: #416ebe; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 13px; color: #888;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    })

    return successResponse
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ ok: true }) // Always succeed externally
  }
}
