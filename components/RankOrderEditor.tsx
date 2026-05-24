'use client'

import { useMemo, useState } from 'react'

interface RankOrderQuestion {
  id: number | string
  criterion: string
  items: string[]
}

interface Props {
  questions: RankOrderQuestion[]
  onChange: (questions: RankOrderQuestion[]) => void
}

// Visual editor for Rank Order: per question, a criterion + an ordered
// item list (drag handles + arrow buttons + remove). The order the
// teacher enters is the correct order — the runner shuffles for the
// student.

export default function RankOrderEditor({ questions, onChange }: Props) {
  const update = (i: number, patch: Partial<RankOrderQuestion>) => {
    const next = [...questions]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  const addQuestion = () => {
    onChange([
      ...questions,
      { id: crypto.randomUUID(), criterion: '', items: ['', '', ''] },
    ])
  }
  const removeQuestion = (i: number) => {
    onChange(questions.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 italic">No questions yet — add one to get started.</p>
      )}

      {questions.map((q, i) => (
        <RankOrderRow
          key={String(q.id) || i}
          index={i}
          q={q}
          onUpdate={(patch) => update(i, patch)}
          onRemove={() => removeQuestion(i)}
        />
      ))}

      <button
        onClick={addQuestion}
        className="w-full text-xs font-bold text-[#416ebe] hover:text-[#3560b0] py-2 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg transition-colors"
      >
        + Add question
      </button>
    </div>
  )
}

function RankOrderRow({
  index,
  q,
  onUpdate,
  onRemove,
}: {
  index: number
  q: RankOrderQuestion
  onUpdate: (patch: Partial<RankOrderQuestion>) => void
  onRemove: () => void
}) {
  const [showShuffle, setShowShuffle] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const setItems = (items: string[]) => onUpdate({ items })

  const updateItem = (idx: number, text: string) => {
    const next = [...q.items]
    next[idx] = text
    setItems(next)
  }
  const addItem = () => setItems([...q.items, ''])
  const removeItem = (idx: number) => {
    if (q.items.length <= 2) return // need at least 2 to rank
    setItems(q.items.filter((_, i) => i !== idx))
  }
  const moveItem = (from: number, to: number) => {
    if (from === to || to < 0 || to >= q.items.length) return
    const next = [...q.items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
  }

  const shuffled = useMemo(() => {
    if (!showShuffle) return q.items
    const arr = [...q.items]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShuffle, q.items.length])

  return (
    <div className="bg-[#f7fafd] border border-[#e6f0fa] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider">
          Question {index + 1}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowShuffle((v) => !v)}
            className="text-[10px] font-bold text-[#416ebe] hover:text-[#3560b0]"
            title="Show the items in random order — what the student will see"
          >
            {showShuffle ? '✎ Edit mode' : '👁 Preview shuffle'}
          </button>
          <button
            onClick={onRemove}
            className="text-[10px] text-gray-300 hover:text-red-400 transition-colors"
            title="Delete this question"
          >
            ✕ Remove
          </button>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
          Ranking criterion <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={q.criterion}
          onChange={(e) => onUpdate({ criterion: e.target.value })}
          placeholder="e.g. Rank from smallest to largest"
          className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
        />
        <p className="text-[10px] text-gray-300 mt-1">
          What rule does the student use to order the items?
        </p>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
          Items in correct order <span className="text-red-400">*</span>
        </label>
        {showShuffle ? (
          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-400">
              Preview — this is the random order the student will see:
            </p>
            {shuffled.map((it, i) => (
              <div
                key={i}
                className="bg-white border border-[#cddcf0] rounded-lg px-3 py-2 text-sm text-[#46464b]"
              >
                {it.trim() || <span className="text-gray-300 italic">empty item</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {q.items.map((it, itIdx) => {
              const isDragOver = dragIdx !== null && dragIdx !== itIdx
              return (
                <div
                  key={itIdx}
                  draggable
                  onDragStart={() => setDragIdx(itIdx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null) moveItem(dragIdx, itIdx)
                    setDragIdx(null)
                  }}
                  onDragEnd={() => setDragIdx(null)}
                  className={`flex items-center gap-2 bg-white border rounded-lg p-1.5 ${
                    isDragOver ? 'border-[#416ebe]' : 'border-[#cddcf0]'
                  }`}
                >
                  <div className="flex items-center gap-1 shrink-0 select-none">
                    <span
                      className="text-gray-300 cursor-grab active:cursor-grabbing"
                      title="Drag to reorder"
                    >
                      ☰
                    </span>
                    <span className="text-[10px] font-bold text-[#416ebe] w-4 text-center">
                      {itIdx + 1}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={it}
                    onChange={(e) => updateItem(itIdx, e.target.value)}
                    placeholder={`Item ${itIdx + 1}`}
                    className="flex-1 px-2 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded focus:outline-none focus:border-[#416ebe] transition-colors"
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => moveItem(itIdx, itIdx - 1)}
                      disabled={itIdx === 0}
                      className="text-gray-400 hover:text-[#416ebe] disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-[#e6f0fa]"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveItem(itIdx, itIdx + 1)}
                      disabled={itIdx === q.items.length - 1}
                      className="text-gray-400 hover:text-[#416ebe] disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-[#e6f0fa]"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeItem(itIdx)}
                      disabled={q.items.length <= 2}
                      className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-red-50"
                      title={q.items.length <= 2 ? 'Need at least 2 items to rank' : 'Remove this item'}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
            <button
              onClick={addItem}
              className="w-full text-[11px] font-bold text-[#416ebe] hover:text-[#3560b0] py-1.5 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg transition-colors"
            >
              + Add item
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
