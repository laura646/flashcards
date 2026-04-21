import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { downloadZoomFile, extractTranscriptUrl, parseCourseName } from '@/lib/zoom'
import { parseVTT, normalizeTranscript } from '@/lib/transcript-parser'

// Allow up to 60s for transcript download + AI processing
export const maxDuration = 60

// ═══════════════════════════════════════════════════════════════
// Zoom Webhook — Phase 2: full transcript → AI processing pipeline
// ═══════════════════════════════════════════════════════════════
// Flow:
//   1. Zoom fires recording.completed → we verify signature
//   2. Extract transcript URL from the recording_files payload
//   3. Create a class_sessions row (or find existing one)
//   4. Download VTT transcript, parse speakers, normalize
//   5. Auto-match meeting topic to an EwL course (case-insensitive)
//   6. Send cleaned transcript to Claude → get flashcards, issues, summary
//   7. Save AI results to class_sessions → status = 'pending_review'
//   8. Trainer sees it in their Lesson Reviews tab and approves/edits
// ═══════════════════════════════════════════════════════════════

type ZoomRecordingFile = {
  file_type?: string
  file_extension?: string
  download_url?: string
  [key: string]: unknown
}

type ZoomRecordingObject = {
  id?: number | string
  uuid?: string
  topic?: string
  account_id?: string
  start_time?: string
  recording_files?: ZoomRecordingFile[]
  [key: string]: unknown
}

type ZoomEvent = {
  event?: string
  payload?: {
    plainToken?: string
    account_id?: string
    object?: ZoomRecordingObject
    [key: string]: unknown
  }
}

// ── Claude prompt for transcript analysis ──
const TRANSCRIPT_ANALYSIS_PROMPT = `You are an expert ESL teaching assistant analyzing a transcript from a live English lesson.

The transcript uses [TRAINER] for the teacher and [STUDENT] for the student(s).

Analyze the conversation and return ONLY valid JSON (no markdown, no extra text) with these keys:

1. "flashcards": Array of vocabulary words/phrases the student(s) struggled with, misused, or clearly did not know. For each:
   - "word": the vocabulary word or phrase
   - "phonetic": IPA pronunciation if applicable, or empty string
   - "meaning": clear ESL-friendly definition
   - "example": a correct example sentence using the word

2. "issues": Array of grammar, vocabulary, or pronunciation mistake PATTERNS observed. For each:
   - "tag": concise description of the mistake pattern (e.g. "Confuses Past Simple and Present Perfect")
   - "evidence": exact quote from the transcript showing the mistake

3. "summary": A string with 5-7 bullet points summarizing what was covered. Each bullet starts with "- ".

RULES:
- Only include vocabulary the student actually struggled with — not every word mentioned
- For issues, focus on PATTERNS (mistakes that appeared more than once), not one-off slips
- If the student used a non-English word, note it but do not try to translate it
- Keep the summary focused on lesson content, not small talk
- Maximum 15 flashcards and 10 issues
- Return ONLY the JSON object — no markdown fences, no explanation`

