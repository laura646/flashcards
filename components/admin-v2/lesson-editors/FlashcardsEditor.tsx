'use client'

// 10B redesign — FLASHCARDS editor, now with NAMED VOCABULARY SETS (Sep 2026).
//
// A lesson's vocabulary is no longer one flat list: cards are grouped into
// named sets ("Travel and Tourism", "Phrasal verbs", …) via the set_name
// column on lesson_flashcards. Cards with no set_name form the default
// "Lesson vocabulary" set (also what every pre-existing lesson shows).
//
// Still presentational only: receives the current cards + an onChange that
// swaps the whole array, and an onPickImage bridge to the parent's
// ImagePickerModal. Set structure is DERIVED from the cards themselves
// (set_name + order of first appearance) — no separate set state to persist.

import { useState } from 'react'
import { Button, Card } from '@/components/student-ui'
import type { Flashcard } from '@/lib/lesson-editor/types'

export const DEFAULT_SET_NAME = 'Lesson vocabulary'

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

const fieldInputClass =
  'w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] focus:outline-none transition-colors border-[1.5px] border-[#e3e5e9] focus:border-sky'
const fieldLabelClass =
  'block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted'

interface Props {
  cards: Flashcard[]
  onChange: (cards: Flashcard[]) => void
  onPickImage: (word: string, apply: (url: string) => void) => void
}

// Renumber order_index to array position — the array IS the canonical order.
function renumber(cards: Flashcard[]): Flashcard[] {
  return cards.map((fc, i) => ({ ...fc, order_index: i }))
}

