'use client'

// 10B redesign — COURSE VOCABULARY PICKER (Phase 6, "new beside old"). Task C.
//
// PRESENTATIONAL + CALLBACKS ONLY. Shows every earlier lesson in the course
// (grouped) with its saved flashcard words as toggleable chips. The teacher
// selects words into a local Set and the footer commits them via onAdd. The
// caller (LessonEditorView) owns the fetchCourseVocabulary call + merges the
// chosen words into the active AI form's vocabulary field.
//
// Ported from the legacy vocab-picker modal (app/admin/lessons/page.tsx, the
// openVocabPicker / applyVocabPicker flow), restyled with the 10B kit + tokens.

import { useMemo, useState } from 'react'
import { Button, Spinner } from '@/components/student-ui'

export interface VocabPickerLesson {
  lesson_id: string
  lesson_title: string
  lesson_date: string
  words: string[]
}

interface Props {
  lessons: VocabPickerLesson[]
  loading: boolean
  onClose: () => void
  onAdd: (words: string[]) => void
}

// Formats an ISO date like "Mar 12, 2025"; tolerates empty / bad input.
function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function VocabPickerModal({ lessons, loading, onClose, onAdd }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const toggle = (word: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }

  // Filter words by the search box, dropping any lesson that ends up empty.
  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return lessons
    return lessons
      .map((l) => ({ ...l, words: l.words.filter((w) => w.toLowerCase().includes(q)) }))
      .filter((l) => l.words.length > 0)
  }, [lessons, q])

  const count = selected.size
  const isEmpty = !loading && lessons.length === 0

  const add = () => {
    if (count === 0) return
    onAdd(Array.from(selected))
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-card shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Pick from course vocabulary"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-eyebrow text-sky">
              📚 Course vocabulary
            </p>
            <h3 className="text-base font-extrabold text-ink-black mt-0.5">Pick words to target</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink-black transition-colors shrink-0 px-1 -mt-1"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search words…"
          disabled={loading || isEmpty}
          className="w-full text-[15px] font-medium text-ink-body bg-white rounded-tile px-3.5 py-3 placeholder:text-[#b6bac2] focus:outline-none transition-colors border-[1.5px] border-[#e3e5e9] focus:border-sky disabled:opacity-60 shrink-0 mb-4"
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-ink-muted py-6 justify-center">
              <Spinner size={18} />
              Loading course vocabulary…
            </div>
          ) : isEmpty ? (
            <p className="text-[13px] text-ink-muted py-6 text-center">
              No saved vocabulary found in this course yet.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-ink-muted py-6 text-center">
              No words match “{search.trim()}”.
            </p>
          ) : (
            <div className="space-y-5">
              {filtered.map((lesson) => (
                <div key={lesson.lesson_id}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-[13px] font-bold text-ink-black truncate">{lesson.lesson_title}</p>
                    {lesson.lesson_date && (
                      <span className="text-[11px] text-ink-muted shrink-0">{formatDate(lesson.lesson_date)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lesson.words.map((word) => {
                      const active = selected.has(word)
                      return (
                        <button
                          key={`${lesson.lesson_id}-${word}`}
                          type="button"
                          onClick={() => toggle(word)}
                          className={`text-[13px] font-medium rounded-full px-3 py-1.5 border-[1.5px] transition-colors ${
                            active
                              ? 'border-sky bg-sky-wash text-sky-text'
                              : 'border-[#e3e5e9] text-ink-body hover:border-sky-border'
                          }`}
                        >
                          {word}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-5 shrink-0">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={add} disabled={count === 0}>
            {count > 0 ? `Add ${count} word${count !== 1 ? 's' : ''}` : 'Add words'}
          </Button>
        </div>
      </div>
    </div>
  )
}
