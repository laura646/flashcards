'use client'

import { useState, useMemo } from 'react'

interface MatchPair {
  id: number
  left: string
  right: string
  image_url?: string
  right_image_url?: string
}

interface Props {
  exercise: {
    title: string
    instructions: string
    questions: MatchPair[]
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MatchHalvesRunner({ exercise, onComplete, onBack }: Props) {
  const pairs = exercise.questions

  // Shuffle the left-side tiles and the right-side definitions independently
  const shuffledLeftTiles = useMemo(() => shuffle(pairs.map(p => ({
    id: p.id,
    text: p.left,
    image_url: p.image_url,
  }))), [])

  const shuffledRightSlots = useMemo(() => shuffle(pairs.map(p => ({
    id: p.id,
    text: p.right,
    right_image_url: p.right_image_url,
  }))), [])

  // Track which tile is placed in which slot: slotId -> tileId
  const [placements, setPlacements] = useState<Record<number, number>>({})
  const [selectedTile, setSelectedTile] = useState<number | null>(null)
  const [dragTileId, setDragTileId] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Which tile ids are already placed
  const placedTileIds = new Set(Object.values(placements))

  // Available tiles (not yet placed)
  const availableTiles = shuffledLeftTiles.filter(t => !placedTileIds.has(t.id))

  const handleTileTap = (tileId: number) => {
    if (submitted) return
    if (selectedTile === tileId) {
      setSelectedTile(null)
    } else {
      setSelectedTile(tileId)
    }
  }

  const handleSlotTap = (slotId: number) => {
    if (submitted) return
    // If slot already has a tile, remove it
    if (placements[slotId] !== undefined) {
      setPlacements(prev => {
        const next = { ...prev }
        delete next[slotId]
        return next
      })
      return
    }
    // If a tile is selected, place it in this slot
    if (selectedTile !== null) {
      setPlacements(prev => ({ ...prev, [slotId]: selectedTile }))
      setSelectedTile(null)
    }
  }

  const handleDragStart = (tileId: number) => {
    if (submitted) return
    setDragTileId(tileId)
  }

  const handleDropOnSlot = (slotId: number) => {
    if (submitted || dragTileId === null) return
    // If the dragged tile is already in another slot, remove it first
    setPlacements(prev => {
      const next = { ...prev }
      // Remove tile from any existing slot
      for (const [key, val] of Object.entries(next)) {
        if (val === dragTileId) delete next[Number(key)]
      }
      // If this slot had a different tile, free it
      // (no swap — just replace)
      next[slotId] = dragTileId
      return next
    })
    setDragTileId(null)
  }

  const handleDropOnPool = () => {
    if (submitted || dragTileId === null) return
    // Remove tile from any slot
    setPlacements(prev => {
      const next = { ...prev }
      for (const [key, val] of Object.entries(next)) {
        if (val === dragTileId) delete next[Number(key)]
      }
      return next
    })
    setDragTileId(null)
  }

  const handleSubmit = () => {
    setSubmitted(true)
    const score = shuffledRightSlots.reduce((acc, slot) => {
      const placedTileId = placements[slot.id]
      return acc + (placedTileId === slot.id ? 1 : 0)
    }, 0)
    onComplete(score, pairs.length)
  }

  const allPlaced = Object.keys(placements).length === pairs.length

  const getTileById = (id: number) => shuffledLeftTiles.find(t => t.id === id)

  // ── RESULTS ──
  if (submitted) {
    const score = shuffledRightSlots.reduce((acc, slot) => {
      return acc + (placements[slot.id] === slot.id ? 1 : 0)
    }, 0)
    const pct = Math.round((score / pairs.length) * 100)

    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-3">{pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}</div>
          <h2 className="text-xl font-bold text-[#416ebe]">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good effort!' : 'Keep practising!'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            You scored {score}/{pairs.length} ({pct}%)
          </p>
        </div>

        <div className="space-y-2">
          {shuffledRightSlots.map(slot => {
            const placedTileId = placements[slot.id]
            const isCorrect = placedTileId === slot.id
            const placedTile = placedTileId !== undefined ? getTileById(placedTileId) : null
            const correctTile = getTileById(slot.id)

            return (
              <div key={slot.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <span className={`text-sm font-bold ${isCorrect ? 'text-green-500' : 'text-red-400'}`}>
                  {isCorrect ? '✓' : '✗'}
                </span>
                <div className="flex-1">
                  {!isCorrect && placedTile && (
                    <p className="text-sm text-red-400 line-through mb-0.5">{placedTile.text}</p>
                  )}
                  <p className="text-sm">
                    <span className="font-bold text-[#416ebe]">{correctTile?.text}</span>
                    <span className="text-gray-400 mx-2">→</span>
                    <span className="text-[#46464b]">{slot.text}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={onBack} className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2">
          ← Back to exercises
        </button>
      </div>
    )
  }

  // ── ACTIVE ──
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-[#416ebe] transition-colors">← Back</button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-[#416ebe]">{exercise.title}</h2>
        </div>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Keyword tiles pool */}
      <div
        className="bg-white border border-[#cddcf0] rounded-2xl p-4 shadow-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDropOnPool()}
      >
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Tap or drag to match</p>
        <div className="flex flex-wrap gap-2 min-h-[44px]">
          {availableTiles.map(tile => (
            <button
              key={tile.id}
              draggable
              onDragStart={() => handleDragStart(tile.id)}
              onClick={() => handleTileTap(tile.id)}
              className={`flex items-center gap-2 rounded-xl text-sm font-bold transition-all select-none cursor-pointer ${
                tile.image_url ? 'p-0 overflow-hidden' : 'px-4 py-2.5'
              } ${
                selectedTile === tile.id
                  ? tile.image_url
                    ? 'ring-3 ring-[#416ebe] shadow-md scale-105'
                    : 'bg-[#416ebe] text-white shadow-md scale-105'
                  : tile.image_url
                  ? 'hover:ring-2 hover:ring-[#416ebe] active:scale-95'
                  : 'bg-[#e6f0fa] text-[#416ebe] border border-[#cddcf0] hover:bg-[#d0e0f5] active:scale-95'
              }`}
            >
              {tile.image_url ? (
                <img src={tile.image_url} alt={tile.text} className="w-16 h-16 object-cover rounded-xl" />
              ) : (
                tile.text
              )}
            </button>
          ))}
          {availableTiles.length === 0 && (
            <p className="text-xs text-gray-300 py-2">All tiles placed!</p>
          )}
        </div>
      </div>

      {/* Matching slots */}
      <div className="space-y-2">
        {shuffledRightSlots.map(slot => {
          const placedTileId = placements[slot.id]
          const placedTile = placedTileId !== undefined ? getTileById(placedTileId) : null

          return (
            <div
              key={slot.id}
              className="flex items-center gap-3 bg-white border border-[#cddcf0] rounded-xl p-3 shadow-sm"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnSlot(slot.id)}
            >
              {/* Drop zone / placed tile */}
              <div
                onClick={() => handleSlotTap(slot.id)}
                className={`min-w-[7rem] min-h-[2.5rem] rounded-lg border-2 border-dashed flex items-center justify-center gap-2 px-3 py-2 cursor-pointer transition-all ${
                  placedTile
                    ? 'border-[#416ebe] bg-[#e6f0fa] text-[#416ebe]'
                    : selectedTile !== null
                    ? 'border-[#416ebe] bg-[#e6f0fa]/30 animate-pulse'
                    : 'border-gray-300 bg-gray-50 text-gray-300'
                }`}
              >
                {placedTile ? (
                  placedTile.image_url ? (
                    <img src={placedTile.image_url} alt={placedTile.text} className="w-10 h-10 object-cover rounded" />
                  ) : (
                    <span className="text-sm font-bold">{placedTile.text}</span>
                  )
                ) : (
                  <span className="text-xs">___</span>
                )}
              </div>

              {/* Right side text/image */}
              <div className="flex items-center gap-2 flex-1">
                {slot.right_image_url && (
                  <img src={slot.right_image_url} alt="" className="w-10 h-10 object-cover rounded" />
                )}
                {slot.text && <p className="text-sm text-[#46464b] font-medium">{slot.text}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!allPlaced}
        className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit Answers
      </button>
    </div>
  )
}
