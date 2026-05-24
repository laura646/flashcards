'use client'

import { useState, useMemo } from 'react'

interface ErrorCorrectionQuestion {
  id: number | string
  incorrect: string
  correct: string
  hints?: string
}

interface Props {
  questions: ErrorCorrectionQuestion[]
  onChange: (questions: ErrorCorrectionQuestion[]) => void
}

// LCS-based word diff. Mirrors the algorithm the ErrorCorrectionRunner
// uses, so the preview shows exactly what the student will see as errors.
type DiffPart =
  | { type: 'same'; text: string }
  | { type: 'replace'; from: string; to: string }
  | { type: 'insert'; text: string }
  | { type: 'delete'; text: string }

function wordDiff(incorrect: string, correct: string): DiffPart[] {
  const inc = incorrect.trim().split(/\s+/).filter(Boolean)
  const cor = correct.trim().split(/\s+/).filter(Boolean)
  const n = inc.length
  const m = cor.length
  if (n === 0 && m === 0) return []

  // LCS length DP, case-insensitive
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (inc[i - 1].toLowerCase() === cor[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to produce a script of ops
  const ops: DiffPart[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (inc[i - 1].toLowerCase() === cor[j - 1].toLowerCase()) {
      ops.push({ type: 'same', text: inc[i - 1] })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ type: 'delete', text: inc[i - 1] })
      i--
    } else {
      ops.push({ type: 'insert', text: cor[j - 1] })
      j--
    }
  }
  while (i > 0) {
    ops.push({ type: 'delete', text: inc[i - 1] })
    i--
  }
  while (j > 0) {
    ops.push({ type: 'insert', text: cor[j - 1] })
    j--
  }
  ops.reverse()

  // Merge adjacent delete+insert into "replace" for a friendlier display
  const merged: DiffPart[] = []
  for (let k = 0; k < ops.length; k++) {
    const cur = ops[k]
    const next = ops[k + 1]
    if (cur.type === 'delete' && next && next.type === 'insert') {
      merged.push({ type: 'replace', from: cur.text, to: next.text })
      k++
    } else {
      merged.push(cur)
    }
  }
  return merged
}

function countErrors(diff: DiffPart[]): number {
  return diff.reduce((n, d) => n + (d.type === 'same' ? 0 : 1), 0)
}

export default function ErrorCorrectionEditor({ questions, onChange }: Props) {
  const [busyIdx, setBusyIdx] = useState<number | null>(null)
  const [errByIdx, setErrByIdx] = useState<Record<number, string>>({})

  const update = (i: number, patch: Partial<ErrorCorrectionQuestion>) => {
    const next = [...questions]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const add = () => {
    onChange([
      ...questions,
      { id: crypto.randomUUID(), incorrect: '', correct: '', hints: '' },
    ])
  }

  const remove = (i: number) => {
    onChange(questions.filter((_, idx) => idx !== i))
  }

  const autoCorrect = async (i: number, text: string) => {
    if (busyIdx !== null) return
    const trimmed = text.trim()
    if (!trimmed) {
      setErrByIdx((p) => ({ ...p, [i]: 'Type the incorrect sentence first.' }))
      return
    }
    setBusyIdx(i)
    setErrByIdx((p) => ({ ...p, [i]: '' }))
    try {
      const res = await fetch('/api/correct-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || !data.corrected) {
        setErrByIdx((p) => ({ ...p, [i]: data.error || 'Auto-correct failed.' }))
      } else {
        update(i, { correct: data.corrected })
      }
    } catch {
      setErrByIdx((p) => ({ ...p, [i]: 'Auto-correct failed. Try again.' }))
    }
    setBusyIdx(null)
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 italic">No sentences yet — add one to get started.</p>
      )}

      {questions.map((q, i) => (
        <ErrorCorrectionRow
          key={String(q.id) || i}
          index={i}
          q={q}
          busy={busyIdx === i}
          errorMsg={errByIdx[i]}
          onUpdate={(patch) => update(i, patch)}
          onRemove={() => remove(i)}
          onAutoCorrect={() => autoCorrect(i, q.incorrect)}
        />
      ))}

      <button
        onClick={add}
        className="w-full text-xs font-bold text-[#416ebe] hover:text-[#3560b0] py-2 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg transition-colors"
      >
        + Add sentence
      </button>
    </div>
  )
}

