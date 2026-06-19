'use client'

// Wave 0 verification harness for SortableList. Not linked; delete with the
// other preview routes on sign-off.

import { useState } from 'react'
import SortableList from '@/components/student-ui/SortableList'

interface Row { id: string; icon: string; label: string }

export default function SortablePreview() {
  const [items, setItems] = useState<Row[]>([
    { id: 'a', icon: '📝', label: 'Warm-up note' },
    { id: 'b', icon: '🔤', label: 'Vocabulary' },
    { id: 'c', icon: '✅', label: 'Multiple choice' },
    { id: 'd', icon: '📖', label: 'Reading + questions' },
    { id: 'e', icon: '🎧', label: 'Gap-fill listening' },
  ])
  return (
    <main className="min-h-screen bg-surface font-rubik px-4 py-10">
      <div className="max-w-md mx-auto bg-white rounded-card border border-hairline p-5">
        <h2 className="text-sm font-extrabold text-brandblue mb-1">Drag to reorder</h2>
        <p className="text-xs text-ink-muted mb-4">Mouse, touch, or keyboard (focus the grip → Space → ↑/↓ → Space).</p>
        <SortableList
          items={items}
          onReorder={setItems}
          className="space-y-1.5"
          renderItem={(item, handle) => (
            <div className="flex items-center gap-2.5 px-3 py-2.5 border border-hairline rounded-tile bg-white">
              <button
                {...handle.attributes}
                {...handle.listeners}
                aria-label={`Reorder ${item.label}`}
                className="text-ink-muted cursor-grab active:cursor-grabbing touch-none px-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40"
              >⠿</button>
              <span aria-hidden="true">{item.icon}</span>
              <span className="text-[13px] text-ink-black">{item.label}</span>
            </div>
          )}
        />
        <p className="mt-4 text-xs text-ink-muted">Order: {items.map((i) => i.id).join(' · ')}</p>
      </div>
    </main>
  )
}
