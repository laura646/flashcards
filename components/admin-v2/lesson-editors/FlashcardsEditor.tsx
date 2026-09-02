'use client'

// 10B redesign — FLASHCARDS editor. One instance edits ONE vocabulary set
// (Sep 2026 rework): sets are separate top-level lesson units, so this editor
// went back to a flat card list, plus a "Set name" field at the top that
// stamps set_name onto every card in the unit. The lesson can hold several
// flashcards units — "Environment", "Education" — each its own instance.
//
// Still presentational only: receives the current cards + an onChange that
// swaps the whole array, and an onPickImage bridge to the parent's
// ImagePickerModal.

import { useState } from 'react'
import { Button, Card } from '@/components/student-ui'
import type { Flashcard } from '@/lib/lesson-editor/types'

export const DEFAULT_SET_NAME = 'Lesson vocabulary'

// Reads a File and resolves its base64 payload (data-URL prefix stripped).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const fieldInputClass =
  'w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] focus:outline-none transition-colors border-[1.5px] border-[#e3e5e9] focus:border-sky'
const fieldLabelClass =
  'block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted'

interface Props {
  cards: Flashcard[]
  onChange: (cards: Flashcard[]) => void
  onPickImage: (word: string, apply: (url: string) => void) => void
}

export default function FlashcardsEditor({ cards, onChange, onPickImage }: Props) {
  const [uploadError, setUploadError] = useState<string | null>(null)

  const setName = ((cards[0]?.set_name || '').trim()) || DEFAULT_SET_NAME

  function renameSet(newName: string) {
    const name = newName.trim()
    const value = name && name !== DEFAULT_SET_NAME ? name : null
    onChange(cards.map((fc) => ({ ...fc, set_name: value })))
  }

  function updateFlashcard(fcIndex: number, field: keyof Flashcard, value: string) {
    const updated = [...cards]
    updated[fcIndex] = { ...updated[fcIndex], [field]: value }
    onChange(updated)
  }

  function removeFlashcard(fcIndex: number) {
    const updated = cards
      .filter((_, i) => i !== fcIndex)
      .map((fc, i) => ({ ...fc, order_index: i }))
    onChange(updated)
  }

  function addBlankFlashcard() {
    onChange([
      ...cards,
      {
        word: '', phonetic: '', meaning: '', example: '', notes: '', image_url: '',
        order_index: cards.length,
        set_name: cards[0]?.set_name ?? null,
      },
    ])
  }

  async function handleUpload(fcIndex: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, fileType: file.type, fileName: file.name }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        updateFlashcard(fcIndex, 'image_url', data.url)
      } else {
        setUploadError(data.error || 'Upload failed')
      }
    } catch {
      setUploadError('Failed to upload image')
    }
    e.target.value = ''
  }

  return (
    <div className="font-rubik space-y-4">
      {/* Set name — students see this as the unit's title */}
      <label className="block">
        <span className={fieldLabelClass}>Set name</span>
        <input
          type="text"
          key={setName}
          defaultValue={setName}
          onBlur={(e) => { if (e.target.value.trim() !== setName) renameSet(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder={DEFAULT_SET_NAME}
          className={fieldInputClass}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-ink-muted">
          {cards.length} flashcard{cards.length !== 1 ? 's' : ''}
        </p>
        <Button variant="textLink" size="sm" onClick={addBlankFlashcard}>
          + Add Manually
        </Button>
      </div>

      {uploadError && (
        <p className="text-xs font-medium text-incorrect-fg">{uploadError}</p>
      )}

      {cards.map((fc, fcIdx) => (
        <Card key={fcIdx} padding="md">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-extrabold text-sky-text">#{fcIdx + 1}</span>
            <button
              onClick={() => removeFlashcard(fcIdx)}
              className="text-xs font-bold text-ink-muted hover:text-incorrect-fg transition-colors"
            >
              {'✕'} Remove
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className={fieldLabelClass}>Word</span>
              <input
                type="text"
                value={fc.word}
                onChange={(e) => updateFlashcard(fcIdx, 'word', e.target.value)}
                className={fieldInputClass}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Phonetic</span>
              <input
                type="text"
                value={fc.phonetic}
                onChange={(e) => updateFlashcard(fcIdx, 'phonetic', e.target.value)}
                className={fieldInputClass}
              />
            </label>
          </div>

          <label className="block mb-3">
            <span className={fieldLabelClass}>Meaning</span>
            <input
              type="text"
              value={fc.meaning}
              onChange={(e) => updateFlashcard(fcIdx, 'meaning', e.target.value)}
              className={fieldInputClass}
            />
          </label>

          <label className="block mb-3">
            <span className={fieldLabelClass}>Example</span>
            <input
              type="text"
              value={fc.example}
              onChange={(e) => updateFlashcard(fcIdx, 'example', e.target.value)}
              className={fieldInputClass}
            />
          </label>

          <label className="block mb-3">
            <span className={fieldLabelClass}>Notes</span>
            <input
              type="text"
              value={fc.notes}
              onChange={(e) => updateFlashcard(fcIdx, 'notes', e.target.value)}
              placeholder="Optional notes…"
              className={fieldInputClass}
            />
          </label>

          <div>
            <span className={fieldLabelClass}>Image (optional)</span>
            {fc.image_url ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fc.image_url}
                  alt=""
                  className="max-h-20 max-w-[120px] object-contain rounded-tile border border-hairline"
                />
                <button
                  onClick={() => updateFlashcard(fcIdx, 'image_url', '')}
                  className="text-xs font-bold text-ink-muted hover:text-incorrect-fg transition-colors"
                >
                  {'✕'} Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 px-3.5 py-3 border-[1.5px] border-dashed border-sky-border rounded-tile cursor-pointer hover:border-sky transition-colors">
                  <span className="text-xs font-bold text-ink-muted">📷 Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => handleUpload(fcIdx, e)}
                  />
                </label>
                {fc.word && (
                  <button
                    onClick={() =>
                      onPickImage(fc.word, (url) => updateFlashcard(fcIdx, 'image_url', url))
                    }
                    className="inline-flex items-center px-3.5 py-3 border-[1.5px] border-dashed border-sky-border rounded-tile text-xs font-bold text-ink-muted hover:border-sky hover:text-sky transition-colors"
                  >
                    🔍 Find image
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
