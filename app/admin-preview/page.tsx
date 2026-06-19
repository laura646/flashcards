'use client'

// ─────────────────────────────────────────────────────────────────────
// CLICKABLE PROTOTYPE — teacher-side redesign (NOT production).
//
// Demonstrates two approved concepts for English-with-Laura's teacher app:
//   1. A redesigned top-level navigation (the left sidebar + destinations)
//   2. The "calm" lesson builder — left outline · edit-one-thing · live
//      student preview — replacing the monolithic editor + nested pop-ups.
//
// Everything is local React state with mock data. NOTHING is saved, no API
// is written to, and the real /admin editor is untouched. Safe to delete.
// The live preview reuses the REAL student CardFace so it can never drift
// from what learners actually see.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import CardFace from '@/components/CardFace'
import { Button, Eyebrow } from '@/components/student-ui'
import type { Flashcard } from '@/data/flashcards'

type Screen = 'courses' | 'students' | 'attendance' | 'reports' | 'library' | 'builder'
type ItemType = 'note' | 'vocab' | 'mcq' | 'reading' | 'gapfill'
interface OutlineItem { id: string; type: ItemType; label: string; meta?: string }

const NAV: { key: Screen; icon: string; label: string }[] = [
  { key: 'courses', icon: '📚', label: 'Courses' },
  { key: 'students', icon: '👥', label: 'Students' },
  { key: 'attendance', icon: '✅', label: 'Attendance' },
  { key: 'reports', icon: '📊', label: 'Reports' },
  { key: 'library', icon: '🗃️', label: 'Library' },
]

const ICON: Record<ItemType, string> = { note: '📝', vocab: '🔤', mcq: '✅', reading: '📖', gapfill: '🎧' }
const ADD_OPTIONS: { type: ItemType; icon: string; label: string; sub: string }[] = [
  { type: 'vocab', icon: '🔤', label: 'Flashcards', sub: 'Vocabulary set' },
  { type: 'mcq', icon: '✅', label: 'Exercise', sub: 'Multiple choice, gap-fill…' },
  { type: 'reading', icon: '📖', label: 'Reading / audio', sub: 'Text or listening + questions' },
]

const START_WORDS = [
  { word: 'negotiate', meaning: 'reach agreement through discussion' },
  { word: 'leverage', meaning: 'use something to gain advantage' },
  { word: 'concession', meaning: 'something given up to reach a deal' },
]
const MCQ_OPTIONS = ['negotiate', 'leverage', 'concession', 'deadline']