function ErrorCorrectionRow({
  index,
  q,
  busy,
  errorMsg,
  onUpdate,
  onRemove,
  onAutoCorrect,
}: {
  index: number
  q: ErrorCorrectionQuestion
  busy: boolean
  errorMsg?: string
  onUpdate: (patch: Partial<ErrorCorrectionQuestion>) => void
  onRemove: () => void
  onAutoCorrect: () => void
}) {
  const diff = useMemo(() => wordDiff(q.incorrect || '', q.correct || ''), [q.incorrect, q.correct])
  const errorCount = countErrors(diff)
  const bothFilled = !!q.incorrect.trim() && !!q.correct.trim()
  const identical =
    bothFilled && q.incorrect.trim().toLowerCase() === q.correct.trim().toLowerCase()

  return (
    <div className="bg-[#f7fafd] border border-[#e6f0fa] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider">
          Sentence {index + 1}
        </p>
        <button
          onClick={onRemove}
          className="text-[10px] text-gray-300 hover:text-red-400 transition-colors"
          title="Delete this sentence"
        >
          ✕ Remove
        </button>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
          Incorrect sentence <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={q.incorrect}
          onChange={(e) => onUpdate({ incorrect: e.target.value })}
          placeholder="e.g. She go to school yesterday."
          className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
        />
        <p className="text-[10px] text-gray-300 mt-1">What the student sees and has to fix.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[10px] font-bold text-gray-400 uppercase">
            Correct sentence <span className="text-red-400">*</span>
          </label>
          <button
            onClick={onAutoCorrect}
            disabled={busy || !q.incorrect.trim()}
            className="text-[10px] font-bold text-[#416ebe] hover:text-[#3560b0] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Use AI to suggest the corrected version"
          >
            {busy ? '🪄 Correcting…' : '🪄 Auto-correct'}
          </button>
        </div>
        <input
          type="text"
          value={q.correct}
          onChange={(e) => onUpdate({ correct: e.target.value })}
          placeholder="e.g. She went to school yesterday."
          className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
        />
        <p className="text-[10px] text-gray-300 mt-1">The answer key — used to score the student.</p>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
          Hint <span className="text-gray-300 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={q.hints || ''}
          onChange={(e) => onUpdate({ hints: e.target.value })}
          placeholder="e.g. Check the verb tense"
          className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
        />
      </div>

      {errorMsg && <p className="text-[11px] text-red-500">{errorMsg}</p>}

      {/* Live diff preview — what the runner will treat as errors */}
      {bothFilled && (
        <div className="border-t border-[#e6f0fa] pt-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
            Preview · {identical ? 'no errors' : `${errorCount} error${errorCount === 1 ? '' : 's'}`}
          </p>
          {identical ? (
            <p className="text-[11px] text-amber-600">
              ⚠ The two sentences are identical — the student will have nothing to fix.
            </p>
          ) : errorCount === 0 ? (
            <p className="text-[11px] text-amber-600">
              ⚠ The diff produced no errors. Check that you changed at least one word.
            </p>
          ) : (
            <p className="text-sm leading-relaxed">
              {diff.map((d, k) => {
                if (d.type === 'same') return <span key={k} className="text-[#46464b]">{d.text} </span>
                if (d.type === 'replace') {
                  return (
                    <span key={k}>
                      <span className="text-red-500 line-through">{d.from}</span>
                      <span className="text-green-600 font-bold"> {d.to}</span>{' '}
                    </span>
                  )
                }
                if (d.type === 'insert') {
                  return <span key={k} className="text-green-600 font-bold">+{d.text} </span>
                }
                return <span key={k} className="text-red-500 line-through">{d.text} </span>
              })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
