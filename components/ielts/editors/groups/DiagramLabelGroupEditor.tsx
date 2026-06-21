'use client'

// IELTS Reading — TEACHER authoring editor: Diagram label completion (Type 13,
// AUTHENTIC exam version).
//
// ADDITIVE: not imported by any live file. Authors the exact fields the
// (future) ReadingDiagramLabelCompletionRunner will consume:
//   imageUrl: string                 (the uploaded diagram)
//   wordLimit?  (group default)
//   labels[]: { number, x, y, acceptedAnswers[], wordLimit? }
//     x/y are PERCENTAGES (0–100) of the image box, so the numbered pins
//     position responsively regardless of the rendered image size.
//
// Image upload reuses the SAME mechanism FlashcardsEditor uses
// (components/admin-v2/lesson-editors/FlashcardsEditor.tsx): read the File to
// base64, POST it to /api/upload, store the returned `url`. The "Find image"
// search bridge (ImagePickerModal) is NOT reused — a diagram is a bespoke
// upload, and this editor matches the standalone { group, onChange } props of
// every other group editor (no parent onPickImage bridge).
//
// Click-to-place: once an image is set, clicking the image adds a numbered pin
// at the clicked point (x,y as % of the image box). Selecting a pin opens an
// inline panel to edit its acceptedAnswers (comma-separated via the shared
// _acceptedAnswers helpers) + optional per-label word limit, and to delete it.
// Labels are auto-numbered 1..N in creation order and re-sequenced on delete.

import { useRef, useState } from 'react'
import type { DiagramLabelCompletionGroup } from '@/lib/ielts/types'
import { Button } from '@/components/student-ui'
import {
  answersToInput,
  inputToAnswers,
  parseWordLimit,
} from './_acceptedAnswers'

type Label = DiagramLabelCompletionGroup['labels'][number]

export interface DiagramLabelGroupEditorProps {
  group: DiagramLabelCompletionGroup
  onChange: (group: DiagramLabelCompletionGroup) => void
}

// Reads a File and resolves its base64 payload (data-URL prefix stripped).
// Same helper FlashcardsEditor uses (ported from legacy fileToBase64).
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
  'w-full text-[14px] font-medium text-ink-body bg-white rounded-tile px-3 py-2 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky'
const labelClass =
  'block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted'

/** Re-sequence label numbers 1, 2, 3 … in creation (array) order. */
function renumber(labels: Label[]): Label[] {
  return labels.map((l, i) => ({ ...l, number: i + 1 }))
}

