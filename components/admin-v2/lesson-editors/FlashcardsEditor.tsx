'use client'

// 10B redesign — FLASHCARDS editor (Phase 2, "new beside old").
//
// Presentational only: receives the current cards + an onChange that swaps the
// whole array, and an onPickImage bridge to the parent's ImagePickerModal. No
// own state, no data fetching. The live editor app/admin/lessons/page.tsx is
// left 100% untouched.
//
// Ported faithfully from the legacy renderFlashcardsEditor
// (app/admin/lessons/page.tsx 2430-2577):
//   - count line "N flashcard(s)" + "+ Add Manually"
//   - per-card fields Word / Phonetic (2-col), Meaning, Example, Notes
//   - image: preview + remove, OR Upload (base64 -> /api/upload) + Find image
// AI generation panel (legacy 2453-2476) is DEFERRED — omitted here.

import { useState } from 'react'
import { Button, Card } from '@/components/student-ui'
import type { Flashcard } from '@/lib/lesson-editor/types'

// Reads a File and resolves its base64 payload (data-URL prefix stripped).
// Copied verbatim from legacy fileToBase64 (page.tsx 469-480).
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

// Shared field styling — matches the 10B TextField input (index.tsx 117-132)
// but applied to bare <input>s so we can render a compact uppercase eyebrow
// label inline without TextField's focused-color state machinery.
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
  // Surfaces upload failures inline per-card (legacy used a global toast,
  // which this presentational component does not own).
  const [uploadError, setUploadError] = useState<string | null>(null)

  // updateFlashcard (legacy 2433-2437): swap one field on one card.
  function updateFlashcard(fcIndex: number, field: keyof Flashcard, value: string) {
    const updated = [...cards]
    updated[fcIndex] = { ...updated[fcIndex], [field]: value }
    onChange(updated)
  }

  // removeFlashcard (legacy 2439-2442): filter + renumber order_index to the
  // new array index.
  function removeFlashcard(fcIndex: number) {
    const updated = cards
      .filter((_, i) => i !== fcIndex)
      .map((fc, i) => ({ ...fc, order_index: i }))
    onChange(updated)
  }

  // addBlankFlashcard (legacy 2444-2449): append a blank card whose
  // order_index is the pre-append length.
  function addBlankFlashcard() {
    onChange([
      ...cards,
      { word: '', phonetic: '', meaning: '', example: '', notes: '', image_url: '', order_index: cards.length },
    ])
  }

  // Upload handler (legacy 2535-2555): base64 -> POST /api/upload -> set
  // image_url; reset the input value so the same file can be re-picked.
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
      {/* Count line + Add Manually (legacy 2479-2482) */}
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

      {/* Cards (legacy 2484-2574) */}
      {cards.map((fc, fcIdx) => (
        <Card key={fcIdx} padding="md">
          {/* Header: #N + Remove (legacy 2486-2491) */}
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-extrabold text-sky-text">#{fcIdx + 1}</span>
            <button
              onClick={() => removeFlashcard(fcIdx)}
              className="text-xs font-bold text-ink-muted hover:text-incorrect-fg transition-colors"
            >
              {'✕'} Remove
            </button>
          </div>

          {/* Word + Phonetic, 2-col (legacy 2492-2503) */}
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

          {/* Meaning (legacy 2504-2508) */}
          <label className="block mb-3">
            <span className={fieldLabelClass}>Meaning</span>
            <input
              type="text"
              value={fc.meaning}
              onChange={(e) => updateFlashcard(fcIdx, 'meaning', e.target.value)}
              className={fieldInputClass}
            />
          </label>

          {/* Example (legacy 2509-2513) */}
          <label className="block mb-3">
            <span className={fieldLabelClass}>Example</span>
            <input
              type="text"
              value={fc.example}
              onChange={(e) => updateFlashcard(fcIdx, 'example', e.target.value)}
              className={fieldInputClass}
            />
          </label>

          {/* Notes (legacy 2514-2519) */}
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

          {/* Image: preview + remove, OR Upload + Find image (legacy 2520-2572) */}
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
                {/* Upload (legacy 2533-2556) */}
                <label className="inline-flex items-center gap-2 px-3.5 py-3 border-[1.5px] border-dashed border-sky-border rounded-tile cursor-pointer hover:border-sky transition-colors">
                  <span className="text-xs font-bold text-ink-muted">📷 Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => handleUpload(fcIdx, e)}
                  />
                </label>
                {/* Find image — only when the word is set (legacy 2557-2569) */}
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
