'use client'

interface HangmanQuestion {
  id: number | string
  word: string
  clue?: string
}

interface Props {
  questions: HangmanQuestion[]
  onChange: (questions: HangmanQuestion[]) => void
}

// Visual editor for Hangman: per-word row with Word (required) and an
// optional Clue. Replaces the raw JSON textarea — teachers don't have to
// hand-write the shape any more.

export default function HangmanEditor({ questions, onChange }: Props) {
  const update = (i: number, patch: Partial<HangmanQuestion>) => {
    const next = [...questions]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const add = () => {
    onChange([
      ...questions,
      { id: crypto.randomUUID(), word: '', clue: '' },
    ])
  }

  const remove = (i: number) => {
    onChange(questions.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 italic">No words yet — add one to get started.</p>
      )}

      {questions.map((q, i) => (
        <div
          key={String(q.id) || i}
          className="bg-[#f7fafd] border border-[#e6f0fa] rounded-xl p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider">
              Word {i + 1}
            </p>
            <button
              onClick={() => remove(i)}
              className="text-[10px] text-gray-300 hover:text-red-400 transition-colors"
              title="Delete this word"
            >
              ✕ Remove
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
              Word <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={q.word}
              onChange={(e) => update(i, { word: e.target.value })}
              placeholder="e.g. VOCABULARY"
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors uppercase"
            />
            <p className="text-[10px] text-gray-300 mt-1">
              The word the student will guess letter-by-letter. Letters and spaces only.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
              Clue <span className="text-gray-300 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={q.clue || ''}
              onChange={(e) => update(i, { clue: e.target.value })}
              placeholder="e.g. A collection of words known to a person"
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
            />
            <p className="text-[10px] text-gray-300 mt-1">
              A definition, question, or hint shown above the word. Leave blank for a pure guessing round.
            </p>
          </div>
        </div>
      ))}

      <button
        onClick={add}
        className="w-full text-xs font-bold text-[#416ebe] hover:text-[#3560b0] py-2 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg transition-colors"
      >
        + Add word
      </button>
    </div>
  )
}