export default function FlashcardsEditor({ cards, onChange, onPickImage }: Props) {
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Collapsed sets (by set key). Purely visual, not persisted.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // ── Derive the sets: unique names in order of first appearance. ──
  // Key '' = the default set (set_name null/empty), shown as DEFAULT_SET_NAME.
  const setKeys: string[] = []
  cards.forEach((fc) => {
    const key = (fc.set_name || '').trim()
    if (!setKeys.includes(key)) setKeys.push(key)
  })
  if (setKeys.length === 0) setKeys.push('')
  const displayName = (key: string) => key || DEFAULT_SET_NAME

  function updateFlashcard(fcIndex: number, field: keyof Flashcard, value: string) {
    const updated = [...cards]
    updated[fcIndex] = { ...updated[fcIndex], [field]: value }
    onChange(updated)
  }

  function removeFlashcard(fcIndex: number) {
    onChange(renumber(cards.filter((_, i) => i !== fcIndex)))
  }

  // Append a blank card at the END of the given set's cards (so it renders
  // inside that section), not at the end of the whole array.
  function addBlankCard(setKey: string) {
    const blank: Flashcard = {
      word: '', phonetic: '', meaning: '', example: '', notes: '', image_url: '',
      order_index: 0, set_name: setKey || null,
    }
    let insertAt = cards.length
    for (let i = cards.length - 1; i >= 0; i--) {
      if ((cards[i].set_name || '').trim() === setKey) { insertAt = i + 1; break }
    }
    const updated = [...cards]
    updated.splice(insertAt, 0, blank)
    onChange(renumber(updated))
  }

  // A new set exists as soon as it has a card — create it with one blank card.
  function addSet() {
    let n = setKeys.filter((k) => k).length + 1
    let name = `New set ${n}`
    while (setKeys.includes(name)) { n += 1; name = `New set ${n}` }
    onChange(renumber([
      ...cards,
      { word: '', phonetic: '', meaning: '', example: '', notes: '', image_url: '', order_index: 0, set_name: name },
    ]))
  }

  function renameSet(oldKey: string, newName: string) {
    const name = newName.trim()
    onChange(cards.map((fc) =>
      (fc.set_name || '').trim() === oldKey
        ? { ...fc, set_name: name && name !== DEFAULT_SET_NAME ? name : null }
        : fc
    ))
  }

  function removeSet(setKey: string) {
    const count = cards.filter((fc) => (fc.set_name || '').trim() === setKey).length
    if (!window.confirm(`Delete the set “${displayName(setKey)}” and its ${count} word${count === 1 ? '' : 's'}?`)) return
    onChange(renumber(cards.filter((fc) => (fc.set_name || '').trim() !== setKey)))
  }

  function moveCardToSet(fcIndex: number, setKey: string) {
    updateFlashcard(fcIndex, 'set_name', setKey)
  }

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-ink-muted">
          {cards.length} flashcard{cards.length !== 1 ? 's' : ''}
          {setKeys.length > 1 ? ` in ${setKeys.length} sets` : ''}
        </p>
        <Button variant="textLink" size="sm" onClick={addSet}>
          + New vocabulary set
        </Button>
      </div>

      {uploadError && (
        <p className="text-xs font-medium text-incorrect-fg">{uploadError}</p>
      )}

      {setKeys.map((setKey) => {
        const isCollapsed = collapsed.has(setKey)
        const setCards = cards
          .map((fc, i) => ({ fc, i }))
          .filter(({ fc }) => (fc.set_name || '').trim() === setKey)
        return (
          <div key={setKey} className="rounded-card border-[1.5px] border-hairline overflow-hidden">
            {/* ── Set header: collapse | editable name | count | delete ── */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-sky-wash/60">
              <button
                onClick={() => toggleCollapsed(setKey)}
                className="text-xs font-bold text-ink-muted w-5"
                title={isCollapsed ? 'Expand' : 'Collapse'}
                aria-label={isCollapsed ? 'Expand set' : 'Collapse set'}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
              <span className="text-sm">🃏</span>
              <input
                type="text"
                defaultValue={displayName(setKey)}
                key={`name-${setKey}`}
                onBlur={(e) => { if (e.target.value.trim() !== displayName(setKey)) renameSet(setKey, e.target.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className="flex-1 min-w-0 text-sm font-bold text-ink-black bg-transparent focus:outline-none focus:bg-white rounded px-1.5 py-0.5 border border-transparent focus:border-sky"
                title="Set name — students see this"
              />
              <span className="text-[11px] font-bold text-ink-muted whitespace-nowrap">
                {setCards.length} word{setCards.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => addBlankCard(setKey)}
                className="text-[11px] font-bold text-sky-text hover:underline whitespace-nowrap"
              >
                + Add word
              </button>
              {setKeys.length > 1 && (
                <button
                  onClick={() => removeSet(setKey)}
                  className="text-[11px] font-bold text-ink-muted hover:text-incorrect-fg"
                  title="Delete this set and its words"
                >
                  🗑
                </button>
              )}
            </div>

            {/* ── Cards ── */}
            {!isCollapsed && (
              <div className="p-3 space-y-3">
                {setCards.length === 0 && (
                  <p className="text-xs text-ink-muted italic">No words yet — “+ Add word”.</p>
                )}
                {setCards.map(({ fc, i: fcIdx }, posInSet) => (
                  <Card key={fcIdx} padding="md">
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <span className="text-xs font-extrabold text-sky-text">#{posInSet + 1}</span>
                      <div className="flex items-center gap-3">
                        {setKeys.length > 1 && (
                          <select
                            value={setKey}
                            onChange={(e) => moveCardToSet(fcIdx, e.target.value)}
                            className="text-[11px] font-bold text-ink-muted bg-transparent border border-hairline rounded px-1 py-0.5"
                            title="Move to another set"
                          >
                            {setKeys.map((k) => (
                              <option key={k} value={k}>{displayName(k)}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => removeFlashcard(fcIdx)}
                          className="text-xs font-bold text-ink-muted hover:text-incorrect-fg transition-colors"
                        >
                          {'✕'} Remove
                        </button>
                      </div>
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
            )}
          </div>
        )
      })}
    </div>
  )
}
