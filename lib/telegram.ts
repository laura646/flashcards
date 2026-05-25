// Tiny server-side helper for posting to Telegram via the Bot API.
// Used by the publish-time send, the scheduled-send cron, and the
// "Send test message" button on the course settings.

const API_BASE = 'https://api.telegram.org'

/**
 * Send a message to a Telegram chat (group or private). Returns true on
 * success, false on any failure — calling sites are expected to swallow
 * the false (we never want a missing/blocked bot to break a publish).
 *
 * Uses MarkdownV2 escaping when `markdown` is true; pass plain text
 * otherwise.
 */
export async function sendTelegram(
  chatId: string,
  text: string,
  opts?: { markdown?: boolean }
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return false
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // Markdown gets us bolds + clickable links. We escape carefully
        // for MarkdownV2 — see escapeMarkdownV2 below.
        parse_mode: opts?.markdown ? 'MarkdownV2' : undefined,
        disable_web_page_preview: false,
      }),
    })
    return res.ok
  } catch (err) {
    console.error('Telegram send error:', err)
    return false
  }
}

/**
 * Escape a plain-text string so it can be safely interpolated into a
 * MarkdownV2 message body. Doesn't escape characters used for our own
 * formatting tokens (which callers add unescaped, e.g. `*bold*`).
 */
export function escapeMarkdownV2(s: string): string {
  // From Telegram docs: characters that must be escaped in MarkdownV2.
  return s.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`)
}
