'use client'

import { useState } from 'react'

// Reusable audio source picker — three options: paste a Link (with
// Google Drive auto-normalization), Upload a file, or AI-generate from
// text and cache to storage (so students don't trigger fresh TTS on
// every play). Used by DictationEditor and GapFillBuilder (cloze
// listening).

interface Props {
  value: string | undefined
  onChange: (url: string) => void
  // Lazy text getter — caller decides what string the TTS should use.
  // For Dictation it's just q.text; for cloze_listening it's the text
  // with the {{n}} blanks substituted with the correct words.
  getText: () => string
  // Hide the AI-generate tab when the surrounding context doesn't have
  // a sensible source text (e.g. an Audio content block that's just a
  // podcast clip, not a sentence to read aloud). Default: AI shown.
  allowAi?: boolean
}

function normalizeAudioUrl(raw: string): string {
  const url = raw.trim()
  if (!url) return url
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
  if (fileMatch) return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`
  const openMatch = url.match(/drive\.google\.com\/open\?[^#]*\bid=([^&]+)/)
  if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`
  return url
}

function sourceLabel(url: string | undefined): string {
  if (!url) return ''
  if (url.includes('drive.google.com')) return 'Google Drive'
  if (url.includes('/audio/')) return 'Stored audio'
  return 'Audio link'
}

type SourceTab = 'link' | 'upload' | 'ai'

export default function AudioSourcePicker({ value, onChange, getText, allowAi = true }: Props) {
  const [tab, setTab] = useState<SourceTab>('link')
  const [busy, setBusy] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [error, setError] = useState('')

  const applyLink = () => {
    if (!linkDraft.trim()) return
    onChange(normalizeAudioUrl(linkDraft))
    setLinkDraft('')
    setError('')
  }

  const uploadFile = async (file: File) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const buf = await file.arrayBuffer()
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
      if (!res.ok || !data.url) setError(data.error || 'Upload failed.')
      else onChange(data.url)
    } catch {
      setError('Upload failed. Check your connection and try again.')
    }
    setBusy(false)
  }

  const generateWithAI = async () => {
    if (busy) return
    const text = getText().trim()
    if (!text) {
      setError('Add the text first, then generate.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/upload-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true, text }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) setError(data.error || 'AI generation failed.')
      else onChange(data.url)
    } catch {
      setError('AI generation failed. Try again.')
    }
    setBusy(false)
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#cddcf0] rounded-lg">
        <span className="text-xs text-[#46464b] truncate">
          ✓ {sourceLabel(value)}{' '}
          <span className="text-gray-300">— students will hear this</span>
        </span>
        <button
          onClick={() => { onChange(''); setError('') }}
          className="text-[10px] font-bold text-red-400 hover:text-red-500 shrink-0"
        >
          ✕ Change
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        {(allowAi ? (['link', 'upload', 'ai'] as const) : (['link', 'upload'] as const)).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError('') }}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${
              tab === t ? 'bg-[#416ebe] text-white' : 'text-[#46464b] hover:text-[#416ebe]'
            }`}
          >
            {t === 'link' ? 'Link' : t === 'upload' ? 'Upload' : 'AI generate'}
          </button>
        ))}
      </div>

      {tab === 'link' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyLink() }}
            placeholder="Paste an audio URL or Google Drive share link"
            className="flex-1 px-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
          />
          <button
            onClick={applyLink}
            disabled={!linkDraft.trim()}
            className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            Use
          </button>
        </div>
      )}

      {tab === 'upload' && (
        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#cddcf0] hover:border-[#416ebe] rounded-lg cursor-pointer transition-colors">
          <span className="text-xs text-[#46464b]">
            {busy ? 'Uploading…' : '📁 Choose an audio file (MP3, WAV, M4A, OGG — max 10 MB)'}
          </span>
          <input
            type="file"
            accept="audio/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadFile(f)
              e.target.value = ''
            }}
            className="hidden"
          />
        </label>
      )}

      {tab === 'ai' && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-400 flex-1">
            Generate audio once from the text. Cached — students don&apos;t re-generate on each play.
          </p>
          <button
            onClick={generateWithAI}
            disabled={busy}
            className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 shrink-0"
          >
            {busy ? 'Generating…' : '🪄 Generate'}
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}
    </div>
  )
}
