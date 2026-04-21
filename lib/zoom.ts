// ═══════════════════════════════════════════════════════════════
// Zoom API helpers — Server-to-Server OAuth + recording downloads
// ═══════════════════════════════════════════════════════════════
// Required env vars:
//   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token'

// In-memory token cache (per serverless instance)
let cachedToken: string | null = null
let tokenExpiresAt = 0

/**
 * Get a valid Zoom Server-to-Server OAuth access token.
 * Caches in memory; refreshes 5 min before expiry.
 */
export async function getZoomAccessToken(): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Missing ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, or ZOOM_CLIENT_SECRET')
  }

  if (cachedToken && Date.now() < (tokenExpiresAt - 5 * 60 * 1000)) {
    return cachedToken
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Zoom OAuth failed (${res.status}): ${errorText}`)
  }

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in * 1000)
  return cachedToken!
}

/**
 * Download a Zoom recording file (e.g., VTT transcript).
 */
export async function downloadZoomFile(downloadUrl: string): Promise<string> {
  const token = await getZoomAccessToken()
  const separator = downloadUrl.includes('?') ? '&' : '?'
  const url = `${downloadUrl}${separator}access_token=${token}`

  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`Zoom file download failed (${res.status})`)
  }
  return res.text()
}

/**
 * Extract the VTT transcript download URL from the recording_files array
 * inside a recording.completed webhook payload.
 */
export function extractTranscriptUrl(
  recordingFiles: Array<Record<string, unknown>>
): string | null {
  if (!Array.isArray(recordingFiles)) return null
  const transcript = recordingFiles.find(
    (f) => f.file_type === 'TRANSCRIPT' && f.file_extension === 'VTT'
  )
  return (transcript?.download_url as string) || null
}

/**
 * Parse the EwL course name from a Zoom meeting topic.
 * Topic format: "A1.1-G4-Nelly | English with Laura"
 * Returns: "A1.1-G4-Nelly" (or null if unparseable)
 */
export function parseCourseName(topic: string | null | undefined): string | null {
  if (!topic) return null
  const parts = topic.split('|')
  const name = parts[0].trim()
  return name || null
}
