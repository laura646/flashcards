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

// Convert a Google Drive share URL into a direct-download URL so it
// plays in <audio>. Other URLs pass through unchanged.
function normalizeAudioUrl(raw: string): string {
  const url = raw.trim()
  if (!url) return url
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
  if (fileMatch) return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`
  const openMatch = url.match(/drive\.google\.com\/open\?[^#]*\bid=([^&]+)/)
  if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`
  return url
}

// Detect what kind of audio source the saved URL came from, so the UI
// can show "✓ Audio from Google Drive" / "✓ Uploaded file" / etc.
function audioSourceLabel(url: string | undefined): string | null {
  if (!url) return null
  if (url.includes('drive.google.com')) return 'Google Drive'
  if (url.includes('/audio/')) return 'Stored audio'
  return 'Audio link'
}

type SourceTab = 'link' | 'upload' | 'ai'

// Visual editor for Dictation: per-sentence row with the text the student
// must type, optional teacher-uploaded audio URL, default speed, and a
// listen-preview button that plays the TTS the student would hear.

export default function DictationEditor({ questions, onChange }: Props) {
  const [previewing, setPreviewing] = useState<number | null>(null)
  const [tabByIdx, setTabByIdx] = useState<Record<number, SourceTab>>({})
  const [busyIdx, setBusyIdx] = useState<number | null>(null)
  const [linkDraft, setLinkDraft] = useState<Record<number, string>>({})
  const [errByIdx, setErrByIdx] = useState<Record<number, string>>({})

  const setTab = (i: number, t: SourceTab) => setTabByIdx((prev) => ({ ...prev, [i]: t }))
  const setErr = (i: number, msg: string) => setErrByIdx((prev) => ({ ...prev, [i]: msg }))
  const clearErr = (i: number) => setErrByIdx((prev) => ({ ...prev, [i]: '' }))

  const applyLink = (i: number) => {
    const raw = linkDraft[i] ?? ''
    if (!raw.trim()) return
    const normalized = normalizeAudioUrl(raw)
    update(i, { audio_url: normalized })
    setLinkDraft((prev) => ({ ...prev, [i]: '' }))
    clearErr(i)
  }

  const uploadFile = async (i: number, file: File) => {
    if (busyIdx !== null) return
    setBusyIdx(i)
    clearErr(i)
    try {
      const buf = await file.arrayBuffer()
      // base64 — chunked to avoid call-stack overflow on large files
      let binary = ''
      const bytes = new Uint8Array(buf)
      const chunk = 0x8000
      for (let p = 0; p < bytes.length; p += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(p, p + chunk)))
      }
      const b64 = btoa(binary)
      const res = await fetch('/api/upload-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: b64, fileType: file.type, fileName: file.name }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setErr(i, data.error || 'Upload failed.')
      } else {
        update(i, { audio_url: data.url })
      }
    } catch {
      setErr(i, 'Upload failed. Check your connection and try again.')
    }
    setBusyIdx(null)
  }

  const generateWithAI = async (i: number, text: string) => {
    if (busyIdx !== null) return
    if (!text.trim()) {
      setErr(i, 'Add the sentence text first, then generate.')
      return
    }
    setBusyIdx(i)
    clearErr(i)
    try {
      const res = await fetch('/api/upload-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true, text }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setErr(i, data.error || 'AI generation failed.')
      } else {
        update(i, { audio_url: data.url })
      }
    } catch {
      setErr(i, 'AI generation failed. Try again.')
    }
    setBusyIdx(null)
  }

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

          {/* Audio source picker — three options, plus speed */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
              Audio
            </label>

            {q.audio_url ? (
              // Already attached — show source + Change/Clear
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#cddcf0] rounded-lg">
                <span className="text-xs text-[#46464b] truncate">
                  ✓ {audioSourceLabel(q.audio_url)}{' '}
                  <span className="text-gray-300">— students will hear this</span>
                </span>
                <button
                  onClick={() => { update(i, { audio_url: '' }); clearErr(i) }}
                  className="text-[10px] font-bold text-red-400 hover:text-red-500 shrink-0"
                >
                  ✕ Change
                </button>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex items-center gap-1 mb-2">
                  {(['link', 'upload', 'ai'] as const).map((t) => {
                    const active = (tabByIdx[i] || 'link') === t
                    const label = t === 'link' ? 'Link' : t === 'upload' ? 'Upload' : 'AI generate'
                    return (
                      <button
                        key={t}
                        onClick={() => { setTab(i, t); clearErr(i) }}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${
                          active
                            ? 'bg-[#416ebe] text-white'
                            : 'text-[#46464b] hover:text-[#416ebe]'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* Per-tab control */}
                {(tabByIdx[i] || 'link') === 'link' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={linkDraft[i] || ''}
                      onChange={(e) => setLinkDraft((p) => ({ ...p, [i]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') applyLink(i) }}
                      placeholder="Paste an audio URL or Google Drive share link"
                      className="flex-1 px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
                    />
                    <button
                      onClick={() => applyLink(i)}
                      disabled={!(linkDraft[i] || '').trim()}
                      className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                    >
                      Use
                    </button>
                  </div>
                )}

                {(tabByIdx[i] || 'link') === 'upload' && (
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg cursor-pointer transition-colors">
                    <span className="text-xs text-[#46464b]">
                      {busyIdx === i ? 'Uploading…' : '📁 Choose an audio file (MP3, WAV, M4A, OGG — max 10 MB)'}
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      disabled={busyIdx === i}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) uploadFile(i, f)
                        e.target.value = ''
                      }}
                      className="hidden"
                    />
                  </label>
                )}

                {(tabByIdx[i] || 'link') === 'ai' && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-gray-400 flex-1">
                      Generate audio once from the sentence above. Cached — students don&apos;t re-generate on each play.
                    </p>
                    <button
                      onClick={() => generateWithAI(i, q.text)}
                      disabled={busyIdx === i || !q.text.trim()}
                      className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                    >
                      {busyIdx === i ? 'Generating…' : '🪄 Generate'}
                    </button>
                  </div>
                )}

                {errByIdx[i] && (
                  <p className="text-[11px] text-red-500 mt-1.5">{errByIdx[i]}</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
              Speed
            </label>
            <select
              value={q.speed || 'normal'}
              onChange={(e) => update(i, { speed: e.target.value as 'normal' | 'slow' })}
              className="w-full sm:w-48 px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors bg-white"
            >
              <option value="normal">Normal</option>
              <option value="slow">Slow (0.7×)</option>
            </select>
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
