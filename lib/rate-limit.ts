/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window per key (typically user email).
 *
 * NOTE: This works per-serverless-instance. For production at scale,
 * replace with Redis-backed limiter. Sufficient for current traffic.
 */

const windowMs = 60 * 1000 // 1 minute window
const store = new Map<string, number[]>()

// Clean up old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  store.forEach((timestamps, key) => {
    const valid = timestamps.filter(t => now - t < windowMs)
    if (valid.length === 0) store.delete(key)
    else store.set(key, valid)
  })
}, 5 * 60 * 1000)

export function rateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const timestamps = store.get(key) || []

  // Remove timestamps outside the window
  const valid = timestamps.filter(t => now - t < windowMs)

  if (valid.length >= maxRequests) {
    store.set(key, valid)
    return { allowed: false, remaining: 0 }
  }

  valid.push(now)
  store.set(key, valid)
  return { allowed: true, remaining: maxRequests - valid.length }
}
