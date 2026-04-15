import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
// Zoom Webhook Endpoint — Phase 1 of Lesson Recording AI feature
// ═══════════════════════════════════════════════════════════════
// What this does:
//   Receives webhooks from Zoom when a cloud recording finishes.
//   Verifies the request signature, handles Zoom's one-time URL
//   validation handshake, and stubs a row into class_sessions.
//
// What this does NOT do (yet — Phase 2):
//   - Fetch the transcript file via Zoom OAuth
//   - Parse speakers + send to Claude
//   - Auto-match meeting topic to a course
//   - Notify trainers
//
// Required environment variables (set in Vercel + .env.local):
//   ZOOM_WEBHOOK_SECRET — the "Secret Token" from your Zoom
//                        Marketplace app's Event Subscriptions section.
//                        Used for both URL validation and signature verification.
// ═══════════════════════════════════════════════════════════════

type ZoomRecordingObject = {
  id?: number | string
  uuid?: string
  topic?: string
  account_id?: string
  start_time?: string
  [key: string]: unknown
}

type ZoomEvent = {
  event?: string
  event_ts?: number
  payload?: {
    plainToken?: string
    account_id?: string
    object?: ZoomRecordingObject
    [key: string]: unknown
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET
  if (!secret) {
    console.error('[zoom/webhook] ZOOM_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Read raw body once — needed for signature verification AND for parsing
  const rawBody = await req.text()

  let event: ZoomEvent
  try {
    event = JSON.parse(rawBody) as ZoomEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── 1. Zoom URL validation handshake ──
  // When you first register the webhook URL in the Zoom Marketplace,
  // Zoom calls our endpoint once with this event. We must respond with
  // an HMAC of the plainToken to prove we own the secret.
  // Reference: https://developers.zoom.us/docs/api/webhooks/#validate-your-webhook-endpoint
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

  // ── 2. Verify signature on real events ──
  // Zoom signs every webhook with HMAC-SHA256 over "v0:{timestamp}:{rawBody}".
  // Reference: https://developers.zoom.us/docs/api/webhooks/#verify-webhook-events
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

  // Constant-time comparison to avoid timing attacks
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expectedSignature)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.warn('[zoom/webhook] Signature mismatch')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── 3. Handle the events we care about ──
  // For Phase 1, we only stub the recording.completed event. Phase 2
  // will add transcript fetching, course matching, and AI processing.
  if (event.event === 'recording.completed') {
    const recording = event.payload?.object
    if (!recording) {
      // Nothing useful in payload — ack and bail
      return NextResponse.json({ ok: true })
    }

    const { error } = await supabase.from('class_sessions').insert({
      zoom_meeting_id: String(recording.id || ''),
      zoom_meeting_uuid: recording.uuid || null,
      zoom_meeting_topic: recording.topic || null,
      zoom_account_id: recording.account_id || event.payload?.account_id || null,
      recorded_at: recording.start_time || null,
      status: 'pending_processing',
    })

    if (error) {
      // Log but still return 200 — we don't want Zoom to retry forever
      // for what may be a duplicate (zoom_meeting_uuid is UNIQUE).
      console.error('[zoom/webhook] Failed to insert class_sessions row:', error)
    }
  }

  // Always 200 for events we don't handle — Zoom expects success acknowledgement
  return NextResponse.json({ ok: true })
}
