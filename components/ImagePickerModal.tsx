'use client'

import { useCallback, useEffect, useState } from 'react'

// Image picker for flashcards.
//
// On open we run an initial search using the flashcard's word. The teacher
// can refine the query (vocab words like "bank" / "spring" / "club" are
// ambiguous and the default search often returns junk), switch between
// Photos and Illustrations (Pixabay-only), and click any thumbnail to
// pick — that closes the modal and writes the URL back to the flashcard.

interface ImageHit {
  id: string
  url: string
  thumb: string
  alt: string
  credit: string
  source: 'pexels' | 'pixabay'
  type: 'photo' | 'illustration'
}

interface Props {
  word: string
  onClose: () => void
  onPick: (url: string) => void
}

export default function ImagePickerModal({ word, onClose, onPick }: Props) {
  const [query, setQuery] = useState(word)
  const [activeQuery, setActiveQuery] = useState(word)
  const [type, setType] = useState<'photo' | 'illustration'>('photo')
  const [images, setImages] = useState<ImageHit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pixabayConfigured, setPixabayConfigured] = useState(true)

  const runSearch = useCallback(async (q: string, t: 'photo' | 'illustration') => {
    if (!q.trim()) {
      setImages([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/image-search?q=${encodeURIComponent(q.trim())}&type=${t}`
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Image search failed.')
        setImages([])
      } else {
        setImages(data.images || [])
        setPixabayConfigured(data.pixabayConfigured !== false)
      }
    } catch {
      setError('Network error — try again.')
      setImages([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    runSearch(activeQuery, type)
  }, [activeQuery, type, runSearch])

  const submitRefine = () => {
    if (query.trim() && query.trim() !== activeQuery) {
      setActiveQuery(query.trim())
    } else {
      runSearch(activeQuery, type) // re-run if same query (force refresh)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e6f0fa] flex items-center justify-between shrink-0">
          <h3 className="font-bold text-[#46464b]">
            Pick an image for <span className="text-[#416ebe]">“{word}”</span>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg"
          >
            &times;
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-[#e6f0fa] shrink-0 flex flex-wrap gap-3 items-center">
          {/* Type tabs */}
          <div className="flex items-center gap-1">
            {(['photo', 'illustration'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  type === t
                    ? 'bg-[#416ebe] text-white'
                    : 'text-[#46464b] hover:text-[#416ebe]'
                }`}
              >
                {t === 'photo' ? 'Photos' : 'Illustrations'}
              </button>
            ))}
          </div>

          {/* Refine search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitRefine() }}
              placeholder="Refine search…"
              className="w-full pl-9 pr-3 py-2 text-sm text-[#46464b] border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] bg-white"
            />
          </div>
          <button
            onClick={submitRefine}
            disabled={!query.trim()}
            className="bg-[#416ebe] hover:bg-[#3560b0] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            Search
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <p className="text-center text-gray-400 py-12 text-sm">Searching…</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12 text-sm">{error}</p>
          ) : images.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400 mb-1">No images found for “{activeQuery}”.</p>
              <p className="text-xs text-gray-300">
                Try a different word or switch tabs
                {type === 'illustration' && !pixabayConfigured
                  ? ' (illustrations require Pixabay — ask the admin to add PIXABAY_API_KEY).'
                  : '.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => onPick(img.url)}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-[#cddcf0] hover:border-[#416ebe] hover:shadow-md transition-all bg-[#f7fafd]"
                  title={`${img.alt} — by ${img.credit} (${img.source})`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.thumb}
                    alt={img.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-1 right-1 text-[9px] bg-black/55 text-white px-1.5 py-0.5 rounded-full capitalize opacity-0 group-hover:opacity-100 transition-opacity">
                    {img.source}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-2 border-t border-[#e6f0fa] text-[10px] text-gray-400 shrink-0">
          Images from Pexels{pixabayConfigured ? ' and Pixabay' : ''} — free to use.
          {!pixabayConfigured && (
            <span className="ml-1 text-amber-600">
              Add PIXABAY_API_KEY to also pull illustrations.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
