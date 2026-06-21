'use client'

import AudioButton from '@/components/AudioButton'
import AttachedExercisesRunner from '@/components/AttachedExercisesRunner'
import { InlineQuiz } from '../InlineQuiz'
import type { GrammarContent } from '../types'

// ── Grammar Block (student view) ──
// Inner body lifted verbatim from app/lessons/[id]/page.tsx grammar branch
// (rule + examples with highlight & Listen + pitfalls + practice). onScore is
// the same handleBlockComplete(blockId, s, t) wire for both practice paths.
export function GrammarView({
  content,
  onScore,
}: {
  content: GrammarContent
  onScore?: (score: number, total: number) => void
}) {
  return (
    <>
      {/* Rule explanation */}
      <div className="bg-white rounded-2xl border-[1.5px] border-sky-border p-6 mb-4">
        <h2 className="text-xs font-bold text-brandblue uppercase tracking-wider mb-3">
          Rule
        </h2>
        <p className="text-sm text-ink-body leading-relaxed whitespace-pre-wrap">
          {content.explanation}
        </p>
      </div>

      {/* Examples — with target structure highlight + Listen audio */}
      {content.examples && content.examples.length > 0 && (
        <div className="bg-sky-wash rounded-2xl p-5 mb-4">
          <h2 className="text-xs font-bold text-sky-dark uppercase tracking-wider mb-3">
            Examples
          </h2>
          <ul className="space-y-2">
            {content.examples.map((ex, i) => {
              // Highlight: prefer per-example highlight; fall back to target_structure global; else none.
              const hl = (content.example_highlights && content.example_highlights[i]) || content.target_structure || ''
              let body: React.ReactNode = ex
              if (hl && ex.toLowerCase().includes(hl.toLowerCase())) {
                const idx = ex.toLowerCase().indexOf(hl.toLowerCase())
                body = (
                  <>
                    {ex.slice(0, idx)}
                    <strong className="text-brandblue">{ex.slice(idx, idx + hl.length)}</strong>
                    {ex.slice(idx + hl.length)}
                  </>
                )
              }
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-ink-body bg-white rounded-lg px-3 py-2 border border-sky-border"
                >
                  <span className="flex-1">{body}</span>
                  <AudioButton text={ex} />
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Common pitfalls — opt-in section from AI generation */}
      {content.pitfalls && content.pitfalls.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mb-4">
          <h2 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3">
            Watch out for
          </h2>
          <ul className="space-y-3">
            {content.pitfalls.map((p, i) => (
              <li key={i} className="text-sm text-ink-body">
                <div>
                  <span className="text-red-400 line-through mr-1">{p.mistake}</span>
                  <span className="mx-1 text-[#c8ccd4]">→</span>
                  <span className="text-green-600 font-medium">{p.correct}</span>
                </div>
                {p.tip && <p className="text-[11px] text-ink-muted mt-0.5">{p.tip}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Practice exercises — prefer new multi-type field; fall back to legacy MCQ */}
      {content.practice_exercises && content.practice_exercises.length > 0 ? (
        <div>
          <h2 className="text-sm font-bold text-brandblue mb-3">Practice</h2>
          <AttachedExercisesRunner
            exercises={content.practice_exercises}
            onScore={(s, t) => onScore?.(s, t)}
          />
        </div>
      ) : content.exercises && content.exercises.length > 0 ? (
        <div>
          <h2 className="text-sm font-bold text-brandblue mb-3">Practice</h2>
          <InlineQuiz questions={content.exercises} onComplete={(s, t) => onScore?.(s, t)} />
        </div>
      ) : null}
    </>
  )
}
