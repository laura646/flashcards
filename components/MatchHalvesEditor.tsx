'use client'

import { useState } from 'react'

interface MatchPair {
  id: number
  left: string
  right: string
  image_url?: string
}

interface Props {
  questions: MatchPair[]
  onChange: (questions: MatchPair[]) => void
}

export default function MatchHalvesEditor({ questions, onChange }: Props) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const addPair = () => {
    onChange([...questions, { id: Date.now(), left: '', right: '' }])
  }

  const updatePair = (idx: number, field: 'left' | 'right', value: string) => {
    const updated = [...questions]
    updated[idx] = { ...updated[idx], [field]: value }
    onChange(updated)
  }

  const removePair = (idx: number) => {
    onChange(questions.filter((_, i) => i !== idx))
  }

  const setImage = (idx: number, url: string | undefined) => {
    const updated = [...questions]
    updated[idx] = { ...updated[idx], image_url: url }
    onChange(updated)
  }

  const handleImageUpload = async (idx: number, file: File) => {
    setUploadingIdx(idx)
    setUploadError(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      )
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, fileType: file.type, fileName: file.name }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setImage(idx, data.url)
      } else {
        setUploadError(data.error || 'Upload failed')
      }
    } catch (err) {
      setUploadError('Upload failed — check connection')
    }
    setUploadingIdx(null)
  }

  const swapColumns = () => {
    onChange(questions.map(q => ({ ...q, left: q.right, right: q.left })))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500">
          {questions.length} pair{questions.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <button
            onClick={swapColumns}
            className="text-[10px] text-gray-400 hover:text-[#416ebe] font-bold"
          >
            ⇄ Swap Columns
          </button>
          <button
            onClick={addPair}
            className="text-xs text-[#416ebe] font-bold hover:underline"
          >
            + Add pair
          </button>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center justify-between mb-2">
          <p className="text-xs text-red-500">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="text-xs text-red-400 hover:text-red-600 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Header */}
      {questions.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2 px-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Keyword</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Matching definition</p>
          <div className="w-16" />
        </div>
      )}

      {questions.length === 0 && (
        <div className="bg-[#f7fafd] rounded-xl border border-[#e6f0fa] p-4 text-center">
          <p className="text-xs text-gray-400">No pairs yet. Click &quot;+ Add pair&quot; to create one.</p>
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start bg-[#f7fafd] rounded-xl border border-[#e6f0fa] p-3">
            {/* Left (keyword) */}
            <div>
              <input
                type="text"
                value={q.left}
                onChange={(e) => updatePair(i, 'left', e.target.value)}
                placeholder="Keyword..."
                className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe] transition-colors"
              />
              {/* Image */}
              <div className="mt-1.5">
                {q.image_url ? (
                  <div className="relative inline-block">
                    <img src={q.image_url} alt="" className="h-12 object-cover" />
                    <button
                      onClick={() => setImage(i, undefined)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 hover:bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-[#416ebe] cursor-pointer rounded-lg hover:bg-[#e6f0fa] transition-colors ${uploadingIdx === i ? 'opacity-50 pointer-events-none' : ''}`}>
                    <span>📷</span>
                    <span>{uploadingIdx === i ? 'Uploading...' : 'Add image'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={uploadingIdx === i}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(i, file)
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Right (definition) */}
            <input
              type="text"
              value={q.right}
              onChange={(e) => updatePair(i, 'right', e.target.value)}
              placeholder="Matching definition..."
              className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe] transition-colors"
            />

            {/* Delete */}
            <button
              onClick={() => removePair(i)}
              className="p-2 text-xs text-gray-300 hover:text-red-400 transition-colors"
              title="Remove pair"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
