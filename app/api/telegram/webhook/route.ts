import { NextRequest, NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/telegram'

// Telegram → us webhook. Two responsibilities right now:
//  1. When the bot is added to a group, reply with the group's chat ID
//     (so the teacher can paste it into the course settings without
//     poking around in dev tools).
//  2. When anyone in the group types `/chatid`, do the same.
//
// Authentication uses Telegram's optional `secret_token` mechanism:
// we set X-Telegram-Bot-Api-Secret-Token when we configure the webhook,
// and Telegram echoes it back on every call. If TELEGRAM_WEBHOOK_SECRET
// is set in env, we verify the header matches.

export async function POST(req: NextRequest) {
  // Optional secret-token verification
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expected) {
    const got = req.headers.get('x-telegram-bot-api-secret-token')
    if (got !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let update: unknown
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ ok: true }) // Telegram retries on non-200; absorb
  }

  // Telegram sends many update shapes; we only care about a few.
  const u = update as {
    message?: {
      chat?: { id: number; type: string; title?: string }
      text?: string
      new_chat_members?: { is_bot: boolean; username?: string }[]
    }
    my_chat_member?: {
      chat?: { id: number; type: string; title?: string }
      new_chat_member?: { status: string }
    }
  }

  // Case 1: bot was added to (or its status changed in) a chat.
  // `my_chat_member` fires when the bot itself is added/promoted/kicked.
  if (u.my_chat_member?.chat && u.my_chat_member.new_chat_member?.status === 'member') {
    const chat = u.my_chat_member.chat
    if (chat.type === 'group' || chat.type === 'supergroup') {
      await sendTelegram(
        String(chat.id),
        `👋 Hello! I'm ready to post lesson notifications here.\n\nYour group chat ID is:\n\n${chat.id}\n\nCopy that and paste it into the course's "Telegram chat ID" field in the EwL admin panel.`
      )
    }
    return NextResponse.json({ ok: true })
  }

  // Case 2: a message with "/chatid" in any chat.
  if (u.message?.chat && typeof u.message.text === 'string') {
    const text = u.message.text.trim().toLowerCase()
    if (text === '/chatid' || text.startsWith('/chatid@')) {
      const chat = u.message.chat
      await sendTelegram(
        String(chat.id),
        `Chat ID: ${chat.id}\n\nPaste this into the course's "Telegram chat ID" field in the EwL admin panel.`
      )
      return NextResponse.json({ ok: true })
    }
  }

  // Ignore everything else
  return NextResponse.json({ ok: true })
}
