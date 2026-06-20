'use client'

// 10B redesign — AI generation form for READING / ARTICLE blocks (Phase 6, "new
// beside old"). The reading door of the two-door add flow.
//
// PRESENTATIONAL + CALLBACKS ONLY. Two modes:
//   - "Use a source": one of URL / pasted text / a single image is required.
//   - "Create from scratch": a creative brief (reading_type / plot / narrator /
//     characters / grammar focus / vocabulary).
// Plus COMMON fields (level / length_words / style) for both modes.
//
// It does NOT fetch — the page maps this onto useLessonAi's ReadingForm
// (splitting the comma `vocabulary` string into string[], forwarding source_image
// as a File) and calls generateReading.
//
// NOTE on shape: `vocabulary` is emitted as a raw comma string; `source_image`
// is a File (the page derives source_image_type). DEFER (pass 2): the
// course-vocabulary picker — vocabulary stays a plain comma textarea.
//
// Modal shell + tokens mirror LessonEditorView's confirm modal and the 10B kit.

import { useState } from 'react'
import { Button, InlineError, SegmentedControl, Spinner } from '@/components/student-ui'

export type ReadingMode = 'source' | 'scratch'

export interface ReadingAiFormValues {
  mode: ReadingMode
  // common
  level?: string
  length_words?: number
  style?: string
  // source mode
  source_text?: string
  source_url?: string
  source_image?: File
  // scratch mode
  reading_type?: string
  plot?: string
  /** Raw comma-separated string; the page splits it into string[] for the hook. */
  vocabulary?: string
  narrator_pov?: string
  characters?: string
  grammar_focus?: string
}

interface Props {
  generating: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (form: ReadingAiFormValues) => void
}

const MODE_SEGMENTS: { value: ReadingMode; label: string }[] = [
  { value: 'source', label: 'Use a source' },
  { value: 'scratch', label: 'Create from scratch' },
]

const READING_TYPES = ['Story', 'Article', 'Dialogue', 'Email', 'Report', 'Review']
const POV_OPTIONS = ['First person', 'Second person', 'Third person']

