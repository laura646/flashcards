'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Home-screen card surfacing how many vocabulary words are due for
// spaced-repetition review. This is the main discoverability unlock —
// before this, the SRS was buried 3 taps deep and most students never
// found it.
//
// On mount it silently triggers a sync (so the SRS self-populates from
// the student's lessons) then fetches the due count. Loads independently
// of the rest of the home page so it never blocks the main render.

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
      // 1. Silent best-effort sync so new lesson words enter the SRS
      try {
        await fetch('/api/vocab-srs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync' }),
        })
      } catch {
        /* non-blocking */
      }
      // 2. Fetch the due/total counts + the review streak in parallel
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

  // While loading, render a slim skeleton so the layout doesn't jump
  if (loading) {
    return (
      <div className="w-full bg-white rounded-2xl border-2 border-[#cddcf0] p-5 mb-3 animate-pulse">
        <div className="h-4 w-40 bg-gray-100 rounded mb-2" />
        <div className="h-3 w-56 bg-gray-100 rounded" />
      </div>
    )
  }

  // No SRS data at all (sync found nothing / error) → don't clutter home
  if (!stats || stats.total === 0) return null

  const due = stats.review_due ?? stats.due

  const newWords = stats.new_words ?? 0

  // No reviews due but new words waiting — nudge them to learn new words
  if (due === 0 && newWords > 0) {
    return (
      <button
        onClick={() => router.push('/vocabulary?mode=trainer')}
        className="w-full bg-white rounded-2xl border-2 border-[#cddcf0] p-5 mb-3 text-left hover:border-[#416ebe] transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="text-3xl">✨</div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[#46464b] group-hover:text-[#416ebe] transition-colors">
              {newWords} new word{newWords === 1 ? '' : 's'} waiting
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">No reviews due — learn some new words today</p>
          </div>
          <span className="text-gray-300 group-hover:text-[#416ebe] transition-colors text-lg">→</span>
        </div>
      </button>
    )
  }

  // Fully caught up — nothing due, nothing new
  if (due === 0) {
    return (
      <button
        onClick={() => router.push('/vocabulary?mode=trainer')}
        className="w-full bg-white rounded-2xl border-2 border-[#cddcf0] p-5 mb-3 text-left hover:border-[#416ebe] transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="text-3xl">✅</div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[#46464b] group-hover:text-[#416ebe] transition-colors">
              Vocabulary — all caught up!
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.total} words tracked. Come back later for more reviews.
            </p>
          </div>
          <span className="text-gray-300 group-hover:text-[#416ebe] transition-colors text-lg">→</span>
        </div>
      </button>
    )
  }

  // Words due — prominent, action-oriented
  return (
    <button
      onClick={() => router.push('/vocabulary?mode=trainer')}
      className="w-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl shadow-sm p-5 mb-3 text-left transition-all hover:shadow-md group"
    >
      <div className="flex items-center gap-4">
        <div className="text-3xl">🧠</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">
              {due} {due === 1 ? 'word' : 'words'} due for review
            </h3>
            {streak > 0 && (
              <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                🔥 {streak}
              </span>
            )}
          </div>
          <p className="text-xs text-amber-50 mt-0.5">
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
