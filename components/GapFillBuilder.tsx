'use client'

import { useState } from 'react'

interface GapQuestion {
  id: number
  text: string
  blanks: Record<string, string>
  wordBank?: string[]
  audio_url?: string
  image_url?: string
}

interface Props {
  questions: GapQuestion[]
  onChange: (questions: GapQuestion[]) => void
  mode: 'complete_sentence' | 'cloze_listening'
}

export default function GapFillBuilder({ questions, onChange, mode }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [rawSentence, setRawSentence] = useState('')
  const [gappedIndices, setGappedIndices] = useState<Set<number>>(new Set())
  const [distractors, setDistractors] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  const startNewQuestion = () => {
    setRawSentence('')
    setGappedIndices(new Set())
    setDistractors('')
    setAudioUrl('')
    setImageUrl('')
    setEditingIndex(-1) // -1 = new question
  }

  const startEditQuestion = (idx: number) => {
    const q = questions[idx]
    // Reconstruct raw sentence from text + blanks
    let raw = q.text
    const blankEntries = Object.entries(q.blanks)
    // Replace {{n}} with actual words
    blankEntries.forEach(([key, word]) => {
      raw = raw.replace(`{{${key}}}`, word)
    })
    setRawSentence(raw)

    // Figure out which word indices are gapped by splitting the template
    // into tokens and checking which positions are {{n}} placeholders
    const templateTokens = q.text.split(/\s+/)
    const gaps = new Set<number>()
    templateTokens.forEach((token, i) => {
      if (/\{\{\d+\}\}/.test(token)) {
        gaps.add(i)
      }
    })
    setGappedIndices(gaps)

    // Get distractors (words in wordBank not in blanks)
    const blankWords = new Set(Object.values(q.blanks).map(w => w.toLowerCase()))
    const dists = (q.wordBank || []).filter(w => !blankWords.has(w.toLowerCase()))
    setDistractors(dists.join(', '))
    setAudioUrl(q.audio_url || '')
    setImageUrl(q.image_url || '')
    setEditingIndex(idx)
  }

  const words = rawSentence.trim().split(/\s+/).filter(w => w.length > 0)

  const toggleGap = (wordIndex: number) => {
    const newGaps = new Set(gappedIndices)
    if (newGaps.has(wordIndex)) {
      newGaps.delete(wordIndex)
    } else {
      newGaps.add(wordIndex)
    }
    setGappedIndices(newGaps)
  }

  const buildQuestion = (): GapQuestion | null => {
    if (words.length === 0 || gappedIndices.size === 0) return null

    let blankCounter = 1
    const blanks: Record<string, string> = {}
    const textParts: string[] = []

    words.forEach((word, i) => {
      if (gappedIndices.has(i)) {
        const key = String(blankCounter)
        // Strip only trailing/leading sentence punctuation (not apostrophes in contractions)
        const cleanWord = word.replace(/^[.,!?;:"()]+|[.,!?;:"()]+$/g, '')
        // Keep punctuation in the template
        const leadingPunct = word.match(/^[.,!?;:"()]+/)?.[0] || ''
        const trailingPunct = word.match(/[.,!?;:"()]+$/)?.[0] || ''
        blanks[key] = cleanWord
        textParts.push(`${leadingPunct}{{${key}}}${trailingPunct}`)
        blankCounter++
      } else {
        textParts.push(word)
      }
    })

    const wordBank = [
      ...Object.values(blanks),
      ...distractors.split(',').map(d => d.trim()).filter(d => d.length > 0),
    ]

    // Shuffle word bank
    const shuffled = [...wordBank].sort(() => Math.random() - 0.5)

    const q: GapQuestion = {
      id: editingIndex !== null && editingIndex >= 0 ? questions[editingIndex].id : Date.now(),
      text: textParts.join(' '),
      blanks,
      wordBank: mode === 'complete_sentence' ? shuffled : undefined,
    }

    if (mode === 'cloze_listening') {
      q.audio_url = audioUrl || ''
      delete q.wordBank
    }

    if (mode === 'complete_sentence' && imageUrl) {
      q.image_url = imageUrl
    }

    return q
  }

  const saveQuestion = () => {
    const q = buildQuestion()
    if (!q) return

    const newQuestions = [...questions]
    if (editingIndex !== null && editingIndex >= 0) {
      newQuestions[editingIndex] = q
    } else {
      newQuestions.push(q)
    }
    onChange(newQuestions)
    setEditingIndex(null)
    setRawSentence('')
    setGappedIndices(new Set())
    setDistractors('')
    setAudioUrl('')
    setImageUrl('')
  }

  const deleteQuestion = (idx: number) => {
    const newQuestions = questions.filter((_, i) => i !== idx)
    onChange(newQuestions)
  }

  // ── QUESTION LIST VIEW ──
  if (editingIndex === null) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={startNewQuestion}
            className="text-xs text-[#416ebe] font-bold hover:underline"
          >
            + Add sentence
          </button>
        </div>

        {questions.length === 0 && (
          <div className="bg-[#f7fafd] rounded-xl border border-[#e6f0fa] p-4 text-center">
            <p className="text-xs text-gray-400">No questions yet. Click &quot;+ Add sentence&quot; to create one.</p>
          </div>
        )}

        <div className="space-y-2">
          {questions.map((q, i) => {
            // Render the sentence with gaps highlighted
            const parts = q.text.split(/(\{\{\d+\}\})/)
            return (
              <div
                key={q.id}
                className="bg-[#f7fafd] rounded-xl border border-[#e6f0fa] p-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-[#46464b] leading-relaxed">
                      {parts.map((part, pi) => {
                        const match = part.match(/^\{\{(\d+)\}\}$/)
                        if (match) {
                          const blankId = match[1]
                          return (
                            <span
                              key={pi}
                              className="inline-block bg-[#416ebe] text-white px-1.5 py-0.5 rounded text-xs font-bold mx-0.5"
                            >
                              {q.blanks[blankId] || '___'}
                            </span>
                          )
                        }
                        return <span key={pi}>{part}</span>
                      })}
                    </p>
                    {q.image_url && (
                      <img src={q.image_url} alt="" className="mt-2 h-16 rounded-lg border border-[#e6f0fa] object-cover" />
                    )}
                    {q.wordBank && q.wordBank.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Word bank: {q.wordBank.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEditQuestion(i)}
                      className="text-xs text-[#416ebe] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteQuestion(i)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── EDITING / CREATING VIEW ──
  const preview = buildQuestion()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500">
          {editingIndex >= 0 ? 'Edit sentence' : 'New sentence'}
        </p>
        <button
          onClick={() => { setEditingIndex(null); setRawSentence(''); setGappedIndices(new Set()) }}
          className="text-xs text-gray-400 hover:text-[#416ebe]"
        >
          Cancel
        </button>
      </div>

      {/* Step 1: Type/paste sentence */}
      <div>
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
          Type or paste the full sentence
        </label>
        <textarea
          value={rawSentence}
          onChange={(e) => { setRawSentence(e.target.value); setGappedIndices(new Set()) }}
          placeholder="e.g. She went to the store and bought some milk."
          rows={2}
          className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg p-3 resize-none focus:outline-none focus:border-[#416ebe] transition-colors"
        />
      </div>

      {/* Step 2: Click words to gap them */}
      {words.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
            Click words to turn them into gaps
          </label>
          <div className="bg-white border border-[#cddcf0] rounded-xl p-3 flex flex-wrap gap-1.5">
            {words.map((word, i) => {
              const isGapped = gappedIndices.has(i)
              return (
                <button
                  key={i}
                  onClick={() => toggleGap(i)}
                  className={`px-2 py-1 rounded-lg text-sm font-medium transition-all ${
                    isGapped
                      ? 'bg-[#416ebe] text-white shadow-sm scale-105'
                      : 'bg-gray-100 text-[#46464b] hover:bg-[#e6f0fa] hover:text-[#416ebe]'
                  }`}
                >
                  {word}
                </button>
              )
            })}
          </div>
          {gappedIndices.size === 0 && (
            <p className="text-[10px] text-amber-500 mt-1">Click at least one word to create a gap</p>
          )}
        </div>
      )}

      {/* Distractors (complete_sentence only) */}
      {mode === 'complete_sentence' && gappedIndices.size > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
            Distractors (optional, comma-separated)
          </label>
          <input
            type="text"
            value={distractors}
            onChange={(e) => setDistractors(e.target.value)}
            placeholder="e.g. gone, buyed, goed"
            className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe] transition-colors"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">
            Wrong options added to the word bank alongside correct answers
          </p>
        </div>
      )}

      {/* Image upload (complete_sentence only) */}
      {mode === 'complete_sentence' && (
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
            Image (optional)
          </label>
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="" className="h-24 rounded-xl border border-[#e6f0fa] object-cover" />
              <button
                onClick={() => setImageUrl('')}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-400 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[#cddcf0] rounded-xl cursor-pointer hover:border-[#416ebe] hover:bg-[#f7fafd] transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-sm">📷</span>
              <span className="text-xs text-[#46464b] font-medium">
                {uploadingImage ? 'Uploading...' : 'Add image'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
                disabled={uploadingImage}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploadingImage(true)
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
                      setImageUrl(data.url)
                    }
                  } catch {
                    // Upload failed silently
                  }
                  setUploadingImage(false)
                }}
              />
            </label>
          )}
        </div>
      )}

      {/* Audio URL (cloze_listening only) */}
      {mode === 'cloze_listening' && gappedIndices.size > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
            Audio URL (optional — TTS auto-generated if empty)
          </label>
          <input
            type="text"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm text-[#46464b] border border-[#cddcf0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#416ebe] transition-colors"
          />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-[#e6f0fa] rounded-xl p-3 border border-[#cddcf0]">
          <p className="text-[10px] font-bold text-[#416ebe] uppercase mb-1">Preview</p>
          <p className="text-sm text-[#46464b] leading-relaxed">
            {preview.text.split(/(\{\{\d+\}\})/).map((part, pi) => {
              const match = part.match(/^\{\{(\d+)\}\}$/)
              if (match) {
                return (
                  <span
                    key={pi}
                    className="inline-block border-b-2 border-dashed border-[#416ebe] text-[#416ebe] font-bold mx-0.5 min-w-[3rem] text-center"
                  >
                    ___
                  </span>
                )
              }
              return <span key={pi}>{part}</span>
            })}
          </p>
          {preview.wordBank && preview.wordBank.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {preview.wordBank.map((w, wi) => (
                <span key={wi} className="text-xs bg-white text-[#46464b] px-2 py-0.5 rounded border border-[#cddcf0]">
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={saveQuestion}
        disabled={!preview}
        className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {editingIndex !== null && editingIndex >= 0 ? 'Update sentence' : 'Add sentence'}
      </button>
    </div>
  )
}
