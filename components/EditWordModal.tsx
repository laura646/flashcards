'use client'

import { useState } from 'react'

export interface EditWordData {
  // vocab_srs row id. When absent (a lesson word not yet synced into the
  // student's SRS) we upsert by word instead of updating by id.
  id?: string
  word: string
  phonetic: string
  meaning: string
  example: string
  translation: string
  notes: string
}

interface Props {
  existing: EditWordData
  onClose: () => void
  onSaved: (word: string) => void
}

// Per-word editing for the My Vocabulary list. vocab_srs is per-user, so a
// student only ever changes their OWN copy of a word — never the shared
// lesson flashcard. Mirrors the fields the old trainer editor exposed.
export default function EditWordModal({ existing, onClose, onSaved }: Props) {
  const [form, setForm] = useState<EditWordData>(existing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (key: keyof EditWordData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    if (!form.word.trim()) return
    setSaving(true)
    setError(null)
    try {
      // Update an existing SRS row by id; otherwise upsert it by word.
      const body = form.id
        ? {
            action: 'update',
            word_id: form.id,
            word: form.word.trim(),
            phonetic: form.phonetic,
            meaning: form.meaning,
            example: form.example,
            notes: form.notes,
            translation: form.translation,
          }
        : {
            action: 'add',
            word: form.word.trim(),
            phonetic: form.phonetic.trim(),
            meaning: form.meaning.trim(),
            example: form.example.trim(),
            translation: form.translation.trim() || null,
          }
      const res = await fetch('/api/vocab-srs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to save. Please try again.')
        setSaving(false)
        return
      }
      onSaved(form.word.trim())
    } catch {
      setError('Network error — could not save.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg pb-10 sm:pb-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-brandblue">Edit word</h3>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink-body text-lg leading-none">✕</button>
        </div>
        <p className="text-xs text-ink-muted mb-4">Only you see your changes — tweak the meaning, add a translation in your language, or a memory note.</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Word</label>
            <input type="text" value={form.word} onChange={(e) => update('word', e.target.value)}
              className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Phonetic</label>
            <input type="text" value={form.phonetic} onChange={(e) => update('phonetic', e.target.value)}
              className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Meaning</label>
            <textarea value={form.meaning} onChange={(e) => update('meaning', e.target.value)} rows={2}
              className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky resize-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Example</label>
            <textarea value={form.example} onChange={(e) => update('example', e.target.value)} rows={2}
              className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky resize-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Translation (your language)</label>
            <input type="text" value={form.translation} onChange={(e) => update('translation', e.target.value)} placeholder="your own-language word"
              className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">My notes (memory tricks, associations…)</label>
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2} placeholder="e.g. sounds like…"
              className="w-full text-sm text-ink-body border border-sky-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky resize-none" />
          </div>
        </div>

        {error && <p className="text-xs text-incorrect-fg mb-3">{error}</p>}

        <button onClick={save} disabled={saving || !form.word.trim()}
          className="w-full bg-sky hover:brightness-95 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
