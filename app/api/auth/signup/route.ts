import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP — 5 signups per minute
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = rateLimit(`signup:${ip}`, 5)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 })
    }

    const { name, email, password } = await req.json()

    // Validate inputs
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
    }

    const trimmedEmail = email.toLowerCase().trim()
    const trimmedName = name.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (password.length < 10) {
      return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 })
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least one letter and one number' }, { status: 400 })
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('email, password_hash')
      .eq('email', trimmedEmail)
      .maybeSingle()

    const passwordHash = await bcrypt.hash(password, 12)
    let isExistingPasswordUser = false

    if (existingUser) {
      if (existingUser.password_hash) {
        // SECURITY: Don't confirm to attackers that this email is registered.
        // Return a generic success-style response so signup looks identical
        // whether the email exists or not. We email the real owner separately.
        isExistingPasswordUser = true
      } else {
        // Google-only user — link account by adding password
        await supabase
          .from('users')
          .update({ password_hash: passwordHash, name: trimmedName })
          .eq('email', trimmedEmail)
      }
    } else {
      // New user
      const { error } = await supabase
        .from('users')
        .insert({ email: trimmedEmail, name: trimmedName, role: 'student', password_hash: passwordHash })
      if (error) throw error
    }

    // If this email already had a password account, notify the real owner
    // (not the attacker) and silently return success to the request.
    if (isExistingPasswordUser) {
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        try {
          const resend = new Resend(apiKey)
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.englishwithlaura.com'
          await resend.emails.send({
            from: 'English with Laura <noreply@learn.englishwithlaura.com>',
            to: trimmedEmail,
            subject: 'Someone tried to sign up with your email',
            html: `<p>Hi,</p><p>Someone just tried to create an English with Laura account using your email address. If this was you and you forgot you already have an account, you can <a href="${appUrl}/forgot-password">reset your password here</a>.</p><p>If it wasn't you, no action is needed — your account is safe.</p><p>— English with Laura</p>`,
          })
        } catch { /* ignore email errors */ }
      }
      return NextResponse.json({ ok: true })
    }

    // Send welcome email
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      try {
        const esc = (await import('@/lib/html')).escHtml
        const resend = new Resend(apiKey)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://flashcards-app-navy.vercel.app'
        await resend.emails.send({
          from: 'English with Laura <noreply@learn.englishwithlaura.com>',
          to: trimmedEmail,
          subject: 'Welcome to English with Laura!',
          html: `
            <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
              <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura</h1>
              </div>
              <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 15px; margin-top: 0;">Hi ${esc(trimmedName)},</p>
                <p style="font-size: 15px; line-height: 1.6;">
                  Welcome! Your account has been created successfully.
                </p>
                <p style="font-size: 15px; line-height: 1.6;">
                  To get started, ask your teacher for an invite code or link to join your course.
                </p>
                <div style="margin: 24px 0;">
                  <a href="${appUrl}/home"
                     style="display: inline-block; background: #416ebe; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                    Go to My Account
                  </a>
                </div>
                <p style="font-size: 13px; color: #888; margin-top: 24px;">— English with Laura</p>
              </div>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Welcome email error:', emailErr)
        // Don't block signup if email fails
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
