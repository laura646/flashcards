import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole, hasAccessToCourse } from '@/lib/roles'

// ═══════════════════════════════════════════════════════════════
// /api/student-summary
//
// POST: generate a 2-3 sentence narrative summary of one student's
// progress for the teacher-facing report. The client sends a
// pre-aggregated "digest" of metrics (we already computed them for
// the student detail view); the server just adds auth + course
// access checks, then asks Claude for a concise summary.
//
// Prompt caching is enabled on the system prompt so back-to-back
// calls (teacher reviewing several students) hit the cache and use
// ~10% of the input tokens.
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are a concise teaching assistant who writes brief progress summaries for an English-learning platform. Each summary appears at the top of a teacher-facing report about a single student over a defined time range.

RULES (follow exactly):
- 2-3 sentences total. Never more.
- Use ONLY the metrics you are given. Do not invent numbers, exercises, or skills.
- Refer to the student by first name only (extract from the full name).
- Be honest but constructive. If the student is struggling, say so plainly and suggest a forward-looking focus area.
- Reference at most ONE specific strength and ONE specific weakness if data permits.
- No greetings. No emojis. No headers or labels. No bullet points. Plain prose only.
- If there is no activity (no exercises attempted, no attendance marked), write a single short sentence saying so.`

interface DigestPayload {
  studentName: string
  studentEmail: string
  courseId: string
  courseName: string
  timeRangeLabel: string

  completionPct: number
  attempted: number
  assigned: number

  avgLatestPct: number | null
  avgBestPct: number | null

  attendancePct: number | null
  attendanceMarked: number

  streak: number
  totalAttempts: number

  trendDirection: 'up' | 'down' | 'flat' | 'none'

  topStrengths: { title: string; pct: number }[]   // up to 3
  topWeaknesses: { title: string; pct: number }[]  // up to 3

  skillBreakdown: { label: string; avgPct: number; attempted: number }[]
  cefrBreakdown: { level: string; avgPct: number; attempted: number }[]
}

function errorResponse(err: unknown): NextResponse {
  const e = err as { status?: number; message?: string }
  return NextResponse.json({ error: e.message || 'Error' }, { status: e.status || 500 })
}

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return errorResponse(err)
  }

  let body: DigestPayload
  try {
    body = (await req.json()) as DigestPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.studentEmail || !body.courseId) {
    return NextResponse.json({ error: 'studentEmail and courseId required' }, { status: 400 })
  }

  const hasAccess = await hasAccessToCourse(auth.email, auth.role, body.courseId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // Short-circuit: no activity at all → fixed message, no LLM call
  if (
    body.attempted === 0 &&
    body.attendanceMarked === 0 &&
    body.totalAttempts === 0 &&
    body.streak === 0
  ) {
    return NextResponse.json({
      summary: `No activity recorded for ${body.studentName} in the selected time range.`,
      cached: false,
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI summary is not configured' }, { status: 503 })
  }

  // Format the digest as a compact, readable data block for the model
  const dataBlock = formatDigest(body)

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 220,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: dataBlock,
        },
      ],
    })

    // Extract plain-text content from the response
    const text = message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    return NextResponse.json({
      summary: text || `Summary unavailable for ${body.studentName}.`,
      cached: false,
    })
  } catch (err) {
    console.error('student-summary error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}

function formatDigest(d: DigestPayload): string {
  const lines: string[] = []
  lines.push(`Student: ${d.studentName} (${d.studentEmail})`)
  lines.push(`Course: ${d.courseName}`)
  lines.push(`Time range: ${d.timeRangeLabel}`)
  lines.push('')
  lines.push(`Completion: ${d.completionPct}% (${d.attempted} of ${d.assigned} exercises attempted)`)
  lines.push(`Total attempts: ${d.totalAttempts}`)
  if (d.avgLatestPct != null) lines.push(`Average latest score: ${d.avgLatestPct}%`)
  if (d.avgBestPct != null) lines.push(`Average best score: ${d.avgBestPct}%`)
  if (d.attendancePct != null) lines.push(`Attendance: ${d.attendancePct}% across ${d.attendanceMarked} marked sessions`)
  lines.push(`Streak: ${d.streak} day${d.streak === 1 ? '' : 's'} of consecutive activity`)
  lines.push(`Score trend: ${d.trendDirection}`)
  if (d.topStrengths.length > 0) {
    lines.push('')
    lines.push('Strongest exercises (best score):')
    for (const ex of d.topStrengths) lines.push(`  - ${ex.title}: ${ex.pct}%`)
  }
  if (d.topWeaknesses.length > 0) {
    lines.push('')
    lines.push('Weakest exercises (latest score):')
    for (const ex of d.topWeaknesses) lines.push(`  - ${ex.title}: ${ex.pct}%`)
  }
  if (d.skillBreakdown.length > 0) {
    lines.push('')
    lines.push('Skill breakdown:')
    for (const s of d.skillBreakdown) lines.push(`  - ${s.label}: ${s.avgPct}% (${s.attempted} exercises)`)
  }
  if (d.cefrBreakdown.length > 0) {
    lines.push('')
    lines.push('CEFR performance:')
    for (const c of d.cefrBreakdown) lines.push(`  - ${c.level}: ${c.avgPct}% (${c.attempted} exercises)`)
  }
  lines.push('')
  lines.push('Write the 2-3 sentence summary now.')
  return lines.join('\n')
}