export async function POST(req: NextRequest) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET
  if (!secret) {
    console.error('[zoom/webhook] ZOOM_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  let event: ZoomEvent
  try {
    event = JSON.parse(rawBody) as ZoomEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── 1. Zoom URL validation handshake ──
  if (event.event === 'endpoint.url_validation') {
    const plainToken = event.payload?.plainToken
    if (!plainToken) {
      return NextResponse.json({ error: 'Missing plainToken' }, { status: 400 })
    }
    const encryptedToken = crypto
      .createHmac('sha256', secret)
      .update(plainToken)
      .digest('hex')
    return NextResponse.json({ plainToken, encryptedToken })
  }

  // ── 2. Verify HMAC-SHA256 signature ──
  const timestamp = req.headers.get('x-zm-request-timestamp')
  const signature = req.headers.get('x-zm-signature')
  if (!timestamp || !signature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
  }

  const expectedSignature =
    'v0=' +
    crypto
      .createHmac('sha256', secret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest('hex')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expectedSignature)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.warn('[zoom/webhook] Signature mismatch')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── 3. Handle recording.completed ──
  if (event.event === 'recording.completed' || event.event === 'recording.transcript_completed') {
    const recording = event.payload?.object
    if (!recording) return NextResponse.json({ ok: true })

    const meetingUuid = recording.uuid || ''
    const meetingTopic = recording.topic || ''
    const recordingFiles = (recording.recording_files || []) as ZoomRecordingFile[]
    const transcriptUrl = extractTranscriptUrl(recordingFiles as Array<Record<string, unknown>>)

    // ── 3a. Upsert class_sessions row ──
    // Use upsert so duplicate webhooks (recording.completed + transcript_completed) don't conflict
    const { data: sessionRow, error: upsertError } = await supabase
      .from('class_sessions')
      .upsert(
        {
          zoom_meeting_id: String(recording.id || ''),
          zoom_meeting_uuid: meetingUuid || null,
          zoom_meeting_topic: meetingTopic,
          zoom_account_id: recording.account_id || event.payload?.account_id || null,
          zoom_transcript_download_url: transcriptUrl || null,
          recorded_at: recording.start_time || null,
          status: transcriptUrl ? 'pending_processing' : 'pending_processing',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'zoom_meeting_uuid' }
      )
      .select('id, status')
      .single()

    if (upsertError || !sessionRow) {
      console.error('[zoom/webhook] Upsert failed:', upsertError)
      return NextResponse.json({ ok: true }) // Still 200 so Zoom doesn't retry forever
    }

    // Skip if already processed
    if (sessionRow.status === 'pending_review' || sessionRow.status === 'published') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    // If no transcript URL available, we wait for transcript_completed event
    if (!transcriptUrl) {
      console.log('[zoom/webhook] No transcript URL yet, waiting for transcript_completed event')
      return NextResponse.json({ ok: true })
    }

    // ── 3b. Process the recording (download, match, AI) ──
    try {
      await processClassSession(sessionRow.id, transcriptUrl, meetingTopic)
    } catch (err) {
      console.error('[zoom/webhook] Processing failed:', err)
      await supabase
        .from('class_sessions')
        .update({
          status: 'failed',
          ai_error: err instanceof Error ? err.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionRow.id)
    }

    return NextResponse.json({ ok: true })
  }

  // Ack any other event types
  return NextResponse.json({ ok: true })
}

// ═══════════════════════════════════════════════════════════════
// Processing pipeline
// ═══════════════════════════════════════════════════════════════

async function processClassSession(
  sessionId: string,
  transcriptUrl: string,
  meetingTopic: string
) {
  // ── Step 1: Download and parse the VTT transcript ──
  const vttContent = await downloadZoomFile(transcriptUrl)
  const parsed = parseVTT(vttContent)
  const cleanTranscript = normalizeTranscript(parsed)

  if (!cleanTranscript || cleanTranscript.length < 50) {
    throw new Error('Transcript too short or empty after parsing')
  }

  // ── Step 2: Auto-match course by meeting topic ──
  const courseName = parseCourseName(meetingTopic)
  let courseId: string | null = null
  let trainerEmail: string | null = null

  if (courseName) {
    // Case-insensitive match against courses.name
    const { data: course } = await supabase
      .from('courses')
      .select('id, name')
      .ilike('name', courseName)
      .is('archived_at', null)
      .maybeSingle()

    if (course) {
      courseId = course.id

      // Look up the trainer assigned to this course
      const { data: teacher } = await supabase
        .from('course_teachers')
        .select('teacher_email')
        .eq('course_id', course.id)
        .limit(1)
        .maybeSingle()

      trainerEmail = teacher?.teacher_email || null
    }
  }

  // ── Step 3: Run Claude AI analysis ──
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: TRANSCRIPT_ANALYSIS_PROMPT,
    messages: [
      { role: 'user', content: `TRANSCRIPT:\n\n${cleanTranscript}` },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  const rawOutput = textContent && textContent.type === 'text' ? textContent.text : ''

  // Parse the AI JSON response
  let flashcards: unknown[] = []
  let issues: unknown[] = []
  let summary = ''

  try {
    // Strip markdown fences if the model wrapped the output
    const jsonStr = rawOutput.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(jsonStr)
    flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : []
    issues = Array.isArray(parsed.issues) ? parsed.issues : []
    summary = typeof parsed.summary === 'string' ? parsed.summary : ''
  } catch {
    console.error('[zoom/webhook] Failed to parse AI response as JSON:', rawOutput.slice(0, 200))
    // Save the raw output as summary so the trainer can still see something
    summary = rawOutput
  }

  // ── Step 4: Update class_sessions with results ──
  const newStatus = courseId ? 'pending_review' : 'pending_match'

  await supabase
    .from('class_sessions')
    .update({
      course_id: courseId,
      trainer_email: trainerEmail,
      transcript_text: cleanTranscript,
      transcript_fetched_at: new Date().toISOString(),
      ai_proposed_flashcards: flashcards,
      ai_proposed_issues: issues,
      ai_summary: summary,
      ai_processed_at: new Date().toISOString(),
      ai_error: null,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  console.log(
    `[zoom/webhook] Processed session ${sessionId}: ${flashcards.length} flashcards, ${issues.length} issues, status=${newStatus}`
  )
}
