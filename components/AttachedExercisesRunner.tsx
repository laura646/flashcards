'use client'

import { useState } from 'react'
import GroupSortRunner from './GroupSortRunner'
import RankOrderRunner from './RankOrderRunner'
import AnagramRunner from './AnagramRunner'
import {
  AttachedExercise,
  ATTACHED_TYPE_ICONS,
  ATTACHED_TYPE_LABELS,
} from '@/lib/attached-exercise'

// Inline runner for the list of follow-up exercises attached to a media
// block. Renders each exercise as its own card on the page (matches the
// existing InlineQuiz pattern that video/article use today, but extended
// to 6 exercise types).
//
// Simple types (MCQ, True/False, Type the Answer) get compact inline
// UIs so several can stack on one page. Drag-based types (Group Sort,
// Rank Order, Anagram) embed the existing standalone runners — heavier
// but functional and consistent with how those exercises behave
// elsewhere.

interface Props {
  exercises: AttachedExercise[]
  // Optional: aggregate score reporter so the parent block can plug into
  // the lesson's progress tracking on submit.
  onScore?: (score: number, total: number) => void
}

export default function AttachedExercisesRunner({ exercises, onScore }: Props) {
  // Score is the count of "correctly handled" sub-questions across all
  // attached exercises. We aggregate via callbacks from each child.
  const [scores, setScores] = useState<Record<string, { score: number; total: number }>>({})

  const reportScore = (exId: string, score: number, total: number) => {
    setScores((prev) => {
      const next = { ...prev, [exId]: { score, total } }
      if (onScore) {
        let s = 0
        let t = 0
        for (const v of Object.values(next)) {
          s += v.score
          t += v.total
        }
        onScore(s, t)
      }
      return next
    })
  }

  if (exercises.length === 0) return null

  return (
    <div className="space-y-4">
      {exercises.map((ex) => (
        <div
          key={ex.id}
          className="bg-white border border-[#cddcf0] rounded-2xl p-4"
        >
          <p className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider mb-3">
            {ATTACHED_TYPE_ICONS[ex.type]} {ATTACHED_TYPE_LABELS[ex.type]}
          </p>
          <Dispatch
            ex={ex}
            onScore={(s, t) => reportScore(ex.id, s, t)}
          />
        </div>
      ))}
    </div>
  )
}

function Dispatch({
  ex,
  onScore,
}: {
  ex: AttachedExercise
  onScore: (score: number, total: number) => void
}) {
  if (ex.type === 'multiple_choice') return <InlineMcq questions={ex.questions || []} onScore={onScore} />
  if (ex.type === 'true_or_false') return <InlineTrueFalse questions={ex.questions || []} onScore={onScore} />
  if (ex.type === 'type_answer') return <InlineTypeAnswer questions={ex.questions || []} onScore={onScore} />
  if (ex.type === 'group_sort') {
    return (
      <GroupSortRunner
        exercise={{
          title: '',
          instructions: '',
          groupData: ex.groupData as Parameters<typeof GroupSortRunner>[0]['exercise']['groupData'],
        }}
        onComplete={onScore}
        onBack={() => { /* embedded — no back nav */ }}
      />
    )
  }
  if (ex.type === 'rank_order') {
    return (
      <RankOrderRunner
        exercise={{
          title: '',
          instructions: '',
          questions: (ex.questions || []) as Parameters<typeof RankOrderRunner>[0]['exercise']['questions'],
        }}
        onComplete={onScore}
        onBack={() => { /* embedded — no back nav */ }}
      />
    )
  }
  if (ex.type === 'anagram') {
    return (
      <AnagramRunner
        exercise={{
          title: '',
          instructions: '',
          questions: (ex.questions || []) as Parameters<typeof AnagramRunner>[0]['exercise']['questions'],
        }}
        onComplete={onScore}
        onBack={() => { /* embedded — no back nav */ }}
      />
    )
  }
  return null
}

