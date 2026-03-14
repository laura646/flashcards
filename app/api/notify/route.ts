import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const TEACHER_EMAIL = 'laura@englishwithlaura.com'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { studentEmail, studentName, event, mode, score, total, knewCount } = body

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Silently fail so students are not blocked
    return NextResponse.json({ ok: true })
  }

  const resend = new Resend(apiKey)
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Yerevan' })

  let subject = ''
  let html = ''

  if (event === 'session_start') {
    subject = `📚 ${studentName} started a flashcard session`
    html = `
      <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
        <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura — Flashcards</h1>
        </div>
        <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #416ebe; font-size: 18px; margin-top: 0;">New session started</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 120px;">Student</td>
              <td style="padding: 8px 0; font-weight: bold;">${studentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Email</td>
              <td style="padding: 8px 0;">${studentEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Time (Yerevan)</td>
              <td style="padding: 8px 0;">${now}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  } else if (event === 'session_complete') {
    let resultLine = ''
    if (mode === 'quiz') {
      const pct = total ? Math.round((score / total) * 100) : 0
      resultLine = `Quiz score: <strong>${score}/${total} (${pct}%)</strong>`
    } else if (mode === 'self-assess') {
      const pct = total ? Math.round((knewCount / total) * 100) : 0
      resultLine = `Self-assessed: <strong>${knewCount}/${total} knew it (${pct}%)</strong>`
    } else {
      resultLine = `Completed flip mode — reviewed all <strong>${total}</strong> words`
    }

    subject = `✅ ${studentName} completed a ${mode} session`
    html = `
      <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
        <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura — Flashcards</h1>
        </div>
        <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #416ebe; font-size: 18px; margin-top: 0;">Session completed</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 120px;">Student</td>
              <td style="padding: 8px 0; font-weight: bold;">${studentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Email</td>
              <td style="padding: 8px 0;">${studentEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Mode</td>
              <td style="padding: 8px 0; text-transform: capitalize;">${mode}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Result</td>
              <td style="padding: 8px 0;">${resultLine}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Time (Yerevan)</td>
              <td style="padding: 8px 0;">${now}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  }

  try {
    await resend.emails.send({
      from: 'Flashcards <onboarding@resend.dev>',
      to: TEACHER_EMAIL,
      subject,
      html,
    })
  } catch (err) {
    console.error('Resend error:', err)
  }

  return NextResponse.json({ ok: true })
}
