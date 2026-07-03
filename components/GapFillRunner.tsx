'use client'

// ── Gap-fill runner (one umbrella exercise, three modes) ──
//
// Faithful port of the approved prototype. The exercise's whole config lives in
// questions[0] (see lib/lesson-editor/types.ts GapFillQuestion). The mode is
// FIXED to cfg.mode — there is NO student-facing mode switcher. The same
// paragraph (`cfg.text`, with {{gapId}} placeholders) is rendered with a
// per-mode control swapped in for each gap, so all three modes share one card.
//
// All gap controls share ONE slim geometry (BLANK_H height, box-sizing border-box,
// vertical-align middle, ~7px radius, 1px sky-border, 15px font) so the three
// modes line up inside running text.
//
// 10B/EwL kit: font-rubik, sky tokens, correct green / wrong red. Chrome
// (eyebrow, title, Check button) uses tokens; the precise inline-blank geometry
// uses inline styles because it must match across <input>, <button> and <span>.

import { useMemo, useRef, useState } from 'react'

// ── Tokens (kept literal so the geometry is exact across element types) ──
const SKY = '#00aff0'
const SKY_TEXT = '#0076a8'
const SKY_WASH = '#e6f6fe'
const SKY_BORDER = '#cfeafb'
const INK_BODY = '#46464b'
const INK_MUTED = '#6b7280'
const CORRECT_FG = '#15803d'
const CORRECT_BG = '#e7f7ee'
const WRONG_FG = '#dc2626'
const WRONG_BG = '#fdeaea'

const BLANK_H = 28 // px — shared height for every gap control

// Base style every inline gap control shares so the three modes line up.
const blankBase: React.CSSProperties = {
  height: BLANK_H,
  boxSizing: 'border-box',
  verticalAlign: 'middle',
  borderRadius: 7,
  border: `1px solid ${SKY_BORDER}`,
  fontSize: 15,
  fontFamily: 'inherit',
  lineHeight: `${BLANK_H - 2}px`,
  padding: '0 8px',
  margin: '0 2px',
}

// ── Config shape (mirrors GapFillQuestion in lib/lesson-editor/types.ts) ──
interface GapCfg {
  id: string
  answers: string[]
  options?: string[]
}
interface GapFillCfg {
  mode: 'open' | 'word_bank' | 'dropdown'
  text: string
  gaps: GapCfg[]
  distractors?: string[]
  require_exact?: boolean
}

interface Props {
  exercise: {
    title: string
    instructions: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    questions: any
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

// ── Helpers ──

type TextPart = { type: 'text'; value: string } | { type: 'gap'; gapId: string }

function parseText(text: string): TextPart[] {
  const parts: TextPart[] = []
  const regex = /\{\{(\w+)\}\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'gap', gapId: match[1] })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return parts
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

// Levenshtein distance (iterative, two-row). Used for open-mode typo tolerance.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

// Forgiving open-mode match: case-insensitive + trimmed + (unless requireExact)
// Levenshtein <= 1 against ANY accepted answer.
function openMatches(value: string, answers: string[], requireExact: boolean): boolean {
  const v = norm(value)
  if (!v) return false
  return answers.some((ans) => {
    const a = norm(ans)
    if (v === a) return true
    if (requireExact) return false
    return levenshtein(v, a) <= 1
  })
}

// Exact-pick match (word_bank / dropdown): case-insensitive + trimmed equality
// against ANY accepted answer.
function pickMatches(value: string | null, answers: string[]): boolean {
  if (value == null) return false
  const v = norm(value)
  return answers.some((ans) => norm(ans) === v)
}

// Deterministic-ish shuffle (Fisher-Yates with Math.random — render-time only).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function GapFillRunner({ exercise, onComplete, onBack }: Props) {
  const cfg: GapFillCfg | undefined = Array.isArray(exercise.questions)
    ? exercise.questions[0]
    : undefined

  const gaps: GapCfg[] = cfg?.gaps || []
  const mode = cfg?.mode || 'open'
  const total = gaps.length

  // Per-gap student input. open/dropdown: gap.id -> string. word_bank: gap.id ->
  // placed tile word (or undefined when empty).
  const [values, setValues] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)

