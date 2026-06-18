'use client'

// Phase D verification harness — mounts the REAL VocabTrainer with a
// mocked /api/vocab-srs so its home dashboard + review flow render
// without auth. Verifies the 10B re-skin + the one-tap RatingRow.
// Not linked; delete with the other preview routes when the redesign ships.

import { useEffect, useState } from 'react'
import VocabTrainer from '@/components/VocabTrainer'

const MOCK_WORDS = [
  { id: '0', word: 'notwithstanding', meaning: 'In spite of; without being affected by the particular factor mentioned — used to introduce a contrast that does not change the outcome of the main clause.', phonetic: 'ˌnɒtwɪθˈstandɪŋ', translation: 'несмотря на / trotzdem', example: 'Notwithstanding the heavy rain and the late hour, the entire team stayed behind to finish the project before the morning deadline.', box_level: 2, next_review_at: '' },
  { id: '1', word: 'mercury', meaning: 'The smallest planet, closest to the Sun.', phonetic: 'ˈmɜːkjʊri', example: 'Mercury orbits the Sun fastest.', box_level: 1, next_review_at: '' },
  { id: '2', word: 'orbit', meaning: 'The path of an object around a star or planet.', phonetic: 'ˈɔːbɪt', example: 'Earth completes one orbit a year.', box_level: 3, next_review_at: '' },
  { id: '3', word: 'galaxy', meaning: 'A huge system of stars held together by gravity.', phonetic: 'ˈɡaləksi', example: 'We live in the Milky Way galaxy.', box_level: 2, next_review_at: '' },
]

const STATS = { 1: 4, 2: 3, 3: 2, 4: 1, 5: 5, total: 15, due: 3, review_due: 3, new_words: 2 }

function installMockFetch() {
  const real = window.fetch.bind(window)
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/vocab-srs')) {
      const action = new URL(url, location.origin).searchParams.get('action')
      let body: unknown = {}
      try { body = init?.body ? JSON.parse(init.body as string) : {} } catch {}
      const postAction = (body as { action?: string }).action
      if (action === 'stats') return jsonRes({ stats: STATS })
      if (action === 'due') return jsonRes({ words: MOCK_WORDS })
      if (action === 'all') return jsonRes({ words: MOCK_WORDS })
      if (action === 'focus') return jsonRes({ words: [{ id: '2', word: 'orbit', meaning: 'path around a star' }] })
      if (action === 'streak') return jsonRes({ streak: 4, reviewedToday: false })
      if (postAction === 'sync' || postAction === 'review' || postAction === 'add' || postAction === 'update') return jsonRes({ ok: true })
      return jsonRes({ ok: true })
    }
    if (url.includes('/api/progress')) return jsonRes({ ok: true })
    return real(input, init)
  }) as typeof window.fetch
}
function jsonRes(obj: unknown) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export default function VocabPreview() {
  const [ready, setReady] = useState(false)
  useEffect(() => { installMockFetch(); setReady(true) }, [])
  if (!ready) return null
  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-8">
      <div className="max-w-lg mx-auto">
        <VocabTrainer onBack={() => {}} />
      </div>
    </main>
  )
}
