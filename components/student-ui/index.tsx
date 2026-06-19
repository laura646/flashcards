'use client'

// ── Student-app "10B" universal component kit ──
//
// Reusable primitives that match the design handoff in
// design_handoff_student_app/. Used by every student-facing screen
// rebuilt under Phase A onwards. Admin screens import nothing from
// here — they keep their existing components/colours.
//
// Why one file: this is a tight set of small components that share
// tokens. Splitting them is overhead for little gain; if anything
// grows past ~80 lines (e.g. AudioCircle with full equalizer state),
// we'll lift it out.

import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, useState } from 'react'

// ════════════════════════════════════════════════════════════════
// Buttons
// ════════════════════════════════════════════════════════════════

type BtnVariant = 'primary' | 'secondary' | 'neutral' | 'check' | 'textLink' | 'onHeroWhite' | 'translucent'

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', fullWidth, className = '', children, disabled, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center font-extrabold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-sky/40 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'text-[12px] px-3 py-2 rounded-tile gap-1',
    md: 'text-sm px-5 py-3 rounded-tile gap-1.5',
    lg: 'text-[15px] px-6 py-3.5 rounded-tile gap-2',
  }
  const variants: Record<BtnVariant, string> = {
    primary:      'bg-sky text-white hover:bg-[#0099d6] disabled:opacity-45',
    secondary:    'bg-white text-sky-dark border-[1.5px] border-sky-border hover:border-sky disabled:opacity-45',
    neutral:      'bg-[#f4f5f7] text-ink-body hover:bg-[#ebeef2] disabled:opacity-45',
    check:        'bg-sky text-white text-[12px] !px-3 !py-1.5 rounded-tile font-extrabold',
    textLink:     'text-sky bg-transparent !p-0 hover:underline disabled:opacity-45',
    onHeroWhite:  'bg-white text-ink-body hover:bg-white/95 disabled:opacity-45',
    translucent:  'bg-white/20 text-white border border-white/35 hover:bg-white/30 disabled:opacity-45',
  }
  return (
    <button
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
// Pills / badges
// ════════════════════════════════════════════════════════════════

type PillVariant = 'status' | 'level' | 'lesson' | 'streak' | 'correct' | 'incorrect' | 'wash'

export function Pill({ variant = 'wash', children, className = '' }: { variant?: PillVariant; children: ReactNode; className?: string }) {
  const styles: Record<PillVariant, string> = {
    status:    'bg-sky text-white',
    level:     'bg-sky-wash text-ink-body',
    lesson:    'bg-sky text-white',
    streak:    'bg-streak-fill text-streak-ink',
    correct:   'bg-correct-bg text-correct-fg border border-correct-border',
    incorrect: 'bg-incorrect-bg text-incorrect-fg border border-incorrect-border',
    wash:      'bg-sky-wash text-ink-body',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[variant]} ${className}`}>
      {children}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════
// Eyebrow (uppercase 11-12px label above content)
// ════════════════════════════════════════════════════════════════

export function Eyebrow({ tone = 'sky', children, className = '' }: { tone?: 'sky' | 'brand'; children: ReactNode; className?: string }) {
  const color = tone === 'sky' ? 'text-sky' : 'text-brandblue'
  return (
    <span className={`text-[11px] font-extrabold uppercase tracking-eyebrow ${color} ${className}`}>
      {children}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════
// Card (hairline-bordered white surface)
// ════════════════════════════════════════════════════════════════

export function Card({ children, className = '', padding = 'md' }: { children: ReactNode; className?: string; padding?: 'sm' | 'md' | 'lg' }) {
  const pad = padding === 'sm' ? 'p-[15px]' : padding === 'lg' ? 'p-6' : 'p-[18px]'
  return (
    <div className={`bg-white rounded-card border border-hairline ${pad} ${className}`}>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Input (eyebrow label + textfield with focused state)
// ════════════════════════════════════════════════════════════════

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  className?: string
  required?: boolean
}

export function TextField({ label, required, className = '', ...rest }: InputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <label className={`block ${className}`}>
      <span className={`block text-[11px] font-extrabold uppercase tracking-eyebrow mb-1.5 ${focused ? 'text-sky' : 'text-ink-muted'}`}>
        {label}{required && <span className="text-incorrect-fg ml-0.5">*</span>}
      </span>
      <input
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e) }}
        className={`w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] focus:outline-none transition-colors ${focused ? 'border-[1.5px] border-sky' : 'border-[1.5px] border-[#e3e5e9]'}`}
        {...rest}
      />
    </label>
  )
}

// ════════════════════════════════════════════════════════════════
// SegmentedControl (sky-wash track + white active pill)
// ════════════════════════════════════════════════════════════════

interface Segment<T extends string> {
  value: T
  label: string
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className = '',
}: {
  segments: Segment<T>[]
  value: T
  onChange: (next: T) => void
  className?: string
}) {
  return (
    <div className={`inline-flex bg-sky-wash rounded-full p-1 ${className}`}>
      {segments.map((s) => {
        const active = s.value === value
        return (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`px-4 py-1.5 text-[13px] font-bold rounded-full transition-all ${
              active
                ? 'bg-white text-brandblue shadow-[0_1px_2px_rgba(15,22,40,0.08)]'
                : 'text-ink-body hover:text-ink-black'
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ProgressBar (thin track, sky fill, animates to value)
// ════════════════════════════════════════════════════════════════

export function ProgressBar({ value, total, className = '', height = 'h-1.5' }: { value: number; total: number; className?: string; height?: string }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0
  return (
    <div className={`w-full ${height} bg-[#eef1f6] rounded-full overflow-hidden ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}>
      <div
        className={`${height} bg-sky rounded-full transition-[width] duration-700 ease-in-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// Segmented progress — used by Lesson detail's "1 / 3" tri-bar.
export function SegmentedProgress({ filled, total, className = '' }: { filled: number; total: number; className?: string }) {
  return (
    <div
      className={`flex gap-1.5 ${className}`}
      role="progressbar"
      aria-valuenow={filled}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Step ${filled} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 h-1.5 rounded-full transition-colors ${i < filled ? 'bg-sky' : 'bg-[#eef1f6]'}`}
        />
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// AudioCircle — outlined circle with speaker icon; "playing" plays
// the locked 4-bar equalizer animation.
// ════════════════════════════════════════════════════════════════

export function AudioCircle({ playing = false, onClick, size = 36, ariaLabel = 'Play audio' }: { playing?: boolean; onClick?: () => void; size?: number; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
      className="inline-flex items-center justify-center rounded-full bg-sky-wash border-[1.5px] border-sky-border text-sky hover:border-sky transition-colors"
    >
      {playing ? (
        <span className="flex items-end gap-[2px] h-[14px]">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="w-[2.5px] bg-sky rounded-full animate-eq"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
// Spaced-repetition rating row (Again / Hard / Good / Easy)
// ════════════════════════════════════════════════════════════════

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export function RatingRow({ onRate, captions }: { onRate: (r: Rating) => void; captions?: Partial<Record<Rating, string>> }) {
  const buttons: { value: Rating; label: string; classes: string; caption: string }[] = [
    { value: 'again', label: 'Again', classes: 'bg-rating-again-bg text-rating-again-fg', caption: captions?.again || '<1min' },
    { value: 'hard',  label: 'Hard',  classes: 'bg-rating-hard-bg text-rating-hard-fg',  caption: captions?.hard  || '5min'  },
    { value: 'good',  label: 'Good',  classes: 'bg-sky-wash text-sky-dark',              caption: captions?.good  || '10min' },
    { value: 'easy',  label: 'Easy',  classes: 'bg-sky text-white',                      caption: captions?.easy  || '4 days' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {buttons.map((b) => (
        <button
          key={b.value}
          onClick={() => onRate(b.value)}
          className={`flex flex-col items-center justify-center rounded-tile py-2.5 ${b.classes} hover:brightness-95 transition-all`}
        >
          <span className="text-[13px] font-extrabold leading-none">{b.label}</span>
          <span className="text-[10px] font-semibold opacity-80 mt-1 leading-none">{b.caption}</span>
        </button>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// True / False (two equal outline buttons, with answered states)
// ════════════════════════════════════════════════════════════════

export function TrueFalseChoice({
  answered,
  selected,
  correct,
  onPick,
}: {
  answered?: boolean
  selected?: boolean | null
  correct?: boolean
  onPick: (v: boolean) => void
}) {
  const stateFor = (v: boolean) => {
    if (!answered) return 'bg-white border-sky-border text-ink-body hover:border-sky'
    if (selected === v && v === correct) return 'bg-correct-bg border-correct-border text-correct-fg'
    if (selected === v && v !== correct) return 'bg-incorrect-bg border-incorrect-border text-incorrect-fg'
    if (v === correct) return 'bg-correct-bg/60 border-correct-border text-correct-fg'
    return 'bg-white border-hairline text-ink-muted opacity-60'
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          disabled={answered}
          onClick={() => onPick(v)}
          className={`py-3 rounded-tile border-[1.5px] text-sm font-bold transition-colors ${stateFor(v)}`}
        >
          {v ? 'True' : 'False'}
        </button>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Sky hero band (used by Home + Loading)
// ════════════════════════════════════════════════════════════════

export function SkyHero({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-sky text-white px-5 pt-5 pb-6 ${className}`}>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Async states — Skeleton / Spinner / EmptyState / InlineError
// Wave 0 addition: the kit had no shared loading/empty/error states, so
// every screen invented its own (grey skeletons, bare spinners, native
// alert()). AI generation + audio waits make these non-optional. Use
// these instead of ad-hoc states so the teacher side feels native.
// ════════════════════════════════════════════════════════════════

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-hairline rounded-tile ${className}`} />
}

export function Spinner({ size = 20, label = 'Loading…', className = '' }: { size?: number; label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={`inline-flex ${className}`}>
      <span
        className="block animate-spin rounded-full border-2 border-sky-border border-t-sky"
        style={{ width: size, height: size }}
      />
    </span>
  )
}

export function EmptyState({ icon, title, hint, action, className = '' }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-6 ${className}`}>
      {icon && <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>}
      <p className="text-sm font-bold text-ink-body">{title}</p>
      {hint && <p className="text-xs text-ink-muted mt-1 max-w-xs leading-relaxed">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function InlineError({ message, onRetry, className = '' }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={`flex items-center justify-between gap-3 bg-incorrect-bg border border-incorrect-border rounded-tile px-3.5 py-2.5 ${className}`}>
      <span className="text-xs font-medium text-incorrect-fg">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-extrabold text-incorrect-fg underline shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-incorrect-fg/40 rounded">
          Retry
        </button>
      )}
    </div>
  )
}
