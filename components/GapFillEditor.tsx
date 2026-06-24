'use client'

// ── Gap-fill editor (one umbrella exercise, three render modes) ──
//
// Authors the SINGLE-element questions array (questions[0]) consumed by
// GapFillRunner. See lib/lesson-editor/types.ts GapFillQuestion for the shape.
// Wired into ExerciseEditor's registry with dataKey 'questions', so it receives
// { questions, onChange } exactly like OddOneOutEditor / the other per-type
// editors. We read cfg = questions[0] and always emit a fresh one-element array.
//
// Authoring flow:
//   1. Mode selector — Open cloze / Word bank / Dropdown (sky pill segmented).
//   2. Paragraph textarea (cfg.text) where the teacher writes the story.
//   3. "Click a word to make it a gap" — a live preview of the paragraph as
//      clickable word chips. Clicking a plain word turns it into a gap (inserts a
//      {{gId}} placeholder in text + adds a gap whose first answer is that word).
//      Clicking a gap chip removes it (restores the word). text + gaps stay in
//      sync at all times.
//   4. Per-gap rows — edit accepted answers (comma field); for DROPDOWN also edit
//      the wrong options for that gap.
//   5. Word-bank mode — a distractor-words field (extra wrong tiles).
//   6. Open mode — a "Require exact spelling" checkbox (cfg.require_exact).
//
// 10B/EwL kit: font-rubik, sky tokens, rounded cards. Mirrors the token classes
// used across the other editors (sky / sky-wash / sky-border / ink-*).

import { useMemo } from 'react'
import type { GapFillMode, GapFillGap, GapFillQuestion } from '@/lib/lesson-editor/types'

interface Props {
  questions: GapFillQuestion[]
  onChange: (questions: GapFillQuestion[]) => void
}

const MODES: { value: GapFillMode; label: string; hint: string }[] = [
  { value: 'open', label: 'Open cloze', hint: 'Student types the missing word.' },
  { value: 'word_bank', label: 'Word bank', hint: 'Student drags/taps words from a shared bank.' },
  { value: 'dropdown', label: 'Dropdown', hint: 'Student picks from a list at each gap.' },
]

// Canonical empty config — matches defaultDataForType('gap_fill').
function emptyCfg(): GapFillQuestion {
  return { mode: 'open', text: '', gaps: [], distractors: [], require_exact: false }
}

// Split a paragraph into render tokens: a "word" run (with its char span) or a
// whitespace run. Words keep their surrounding punctuation off so the chip shows
// just the lexical core, but we splice the placeholder back at the exact span so
// punctuation is preserved in `text`.
type Token =
  | { type: 'space'; value: string }
  | { type: 'gap'; gapId: string; start: number; end: number }
  | { type: 'word'; value: string; lead: string; core: string; trail: string; start: number; end: number }

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  // Match either a {{gapId}} placeholder, a run of whitespace, or a run of
  // non-whitespace ("word").
  const regex = /(\{\{(\w+)\}\})|(\s+)|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    const start = m.index
    const end = regex.lastIndex
    if (m[1]) {
      tokens.push({ type: 'gap', gapId: m[2], start, end })
    } else if (m[3]) {
      tokens.push({ type: 'space', value: m[3] })
    } else {
      const raw = m[4]
      // Peel leading / trailing punctuation so the gap answer is the clean word.
      // "Word char" here = letters, digits, apostrophes and hyphens (e.g. don't,
      // well-known). Everything else at the edges is treated as punctuation.
      const lead = raw.match(/^[^A-Za-z0-9]*/)?.[0] ?? ''
      const trail = raw.match(/[^A-Za-z0-9]*$/)?.[0] ?? ''
      const core = raw.slice(lead.length, raw.length - trail.length)
      tokens.push({ type: 'word', value: raw, lead, core, trail, start, end })
    }
  }
  return tokens
}

// Allocate the next free gap id (g1, g2, …) not already used in `gaps`.
function nextGapId(gaps: GapFillGap[]): string {
  const used = new Set(gaps.map((g) => g.id))
  let n = 1
  while (used.has(`g${n}`)) n++
  return `g${n}`
}