// ── Local presentational helpers (10B tokens) ──

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 text-ink-muted">
      {children}
    </span>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] focus:outline-none transition-colors border-[1.5px] border-[#e3e5e9] focus:border-sky disabled:opacity-60"
    />
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile p-3.5 resize-y border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors placeholder:text-[#b6bac2] disabled:opacity-60"
    />
  )
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 border-[1.5px] border-[#e3e5e9] focus:outline-none focus:border-sky transition-colors disabled:opacity-60"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

export default function ReadingAiForm({ generating, error, onClose, onSubmit }: Props) {
  const [mode, setMode] = useState<ReadingMode>('source')

  // common
  const [level, setLevel] = useState('')
  const [lengthWords, setLengthWords] = useState('400')
  const [style, setStyle] = useState('')

  // source mode
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [sourceImage, setSourceImage] = useState<File | null>(null)

  // scratch mode
  const [readingType, setReadingType] = useState('')
  const [plot, setPlot] = useState('')
  const [vocabulary, setVocabulary] = useState('')
  const [narratorPov, setNarratorPov] = useState('')
  const [characters, setCharacters] = useState('')
  const [grammarFocus, setGrammarFocus] = useState('')

  // Source mode needs exactly one of url / text / image. Scratch is always
  // generatable (all brief fields optional, matching the hook).
  const hasSource =
    sourceUrl.trim().length > 0 || sourceText.trim().length > 0 || sourceImage != null
  const canGenerate = mode === 'scratch' || hasSource

  const submit = () => {
    if (!canGenerate || generating) return
    const lengthNum = Number(lengthWords)
    const common = {
      mode,
      level: level.trim() || undefined,
      length_words: Number.isFinite(lengthNum) && lengthNum > 0 ? lengthNum : undefined,
      style: style.trim() || undefined,
    }
    if (mode === 'source') {
      onSubmit({
        ...common,
        source_url: sourceUrl.trim() || undefined,
        source_text: sourceText.trim() || undefined,
        source_image: sourceImage ?? undefined,
      })
    } else {
      onSubmit({
        ...common,
        reading_type: readingType || undefined,
        plot: plot.trim() || undefined,
        vocabulary: vocabulary.trim() || undefined,
        narrator_pov: narratorPov || undefined,
        characters: characters.trim() || undefined,
        grammar_focus: grammarFocus.trim() || undefined,
      })
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-card shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Generate reading with AI"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              ✨ Generate with AI
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5">Reading / article</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        {/* Mode tabs */}
        <SegmentedControl
          segments={MODE_SEGMENTS}
          value={mode}
          onChange={setMode}
          className="mb-4"
        />

        <div className="space-y-4">
          {mode === 'source' ? (
            <>
              <p className="text-[12px] text-ink-muted -mt-1">
                Provide one of the following — a URL, pasted text, or an image.
              </p>
              <div>
                <FieldLabel>Source URL</FieldLabel>
                <TextInput
                  value={sourceUrl}
                  onChange={setSourceUrl}
                  placeholder="https://example.com/article"
                  disabled={generating}
                  type="url"
                />
              </div>
              <div>
                <FieldLabel>Paste source text</FieldLabel>
                <TextArea
                  value={sourceText}
                  onChange={setSourceText}
                  placeholder="Paste the source material to adapt…"
                  rows={5}
                  disabled={generating}
                />
              </div>
              <div>
                <FieldLabel>Source image</FieldLabel>
                <label className="flex items-center justify-center gap-2 border border-dashed border-sky-border rounded-tile py-5 text-[13px] text-sky-text cursor-pointer hover:bg-sky-wash transition-colors">
                  <span aria-hidden="true">🖼️</span> Choose an image
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/*"
                    disabled={generating}
                    className="sr-only"
                    onChange={(e) => setSourceImage(e.target.files?.[0] ?? null)}
                  />
                </label>
                {sourceImage && (
                  <p className="mt-2 text-[12px] text-ink-muted truncate">{sourceImage.name}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <FieldLabel>Reading type</FieldLabel>
                <SelectInput
                  value={readingType}
                  onChange={setReadingType}
                  options={READING_TYPES}
                  placeholder="Let AI choose"
                  disabled={generating}
                />
              </div>
              <div>
                <FieldLabel>Plot / what it is about</FieldLabel>
                <TextArea
                  value={plot}
                  onChange={setPlot}
                  placeholder="e.g. A traveller misses their train and meets a stranger."
                  rows={3}
                  disabled={generating}
                />
              </div>
              <div>
                <FieldLabel>Narrator point of view</FieldLabel>
                <SelectInput
                  value={narratorPov}
                  onChange={setNarratorPov}
                  options={POV_OPTIONS}
                  placeholder="Let AI choose"
                  disabled={generating}
                />
              </div>
              <div>
                <FieldLabel>Characters</FieldLabel>
                <TextInput
                  value={characters}
                  onChange={setCharacters}
                  placeholder="e.g. Maria (curious), Tom (cautious)"
                  disabled={generating}
                />
              </div>
              <div>
                <FieldLabel>Grammar focus</FieldLabel>
                <TextInput
                  value={grammarFocus}
                  onChange={setGrammarFocus}
                  placeholder="e.g. Past Perfect"
                  disabled={generating}
                />
              </div>
              <div>
                <FieldLabel>Target vocabulary (optional)</FieldLabel>
                <TextArea
                  value={vocabulary}
                  onChange={setVocabulary}
                  placeholder="Comma-separated, e.g. platform, delay, stranger"
                  rows={2}
                  disabled={generating}
                />
              </div>
            </>
          )}

          {/* Common fields */}
          <div className="pt-4 border-t border-hairline grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Level (optional)</FieldLabel>
              <TextInput
                value={level}
                onChange={setLevel}
                placeholder="e.g. B1"
                disabled={generating}
              />
            </div>
            <div>
              <FieldLabel>Length (words)</FieldLabel>
              <TextInput
                value={lengthWords}
                onChange={setLengthWords}
                placeholder="400"
                disabled={generating}
                type="number"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Style (optional)</FieldLabel>
            <TextInput
              value={style}
              onChange={setStyle}
              placeholder="e.g. Conversational, journalistic, formal"
              disabled={generating}
            />
          </div>

          {/* Error */}
          {error && <InlineError message={error} />}

          {/* Generating state */}
          {generating && (
            <div className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Spinner size={18} />
              Generating… this can take a few seconds.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-5">
          <Button variant="secondary" size="md" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={generating || !canGenerate}
          >
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  )
}
