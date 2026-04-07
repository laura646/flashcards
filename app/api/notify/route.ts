import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { escHtml as esc } from '@/lib/html'
import { Resend } from 'resend'

const TEACHER_EMAIL = 'laura@englishwithlaura.com'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { studentEmail, studentName, event, mode, score, total, knewCount, exerciseTitle, blockTitle, wordCount } = body

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
    subject = `${esc(studentName)} started a flashcard session`
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
              <td style="padding: 8px 0; font-weight: bold;">${esc(studentName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Email</td>
              <td style="padding: 8px 0;">${esc(studentEmail)}</td>
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
      resultLine = `Quiz score: <strong>${esc(score)}/${esc(total)} (${pct}%)</strong>`
    } else if (mode === 'self-assess') {
      const pct = total ? Math.round((knewCount / total) * 100) : 0
      resultLine = `Self-assessed: <strong>${esc(knewCount)}/${esc(total)} knew it (${pct}%)</strong>`
    } else {
      resultLine = `Completed flip mode — reviewed all <strong>${esc(total)}</strong> words`
    }

    subject = `${esc(studentName)} completed a ${esc(mode)} session`
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
              <td style="padding: 8px 0; font-weight: bold;">${esc(studentName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Email</td>
              <td style="padding: 8px 0;">${esc(studentEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Mode</td>
              <td style="padding: 8px 0; text-transform: capitalize;">${esc(mode)}</td>
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
  } else if (event === 'exercise_complete') {
    const pct = total ? Math.round((score / total) * 100) : 0
    subject = `${esc(studentName)} completed exercise: ${esc(exerciseTitle)}`
    html = `
      <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
        <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura — Exercises</h1>
        </div>
        <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #416ebe; font-size: 18px; margin-top: 0;">Exercise completed</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 120px;">Student</td>
              <td style="padding: 8px 0; font-weight: bold;">${esc(studentName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Email</td>
              <td style="padding: 8px 0;">${esc(studentEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Exercise</td>
              <td style="padding: 8px 0; font-weight: bold;">${esc(exerciseTitle)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Score</td>
              <td style="padding: 8px 0;"><strong>${esc(score)}/${esc(total)} (${pct}%)</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Time (Yerevan)</td>
              <td style="padding: 8px 0;">${now}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  } else if (event === 'writing_submitted') {
    subject = `${esc(studentName)} submitted a writing task: ${esc(blockTitle)}`
    html = `
      <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #46464b;">
        <div style="background: #416ebe; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">English with Laura — Writing</h1>
        </div>
        <div style="background: white; padding: 32px; border: 1px solid #cddcf0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #416ebe; font-size: 18px; margin-top: 0;">Writing task submitted</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 120px;">Student</td>
              <td style="padding: 8px 0; font-weight: bold;">${esc(studentName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Email</td>
              <td style="padding: 8px 0;">${esc(studentEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Task</td>
              <td style="padding: 8px 0; font-weight: bold;">${esc(blockTitle)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Word count</td>
              <td style="padding: 8px 0;">${esc(wordCount)} words</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Time (Yerevan)</td>
              <td style="padding: 8px 0;">${now}</td>
            </tr>
          </table>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e6f0fa;">
            <a href="https://flashcards-app-navy.vercel.app/admin"
               style="display: inline-block; background: #416ebe; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
              View in Admin Console
            </a>
          </div>
        </div>
      </div>
    `
  }

  if (!subject || !html) {
    // Unknown event type — skip sending
    return NextResponse.json({ ok: true })
  }

  try {
    await resend.emails.send({
      from: 'English with Laura <noreply@learn.englishwithlaura.com>',
      to: TEACHER_EMAIL,
      subject,
      html,
    })
  } catch (err) {
    console.error('Resend error:', err)
  }

  return NextResponse.json({ ok: true })
}
