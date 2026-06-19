'use client'

// Wave 0 — the unified "two doors" create chooser.
//
// Laura's decision: the Manual-vs-AI choice is an UPFRONT step on every
// exercise/content add. This is the single reusable piece consumed by the
// everyday builder, IELTS, and the migrated teacher screens — so the pattern
// is identical everywhere (the audit found it built 3 different ways).
//
// Presentational + callbacks only; the real generate/save wiring lands in the
// create-flow phases. Accessibility per the UX pass: real <button>s,
// focus-visible rings, keyboard-operable source chips, accessible sky-text.

import { useState } from 'react'
import { Button } from './index'

export type CreateSource = 'paste' | 'doc' | 'youtube' | 'audio' | 'image' | 'lesson' | 'topic'

type SourceDef = { key: CreateSource; icon: string; label: string; needs?: 'text' | 'url' | 'file' }

const SOURCES: SourceDef[] = [
  { key: 'paste', icon: '📋', label: 'Paste text', needs: 'text' },
  { key: 'doc', icon: '📄', label: 'Upload PDF / Word', needs: 'file' },
  { key: 'youtube', icon: '▶️', label: 'YouTube / video', needs: 'url' },
  { key: 'audio', icon: '🎧', label: 'Audio file', needs: 'file' },
  { key: 'image', icon: '🖼️', label: 'Image', needs: 'file' },
  { key: 'topic', icon: '💡', label: 'A topic', needs: 'text' },
]

interface Props {
  itemLabel?: string
  /** Only show "This lesson's reading" when the lesson actually has text — no dead button. */
  lessonHasReading?: boolean
  onManual: () => void
  onGenerate: (source: CreateSource, value?: string) => void
  className?: string
}

export default function CreateChooser({ itemLabel = 'this exercise', lessonHasReading = false, onManual, onGenerate, className = '' }: Props) {
  const [step, setStep] = useState<'choose' | 'ai'>('choose')
  const [source, setSource] = useState<CreateSource | null>(null)
  const [value, setValue] = useState('')

  const sources: SourceDef[] = lessonHasReading
    ? [{ key: 'lesson', icon: '📚', label: "This lesson's reading" }, ...SOURCES]
    : SOURCES
  const needs = sources.find((s) => s.key === source)?.needs

  if (step === 'choose') {
    return (
      <div className={className}>
        <p className="text-[13px] text-ink-muted mb-3">How do you want to create {itemLabel}?</p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={onManual}
            className="flex-1 min-w-[180px] text-left border border-hairline rounded-card p-4 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
          >
            <div className="text-2xl mb-1.5" aria-hidden="true">✍️</div>
            <div className="text-sm font-bold text-ink-black">Build it manually</div>
            <div className="text-[12px] text-ink-muted mt-0.5 leading-relaxed">Start with a blank editor. Full control.</div>
          </button>
          <button
            onClick={() => setStep('ai')}
            className="flex-1 min-w-[180px] text-left border-[1.5px] border-sky-border bg-sky-wash rounded-card p-4 hover:border-sky transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
          >
            <div className="text-2xl mb-1.5" aria-hidden="true">✨</div>
            <div className="text-sm font-bold text-sky-text">Generate with AI</div>
            <div className="text-[12px] text-ink-body mt-0.5 leading-relaxed">From material you already have. Drafts it for you to tweak.</div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <button
        onClick={() => { setStep('choose'); setSource(null); setValue('') }}
        className="text-[13px] font-bold text-sky-text mb-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
      >‹ Back</button>
      <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted mb-2.5">✨ Generate from…</p>

      <div className="flex gap-2 flex-wrap mb-4">
        {sources.map((s) => (
          <button
            key={s.key}
            onClick={() => { setSource(s.key); setValue('') }}
            aria-pressed={source === s.key}
            className={`text-[12.5px] px-3 py-2 rounded-tile border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${
              source === s.key ? 'border-sky bg-sky-wash text-sky-text font-bold' : 'border-hairline text-ink-body hover:border-sky-border'
            }`}
          >
            <span aria-hidden="true">{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {needs === 'text' && (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          placeholder={source === 'topic' ? 'e.g. The future of remote work' : 'Paste your text here…'}
          className="w-full text-[13px] text-ink-body border border-hairline rounded-tile p-3 mb-3 resize-none focus:outline-none focus:border-sky"
        />
      )}
      {needs === 'url' && (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          className="w-full text-[13px] text-ink-body border border-hairline rounded-tile p-3 mb-3 focus:outline-none focus:border-sky"
        />
      )}
      {needs === 'file' && (
        <label className="flex items-center justify-center gap-2 border border-dashed border-sky-border rounded-tile py-4 mb-3 text-[13px] text-sky-text cursor-pointer hover:bg-sky-wash">
          <span aria-hidden="true">⬆️</span> Choose a file
          <input type="file" className="sr-only" onChange={(e) => setValue(e.target.files?.[0]?.name || '')} />
        </label>
      )}
      {needs === 'file' && value && <p className="text-[12px] text-ink-muted mb-3">Selected: {value}</p>}

      <Button variant="primary" size="md" disabled={!source} onClick={() => source && onGenerate(source, value)}>
        Generate draft
      </Button>
      <p className="text-[11px] text-ink-muted mt-2">→ AI fills the editor; you review &amp; save.</p>
    </div>
  )
}