export default function AdminPreview() {
  const [screen, setScreen] = useState<Screen>('courses')

  // Builder state
  const [items, setItems] = useState<OutlineItem[]>([
    { id: 'a', type: 'note', label: 'Warm-up note' },
    { id: 'b', type: 'vocab', label: 'Vocabulary', meta: '8 words' },
    { id: 'c', type: 'mcq', label: 'Multiple choice', meta: '5 Qs' },
    { id: 'd', type: 'reading', label: 'Reading + questions' },
    { id: 'e', type: 'gapfill', label: 'Gap-fill listening' },
  ])
  const [activeId, setActiveId] = useState('b')
  const [addOpen, setAddOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [save, setSave] = useState<'saved' | 'saving'>('saved')
  const [dragId, setDragId] = useState<string | null>(null)
  const [words, setWords] = useState(START_WORDS)

  const active = items.find((i) => i.id === activeId) || items[0]
  const touch = () => { setSave('saving'); setTimeout(() => setSave('saved'), 700) }

  const addItem = (type: ItemType) => {
    const label = ADD_OPTIONS.find((o) => o.type === type)?.label || 'New item'
    const id = 'n' + items.length + Math.floor(Math.random() * 9999)
    setItems((prev) => [...prev, { id, type, label }])
    setActiveId(id); setAddOpen(false); touch()
  }
  const removeItem = (id: string) => { setItems((prev) => prev.filter((i) => i.id !== id)); touch() }
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    setItems((prev) => {
      const arr = [...prev]
      const from = arr.findIndex((i) => i.id === dragId)
      const to = arr.findIndex((i) => i.id === targetId)
      const [m] = arr.splice(from, 1); arr.splice(to, 0, m); return arr
    })
    setDragId(null); touch()
  }

  const previewCard: Flashcard = {
    id: 1,
    word: words[0]?.word || 'negotiate',
    phonetic: '/nɪˈɡoʊ.ʃi.eɪt/',
    meaning: words[0]?.meaning || 'reach agreement through discussion',
    example: 'We negotiated better terms with the supplier.',
  }

  return (
    <div className="font-rubik min-h-screen bg-surface text-ink-body">
      {/* Prototype banner */}
      <div className="bg-sky-wash text-ink-body text-xs px-4 py-2 text-center border-b border-sky-border">
        🧪 <strong>Prototype</strong> — clickable demo. Nothing saves here, and your real editor is untouched.
      </div>

      {/* Mobile top nav (the sidebar is hidden below lg) */}
      <div className="lg:hidden flex items-center gap-2 px-3 py-2.5 border-b border-hairline bg-white overflow-x-auto">
        <span className="font-extrabold text-brandblue text-sm shrink-0 mr-1">✨ EwL</span>
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setScreen(n.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-tile text-[13px] whitespace-nowrap transition-colors ${screen === n.key ? 'bg-sky text-white font-bold' : 'text-ink-body hover:bg-surface'}`}
          >
            <span aria-hidden="true">{n.icon}</span>{n.label}
          </button>
        ))}
      </div>

      <div className="flex">
        {/* ── SIDEBAR (new top-level nav) — hidden on mobile (see top nav above) ── */}
        <aside className="hidden lg:flex lg:flex-col w-[224px] shrink-0 bg-white border-r border-hairline self-stretch">
          <div className="px-4 py-4 border-b border-hairline">
            <span className="font-extrabold text-brandblue text-base">✨ EwL Teaching</span>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {NAV.map((n) => {
              const act = screen === n.key
              return (
                <button
                  key={n.key}
                  onClick={() => setScreen(n.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-tile text-sm transition-colors ${act ? 'bg-sky text-white font-bold' : 'text-ink-body hover:bg-surface'}`}
                >
                  <span className="text-base leading-none">{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              )
            })}
            <div className="mx-2 my-2 border-t border-hairline" />
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-tile text-sm text-ink-muted hover:bg-surface">
              <span className="text-base leading-none">❓</span><span>Help &amp; docs</span>
            </button>
          </nav>
          <div className="border-t border-hairline p-3">
            <p className="text-sm font-bold text-ink-body">Laura</p>
            <p className="text-[11px] text-ink-muted">Teacher</p>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 min-w-0">
          {screen === 'builder' ? (
            <div className="flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-hairline bg-white flex-wrap">
                <div className="text-xs text-ink-muted">
                  <button onClick={() => setScreen('courses')} className="hover:text-sky">Courses</button>
                  {' › Business English › '}
                  <span className="text-ink-black font-medium">Lesson 4 — Negotiations</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2.5 py-1 rounded-full ${save === 'saved' ? 'bg-correct-bg text-correct-fg' : 'bg-sky-wash text-sky-dark'}`}>
                    {save === 'saved' ? '✓ Saved' : 'Saving…'}
                  </span>
                  <button onClick={() => setShowPreview((p) => !p)} className="text-xs text-ink-body border border-hairline rounded-tile px-3 py-1.5 hover:bg-surface">
                    {showPreview ? 'Hide preview' : 'Preview'}
                  </button>
                  <Button size="sm">Publish</Button>
                </div>
              </div>

              {/* 3 panes — stack into one column on mobile, side-by-side on lg */}
              <div className="flex flex-col lg:flex-row lg:min-h-[520px]">
                {/* Outline */}
                <div className="w-full lg:w-[232px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-hairline p-3">
                  <Eyebrow tone="sky" className="block mb-2">Lesson outline</Eyebrow>
                  <div className="space-y-1">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        draggable
                        onDragStart={() => setDragId(it.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDrop(it.id)}
                        onClick={() => setActiveId(it.id)}
                        className={`group flex items-center gap-2 px-2.5 py-2 rounded-tile cursor-pointer text-[13px] ${it.id === activeId ? 'bg-sky-wash text-sky-dark font-bold ring-1 ring-sky-border' : 'text-ink-body hover:bg-surface'}`}
                      >
                        <span className="cursor-grab text-ink-muted select-none" title="Drag to reorder">⠿</span>
                        <span>{ICON[it.type]}</span>
                        <span className="flex-1 truncate">
                          {it.label}
                          {it.meta && <span className="text-ink-muted font-normal text-[11px]"> · {it.meta}</span>}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(it.id) }}
                          className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-incorrect-fg px-1"
                          title="Delete"
                        >×</button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setAddOpen(true)}
                    className="mt-3 w-full border border-dashed border-sky-border text-sky text-[13px] font-bold rounded-tile py-2.5 hover:bg-sky-wash transition-colors"
                  >+ Add content</button>
                </div>

                {/* Editor */}
                <div className="flex-1 min-w-0 p-5">
                  {active.type === 'vocab' && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-[17px] font-bold text-ink-black">🔤 Vocabulary</h2>
                        <span className="text-[11px] text-ink-muted">{words.length} words</span>
                      </div>
                      <div className="space-y-1.5">
                        {words.map((w, i) => (
                          <div key={i} className="flex items-center gap-2.5 px-3 py-2 border border-hairline rounded-tile bg-white">
                            <span className="text-ink-muted text-xs cursor-grab">⠿</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-bold text-ink-black">{w.word}</span>
                              <span className="text-[12px] text-ink-body"> — {w.meaning}</span>
                            </div>
                            <button onClick={() => setWords(words.filter((_, j) => j !== i))} className="text-ink-muted hover:text-incorrect-fg text-sm px-1">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => { setWords([...words, { word: 'new word', meaning: 'tap to edit…' }]); touch() }} className="text-[12px] text-ink-body border border-hairline rounded-tile px-3 py-2 hover:bg-surface">+ Add word</button>
                        <button onClick={() => { setWords([...words, { word: 'momentum', meaning: 'driving force' }, { word: 'stalemate', meaning: 'a deadlock' }]); touch() }} className="text-[12px] text-sky border border-sky-border rounded-tile px-3 py-2 hover:bg-sky-wash">⎙ Paste a list</button>
                      </div>
                    </div>
                  )}

                  {active.type === 'mcq' && (
                    <div>
                      <h2 className="text-[17px] font-bold text-ink-black mb-4">✅ Multiple choice</h2>
                      <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-ink-muted mb-1.5">Question</label>
                      <div className="border border-hairline rounded-tile p-3 text-sm text-ink-black bg-white mb-4">Which word means “to reach agreement through discussion”?</div>
                      <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-ink-muted mb-1.5">Options</label>
                      <div className="space-y-1.5">
                        {MCQ_OPTIONS.map((o, i) => (
                          <div key={o} className={`flex items-center gap-2.5 px-3 py-2 border rounded-tile bg-white text-[13px] ${i === 0 ? 'border-sky text-sky-dark font-bold' : 'border-hairline text-ink-body'}`}>
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${i === 0 ? 'bg-sky border-sky text-white' : 'border-hairline'}`}>{i === 0 ? '✓' : ''}</span>
                            <span className="flex-1">{o}</span>
                            {i === 0 && <span className="text-[10px] text-sky-dark">correct</span>}
                          </div>
                        ))}
                      </div>
                      <button className="text-[12px] text-ink-body border border-hairline rounded-tile px-3 py-2 hover:bg-surface mt-4">+ Add option</button>
                    </div>
                  )}

                  {active.type === 'reading' && (
                    <div>
                      <h2 className="text-[17px] font-bold text-ink-black mb-4">📖 Reading</h2>
                      <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-ink-muted mb-1.5">Title</label>
                      <div className="border border-hairline rounded-tile p-3 text-sm text-ink-black bg-white mb-4">Closing the deal</div>
                      <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-ink-muted mb-1.5">Passage</label>
                      <div className="border border-hairline rounded-tile p-3 text-[13px] text-ink-body leading-relaxed bg-white">After weeks of back-and-forth, both sides finally sat down to negotiate the final terms. The supplier offered a small concession on price, and in return the buyer agreed to a longer contract…</div>
                      <button className="text-[12px] text-sky border border-sky-border rounded-tile px-3 py-2 hover:bg-sky-wash mt-4">+ Attach questions</button>
                    </div>
                  )}

                  {active.type === 'note' && (
                    <div>
                      <h2 className="text-[17px] font-bold text-ink-black mb-4">📝 Warm-up note</h2>
                      <div className="border border-hairline rounded-tile p-3 text-[13px] text-ink-body leading-relaxed bg-white min-h-[120px]">Today we’ll practise the language of negotiation. Think of a time you had to reach a compromise — we’ll come back to it at the end.</div>
                    </div>
                  )}

                  {active.type === 'gapfill' && (
                    <div>
                      <h2 className="text-[17px] font-bold text-ink-black mb-4">🎧 Gap-fill listening</h2>
                      <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-ink-muted mb-1.5">Audio</label>
                      <div className="flex items-center gap-2 border border-hairline rounded-tile p-2.5 bg-white mb-4">
                        <span className="w-7 h-7 rounded-full bg-sky text-white flex items-center justify-center text-xs">▶</span>
                        <span className="text-[12px] text-ink-muted">negotiation-clip.mp3</span>
                      </div>
                      <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-ink-muted mb-1.5">Text (click a word to make it a gap)</label>
                      <div className="border border-hairline rounded-tile p-3 text-[13px] text-ink-body leading-loose bg-white">
                        We need to <span className="bg-sky-wash text-sky-dark px-2 py-0.5 rounded">______</span> the price before we sign the <span className="bg-sky-wash text-sky-dark px-2 py-0.5 rounded">______</span>.
                      </div>
                    </div>
                  )}
                </div>

                {/* Live student preview — real components */}
                {showPreview && (
                  <div className="w-full lg:w-[300px] lg:shrink-0 border-t lg:border-t-0 lg:border-l border-hairline bg-surface p-4">
                    <Eyebrow tone="sky" className="block mb-3">Student preview</Eyebrow>
                    <div className="mx-auto w-[232px] rounded-[30px] border-[6px] border-ink-black bg-white overflow-hidden">
                      {active.type === 'vocab' && (
                        <div className="h-[300px] bg-white border-2 border-sky rounded-flashcard">
                          <CardFace card={previewCard} />
                        </div>
                      )}
                      {active.type === 'mcq' && (
                        <div className="h-[300px] bg-white p-5 flex flex-col justify-center gap-3">
                          <p className="text-sm font-bold text-ink-black leading-snug">Which word means “to reach agreement through discussion”?</p>
                          {MCQ_OPTIONS.map((o) => (
                            <div key={o} className="border border-sky-border rounded-tile px-3 py-2 text-[13px] text-ink-body bg-white">{o}</div>
                          ))}
                        </div>
                      )}
                      {active.type === 'reading' && (
                        <div className="h-[300px] bg-white p-5 overflow-y-auto">
                          <p className="text-[11px] font-bold uppercase tracking-eyebrow text-sky mb-2">Reading</p>
                          <h3 className="text-base font-bold text-ink-black mb-2">Closing the deal</h3>
                          <p className="text-[13px] text-ink-body leading-relaxed">After weeks of back-and-forth, both sides finally sat down to negotiate the final terms. The supplier offered a small concession on price…</p>
                        </div>
                      )}
                      {active.type === 'note' && (
                        <div className="h-[300px] bg-white p-5 flex items-center">
                          <div className="bg-sky-wash rounded-tile p-4 text-[13px] text-ink-body">💡 Today we’ll practise the language of negotiation. Think of a time you had to reach a compromise.</div>
                        </div>
                      )}
                      {active.type === 'gapfill' && (
                        <div className="h-[300px] bg-white p-5 flex flex-col justify-center gap-4">
                          <div className="mx-auto w-10 h-10 rounded-full bg-sky text-white flex items-center justify-center">▶</div>
                          <p className="text-sm text-ink-black leading-loose text-center">We need to <span className="inline-block min-w-[52px] border-b-2 border-sky">&nbsp;</span> the price before we sign the <span className="inline-block min-w-[52px] border-b-2 border-sky">&nbsp;</span>.</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-muted text-center mt-3">Exactly what students see · updates live</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <OtherScreen screen={screen} onOpenBuilder={() => setScreen('builder')} />
          )}
        </main>
      </div>

      {/* ── Add-content slide-in panel (replaces the nested pop-ups) ── */}
      {addOpen && (
        <>
          <div onClick={() => setAddOpen(false)} className="fixed inset-0 z-40 bg-black/30" />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-[330px] bg-white border-l border-hairline shadow-2xl p-5 flex flex-col font-rubik">
            <button onClick={() => setAddOpen(false)} className="text-[13px] text-sky font-bold mb-4 self-start">‹ Back</button>
            <h2 className="text-[17px] font-bold text-ink-black mb-1">Add content</h2>
            <p className="text-[12px] text-ink-muted mb-5">Pick what to add to this lesson.</p>
            <div className="space-y-2.5">
              {ADD_OPTIONS.map((o) => (
                <button
                  key={o.type}
                  onClick={() => addItem(o.type)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 border border-hairline rounded-card text-left hover:border-sky hover:bg-sky-wash transition-colors"
                >
                  <span className="text-xl">{o.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-ink-black">{o.label}</span>
                    <span className="block text-[12px] text-ink-muted">{o.sub}</span>
                  </span>
                  <span className="text-ink-muted">›</span>
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

// ─────────── Secondary screens (clean redesigned destinations) ───────────

function OtherScreen({ screen, onOpenBuilder }: { screen: Screen; onOpenBuilder: () => void }) {
  const [sel, setSel] = useState(0)
  if (screen === 'courses') {
    const courses = [
      { name: 'Business English', level: 'B2', lessons: ['Lesson 4 — Negotiations', 'Lesson 3 — Meetings', 'Lesson 2 — Email'] },
      { name: 'Conversation Club', level: 'B1', lessons: ['Lesson 7 — Travel', 'Lesson 6 — Food'] },
    ]
    return (
      <div className="p-6 max-w-[860px]">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-brandblue">Courses</h1>
          <Button size="sm">+ New course</Button>
        </div>
        <div className="space-y-3">
          {courses.map((c) => (
            <div key={c.name} className="bg-white rounded-card border border-hairline p-5">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-bold text-ink-black">{c.name}</h2>
                <span className="text-[11px] font-bold bg-sky-wash text-sky-dark px-2 py-0.5 rounded-full">{c.level}</span>
                <span className="text-[12px] text-ink-muted">· {c.lessons.length} lessons</span>
              </div>
              <div className="space-y-1.5">
                {c.lessons.map((l, i) => (
                  <button
                    key={l}
                    onClick={onOpenBuilder}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-tile border border-hairline hover:border-sky hover:bg-sky-wash transition-colors text-left"
                  >
                    <span className="text-[13px] text-ink-body">📖 {l}</span>
                    <span className="text-[12px] text-sky font-bold">{i === 0 ? 'Open ›' : 'Edit ›'}</span>
                  </button>
                ))}
                <button onClick={onOpenBuilder} className="w-full text-[13px] text-sky font-bold border border-dashed border-sky-border rounded-tile py-2.5 hover:bg-sky-wash">+ New lesson</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (screen === 'students') {
    const rows = [
      { n: 'Marek N.', lvl: 'B2', last: 'Today', streak: '12🔥' },
      { n: 'Sofia R.', lvl: 'B1', last: 'Yesterday', streak: '4🔥' },
      { n: 'Tom K.', lvl: 'C1', last: '3 days ago', streak: '—' },
    ]
    return (
      <div className="p-6 max-w-[860px]">
        <h1 className="text-2xl font-bold text-brandblue mb-5">Students</h1>
        <div className="bg-white rounded-card border border-hairline overflow-hidden">
          {rows.map((r, i) => (
            <div key={r.n} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-sky-wash text-sky-dark flex items-center justify-center text-sm font-bold">{r.n[0]}</div>
              <span className="flex-1 text-sm font-bold text-ink-black">{r.n}</span>
              <span className="text-[11px] bg-sky-wash text-sky-dark px-2 py-0.5 rounded-full">{r.lvl}</span>
              <span className="text-[12px] text-ink-muted w-24 text-right">{r.last}</span>
              <span className="text-[12px] w-12 text-right">{r.streak}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (screen === 'attendance') {
    const roster = ['Marek N.', 'Sofia R.', 'Tom K.', 'Aiko M.']
    return (
      <div className="p-6 max-w-[860px]">
        <h1 className="text-2xl font-bold text-brandblue mb-1">Attendance</h1>
        <p className="text-[13px] text-ink-muted mb-5">Business English · Lesson 4</p>
        <div className="bg-white rounded-card border border-hairline overflow-hidden">
          {roster.map((s, i) => (
            <div key={s} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
              <span className="flex-1 text-sm text-ink-black">{s}</span>
              <span className="text-[12px] font-bold text-white bg-sky px-3 py-1 rounded-full">Present</span>
              <span className="text-[12px] text-ink-muted border border-hairline px-3 py-1 rounded-full">Absent</span>
              <span className="text-[12px] text-ink-muted border border-hairline px-3 py-1 rounded-full">Late</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (screen === 'reports') {
    const students = [
      {
        name: 'Marek N.', cefr: 'B2', avg: 82, att: 95, streak: 12, done: '9 / 10',
        summary: 'Marek is progressing steadily at B2. Vocabulary is a real strength (88%), but listening is lagging behind (64%) — a little more dictation and gap-fill work would help close the gap. Attendance is excellent and his 12-day streak shows strong, consistent practice.',
        skills: [['Vocabulary', 88], ['Grammar', 80], ['Reading', 83], ['Speaking', 78], ['Listening', 64]] as [string, number][],
        trend: [60, 72, 68, 80, 84, 90],
        exercises: [['Negotiation MCQ', 90, 95], ['Gap-fill: prices', 72, 80], ['Email rewrite', 85, 85]] as [string, number, number][],
        vocab: [3, 5, 6, 8, 12],
        tests: [['Mid-course test', 78], ['Review test', 85]] as [string, number][],
        attendance: ['present', 'present', 'late', 'present', 'absent', 'present'],
        note: { tag: 'Vocabulary', text: 'Great progress on business idioms. Keep nudging listening practice.' },
      },
      {
        name: 'Sofia R.', cefr: 'B1', avg: 74, att: 80, streak: 4, done: '6 / 10',
        summary: 'Sofia is solid at B1 with good grammar gains this month. Her scores dipped on the last two exercises, so a quick review of past tenses would help. Encouraging more regular practice will help rebuild her streak and momentum.',
        skills: [['Grammar', 82], ['Vocabulary', 75], ['Reading', 70], ['Listening', 68], ['Speaking', 66]] as [string, number][],
        trend: [70, 76, 74, 72, 68, 71],
        exercises: [['Past tense MCQ', 68, 75], ['Listening: café', 71, 71], ['Vocab match', 80, 88]] as [string, number, number][],
        vocab: [6, 7, 4, 3, 2],
        tests: [['Mid-course test', 70]] as [string, number][],
        attendance: ['present', 'absent', 'present', 'late', 'present', 'absent'],
        note: { tag: 'Grammar', text: 'Confident speaker; needs reps on tense accuracy.' },
      },
      {
        name: 'Tom K.', cefr: 'C1', avg: 91, att: 70, streak: 0, done: '8 / 10',
        summary: 'Tom performs strongly at C1 across the board — the content level is well matched. The main gap is attendance (70%) and a broken streak, so re-engagement is the priority rather than difficulty. Worth a quick check-in to keep him motivated.',
        skills: [['Speaking', 94], ['Vocabulary', 92], ['Reading', 90], ['Grammar', 89], ['Listening', 88]] as [string, number][],
        trend: [88, 90, 86, 92, 95, 91],
        exercises: [['Debate prep', 95, 95], ['Idioms MCQ', 88, 92], ['Summary writing', 90, 90]] as [string, number, number][],
        vocab: [1, 2, 4, 9, 18],
        tests: [['Mid-course test', 92], ['Review test', 90]] as [string, number][],
        attendance: ['present', 'absent', 'absent', 'present', 'present', 'absent'],
        note: { tag: 'Attendance', text: 'High performer — focus on getting him back to weekly sessions.' },
      },
    ]
    const s = students[sel]
    const VOCAB = ['New', 'Learning', 'Familiar', 'Known', 'Mastered']
    const VOCAB_BG = ['bg-leitner-new', 'bg-leitner-learning', 'bg-leitner-familiar', 'bg-leitner-known', 'bg-leitner-mastered']
    const ATT_STYLE: Record<string, string> = {
      present: 'bg-sky text-white', late: 'bg-streak-fill text-streak-ink', absent: 'bg-incorrect-bg text-incorrect-fg',
    }
    const stat = (k: string, v: string) => (
      <div className="bg-white rounded-card border border-hairline p-4">
        <p className="text-[12px] text-ink-muted">{k}</p>
        <p className="text-2xl font-bold text-ink-black mt-1">{v}</p>
      </div>
    )
    const cardHead = (t: string) => <p className="text-[11px] font-bold uppercase tracking-eyebrow text-ink-muted mb-3">{t}</p>

    return (
      <div className="p-6 max-w-[1000px]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-brandblue">Reports</h1>
          <span className="text-[12px] text-ink-muted">Business English · last 30 days</span>
        </div>

        {/* Student selector */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {students.map((st, i) => (
            <button
              key={st.name}
              onClick={() => setSel(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] border transition-colors ${i === sel ? 'bg-sky text-white border-sky font-bold' : 'bg-white text-ink-body border-hairline hover:border-sky'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === sel ? 'bg-white/25 text-white' : 'bg-sky-wash text-sky-dark'}`}>{st.name[0]}</span>
              {st.name}
            </button>
          ))}
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {stat('Avg. score', `${s.avg}%`)}
          {stat('Attendance', `${s.att}%`)}
          {stat('Streak', s.streak ? `${s.streak}🔥` : '—')}
          {stat('Completed', s.done)}
        </div>

        {/* AI summary */}
        <div className="bg-white rounded-card border border-sky-border p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <Eyebrow tone="sky">✨ AI progress summary</Eyebrow>
            <div className="flex gap-2">
              <button className="text-[12px] text-ink-body border border-hairline rounded-tile px-2.5 py-1 hover:bg-surface">↻ Regenerate</button>
              <button className="text-[12px] text-ink-body border border-hairline rounded-tile px-2.5 py-1 hover:bg-surface">↓ Export</button>
            </div>
          </div>
          <p className="text-[14px] text-ink-body leading-relaxed">{s.summary}</p>
          <p className="text-[11px] text-ink-muted mt-2">Working at <strong className="text-ink-black">{s.cefr}</strong> · generated from this student’s last 30 days</p>
        </div>

        {/* Detail cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Skill & CEFR breakdown */}
          <div className="bg-white rounded-card border border-hairline p-5">
            {cardHead('Skill & CEFR breakdown')}
            <div className="space-y-2.5">
              {s.skills.map(([label, pct]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-24 text-[12px] text-ink-body shrink-0">{label}</span>
                  <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden"><div className="h-full bg-sky rounded-full" style={{ width: `${pct}%` }} /></div>
                  <span className="w-9 text-[12px] font-bold text-ink-black text-right">{pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Score trend */}
          <div className="bg-white rounded-card border border-hairline p-5">
            {cardHead('Score trend')}
            <div className="flex items-end gap-2 h-28">
              {s.trend.map((h, i) => (
                <div key={i} className="flex-1 bg-sky rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="text-[11px] text-ink-muted mt-2">Last 6 exercises</p>
          </div>

          {/* Per-exercise scores */}
          <div className="bg-white rounded-card border border-hairline p-5">
            {cardHead('Exercise scores (latest · best)')}
            <div className="space-y-1.5">
              {s.exercises.map(([title, latest, best]) => (
                <div key={title} className="flex items-center gap-2 text-[13px]">
                  <span className="flex-1 text-ink-body truncate">{title}</span>
                  <span className="font-bold text-ink-black">{latest}%</span>
                  <span className="text-ink-muted">/ {best}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vocabulary progress */}
          <div className="bg-white rounded-card border border-hairline p-5">
            {cardHead('Vocabulary progress')}
            <div className="flex items-end gap-2">
              {s.vocab.map((c, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-ink-black">{c}</span>
                  <div className="w-full h-20 bg-surface rounded flex items-end overflow-hidden">
                    <div className={`w-full ${VOCAB_BG[i]}`} style={{ height: `${Math.min(c * 6 + 12, 100)}%` }} />
                  </div>
                  <span className="text-[9px] text-ink-muted">{VOCAB[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tests */}
          <div className="bg-white rounded-card border border-hairline p-5">
            {cardHead('Tests')}
            <div className="space-y-1.5">
              {s.tests.map(([title, score]) => (
                <div key={title} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-body">{title}</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${score >= 80 ? 'bg-correct-bg text-correct-fg' : 'bg-sky-wash text-sky-dark'}`}>{score}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance history */}
          <div className="bg-white rounded-card border border-hairline p-5">
            {cardHead('Attendance history')}
            <div className="flex gap-1.5 flex-wrap">
              {s.attendance.map((a, i) => (
                <span key={i} className={`text-[10px] font-bold px-2 py-1 rounded-tile capitalize ${ATT_STYLE[a]}`}>{a}</span>
              ))}
            </div>
          </div>

          {/* Teacher notes */}
          <div className="bg-white rounded-card border border-hairline p-5 md:col-span-2">
            {cardHead('Teacher notes')}
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-bold bg-sky-wash text-sky-dark px-2 py-0.5 rounded-full shrink-0">{s.note.tag}</span>
              <p className="text-[13px] text-ink-body">{s.note.text}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // library (renamed from Content Bank)
  return (
    <div className="p-6 max-w-[860px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-brandblue">Library</h1>
        <Button size="sm" variant="secondary">+ Save current lesson</Button>
      </div>
      <p className="text-[13px] text-ink-muted mb-5">Reusable lessons you can drop into any course. (Renamed from “Content Bank”.)</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {['Negotiation basics', 'Job interviews', 'Small talk', 'Email etiquette', 'Phone calls', 'Presentations'].map((t) => (
          <div key={t} className="bg-white rounded-card border border-hairline p-4 hover:border-sky transition-colors cursor-pointer">
            <div className="text-2xl mb-2">🗂️</div>
            <p className="text-sm font-bold text-ink-black">{t}</p>
            <p className="text-[12px] text-ink-muted mt-0.5">Lesson template</p>
          </div>
        ))}
      </div>
    </div>
  )
}
