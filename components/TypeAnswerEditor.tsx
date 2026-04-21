'use client'

import { useState } from 'react'

interface TypeAnswerQuestion {
  id: number | string
  prompt: string
  answer: string
  alternatives?: string[]
  hint?: string
  image_url?: string
}

interface Props {
  questions: TypeAnswerQuestion[]
  onChange: (questions: TypeAnswerQuestion[]) => void
}

export default function TypeAnswerEditor({ questions, onChange }: Props) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')

  const updateQuestion = (index: number, field: keyof TypeAnswerQuestion, value: string | string[] | undefined) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const addAlternative = (index: number) => {
    const current = questions[index].alternatives || []
    updateQuestion(index, 'alternatives', [...current, ''])
  }

  const updateAlternative = (qIdx: number, altIdx: number, value: string) => {
    const current = questions[qIdx].alternatives || []
    const next = [...current]
    next[altIdx] = value
    updateQuestion(qIdx, 'alternatives', next)
  }

  const removeAlternative = (qIdx: number, altIdx: number) => {
    const current = questions[qIdx].alternatives || []
    const next = current.filter((_, i) => i !== altIdx)
    updateQuestion(qIdx, 'alternatives', next.length > 0 ? next : undefined)
  }

  const addQuestion = () => {
    onChange([...questions, { id: questions.length + 1, prompt: '', answer: '', image_url: '' }])
  }

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, id: i + 1 })))
  }

  const handleImageUpload = async (index: number, file: File) => {
    setUploadingIdx(index)
    setUploadError('')
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, fileType: file.type, fileName: file.name }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        updateQuestion(index, 'image_url', data.url)
      } else {
        setUploadError(data.error || 'Upload failed')
      }
    } catch {
      setUploadError('Failed to upload image')
    }
    setUploadingIdx(null)
  }

  return (
    <div className="space-y-3">
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-500">
          {uploadError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500">{questions.length} question{questions.length !== 1 ? 's' : ''}</p>
        <button onClick={addQuestion} className="text-xs text-[#416ebe] font-bold hover:underline">+ Add Question</button>
      </div>

      {questions.map((q, i) => (
        <div key={i} className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-bold text-[#416ebe]">#{i + 1}</span>
            <button onClick={() => removeQuestion(i)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
              {'\u2715'} Remove
            </button>
          </div>

          {/* Prompt */}
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Question / Prompt</label>
            <input
              type="text"
              value={q.prompt}
              onChange={(e) => updateQuestion(i, 'prompt', e.target.value)}
              placeholder="e.g. What is the past tense of 'go'?"
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
            />
          </div>

          {/* Answer */}
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Correct Answer</label>
            <input
              type="text"
              value={q.answer}
              onChange={(e) => updateQuestion(i, 'answer', e.target.value)}
              placeholder="e.g. went"
              className="w-full px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
            />
            <p className="text-[10px] text-gray-300 mt-1">Not case-sensitive — students can type in any capitalization</p>
          </div>

          {/* Alternative answers */}
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
              Also Accept (optional)
            </label>
            {(q.alternatives || []).map((alt, altIdx) => (
              <div key={altIdx} className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={alt}
                  onChange={(e) => updateAlternative(i, altIdx, e.target.value)}
                  placeholder="Another accepted answer"
                  className="flex-1 px-3 py-1.5 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
                />
                <button
                  onClick={() => removeAlternative(i, altIdx)}
                  className="text-xs text-gray-300 hover:text-red-400 px-2"
                  aria-label="Remove alternative"
                >
                  {'\u2715'}
                </button>
              </div>
            ))}
            <button
              onClick={() => addAlternative(i)}
              className="text-xs text-[#416ebe] font-bold hover:underline mt-1"
            >
              + Add alternative
            </button>
            <p className="text-[10px] text-gray-300 mt-1">Students can type any of these and get it right (useful for synonyms)</p>
          </div>

          {/* Image */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Image (optional)</label>
            {q.image_url ? (
              <div className="flex items-start gap-3">
                <img src={q.image_url} alt="" className="max-h-28 max-w-[200px] object-contain rounded-lg border border-[#cddcf0]" />
                <button onClick={() => updateQuestion(i, 'image_url', '')}
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors mt-1">{'\u2715'} Remove</button>
              </div>
            ) : (
              <label className={`inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-[#cddcf0] rounded-lg cursor-pointer hover:border-[#416ebe] transition-colors ${uploadingIdx === i ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="text-xs text-gray-400">{'\uD83D\uDCF7'} {uploadingIdx === i ? 'Uploading...' : 'Add image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  className="hidden"
                  disabled={uploadingIdx === i}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageUpload(i, file)
                    if (e.target) e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </div>
      ))}

      {questions.length === 0 && (
        <div className="text-center py-8 text-gray-300 text-xs">
          No questions yet. Click &quot;+ Add Question&quot; to start.
        </div>
      )}
    </div>
  )
}
