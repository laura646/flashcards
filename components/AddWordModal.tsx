'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
  // Called after a word is successfully saved, so the parent can refresh
  // its list. The modal closes itself first.
  onSaved: (word: string) => void
}

interface Draft {
  word: string
  phonetic: string
  meaning: string
  example: string
  translation: string
}

// Student-facing "add a word" flow: type a word → AI writes the meaning,
// pronunciation and an example → student reviews/edits → save. Mirrors how
// teachers get AI-generated flashcards, but over the student's own vocab.
export default function AddWordModal({ onClose, onSaved }: Props) {
  const [word, setWord] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // AI generations left in the student's daily quota (null = unknown/unlimited).
  const [remaining, setRemaining] = useState<number | null>(null)

  const generate = async () => {
    const w = word.trim()
    if (!w) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', word: w }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not generate a flashcard. Please try again.')
        setGenerating(false)
        return
      }
      setRemaining(typeof data.remaining === 'number' ? data.remaining : null)
      setDraft({
        word: data.word || w,
        phonetic: data.phonetic || '',
        meaning: data.meaning || '',
        example: data.example || '',
        translation: '',
      })
    } catch {
      setError('Network error — please try again.')
    }
    setGenerating(false)
  }

  const updateDraft = (key: keyof Draft, value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  const save = async () => {
    if (!draft || !draft.word.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          word: draft.word.trim(),
          meaning: draft.meaning.trim(),
          phonetic: draft.phonetic.trim(),
          example: draft.example.trim(),
          translation: draft.translation.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to save. Please try again.')
        setSaving(false)
        return
      }
      onSaved(draft.word.trim())
    } catch {
      setError('Network error — could not save.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg pb-10 sm:pb-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-brandblue">Add a word</h3>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink-body text-lg leading-none">✕</button>
        </div>
        <p className="text-xs text-ink-muted mb-4">
          Type a word or phrase — we&apos;ll write the meaning, pronunciation and an example, then save it to your vocabulary.
        </p>

        {!draft ? (
          <>
            <input
              autoFocus
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && word.trim() && !generating) generate() }}
              placeholder="e.g. ubiquitous"
              className="w-full text-base text-ink-body border border-sky-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky mb-3"
            />
            {error && <p className="text-xs text-incorrect-fg mb-3">{error}</p>}
            <button
              onClick={generate}
              disabled={!word.trim() || generating}
              className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Create flashcard'}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-sky-dark uppercase tracking-wide">Generated for you — check &amp; edit</p>
              {remaining !== null && (
                <span className="text-[10px] text-ink-muted">{remaining} new word{remaining === 1 ? '' : 's'} left today</span>
              )}
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Word</label>
                <input type="text" value={draft.word} onChange={(e) => updateDraft('word', e.target.value)}
                  className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Phonetic</label>
                <input type="text" value={draft.phonetic} onChange={(e) => updateDraft('phonetic', e.target.value)}
                  className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Meaning</label>
                <textarea value={draft.meaning} onChange={(e) => updateDraft('meaning', e.target.value)} rows={2}
                  className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky resize-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Example</label>
                <textarea value={draft.example} onChange={(e) => updateDraft('example', e.target.value)} rows={2}
                  className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky resize-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Translation (your language, optional)</label>
                <input type="text" value={draft.translation} onChange={(e) => updateDraft('translation', e.target.value)} placeholder="e.g. повсюду, überall…"
                  className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky" />
              </div>
            </div>
            {error && <p className="text-xs text-incorrect-fg mb-3">{error}</p>}
            <div className="flex gap-2 items-center">
              <button onClick={generate} disabled={generating}
                className="px-3 py-3 text-sm font-bold text-ink-muted hover:text-sky transition-colors disabled:opacity-50">
                {generating ? '…' : '↻ Regenerate'}
              </button>
              <button onClick={save} disabled={saving || !draft.word.trim()}
                className="flex-1 bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save to my vocabulary'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
