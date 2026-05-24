'use client'

interface TrueFalseQuestion {
  id: number | string
  statement: string
  isTrue: boolean
  explanation?: string
}

interface Props {
  questions: TrueFalseQuestion[]
  onChange: (questions: TrueFalseQuestion[]) => void
}

// Visual editor for True/False: statement + True/False radio + optional
// explanation shown to the student after they answer. Multi-question.

export default function TrueFalseEditor({ questions, onChange }: Props) {
  const update = (i: number, patch: Partial<TrueFalseQuestion>) => {
    const next = [...questions]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  const add = () => {
    onChange([
      ...questions,
      { id: crypto.randomUUID(), statement: '', isTrue: true, explanation: '' },
    ])
  }
  const remove = (i: number) => onChange(questions.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <p className="text-xs text-gray-400 italic">No statements yet — add one to get started.</p>
      )}

      {questions.map((q, i) => (
        <div
          key={String(q.id) || i}
          className="bg-[#f7fafd] border border-[#e6f0fa] rounded-xl p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-[#416ebe] uppercase tracking-wider">
              Statement {i + 1}
            </p>
            <button
              onClick={() => remove(i)}
              className="text-[10px] text-gray-300 hover:text-red-400 transition-colors"
              title="Delete this statement"
            >
              ✕ Remove
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
              Statement <span className="text-red-400">*</span>
            </label>
            <textarea
              value={q.statement}
              onChange={(e) => update(i, { statement: e.target.value })}
              placeholder="e.g. The past tense of 'go' is 'goed'."
              rows={2}
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
              Answer <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              {([true, false] as const).map((val) => (
                <button
                  key={String(val)}
                  onClick={() => update(i, { isTrue: val })}
                  className={`flex-1 px-3 py-2 text-sm font-bold rounded-lg transition-colors border-2 ${
                    q.isTrue === val
                      ? val
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-red-50 border-red-300 text-red-600'
                      : 'bg-white border-[#cddcf0] text-[#46464b] hover:border-[#416ebe]'
                  }`}
                >
                  {val ? '✓ True' : '✗ False'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
              Explanation
              <span className="ml-1 text-gray-300 normal-case font-normal">
                (optional — shown after the student answers)
              </span>
            </label>
            <input
              type="text"
              value={q.explanation || ''}
              onChange={(e) => update(i, { explanation: e.target.value })}
              placeholder="e.g. The correct past tense is 'went'."
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
            />
          </div>
        </div>
      ))}

      <button
        onClick={add}
        className="w-full text-xs font-bold text-[#416ebe] hover:text-[#3560b0] py-2 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg transition-colors"
      >
        + Add statement
      </button>
    </div>
  )
}
