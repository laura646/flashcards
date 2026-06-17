'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Home-screen card surfacing how many vocabulary words are due for
// spaced-repetition review. "10B" re-skin — all data flow preserved:
// silent sync on mount, then stats + streak fetch; hides itself when
// there's no SRS data. Every router.push('/vocabulary') call site kept.

interface SrsStats {
  total: number
  due: number
  review_due: number
  new_words: number
}

export default function VocabDueCard() {
  const router = useRouter()
  const [stats, setStats] = useState<SrsStats | null>(null)
  const [streak, setStreak] = useState(0)
  const [reviewedToday, setReviewedToday] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await fetch('/api/vocab-srs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync' }),
        })
      } catch {
        /* non-blocking */
      }
      try {
        const [statsRes, streakRes] = await Promise.all([
          fetch('/api/vocab-srs?action=stats'),
          fetch('/api/vocab-srs?action=streak'),
        ])
        const statsData = await statsRes.json()
        const streakData = await streakRes.json()
        if (!cancelled) {
          if (statsData.stats) setStats(statsData.stats)
          setStreak(streakData.streak || 0)
          setReviewedToday(!!streakData.reviewedToday)
        }
      } catch {
        /* leave stats null → card hides itself */
      }
      if (!cancelled) setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="w-full bg-white rounded-card border border-hairline p-5 mb-3 animate-pulse">
        <div className="h-4 w-40 bg-sky-wash rounded mb-2" />
        <div className="h-3 w-56 bg-sky-wash rounded" />
      </div>
    )
  }

  if (!stats || stats.total === 0) return null

  const due = stats.review_due ?? stats.due
  const newWords = stats.new_words ?? 0

  // No reviews due but new words waiting
  if (due === 0 && newWords > 0) {
    return (
      <button
        onClick={() => router.push('/vocabulary')}
        className="w-full bg-white rounded-card border border-hairline p-5 mb-3 text-left hover:border-sky transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="text-3xl">✨</div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-ink-black">
              {newWords} new word{newWords === 1 ? '' : 's'} waiting
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">No reviews due — learn some new words today</p>
          </div>
          <span className="text-[#c8ccd4] group-hover:text-sky transition-colors text-lg">→</span>
        </div>
      </button>
    )
  }

  // Fully caught up
  if (due === 0) {
    return (
      <button
        onClick={() => router.push('/vocabulary')}
        className="w-full bg-white rounded-card border border-hairline p-5 mb-3 text-left hover:border-sky transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="text-3xl">✅</div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-ink-black">Vocabulary — all caught up!</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {stats.total} words tracked. Come back later for more reviews.
            </p>
          </div>
          <span className="text-[#c8ccd4] group-hover:text-sky transition-colors text-lg">→</span>
        </div>
      </button>
    )
  }

  // Words due — prominent solid-sky card with a yellow streak chip
  return (
    <button
      onClick={() => router.push('/vocabulary')}
      className="w-full bg-sky rounded-card shadow-sm p-5 mb-3 text-left transition-all hover:brightness-[0.97] group"
    >
      <div className="flex items-center gap-4">
        <div className="text-3xl">🧠</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">
              {due} {due === 1 ? 'word' : 'words'} due for review
            </h3>
            {streak > 0 && (
              <span className="bg-streak-fill text-streak-ink text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                🔥 {streak}
              </span>
            )}
          </div>
          <p className="text-xs text-white/90 mt-0.5">
            {streak > 0 && !reviewedToday
              ? `Review now to keep your ${streak}-day streak alive`
              : `A quick ${due <= 10 ? '2-minute' : '5-minute'} review keeps them in your memory`}
          </p>
        </div>
        <span className="bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
          Review →
        </span>
      </div>
    </button>
  )
}
