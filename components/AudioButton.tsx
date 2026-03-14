'use client'

import { useState } from 'react'

interface Props {
  text: string
}

export default function AudioButton({ text }: Props) {
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)

  const playAudio = async () => {
    if (loading || playing) return
    setLoading(true)
    try {
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('Audio failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      setLoading(false)
      setPlaying(true)
      audio.onended = () => {
        setPlaying(false)
        URL.revokeObjectURL(url)
      }
      audio.play()
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={playAudio}
      disabled={loading || playing}
      title="Listen to pronunciation"
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all ${
        playing
          ? 'bg-[#416ebe] border-[#416ebe] text-white'
          : 'bg-white border-[#cddcf0] text-[#416ebe] hover:border-[#416ebe]'
      } disabled:opacity-50`}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : playing ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  )
}
