'use client'

import { useState } from 'react'

interface DictationQuestion {
  id: number | string
  text: string
  audio_url?: string
  speed?: 'normal' | 'slow'
}

interface Props {
  questions: DictationQuestion[]
  onChange: (questions: DictationQuestion[]) => void
}

// Visual editor for Dictation: per-sentence row with the text the student
// must type, optional teacher-uploaded audio URL, default speed, and a
// listen-preview button that plays the TTS the student would hear.

export default function DictationEditor({ questions, onChange }: Props) {
  const [previewing, setPreviewing] = useState<number | null>(null)

  const update = (i: number, patch: Partial<DictationQuestion>) => {
    const next = [...questions]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const add = () => {
    onChange([
      ...questions,
      { id: crypto.randomUUID(), text: '', audio_url: '', speed: 'normal' },
    ])
  }

  const remove = (i: number) => {
    onChange(questions.filter((_, idx) => idx !== i))
  }

  const preview = async (i: number, q: DictationQuestion) => {
    if (previewing !== null) return
    if (!q.text.trim() && !q.audio_url) return
    setPreviewing(i)
    try {
      if (q.audio_url) {
        const audio = new Audio(q.audio_url)
        if (q.speed === 'slow') audio.playbackRate = 0.7
        audio.onended = () => setPreviewing(null)
        audio.onerror = () => setPreviewing(null)
        await audio.play()
      } else {
        const res = await fetch('/api/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: q.text }),
        })
        if (!res.ok) {
          setPreviewing(null)
          return
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        if (q.speed === 'slow') audio.playbackRate = 0.7
        audio.onended = () => {
          setPreviewing(null)
          URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
          setPreviewing(null)
          URL.revokeObjectURL(url)
        }
        await audio.play()
      }
    } catch {
      setPreviewing(null)
    }
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 italic">No sentences yet — add one to get started.</p>
      )}

      {questions.map((q, i) => (
        <div
          key={String(q.id) || i}
          className="bg-[#f7fafd] border border-[#e6f0fa] rounded-xl p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider">
              Sentence {i + 1}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => preview(i, q)}
                disabled={previewing !== null || (!q.text.trim() && !q.audio_url)}
                className="text-[10px] text-[#416ebe] hover:text-[#3560b0] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                title="Preview what the student will hear"
              >
                {previewing === i ? '🔊 Playing…' : '🔊 Preview'}
              </button>
              <button
                onClick={() => remove(i)}
                className="text-[10px] text-gray-300 hover:text-red-400 transition-colors"
                title="Delete this sentence"
              >
                ✕ Remove
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
              Sentence <span className="text-red-400">*</span>
            </label>
            <textarea
              value={q.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="e.g. She went to school yesterday."
              rows={2}
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors resize-y"
            />
            <p className="text-[10px] text-gray-300 mt-1">
              What the student must type. Punctuation and case are ignored when checking.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Audio URL <span className="text-gray-300 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={q.audio_url || ''}
                onChange={(e) => update(i, { audio_url: e.target.value })}
                placeholder="Leave blank to auto-generate TTS"
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Speed
              </label>
              <select
                value={q.speed || 'normal'}
                onChange={(e) => update(i, { speed: e.target.value as 'normal' | 'slow' })}
                className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors bg-white"
              >
                <option value="normal">Normal</option>
                <option value="slow">Slow (0.7×)</option>
              </select>
            </div>
          </div>
        </div>
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