export default function GapFillEditor({ questions, onChange }: Props) {
  // Always work from a normalized single-element config.
  const cfg: GapFillQuestion =
    Array.isArray(questions) && questions[0]
      ? { ...emptyCfg(), ...questions[0] }
      : emptyCfg()

  const emit = (patch: Partial<GapFillQuestion>) => {
    onChange([{ ...cfg, ...patch }])
  }

  const tokens = useMemo(() => tokenize(cfg.text), [cfg.text])

  // ── Mode ──
  const setMode = (mode: GapFillMode) => emit({ mode })

  // ── Paragraph text ──
  const setText = (text: string) => {
    // Keep gaps in sync with placeholders still present in the new text. Drop any
    // gap whose {{id}} placeholder was deleted by hand.
    const present = new Set<string>()
    const re = /\{\{(\w+)\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) present.add(m[1])
    const gaps = cfg.gaps.filter((g) => present.has(g.id))
    emit({ text, gaps })
  }

  // ── Click-word → toggle gap ──
  const turnWordIntoGap = (tok: Extract<Token, { type: 'word' }>) => {
    if (!tok.core) return
    const id = nextGapId(cfg.gaps)
    // Replace the word's core in text with {{id}}, preserving punctuation.
    const before = cfg.text.slice(0, tok.start)
    const after = cfg.text.slice(tok.end)
    const newText = `${before}${tok.lead}{{${id}}}${tok.trail}${after}`
    const newGap: GapFillGap = {
      id,
      answers: [tok.core],
      ...(cfg.mode === 'dropdown' ? { options: [tok.core] } : {}),
    }
    onChange([{ ...cfg, text: newText, gaps: [...cfg.gaps, newGap] }])
  }

  const removeGap = (gapId: string) => {
    // Restore the word: replace {{id}} with the gap's canonical answer.
    const g = cfg.gaps.find((x) => x.id === gapId)
    const restored = g?.answers[0] ?? ''
    const newText = cfg.text.replace(`{{${gapId}}}`, restored)
    const gaps = cfg.gaps.filter((x) => x.id !== gapId)
    onChange([{ ...cfg, text: newText, gaps }])
  }

  // ── Per-gap field edits ──
  const updateGap = (gapId: string, updates: Partial<GapFillGap>) => {
    const gaps = cfg.gaps.map((g) => (g.id === gapId ? { ...g, ...updates } : g))
    emit({ gaps })
  }

  const setGapAnswers = (gapId: string, raw: string) => {
    const answers = raw.split(',').map((s) => s.trim()).filter(Boolean)
    updateGap(gapId, { answers })
  }

  const setGapOptions = (gapId: string, raw: string) => {
    const options = raw.split(',').map((s) => s.trim()).filter(Boolean)
    updateGap(gapId, { options })
  }

  const setDistractors = (raw: string) => {
    const distractors = raw.split(',').map((s) => s.trim()).filter(Boolean)
    emit({ distractors })
  }

  const activeMode = MODES.find((m) => m.value === cfg.mode) ?? MODES[0]

  return (
    <div className="font-rubik space-y-4">
      {/* ── Mode selector (sky pill segmented) ── */}
      <div>
        <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1.5">
          Mode
        </label>
        <div className="inline-flex rounded-full bg-sky-wash border border-sky-border p-1 gap-1">
          {MODES.map((m) => {
            const active = cfg.mode === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-colors ${
                  active ? 'bg-sky text-white shadow-sm' : 'text-sky-text hover:bg-white/60'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-ink-muted mt-1.5">{activeMode.hint}</p>
      </div>

      {/* ── Paragraph text ── */}
      <div>
        <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1">
          Paragraph
        </label>
        <textarea
          value={cfg.text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write the story here, then click words below to turn them into gaps."
          className="w-full h-28 px-3 py-2.5 text-sm text-ink-body bg-white border border-sky-border rounded-xl focus:outline-none focus:border-sky resize-y placeholder:text-[#b6bac2]"
        />
        <p className="text-[10px] text-ink-muted mt-1">
          You can also type <code className="font-mono">{'{{g1}}'}</code> placeholders by hand — deleting one removes its gap.
        </p>
      </div>

      {/* ── Click-word preview ── */}
      <div>
        <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1.5">
          Click a word to make it a gap
        </label>
        {cfg.text.trim() === '' ? (
          <div className="text-xs text-ink-muted italic bg-surface border border-hairline rounded-xl px-3 py-3">
            Write a paragraph above, then click words here to gap them.
          </div>
        ) : (
          <div className="bg-surface border border-hairline rounded-xl px-3 py-3 leading-loose text-sm text-ink-body">
            {tokens.map((tok, i) => {
              if (tok.type === 'space') return <span key={i}>{tok.value}</span>
              if (tok.type === 'gap') {
                const g = cfg.gaps.find((x) => x.id === tok.gapId)
                const label = g?.answers[0] || tok.gapId
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => removeGap(tok.gapId)}
                    title="Click to remove this gap"
                    className="inline-flex items-center gap-1 align-baseline px-2 py-0.5 mx-0.5 rounded-md bg-sky text-white text-xs font-bold hover:bg-[#0098d4] transition-colors"
                  >
                    {label}
                    <span className="opacity-80">✕</span>
                  </button>
                )
              }
              // plain word
              return (
                <span key={i}>
                  {tok.lead}
                  <button
                    type="button"
                    onClick={() => turnWordIntoGap(tok)}
                    title="Click to make this word a gap"
                    className="rounded-md px-0.5 hover:bg-sky-wash hover:text-sky-text transition-colors cursor-pointer"
                  >
                    {tok.core}
                  </button>
                  {tok.trail}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Per-gap rows ── */}
      {cfg.gaps.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1.5">
            Gaps ({cfg.gaps.length})
          </label>
          <div className="space-y-2">
            {cfg.gaps.map((g, i) => (
              <div
                key={g.id}
                className="bg-[#f5f8fc] border border-[#e6f0fa] rounded-xl px-3 py-2.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-sky-text bg-sky-wash border border-sky-border rounded px-1.5 py-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold text-ink-body flex-1 truncate">
                    {g.answers[0] || <span className="text-gray-300 italic">empty gap</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeGap(g.id)}
                    className="text-gray-300 hover:text-red-400 text-xs p-1"
                    title="Remove gap"
                  >
                    ✕
                  </button>
                </div>

                {/* Accepted answers */}
                <div>
                  <label className="block text-[9px] font-bold text-ink-muted uppercase mb-0.5">
                    Accepted answers (comma-separated; first is canonical)
                  </label>
                  <input
                    type="text"
                    value={g.answers.join(', ')}
                    onChange={(e) => setGapAnswers(g.id, e.target.value)}
                    placeholder="went, travelled"
                    className="w-full px-2.5 py-1.5 text-xs text-ink-body bg-white border border-[#cddcf0] rounded-lg focus:outline-none focus:border-sky placeholder:text-[#b6bac2]"
                  />
                </div>

                {/* Dropdown options (dropdown mode only) */}
                {cfg.mode === 'dropdown' && (
                  <div>
                    <label className="block text-[9px] font-bold text-ink-muted uppercase mb-0.5">
                      Choices for this gap (include the correct answer + wrong options)
                    </label>
                    <input
                      type="text"
                      value={(g.options || []).join(', ')}
                      onChange={(e) => setGapOptions(g.id, e.target.value)}
                      placeholder="went, go, gone, going"
                      className="w-full px-2.5 py-1.5 text-xs text-ink-body bg-white border border-[#cddcf0] rounded-lg focus:outline-none focus:border-sky placeholder:text-[#b6bac2]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Word-bank distractors ── */}
      {cfg.mode === 'word_bank' && (
        <div>
          <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wide mb-1">
            Distractor words (extra wrong tiles in the bank)
          </label>
          <input
            type="text"
            value={(cfg.distractors || []).join(', ')}
            onChange={(e) => setDistractors(e.target.value)}
            placeholder="drove, ate"
            className="w-full px-3 py-2 text-sm text-ink-body bg-white border border-sky-border rounded-xl focus:outline-none focus:border-sky placeholder:text-[#b6bac2]"
          />
          <p className="text-[10px] text-ink-muted mt-1">
            The bank shows one correct word per gap plus these distractors, shuffled.
          </p>
        </div>
      )}

      {/* ── Require exact spelling (open mode only) ── */}
      {cfg.mode === 'open' && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!cfg.require_exact}
            onChange={(e) => emit({ require_exact: e.target.checked })}
            className="w-4 h-4 accent-sky"
          />
          <span className="text-xs font-medium text-ink-body">
            Require exact spelling (no typo tolerance)
          </span>
        </label>
      )}
    </div>
  )
}