// ── Simple inline mini-runners ────────────────────────────────────────

interface McqQ { id: number | string; prompt: string; options: string[]; correctIndex: number; hint?: string; explanation?: string }

function InlineMcq({ questions, onScore }: { questions: unknown[]; onScore: (s: number, t: number) => void }) {
  const qs = questions as McqQ[]
  const [picks, setPicks] = useState<(number | null)[]>(() => qs.map(() => null))
  const [checked, setChecked] = useState<boolean[]>(() => qs.map(() => false))

  const check = (i: number) => {
    if (picks[i] === null) return
    const nextChecked = [...checked]
    nextChecked[i] = true
    setChecked(nextChecked)
    const score = qs.reduce((acc, q, k) => acc + (nextChecked[k] && picks[k] === q.correctIndex ? 1 : 0), 0)
    onScore(score, qs.length)
  }

  return (
    <div className="space-y-3">
      {qs.map((q, i) => {
        const isChecked = checked[i]
        const isCorrect = picks[i] === q.correctIndex
        return (
          <div key={String(q.id) || i} className="bg-[#f7fafd] border border-[#e6f0fa] rounded-lg p-3">
            <p className="text-sm font-medium text-[#46464b] mb-2">{i + 1}. {q.prompt}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const selected = picks[i] === oi
                const isThisCorrect = oi === q.correctIndex
                let cls = 'border-[#cddcf0] text-[#46464b] hover:border-[#416ebe] bg-white'
                if (isChecked) {
                  if (isThisCorrect) cls = 'border-green-400 bg-green-50 text-green-700'
                  else if (selected) cls = 'border-red-400 bg-red-50 text-red-500'
                  else cls = 'border-[#cddcf0] bg-white text-gray-400'
                } else if (selected) cls = 'border-[#416ebe] bg-[#e6f0fa] text-[#416ebe]'
                return (
                  <button
                    key={oi}
                    disabled={isChecked}
                    onClick={() => {
                      const next = [...picks]; next[i] = oi; setPicks(next)
                    }}
                    className={`w-full text-left border-2 rounded-lg py-2 px-3 text-sm transition-all ${cls}`}
                  >
                    {String.fromCharCode(97 + oi)}) {opt}
                  </button>
                )
              })}
            </div>
            {q.hint && !isChecked && (
              <p className="text-[11px] text-gray-400 italic mt-2">{q.hint}</p>
            )}
            {!isChecked ? (
              <button
                onClick={() => check(i)}
                disabled={picks[i] === null}
                className="mt-2 bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"
              >
                Check
              </button>
            ) : (
              <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {isCorrect ? '✓ Correct' : `✗ Correct answer: ${q.options[q.correctIndex]}`}
                {q.explanation && <p className="text-[#46464b] mt-1">{q.explanation}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface TfQ { id: number | string; statement: string; isTrue: boolean; explanation?: string }

function InlineTrueFalse({ questions, onScore }: { questions: unknown[]; onScore: (s: number, t: number) => void }) {
  const qs = questions as TfQ[]
  const [picks, setPicks] = useState<(boolean | null)[]>(() => qs.map(() => null))
  const [checked, setChecked] = useState<boolean[]>(() => qs.map(() => false))

  const check = (i: number) => {
    if (picks[i] === null) return
    const nc = [...checked]; nc[i] = true; setChecked(nc)
    const score = qs.reduce((acc, q, k) => acc + (nc[k] && picks[k] === q.isTrue ? 1 : 0), 0)
    onScore(score, qs.length)
  }

  return (
    <div className="space-y-3">
      {qs.map((q, i) => {
        const isChecked = checked[i]
        const isCorrect = picks[i] === q.isTrue
        return (
          <div key={String(q.id) || i} className="bg-[#f7fafd] border border-[#e6f0fa] rounded-lg p-3">
            <p className="text-sm text-[#46464b] mb-2">{i + 1}. {q.statement}</p>
            <div className="flex gap-2">
              {([true, false] as const).map((v) => {
                const sel = picks[i] === v
                let cls = 'border-[#cddcf0] text-[#46464b] hover:border-[#416ebe] bg-white'
                if (isChecked) {
                  if (q.isTrue === v) cls = 'border-green-400 bg-green-50 text-green-700'
                  else if (sel) cls = 'border-red-400 bg-red-50 text-red-500'
                  else cls = 'border-[#cddcf0] bg-white text-gray-400'
                } else if (sel) cls = 'border-[#416ebe] bg-[#e6f0fa] text-[#416ebe]'
                return (
                  <button
                    key={String(v)}
                    disabled={isChecked}
                    onClick={() => { const n = [...picks]; n[i] = v; setPicks(n) }}
                    className={`flex-1 border-2 rounded-lg py-2 text-sm font-bold transition-colors ${cls}`}
                  >
                    {v ? '✓ True' : '✗ False'}
                  </button>
                )
              })}
            </div>
            {!isChecked ? (
              <button
                onClick={() => check(i)}
                disabled={picks[i] === null}
                className="mt-2 bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"
              >
                Check
              </button>
            ) : (
              <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {isCorrect ? '✓ Correct' : `✗ Correct answer: ${q.isTrue ? 'True' : 'False'}`}
                {q.explanation && <p className="text-[#46464b] mt-1">{q.explanation}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface TaQ { id: number | string; prompt: string; answer: string; alternatives?: string[]; hint?: string }

function InlineTypeAnswer({ questions, onScore }: { questions: unknown[]; onScore: (s: number, t: number) => void }) {
  const qs = questions as TaQ[]
  const [vals, setVals] = useState<string[]>(() => qs.map(() => ''))
  const [checked, setChecked] = useState<boolean[]>(() => qs.map(() => false))

  const normalize = (s: string) =>
    s.replace(/[.,!?;:'"()\-—–…]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

  const isRight = (q: TaQ, v: string) => {
    const t = normalize(v)
    if (!t) return false
    if (normalize(q.answer) === t) return true
    return (q.alternatives || []).some((a) => normalize(a) === t)
  }

  const check = (i: number) => {
    if (!vals[i].trim()) return
    const nc = [...checked]; nc[i] = true; setChecked(nc)
    const score = qs.reduce((acc, q, k) => acc + (nc[k] && isRight(q, vals[k]) ? 1 : 0), 0)
    onScore(score, qs.length)
  }

  return (
    <div className="space-y-3">
      {qs.map((q, i) => {
        const isChecked = checked[i]
        const ok = isChecked && isRight(q, vals[i])
        return (
          <div key={String(q.id) || i} className="bg-[#f7fafd] border border-[#e6f0fa] rounded-lg p-3">
            <p className="text-sm text-[#46464b] mb-2">{i + 1}. {q.prompt}</p>
            <input
              type="text"
              value={vals[i]}
              onChange={(e) => { const n = [...vals]; n[i] = e.target.value; setVals(n) }}
              onKeyDown={(e) => { if (e.key === 'Enter') check(i) }}
              disabled={isChecked}
              placeholder="Type your answer…"
              className={`w-full border-2 rounded-lg px-3 py-2 text-sm text-[#46464b] focus:outline-none disabled:bg-gray-50 ${
                isChecked ? (ok ? 'border-green-400' : 'border-red-400') : 'border-[#cddcf0] focus:border-[#416ebe]'
              }`}
            />
            {q.hint && !isChecked && (
              <p className="text-[11px] text-gray-400 italic mt-1">{q.hint}</p>
            )}
            {!isChecked ? (
              <button
                onClick={() => check(i)}
                disabled={!vals[i].trim()}
                className="mt-2 bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"
              >
                Check
              </button>
            ) : (
              <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {ok ? '✓ Correct' : `✗ Correct answer: ${q.answer}`}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
