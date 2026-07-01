'use client'

// Student-app "10B" audio player (brief §8 — Listen & Understand).
// Replaces the native <audio controls> grey bar with: a solid-sky round
// play/pause button, a "0:00 / 0:44" timecode, a sky-wash scrubber with a
// sky fill that's click-to-seek, and a mute toggle. The underlying
// <audio> element does the actual playback (no controls attribute).

import { useRef, useState } from 'react'

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function LessonAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [slow, setSlow] = useState(false)

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) { a.playbackRate = slow ? 0.7 : 1; a.play(); setPlaying(true) }
    else { a.pause(); setPlaying(false) }
  }

  const toggleSlow = () => {
    const next = !slow
    setSlow(next)
    const a = audioRef.current
    if (a) a.playbackRate = next ? 0.7 : 1
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * duration
    setCurrent(a.currentTime)
  }

  const toggleMute = () => {
    const a = audioRef.current
    if (!a) return
    a.muted = !a.muted
    setMuted(a.muted)
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="bg-white border border-hairline rounded-card p-4 flex items-center gap-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />

      {/* Play / pause */}
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className="shrink-0 w-12 h-12 rounded-full bg-sky text-white flex items-center justify-center hover:brightness-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
      >
        {playing ? (
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4h3v12H6zM11 4h3v12h-3z" /></svg>
        ) : (
          <svg className="w-5 h-5 ml-0.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l10 6-10 6z" /></svg>
        )}
      </button>

      {/* Play slower */}
      <button
        onClick={toggleSlow}
        aria-label="Play slower"
        aria-pressed={slow}
        title="Play slower"
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border text-base transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 ${slow ? 'bg-sky border-sky' : 'bg-white border-sky-border hover:border-sky'}`}
      >
        <span aria-hidden="true">🐌</span>
      </button>

      {/* Timecode + scrubber */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-ink-muted tabular-nums">{fmt(current)} / {fmt(duration)}</span>
          <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="text-ink-muted hover:text-sky transition-colors">
            {muted ? (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4L5 7H2v6h3l4 3V4z" /><path d="M13 7l4 6M17 7l-4 6" stroke="currentColor" strokeWidth="1.5" /></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4L5 7H2v6h3l4 3V4z" /><path d="M12.5 7a3.5 3.5 0 010 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            )}
          </button>
        </div>
        <div onClick={seek} className="h-2 bg-sky-wash rounded-full cursor-pointer overflow-hidden" role="slider" aria-label="Seek" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-sky rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