  // word_bank: which tile is currently "armed" for tap-to-place (touch flow).
  const [armedTile, setArmedTile] = useState<string | null>(null)
  // dropdown: which gap's popup list is open.
  const [openGap, setOpenGap] = useState<string | null>(null)

  // The bank tiles (word_bank): one canonical answer per gap + distractors,
  // shuffled once. Identity is index-based so duplicate words stay distinct.
  const bankTiles = useMemo(() => {
    if (mode !== 'word_bank') return [] as { key: string; word: string }[]
    const fromGaps = gaps.map((g) => g.answers[0] ?? '')
    const distractors = cfg?.distractors || []
    const all = [...fromGaps, ...distractors].filter((w) => w !== '')
    return shuffle(all.map((word, i) => ({ key: `t${i}`, word })))
    // shuffle once on mount per mode/config
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Per-gap dropdown options, shuffled once.
  const dropdownOptions = useMemo(() => {
    if (mode !== 'dropdown') return {} as Record<string, string[]>
    const map: Record<string, string[]> = {}
    for (const g of gaps) {
      let opts = (g.options ?? []).filter(Boolean)
      // Fallback for exercises saved without per-gap options (mode switched after
      // authoring, AI/seeded configs, pre-fix content): fall back to the answers so
      // the dropdown is never empty.
      if (opts.length === 0) opts = (g.answers ?? []).filter(Boolean)
      // Guarantee the correct answer is always selectable, even if a teacher's
      // options list accidentally omits it.
      const answer = (g.answers ?? []).find(Boolean)
      if (answer && !opts.some((o) => o.toLowerCase() === answer.toLowerCase())) {
        opts = [...opts, answer]
      }
      map[g.id] = shuffle(opts)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // word_bank: which bank-tile key is placed in which gap.
  const [placedByGap, setPlacedByGap] = useState<Record<string, string>>({}) // gapId -> tileKey
  const placedKeys = useMemo(() => new Set(Object.values(placedByGap)), [placedByGap])

  const parts = useMemo(() => parseText(cfg?.text || ''), [cfg?.text])

  const dragKey = useRef<string | null>(null) // desktop HTML5 drag payload

  if (!cfg || total === 0) {
    return <div className="text-center py-8 text-sm text-ink-muted">No gaps in this exercise.</div>
  }

  const isCorrectGap = (g: GapCfg): boolean => {
    if (mode === 'open') return openMatches(values[g.id] || '', g.answers, !!cfg.require_exact)
    if (mode === 'dropdown') return pickMatches(values[g.id] ?? null, g.answers)
    // word_bank
    const tileKey = placedByGap[g.id]
    const word = bankTiles.find((t) => t.key === tileKey)?.word ?? null
    return pickMatches(word, g.answers)
  }

  const handleCheck = () => {
    if (checked) return
    const correct = gaps.filter((g) => isCorrectGap(g)).length
    setScore(correct)
    setChecked(true)
    setOpenGap(null)
    setArmedTile(null)
    onComplete(correct, total)
  }

  const handleReset = () => {
    setValues({})
    setPlacedByGap({})
    setChecked(false)
    setScore(0)
    setArmedTile(null)
    setOpenGap(null)
  }

  // ── word_bank placement helpers ──
  const placeTile = (gapId: string, tileKey: string) => {
    if (checked) return
    setPlacedByGap((prev) => {
      const next: Record<string, string> = {}
      // Remove this tile from any other slot (one tile per slot, one slot per tile).
      for (const [gid, tk] of Object.entries(prev)) {
        if (tk === tileKey) continue
        if (gid === gapId) continue
        next[gid] = tk
      }
      next[gapId] = tileKey
      return next
    })
    setArmedTile(null)
  }

  const clearSlot = (gapId: string) => {
    if (checked) return
    setPlacedByGap((prev) => {
      const next = { ...prev }
      delete next[gapId]
      return next
    })
  }

  const onTileTap = (tileKey: string) => {
    if (checked || placedKeys.has(tileKey)) return
    setArmedTile((cur) => (cur === tileKey ? null : tileKey))
  }

  const onSlotTap = (gapId: string) => {
    if (checked) return
    if (placedByGap[gapId]) {
      clearSlot(gapId) // tapping a filled slot returns its tile
      return
    }
    if (armedTile) placeTile(gapId, armedTile)
  }

  // ── Per-mode gap renderer ──
  const renderGap = (gapId: string, idx: number) => {
    const g = gaps.find((x) => x.id === gapId)
    if (!g) {
      // Unknown placeholder — render literally so the teacher notices.
      return <span key={`u-${idx}`} style={{ color: INK_MUTED }}>{`{{${gapId}}}`}</span>
    }
    const correct = checked && isCorrectGap(g)
    const wrong = checked && !correct

    const stateStyle: React.CSSProperties = checked
      ? correct
        ? { border: `1px solid ${CORRECT_FG}`, background: CORRECT_BG, color: CORRECT_FG }
        : { border: `1px solid ${WRONG_FG}`, background: WRONG_BG, color: WRONG_FG }
      : {}

    // Correct answer shown beside each WRONG gap.
    const answerHint = wrong ? (
      <span key={`a-${idx}`} style={{ color: CORRECT_FG, fontSize: 13, fontWeight: 700, margin: '0 2px' }}>
        {g.answers[0]}
      </span>
    ) : null

    if (mode === 'open') {
      return (
        <span key={`g-${idx}`} style={{ whiteSpace: 'nowrap' }}>
          <input
            type="text"
            value={values[g.id] || ''}
            disabled={checked}
            onChange={(e) => setValues((p) => ({ ...p, [g.id]: e.target.value }))}
            aria-label={`Gap ${idx + 1}`}
            style={{
              ...blankBase,
              ...stateStyle,
              width: 96,
              outline: 'none',
              color: checked ? stateStyle.color : INK_BODY,
              background: checked ? stateStyle.background : '#fff',
            }}
          />
          {answerHint}
        </span>
      )
    }

    if (mode === 'dropdown') {
      const opts = dropdownOptions[g.id] || []
      const picked = values[g.id]
      const isOpen = openGap === g.id && !checked
      return (
        <span key={`g-${idx}`} style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
          <button
            type="button"
            disabled={checked}
            onClick={() => setOpenGap((cur) => (cur === g.id ? null : g.id))}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className="gapfill-dropdown-trigger"
            style={{
              ...blankBase,
              ...stateStyle,
              minWidth: 92,
              cursor: checked ? 'default' : 'pointer',
              textAlign: 'left',
              color: checked ? stateStyle.color : picked ? INK_BODY : INK_MUTED,
              background: checked ? stateStyle.background : '#fff',
            }}
          >
            {picked || '   ▾'}
          </button>
          {isOpen && (
            <span
              role="listbox"
              style={{
                position: 'absolute',
                top: BLANK_H + 4,
                left: 0,
                zIndex: 20,
                minWidth: 120,
                background: '#fff',
                border: `1px solid ${SKY_BORDER}`,
                borderRadius: 10,
                boxShadow: '0 6px 20px rgba(15,22,40,0.12)',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {opts.map((opt, oi) => (
                <button
                  key={oi}
                  type="button"
                  role="option"
                  aria-selected={picked === opt}
                  onClick={() => {
                    setValues((p) => ({ ...p, [g.id]: opt }))
                    setOpenGap(null)
                  }}
                  className="gapfill-option"
                  style={{
                    textAlign: 'left',
                    fontSize: 14,
                    padding: '7px 10px',
                    borderRadius: 7,
                    border: 'none',
                    background: picked === opt ? SKY_WASH : 'transparent',
                    color: INK_BODY,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {opt}
                </button>
              ))}
            </span>
          )}
          {answerHint}
        </span>
      )
    }

    // word_bank
    const tileKey = placedByGap[g.id]
    const placedWord = bankTiles.find((t) => t.key === tileKey)?.word
    return (
      <span key={`g-${idx}`} style={{ whiteSpace: 'nowrap' }}>
        <span
          role="button"
          tabIndex={checked ? -1 : 0}
          aria-label={placedWord ? `Gap ${idx + 1}: ${placedWord} (tap to remove)` : `Gap ${idx + 1}, empty`}
          onClick={() => onSlotTap(g.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSlotTap(g.id)
            }
          }}
          onDragOver={(e) => {
            if (checked) return
            e.preventDefault()
          }}
          onDrop={(e) => {
            if (checked) return
            e.preventDefault()
            const dropped = dragKey.current
            if (dropped) placeTile(g.id, dropped)
            dragKey.current = null
          }}
          style={{
            ...blankBase,
            ...stateStyle,
            display: 'inline-block',
            minWidth: 92,
            textAlign: 'center',
            cursor: checked ? 'default' : 'pointer',
            color: checked ? stateStyle.color : placedWord ? INK_BODY : INK_MUTED,
            background: checked ? stateStyle.background : placedWord ? SKY_WASH : '#fff',
            fontWeight: placedWord ? 600 : 400,
          }}
        >
          {placedWord || '     '}
        </span>
        {answerHint}
      </span>
    )
  }

  // ── Score line ──
  const perfect = checked && score === total
  const instructionLine =
    mode === 'open'
      ? 'Type the missing word in each gap.'
      : mode === 'word_bank'
      ? 'Drag or tap a word into each gap.'
      : 'Choose the correct word for each gap.'

  return (
    <div className="font-rubik flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-ink-muted hover:text-sky transition-colors">
          ← Back
        </button>
      </div>

      {/* Card */}
      <div
        style={{
          background: '#fff',
          border: `1px solid ${SKY_BORDER}`,
          borderRadius: 18,
          padding: 20,
          boxShadow: '0 1px 2px rgba(15,22,40,0.04)',
        }}
      >
        {/* Eyebrow + title */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: SKY,
            marginBottom: 4,
          }}
        >
          Gap-fill
        </p>
        {exercise.title && (
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#15161a', marginBottom: 6 }}>
            {exercise.title}
          </h2>
        )}
        <p style={{ fontSize: 13, color: INK_MUTED, marginBottom: 16 }}>
          {exercise.instructions || instructionLine}
        </p>

        {/* Paragraph with inline gaps */}
        <p style={{ fontSize: 15, lineHeight: 2.1, color: INK_BODY }}>
          {parts.map((part, i) =>
            part.type === 'text' ? (
              <span key={`t-${i}`}>{part.value}</span>
            ) : (
              renderGap(part.gapId, i)
            ),
          )}
        </p>

        {/* word_bank: the bank panel */}
        {mode === 'word_bank' && (
          <div
            style={{
              marginTop: 18,
              background: SKY_WASH,
              border: `1px solid ${SKY_BORDER}`,
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {bankTiles.map((t) => {
              const used = placedKeys.has(t.key)
              const armed = armedTile === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  disabled={checked || used}
                  draggable={!checked && !used}
                  onDragStart={() => {
                    dragKey.current = t.key
                  }}
                  onDragEnd={() => {
                    dragKey.current = null
                  }}
                  onClick={() => onTileTap(t.key)}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: armed ? `1.5px solid ${SKY}` : `1px solid ${SKY_BORDER}`,
                    background: used ? '#eef1f6' : '#fff',
                    color: used ? '#a3a8b3' : SKY_TEXT,
                    textDecoration: used ? 'line-through' : 'none',
                    cursor: checked || used ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: armed ? `0 0 0 3px ${SKY_WASH}` : 'none',
                    transition: 'border-color .15s, box-shadow .15s',
                  }}
                >
                  {t.word}
                </button>
              )
            })}
          </div>
        )}

        {/* Check button + score */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          {!checked ? (
            <button
              type="button"
              onClick={handleCheck}
              style={{
                background: SKY,
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                border: 'none',
                borderRadius: 14,
                padding: '11px 22px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Check
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: '#fff',
                color: SKY_TEXT,
                fontWeight: 800,
                fontSize: 14,
                border: `1.5px solid ${SKY_BORDER}`,
                borderRadius: 14,
                padding: '11px 22px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Try again
            </button>
          )}

          {checked && (
            <span style={{ fontSize: 15, fontWeight: 700, color: perfect ? CORRECT_FG : INK_BODY }}>
              {score} / {total}
              {perfect && <span style={{ marginLeft: 8, color: CORRECT_FG }}>perfect!</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
