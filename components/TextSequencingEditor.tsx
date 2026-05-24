'use client'

import { useState, useMemo } from 'react'

interface TextSequencingQuestion {
  id: number | string
  segments: string[]
  level?: 'sentence' | 'paragraph'
}

interface Props {
  questions: TextSequencingQuestion[]
  onChange: (questions: TextSequencingQuestion[]) => void
}

// Reading-comprehension sequencing, LingQ-style: each question is a
// passage broken into ordered paragraphs. Teacher writes them in the
// correct order; the runner shuffles for the student.
//
// Features:
//  - drag-to-reorder paragraphs (HTML5 drag, with ↑↓ arrows as fallback)
//  - "Paste a passage" splits a long text on blank lines into paragraphs
//  - "Preview shuffle" shows what the student will actually see
//  - + Add paragraph / ✕ Remove per row, matching the other editors
//
// Data shape unchanged ({id, segments[], level?}). New questions default
// to level='paragraph'; legacy 'sentence' exercises still load.

export default function TextSequencingEditor({ questions, onChange }: Props) {
  const update = (i: number, patch: Partial<TextSequencingQuestion>) => {
    const next = [...questions]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  const addQuestion = () => {
    onChange([
      ...questions,
      { id: crypto.randomUUID(), segments: ['', ''], level: 'paragraph' },
    ])
  }
  const removeQuestion = (i: number) => {
    onChange(questions.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 italic">No passages yet — add one to get started.</p>
      )}

      {questions.map((q, i) => (
        <PassageRow
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
        + Add passage
      </button>
    </div>
  )
}

function PassageRow({
  index,
  q,
  onUpdate,
  onRemove,
}: {
  index: number
  q: TextSequencingQuestion
  onUpdate: (patch: Partial<TextSequencingQuestion>) => void
  onRemove: () => void
}) {
  const [showShuffle, setShowShuffle] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const setSegments = (segs: string[]) => onUpdate({ segments: segs })

  const updateSegment = (segIdx: number, text: string) => {
    const next = [...q.segments]
    next[segIdx] = text
    setSegments(next)
  }
  const addSegment = () => setSegments([...q.segments, ''])
  const removeSegment = (segIdx: number) => {
    if (q.segments.length <= 2) return // keep at least 2 — nothing to sequence otherwise
    setSegments(q.segments.filter((_, i) => i !== segIdx))
  }
  const moveSegment = (from: number, to: number) => {
    if (from === to || to < 0 || to >= q.segments.length) return
    const next = [...q.segments]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setSegments(next)
  }

  const applyPaste = () => {
    // Split on one-or-more blank lines (typical paragraph break)
    const parts = pasteText
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length >= 2) {
      setSegments(parts)
      setPasteOpen(false)
      setPasteText('')
    }
  }

  // Shuffle for preview — Fisher-Yates, deterministic per render via useMemo
  // on `showShuffle` so the order doesn't churn while the teacher reads.
  const shuffled = useMemo(() => {
    if (!showShuffle) return q.segments
    const arr = [...q.segments]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShuffle, q.segments.length])

  return (
    <div className="bg-[#f7fafd] border border-[#e6f0fa] rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider">
          Passage {index + 1}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPasteOpen((v) => !v)}
            className="text-[10px] font-bold text-[#416ebe] hover:text-[#3560b0]"
            title="Paste a passage and auto-split into paragraphs at blank lines"
          >
            📋 Paste a passage
          </button>
          <button
            onClick={() => setShowShuffle((v) => !v)}
            className="text-[10px] font-bold text-[#416ebe] hover:text-[#3560b0]"
            title="Show the paragraphs in random order — what the student will see"
          >
            {showShuffle ? '✎ Edit mode' : '👁 Preview shuffle'}
          </button>
          <button
            onClick={onRemove}
            className="text-[10px] text-gray-300 hover:text-red-400 transition-colors"
            title="Delete this passage"
          >
            ✕ Remove
          </button>
        </div>
      </div>

      {/* Paste-to-split helper */}
      {pasteOpen && !showShuffle && (
        <div className="bg-white border border-[#cddcf0] rounded-lg p-2 space-y-2">
          <p className="text-[10px] text-gray-400">
            Paste a longer text below. We&apos;ll split it into paragraphs at blank lines and
            replace the current list.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'Paragraph 1 …\n\nParagraph 2 …\n\nParagraph 3 …'}
            rows={5}
            className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={applyPaste}
              disabled={pasteText.split(/\n\s*\n+/).filter((p) => p.trim()).length < 2}
              className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              Split into paragraphs
            </button>
            <button
              onClick={() => { setPasteOpen(false); setPasteText('') }}
              className="text-xs font-bold text-gray-400 hover:text-[#46464b] px-2"
            >
              Cancel
            </button>
            <span className="text-[10px] text-gray-400 ml-auto">
              Detected:{' '}
              {pasteText.split(/\n\s*\n+/).filter((p) => p.trim()).length || 0} paragraphs
            </span>
          </div>
        </div>
      )}

      {/* Either the editor list (default) or the shuffled preview */}
      {showShuffle ? (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-400">
            Preview — this is the random order the student will see:
          </p>
          {shuffled.map((seg, i) => (
            <div
              key={i}
              className="bg-white border border-[#cddcf0] rounded-lg p-2 text-sm text-[#46464b]"
            >
              {seg.trim() || <span className="text-gray-300 italic">empty paragraph</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {q.segments.map((seg, segIdx) => {
            const isDragOver = dragIdx !== null && dragIdx !== segIdx
            return (
              <div
                key={segIdx}
                draggable
                onDragStart={() => setDragIdx(segIdx)}
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={() => {
                  if (dragIdx !== null) moveSegment(dragIdx, segIdx)
                  setDragIdx(null)
                }}
                onDragEnd={() => setDragIdx(null)}
                className={`flex items-start gap-2 bg-white border rounded-lg p-2 ${
                  isDragOver ? 'border-[#416ebe]' : 'border-[#cddcf0]'
                }`}
              >
                {/* Drag handle + number */}
                <div className="flex flex-col items-center gap-1 pt-1 shrink-0 select-none">
                  <span
                    className="text-gray-300 cursor-grab active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    ☰
                  </span>
                  <span className="text-[10px] font-bold text-[#416ebe]">{segIdx + 1}</span>
                </div>

                {/* Paragraph text */}
                <textarea
                  value={seg}
                  onChange={(e) => updateSegment(segIdx, e.target.value)}
                  placeholder={`Paragraph ${segIdx + 1}…`}
                  rows={3}
                  className="flex-1 px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] resize-y"
                />

                {/* Arrow + remove (keyboard-accessible fallback to drag) */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button
                    onClick={() => moveSegment(segIdx, segIdx - 1)}
                    disabled={segIdx === 0}
                    className="text-gray-400 hover:text-[#416ebe] disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-[#e6f0fa]"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveSegment(segIdx, segIdx + 1)}
                    disabled={segIdx === q.segments.length - 1}
                    className="text-gray-400 hover:text-[#416ebe] disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-[#e6f0fa]"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeSegment(segIdx)}
                    disabled={q.segments.length <= 2}
                    className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-sm w-6 h-6 rounded hover:bg-red-50"
                    title={q.segments.length <= 2 ? 'Need at least 2 paragraphs to sequence' : 'Remove this paragraph'}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}

          <button
            onClick={addSegment}
            className="w-full text-[11px] font-bold text-[#416ebe] hover:text-[#3560b0] py-1.5 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg transition-colors"
          >
            + Add paragraph
          </button>
        </div>
      )}
    </div>
  )
}
