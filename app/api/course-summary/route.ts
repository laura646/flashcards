import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { requireRole, hasAccessToCourse } from '@/lib/roles'
import { SONNET_MODEL } from '@/lib/ai-models'

// ═══════════════════════════════════════════════════════════════
// /api/course-summary
//
// POST: generate a course-level AI overview — three short narratives
// (summary / needs attention / ready to level up) for the cohort.
// The client sends a pre-aggregated CourseDigestPayload (built by
// lib/reports-compute.buildCourseDigest); the server adds auth +
// course-access checks, asks Claude for the three sections as JSON,
// and caches the result.
//
// GET: read the cached overview for a course (token-free reopen).
//
// Mirrors /api/student-summary. The cache table (course_ai_summaries)
// is OPTIONAL — every DB touch is fail-safe so the feature works even
// before the migration is run (it just regenerates each time).
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are a concise teaching assistant who writes brief cohort progress overviews for an English-learning platform. Your output appears at the top of a teacher- and HR-facing report about a whole course (a group of learners) over a defined time range.

Return ONLY a JSON object with exactly these three string keys and nothing else:
{"summary": "...", "needs": "...", "ready": "..."}

RULES (follow exactly):
- Each value is 2-3 sentences. Never more.
- "summary": the overall state of the cohort this period.
- "needs": which learners or skills need attention, and why (name up to 2 learners if the data supports it).
- "ready": which learners are excelling or ready to level up (name up to 2 learners if the data supports it).
- Use ONLY the metrics you are given. Do not invent numbers, learners, or skills.
- Refer to learners by first name only.
- Honest but constructive. No greetings, emojis, headers, or bullet points. Plain prose only.
- If there is little or no activity, say so briefly in "summary" and keep "needs"/"ready" short.`

interface CourseDigestPayload {
  courseId: string
  courseName: string
  timeRangeLabel: string
  studentCount: number
  avgCompletionPct: number
  avgScorePct: number | null
  avgAttendancePct: number | null
  activeStreaks: number
  skillCohort: { label: string; avgPct: number; students: number }[]
  topPerformers: { name: string; scorePct: number | null; completionPct: number }[]
  needsAttention: { name: string; completionPct: number; scorePct: number | null; attendancePct: number | null }[]
}

function errorResponse(err: unknown): NextResponse {
  const e = err as { status?: number; message?: string }
  return NextResponse.json({ error: e.message || 'Error' }, { status: e.status || 500 })
}

function deriveTimeRangeDays(label: string | undefined): number {
  const l = (label || '').toLowerCase()
  if (l.includes('7')) return 7
  if (l.includes('30')) return 30
  if (l.includes('90')) return 90
  return 0
}

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin')
  } catch (err) {
    return errorResponse(err)
  }

  let body: CourseDigestPayload
  try {
    body = (await req.json()) as CourseDigestPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.courseId) {
    return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  }

  const hasAccess = await hasAccessToCourse(auth.email, auth.role, body.courseId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI overview is not configured' }, { status: 503 })
  }

  const dataBlock = formatCourseDigest(body)

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: dataBlock }],
    })

    const text = message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    // Parse the JSON object out of the response, tolerating stray prose/fences.
    let summary = '',
      needs = '',
      ready = ''
    try {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      const parsed = JSON.parse(text.slice(start, end + 1))
      summary = String(parsed.summary || '').trim()
      needs = String(parsed.needs || '').trim()
      ready = String(parsed.ready || '').trim()
    } catch {
      summary = text
    }
    if (!summary) summary = `Overview unavailable for ${body.courseName}.`

    const timeRangeDays = deriveTimeRangeDays(body.timeRangeLabel)
    const generatedAt = new Date().toISOString()

    // Cache (one row per course; regenerating overwrites). FAIL-SAFE: never
    // break generation if the table is missing or the DB errors.
    try {
      await supabase.from('course_ai_summaries').upsert(
        {
          course_id: body.courseId,
          summary,
          needs,
          ready,
          time_range_days: timeRangeDays,
          generated_by: auth.email,
          generated_at: generatedAt,
        },
        { onConflict: 'course_id' },
      )
    } catch (cacheErr) {
      console.error('course-summary cache upsert failed (ignored):', cacheErr)
    }

    return NextResponse.json({ summary, needs, ready, generatedAt, cached: false })
  } catch (err) {
    console.error('course-summary error:', err)
    return NextResponse.json({ error: 'Failed to generate overview' }, { status: 500 })
  }
}

// ─── GET: read the cached overview for a course (token-free reopen) ───

export async function GET(req: NextRequest) {
  let auth
  try {
    auth = await requireRole('teacher', 'superadmin', 'hr')
  } catch (err) {
    return errorResponse(err)
  }

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) {
    return NextResponse.json({ error: 'courseId required' }, { status: 400 })
  }

  const hasAccess = await hasAccessToCourse(auth.email, auth.role, courseId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // FAIL-SAFE: missing table / DB error → null overview (UI shows Generate).
  try {
    const { data, error } = await supabase
      .from('course_ai_summaries')
      .select('summary, needs, ready, generated_at, time_range_days')
      .eq('course_id', courseId)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ overview: data || null })
  } catch (err) {
    console.error('course-summary GET error (returning null):', err)
    return NextResponse.json({ overview: null })
  }
}

function formatCourseDigest(d: CourseDigestPayload): string {
  const lines: string[] = []
  lines.push(`Course: ${d.courseName}`)
  lines.push(`Time range: ${d.timeRangeLabel}`)
  lines.push(`Learners: ${d.studentCount}`)
  lines.push('')
  lines.push(`Average completion: ${d.avgCompletionPct}%`)
  if (d.avgScorePct != null) lines.push(`Average score: ${d.avgScorePct}%`)
  if (d.avgAttendancePct != null) lines.push(`Average attendance: ${d.avgAttendancePct}%`)
  lines.push(`Learners on an active streak: ${d.activeStreaks} of ${d.studentCount}`)
  if (d.skillCohort.length > 0) {
    lines.push('')
    lines.push('Cohort skill averages (best score):')
    for (const s of d.skillCohort) lines.push(`  - ${s.label}: ${s.avgPct}% (${s.students} learners)`)
  }
  if (d.topPerformers.length > 0) {
    lines.push('')
    lines.push('Top performers:')
    for (const p of d.topPerformers)
      lines.push(`  - ${p.name}: ${p.scorePct != null ? p.scorePct + '% avg score' : 'no score yet'}, ${p.completionPct}% complete`)
  }
  if (d.needsAttention.length > 0) {
    lines.push('')
    lines.push('Lowest engagement:')
    for (const p of d.needsAttention)
      lines.push(
        `  - ${p.name}: ${p.completionPct}% complete${p.scorePct != null ? ', ' + p.scorePct + '% avg score' : ''}${p.attendancePct != null ? ', ' + p.attendancePct + '% attendance' : ''}`,
      )
  }
  lines.push('')
  lines.push('Return the JSON object now.')
  return lines.join('\n')
}