export default function DiagramLabelGroupEditor({
  group,
  onChange,
}: DiagramLabelGroupEditorProps) {
  const labels = group.labels
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const imageBoxRef = useRef<HTMLDivElement | null>(null)

  // ── Image upload (reused FlashcardsEditor mechanism) ──
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64,
          fileType: file.type,
          fileName: file.name,
        }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        onChange({ ...group, imageUrl: data.url })
      } else {
        setUploadError(data.error || 'Upload failed')
      }
    } catch {
      setUploadError('Failed to upload image')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removeImage() {
    // Clearing the diagram drops the pins too — they have no meaning without it.
    setSelected(null)
    onChange({ ...group, imageUrl: '', labels: [] })
  }

  // ── Pin placement / editing ──
  function addLabelAt(xPct: number, yPct: number) {
    const next = renumber([
      ...labels,
      { number: 0, x: xPct, y: yPct, acceptedAnswers: [''] },
    ])
    onChange({ ...group, labels: next })
    setSelected(next.length - 1)
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const box = imageBoxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const xPct = ((e.clientX - rect.left) / rect.width) * 100
    const yPct = ((e.clientY - rect.top) / rect.height) * 100
    // Clamp into the image box so a pin never escapes the diagram.
    const clamp = (n: number) => Math.min(100, Math.max(0, n))
    addLabelAt(Math.round(clamp(xPct) * 10) / 10, Math.round(clamp(yPct) * 10) / 10)
  }

  function patchLabel(idx: number, p: Partial<Label>) {
    onChange({
      ...group,
      labels: labels.map((l, i) => (i === idx ? { ...l, ...p } : l)),
    })
  }

  function removeLabel(idx: number) {
    const next = renumber(labels.filter((_, i) => i !== idx))
    onChange({ ...group, labels: next })
    setSelected(null)
  }

  const hasImage = group.imageUrl.trim().length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Group-level word limit */}
      <label className="block w-44">
        <span className={labelClass}>Word limit (all labels)</span>
        <input
          type="number"
          min={1}
          value={group.wordLimit ?? ''}
          placeholder="e.g. 2"
          onChange={(e) =>
            onChange({ ...group, wordLimit: parseWordLimit(e.target.value) })
          }
          className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky"
        />
      </label>

      {uploadError && (
        <p className="text-xs font-medium text-incorrect-fg">{uploadError}</p>
      )}

      {/* Diagram image */}
      {!hasImage ? (
        <div className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-2">
          <span className={labelClass}>Diagram image</span>
          <label className="inline-flex w-fit items-center gap-2 px-3.5 py-3 border-[1.5px] border-dashed border-sky-border rounded-tile cursor-pointer hover:border-sky transition-colors">
            <span className="text-xs font-bold text-ink-muted">
              {uploading ? 'Uploading…' : '📷 Upload diagram'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
          <p className="text-[12px] font-medium text-ink-muted">
            Upload the diagram, then click on it to place numbered label points.
          </p>
        </div>
      ) : (
        <div className="rounded-tile border border-hairline bg-surface p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className={labelClass}>
              Diagram — click to add a label point
            </span>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="text-[12px] font-extrabold text-sky hover:underline">
                  {uploading ? 'Uploading…' : 'Replace'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleUpload}
                />
              </label>
              <Button
                variant="textLink"
                size="sm"
                onClick={removeImage}
                aria-label="Remove diagram image"
              >
                Remove
              </Button>
            </div>
          </div>

          <div
            ref={imageBoxRef}
            onClick={handleImageClick}
            className="relative inline-block max-w-full cursor-crosshair select-none rounded-tile border border-hairline bg-white overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={group.imageUrl}
              alt="Diagram to label"
              className="block max-w-full h-auto pointer-events-none"
              draggable={false}
            />
            {labels.map((l, idx) => {
              const isSel = selected === idx
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(idx)
                  }}
                  aria-label={`Select label ${l.number}`}
                  style={{
                    left: `${l.x}%`,
                    top: `${l.y}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-extrabold border-2 shadow-sm transition-colors ${
                    isSel
                      ? 'bg-sky text-white border-white ring-2 ring-sky/50'
                      : 'bg-white text-sky-dark border-sky hover:bg-sky-wash'
                  }`}
                >
                  {l.number}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected-label editor */}
      {hasImage && selected != null && labels[selected] && (
        <div className="rounded-tile border border-sky-border bg-sky-wash p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky-dark">
              Label {labels[selected].number}
            </span>
            <Button
              variant="textLink"
              size="sm"
              onClick={() => removeLabel(selected)}
              aria-label={`Delete label ${labels[selected].number}`}
            >
              Delete
            </Button>
          </div>

          <label className="block">
            <span className={labelClass}>Accepted answers (comma-separated)</span>
            <input
              type="text"
              value={answersToInput(labels[selected].acceptedAnswers)}
              placeholder="ventricle, left ventricle"
              onChange={(e) =>
                patchLabel(selected, {
                  acceptedAnswers: inputToAnswers(e.target.value),
                })
              }
              className={fieldInputClass}
            />
          </label>

          <label className="block w-44">
            <span className={labelClass}>Word limit (this label)</span>
            <input
              type="number"
              min={1}
              value={labels[selected].wordLimit ?? ''}
              placeholder="(uses group)"
              onChange={(e) =>
                patchLabel(selected, {
                  wordLimit: parseWordLimit(e.target.value),
                })
              }
              className={fieldInputClass}
            />
          </label>

          <p className="text-[12px] font-medium text-ink-muted">
            Tip: click the diagram again to add another label point.
          </p>
        </div>
      )}

      {/* Empty-state hint once an image is set but no pins yet */}
      {hasImage && labels.length === 0 && (
        <p className="text-[12px] font-medium text-ink-muted">
          No label points yet — click on the diagram above to add one.
        </p>
      )}

      {/* Label summary list (quick select + count) */}
      {hasImage && labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted">
            {labels.length} label{labels.length !== 1 ? 's' : ''}
          </span>
          {labels.map((l, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelected(idx)}
              className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[12px] font-extrabold border transition-colors ${
                selected === idx
                  ? 'bg-sky text-white border-sky'
                  : 'bg-white text-sky-dark border-sky-border hover:border-sky'
              }`}
            >
              {l.number}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
