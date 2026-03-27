/** Record whether a student knew a word during an activity */
export async function recordWordStruggle(
  userEmail: string,
  word: string,
  activityType: string,
  knew: boolean
): Promise<void> {
  try {
    await fetch('/api/word-struggles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_email: userEmail,
        word,
        activity_type: activityType,
        knew,
      }),
    })
  } catch {
    // Non-blocking
  }
}
