'use client'

import { useState } from 'react'

interface OddOneOutQuestion {
  id: number
  prompt: string
  options: string[]
  correctIndex: number
  explanation?: string
}

interface Props {
  questions: OddOneOutQuestion[]
  onChange: (questions: OddOneOutQuestion[]) => void
}

export default function OddOneOutEditor({ questions, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const addQuestion = () => {
    const newQ: OddOneOutQuestion = {
      id: Date.now(),
      prompt: '',
      options: ['', '', ''],
      correctIndex: 0,
      explanation: '',
    }
    onChange([...questions, newQ])
    setExpandedId(newQ.id)
  }

  const updateQuestion = (index: number, updates: Partial<OddOneOutQuestion>) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index)
    onChange(updated)
  }

  const addOption = (qIndex: number) => {
    const updated = [...questions]
    updated[qIndex] = { ...updated[qIndex], options: [...updated[qIndex].options, ''] }
    onChange(updated)
  }

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions]
    const newOpts = [...updated[qIndex].options]
    newOpts[optIndex] = value
    updated[qIndex] = { ...updated[qIndex], options: newOpts }
    onChange(updated)
  }

  const removeOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions]
    const newOpts = updated[qIndex].options.filter((_, i) => i !== optIndex)
    // Adjust correctIndex if needed
    let newCorrectIndex = updated[qIndex].correctIndex
    if (optIndex === newCorrectIndex) newCorrectIndex = 0
    else if (optIndex < newCorrectIndex) newCorrectIndex--
    updated[qIndex] = { ...updated[qIndex], options: newOpts, correctIndex: newCorrectIndex }
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      {questions.map((q, qi) => {
        const isExpanded = expandedId === q.id
        return (
          <div key={q.id} className="bg-[#f5f8fc] rounded-xl border border-[#e6f0fa] overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#edf4fc] transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : q.id)}
            >
              <span className="text-xs text-gray-400 font-bold w-6">{qi + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#46464b] truncate">
                  {q.prompt || <span className="text-gray-300 italic">No keyword set</span>}
                </p>
                <p className="text-[10px] text-gray-400">
                  {q.options.filter(o => o).length} options · Odd one out: {q.options[q.correctIndex] || '(not set)'}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeQuestion(qi) }}
                className="text-gray-300 hover:text-red-400 text-xs p-1"
              >
                ✕
              </button>
              <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
            </div>

            {/* Expanded editor */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-[#e6f0fa] pt-3 space-y-3">
                {/* Keyword */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Keyword / Verb
                  </label>
                  <input
                    type="text"
                    value={q.prompt}
                    onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                    placeholder="e.g. clean"
                    className="w-full px-3 py-2 text-sm border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe]"
                  />
                </div>

                {/* Options */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Options (click the ✗ button to mark the odd one out)
                  </label>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuestion(qi, { correctIndex: oi })}
                          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                            oi === q.correctIndex
                              ? 'border-red-400 bg-red-50 text-red-500'
                              : 'border-gray-200 bg-white text-gray-300 hover:border-red-300 hover:text-red-400'
                          }`}
                          title={oi === q.correctIndex ? 'This is the odd one out' : 'Click to mark as odd one out'}
                        >
                          ✗
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(qi, oi, e.target.value)}
                          placeholder={`Option ${oi + 1}`}
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-[#416ebe] ${
                            oi === q.correctIndex
                              ? 'border-red-300 bg-red-50'
                              : 'border-[#cddcf0]'
                          }`}
                        />
                        {q.options.length > 2 && (
                          <button
                            onClick={() => removeOption(qi, oi)}
                            className="text-gray-300 hover:text-red-400 text-xs p-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addOption(qi)}
                    className="text-xs text-[#416ebe] font-bold mt-2 hover:underline"
                  >
                    + Add Option
                  </button>
                </div>

                {/* Explanation */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Explanation (optional)
                  </label>
                  <input
                    type="text"
                    value={q.explanation || ''}
                    onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
                    placeholder="e.g. You can't 'clean the washing' — you 'do the washing'"
                    className="w-full px-3 py-2 text-sm border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe]"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={addQuestion}
        className="w-full py-3 border-2 border-dashed border-[#cddcf0] text-[#416ebe] text-sm font-bold rounded-xl hover:bg-[#e6f0fa] transition-colors"
      >
        + Add Question
      </button>
    </div>
  )
}
