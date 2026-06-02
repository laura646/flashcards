'use client'

// Teacher-facing view of one student's dialogue practice session.
// Used in both:
//   1. The Reports → student detail "Dialogue practice" section, and
//   2. The lesson editor → Dialogue block → "View student chats" modal.
//
// Fetches /api/dialogue?action=report&blockId=…&studentEmail=… and renders
// transcript + words-used pills + AI corrections list + a "Mark as
// reviewed" toggle.

import { useEffect, useState } from 'react'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  words_used: string[] | null
  corrections: { original: string; correct: string; why?: string }[] | null
  created_at: string
}

interface Report {
  messages: Msg[]
  words_used: string[]
  corrections: { original: string; correct: string; why?: string; at: string }[]
  reviewed: boolean
  reviewed_by: string | null
  reviewed_at: string | null
}

interface Props {
  blockId: string
  studentEmail: string
  studentName?: string
  targetWords?: string[]
  onClose?: () => void
}

export default function DialogueSessionReview({ blockId, studentEmail, studentName, targetWords, onClose }: Props) {
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingReview, setSavingReview] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/dialogue?action=report&blockId=${encodeURIComponent(blockId)}&studentEmail=${encodeURIComponent(studentEmail)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [blockId, studentEmail])

  const toggleReviewed = async () => {
    if (!data) return
    setSavingReview(true)
    try {
      const res = await fetch('/api/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-reviewed', blockId, studentEmail, reviewed: !data.reviewed }),
      })
      if (res.ok) {
        setData({ ...data, reviewed: !data.reviewed })
      }
    } catch { /* ignore */ }
    setSavingReview(false)
  }

  if (loading) return <p className="text-xs text-gray-400 py-6 text-center">Loading session…</p>
  if (!data) return <p className="text-xs text-gray-400 py-6 text-center">Could not load session.</p>

  const wordsTotal = (targetWords || []).length

  return (
    <div className="space-y-4">
      {/* Header — student + reviewed toggle */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#e6f0fa]">
        <div>
          <p className="text-xs font-bold text-[#46464b]">{studentName || studentEmail}</p>
          {studentName && <p className="text-[10px] text-gray-400">{studentEmail}</p>}
        </div>
        <button
          onClick={toggleReviewed}
          disabled={savingReview}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
            data.reviewed
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'bg-white text-[#416ebe] border-[#cddcf0] hover:bg-[#f7fafd]'
          } disabled:opacity-50`}
          title={data.reviewed ? 'Reviewed — click to mark not reviewed' : 'Click to mark reviewed'}
        >
          {data.reviewed ? '✓ Reviewed' : 'Mark reviewed'}
        </button>
      </div>

      {/* Words used */}
      {wordsTotal > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Target words used{' '}
            <span className="text-[#416ebe]">{data.words_used.length} / {wordsTotal}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(targetWords || []).map((w) => {
              const used = data.words_used.some((u) => u.toLowerCase() === w.toLowerCase())
              return (
                <span key={w} className={`text-xs px-2.5 py-1 rounded-full font-medium ${used ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  {used && '✓ '}{w}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Corrections list */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
          AI corrections <span className="text-[#416ebe]">{data.corrections.length}</span>
        </p>
        {data.corrections.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No corrections during this session.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.corrections.map((c, i) => (
              <li key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                <div>
                  <span className="text-red-500 line-through mr-1">{c.original}</span>
                  <span className="text-gray-400 mx-1">→</span>
                  <span className="text-green-700 font-medium ml-1">{c.correct}</span>
                </div>
                {c.why && <p className="text-[11px] text-amber-700 mt-0.5">{c.why}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transcript */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Transcript</p>
        <div className="space-y-1.5 max-h-72 overflow-y-auto bg-[#f7fafd] rounded-lg p-2 border border-[#e6f0fa]">
          {data.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${m.role === 'user' ? 'bg-[#416ebe] text-white' : 'bg-white border border-[#cddcf0] text-[#46464b]'}`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {onClose && (
        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
        </div>
      )}
    </div>
  )
}
