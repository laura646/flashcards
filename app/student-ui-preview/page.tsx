'use client'

// Internal smoke-test page for the student-app "10B" UI kit.
// Not linked from anywhere in the app — visit /student-ui-preview
// directly to eyeball every primitive on one screen.
// Delete this file once the redesign ships.

import { useState } from 'react'
import {
  Button,
  Pill,
  Eyebrow,
  Card,
  TextField,
  SegmentedControl,
  ProgressBar,
  SegmentedProgress,
  AudioCircle,
  RatingRow,
  TrueFalseChoice,
  SkyHero,
} from '@/components/student-ui'

export default function StudentUiPreview() {
  const [segment, setSegment] = useState<'flip' | 'self' | 'quiz'>('flip')
  const [playing, setPlaying] = useState(false)
  const [tfAnswered, setTfAnswered] = useState(false)
  const [tfPicked, setTfPicked] = useState<boolean | null>(null)

  return (
    <main className="min-h-screen bg-[#f9fafb] py-10 px-4">
      <div className="max-w-[420px] mx-auto space-y-6">

        {/* Sky hero */}
        <SkyHero className="rounded-card">
          <p className="text-[14px] font-medium opacity-90">Welcome back, Anahit</p>
          <div className="flex items-end justify-between mt-3">
            <div>
              <p className="text-[14px] font-medium opacity-90">Words to review</p>
              <p className="text-[42px] font-extrabold leading-none tracking-hero">210</p>
            </div>
            <Button variant="onHeroWhite">Start review</Button>
          </div>
        </SkyHero>

        {/* Buttons */}
        <Card>
          <Eyebrow>Buttons</Eyebrow>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="neutral">Neutral</Button>
            <Button variant="check" size="sm">Check</Button>
            <Button variant="textLink">Text link →</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
          <div className="mt-3">
            <Button variant="primary" fullWidth>Full-width primary</Button>
          </div>
        </Card>

        {/* Pills */}
        <Card>
          <Eyebrow>Pills</Eyebrow>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <Pill variant="status">New</Pill>
            <Pill variant="lesson">Lesson 9</Pill>
            <Pill variant="level">Beginner</Pill>
            <Pill variant="streak">⚡ 1</Pill>
            <Pill variant="correct">✓ Correct</Pill>
            <Pill variant="incorrect">✕ Wrong</Pill>
            <Pill>33 words</Pill>
          </div>
        </Card>

        {/* Eyebrows */}
        <Card>
          <Eyebrow tone="sky">WORD / MEANING</Eyebrow><br />
          <Eyebrow tone="brand">EXAMPLE / TRUE OR FALSE</Eyebrow>
        </Card>

        {/* Segmented control + progress */}
        <Card>
          <Eyebrow>Segmented control</Eyebrow>
          <div className="mt-3">
            <SegmentedControl
              segments={[
                { value: 'flip', label: 'Flip' },
                { value: 'self', label: 'Self-Assess' },
                { value: 'quiz', label: 'Quiz' },
              ]}
              value={segment}
              onChange={setSegment}
            />
          </div>

          <Eyebrow className="mt-5 block">Progress bar</Eyebrow>
          <div className="mt-2"><ProgressBar value={4} total={7} /></div>
          <p className="mt-1 text-[12px] font-bold text-ink-muted">4 / 7</p>

          <Eyebrow className="mt-5 block">Segmented progress</Eyebrow>
          <div className="mt-2"><SegmentedProgress filled={1} total={3} /></div>
        </Card>

        {/* Audio circle */}
        <Card>
          <Eyebrow>Audio circle</Eyebrow>
          <div className="mt-3 flex items-center gap-4">
            <AudioCircle playing={playing} onClick={() => setPlaying((v) => !v)} />
            <span className="text-[13px] text-ink-muted">Tap to toggle</span>
          </div>
        </Card>

        {/* Input */}
        <Card>
          <Eyebrow>Input</Eyebrow>
          <div className="mt-3 space-y-3">
            <TextField label="Word" placeholder="e.g. mercury" required />
            <TextField label="Phonetic" placeholder="ˈmɜːkjʊri" />
          </div>
        </Card>

        {/* Rating row */}
        <Card>
          <Eyebrow>Spaced-repetition rating</Eyebrow>
          <div className="mt-3"><RatingRow onRate={() => {}} /></div>
        </Card>

        {/* True / False */}
        <Card>
          <Eyebrow>True / False</Eyebrow>
          <p className="mt-3 text-[15px] font-semibold text-ink-black">Mercury is the closest planet to the Sun.</p>
          <div className="mt-3">
            <TrueFalseChoice
              answered={tfAnswered}
              selected={tfPicked}
              correct={true}
              onPick={(v) => { setTfPicked(v); setTfAnswered(true) }}
            />
          </div>
          {tfAnswered && (
            <button onClick={() => { setTfAnswered(false); setTfPicked(null) }} className="mt-3 text-[12px] font-bold text-sky hover:underline">
              Reset
            </button>
          )}
        </Card>

      </div>
    </main>
  )
}
