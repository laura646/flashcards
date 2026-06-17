'use client'

// Phase C verification harness — mirrors the Home lessons-view + the
// Lesson-detail overview with mock data (both real screens are auth-gated).
// Uses the real kit components + BottomTabBar. Not linked; delete with the
// other preview routes when the redesign ships.

import { Button, Card, SkyHero } from '@/components/student-ui'
import BottomTabBar from '@/components/student-ui/BottomTabBar'

const LESSONS = [
  { n: 9, title: 'Space & the Solar System', date: '12 June 2025', words: 33, exDone: 1, exTotal: 2, type: 'lesson' },
  { n: 8, title: 'Talking About the Future', date: '5 June 2025', words: 28, exDone: 3, exTotal: 3, type: 'lesson' },
  { n: 0, title: 'Mid-Course Test', date: '1 June 2025', words: 0, exDone: 0, exTotal: 5, type: 'mid_course_test' },
]

const ACTIVITIES = [
  { icon: '📚', label: 'New Words', subtitle: '33 vocabulary words', completed: true },
  { icon: '📖', label: 'Read & Understand', subtitle: 'Reading + comprehension', completed: false },
  { icon: '🎯', label: 'Practice Exercises', subtitle: '0 / 2 complete', completed: false },
]

export default function HomePreview() {
  const firstIncomplete = ACTIVITIES.find((a) => !a.completed)?.label

  return (
    <div className="bg-[#f9fafb] min-h-screen pb-24">
      {/* ───── HOME lessons-view ───── */}
      <SkyHero>
        <div className="max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between">
            <img src="/logo-onblue.png" alt="EwL" className="h-11" />
            <span className="inline-flex items-center gap-1 bg-streak-fill text-streak-ink text-xs font-bold px-3 py-1 rounded-full">🔥 4</span>
          </div>
          <p className="text-white/90 mt-3 text-sm">Welcome back, Anahit!</p>
          <div className="flex items-end justify-between mt-3">
            <div>
              <p className="text-white/90 text-sm">Words to review</p>
              <p className="text-[42px] leading-none font-extrabold tracking-hero">210</p>
            </div>
            <Button variant="onHeroWhite">Start review</Button>
          </div>
        </div>
      </SkyHero>

      <div className="w-full max-w-lg mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[{ e: '🔄', l: 'Flip' }, { e: '🎯', l: 'Quiz' }, { e: '➕', l: 'Add word' }].map((q) => (
            <div key={q.l} className="flex flex-col items-center gap-1.5 bg-sky-wash rounded-tile py-4">
              <span className="text-2xl">{q.e}</span>
              <span className="text-[12px] font-bold text-ink-body">{q.l}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><span>📚</span><h2 className="text-lg font-extrabold text-brandblue">A1.1-G2 · Sveta</h2></div>
          <span className="inline-flex items-center gap-1 bg-streak-fill text-streak-ink text-xs font-bold px-3 py-1 rounded-full">⭐ 1,240</span>
        </div>

        {/* due card mock (solid sky) */}
        <button className="w-full bg-sky rounded-card shadow-sm p-5 mb-3 text-left">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🧠</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">210 words due for review</h3>
                <span className="bg-streak-fill text-streak-ink text-[10px] font-bold px-2 py-0.5 rounded-full">🔥 4</span>
              </div>
              <p className="text-xs text-white/90 mt-0.5">Review now to keep your 4-day streak alive</p>
            </div>
            <span className="bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full">Review →</span>
          </div>
        </button>

        <div className="flex flex-col gap-3">
          {LESSONS.map((l) => {
            const isTest = l.type !== 'lesson'
            const exDone = l.exDone === l.exTotal && l.exTotal > 0
            const pct = l.exTotal > 0 ? Math.round((l.exDone / l.exTotal) * 100) : 0
            return (
              <Card key={l.title} className="hover:border-sky transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-bold text-white px-2 py-0.5 rounded-full ${isTest ? 'bg-[#8b5cf6]' : 'bg-sky'}`}>
                        {isTest ? '📝 Test' : `Lesson ${l.n}`}
                      </span>
                      <span className="text-xs text-ink-muted">{l.date}</span>
                    </div>
                    <h3 className="text-sm font-bold text-brandblue">{l.title}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      {!isTest && <span className="text-xs text-ink-muted">🃏 {l.words} words</span>}
                      <span className="text-xs text-ink-muted">{exDone ? '✅' : '✏️'} {l.exDone}/{l.exTotal} exercises</span>
                    </div>
                    {l.exTotal > 0 && (
                      <div className="mt-2 h-1.5 bg-[#eef1f6] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${exDone ? 'bg-correct-fg' : 'bg-sky'}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <span className="text-[#c8ccd4] text-lg ml-2">→</span>
                </div>
              </Card>
            )
          })}
        </div>

        {/* ───── LESSON-DETAIL overview ───── */}
        <h2 className="text-sm font-extrabold text-ink-muted uppercase tracking-eyebrow mt-10 mb-3">↓ Lesson detail overview</h2>
        <div className="bg-white rounded-card border border-hairline p-6 mb-4">
          <p className="text-xs text-ink-muted mb-1">12 June 2025</p>
          <h1 className="text-xl font-extrabold text-brandblue mb-2">Space &amp; the Solar System</h1>
          <p className="text-sm text-ink-muted leading-relaxed">Explore the planets, their orbits, and the vast distances of space.</p>
        </div>
        <div className="rounded-card p-4 mb-4 bg-white border border-hairline">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-ink-black">Your progress</span>
            <span className="text-xs font-bold text-sky">1/3</span>
          </div>
          <div className="flex gap-1.5">
            {ACTIVITIES.map((a, i) => <div key={i} className={`h-2 flex-1 rounded-full ${a.completed ? 'bg-sky' : 'bg-[#eef1f6]'}`} />)}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {ACTIVITIES.map((a) => {
            const isCurrent = a.label === firstIncomplete
            return (
              <div key={a.label} className={`bg-white rounded-card p-5 flex items-center gap-4 border-[1.5px] ${isCurrent ? 'border-sky' : 'border-hairline'}`}>
                <div className="w-12 h-12 shrink-0 flex items-center justify-center text-2xl bg-sky-wash rounded-tile">{a.completed ? '✅' : a.icon}</div>
                <div className="flex-1">
                  <h3 className={`text-[15px] font-bold ${isCurrent ? 'text-brandblue' : 'text-ink-black'}`}>{a.label}</h3>
                  <p className="text-xs text-ink-muted mt-0.5">{a.subtitle}</p>
                </div>
                <span className="text-[#c8ccd4]">›</span>
              </div>
            )
          })}
        </div>
      </div>

      <BottomTabBar />
    </div>
  )
}
