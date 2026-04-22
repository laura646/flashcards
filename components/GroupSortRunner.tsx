'use client'

import { useState, useMemo } from 'react'

// ------- Types -------

// Legacy items were plain strings. New items are objects with optional image.
type RawItem = string | { id?: string; text: string; image_url?: string }

interface RawGroup {
  name: string
  image_url?: string
  items: RawItem[]
}

interface GroupData {
  groups: RawGroup[]
}

// Normalized shape used inside the component
interface NormItem {
  text: string
  image_url?: string
}

interface NormGroup {
  name: string
  image_url?: string
  items: NormItem[]
}

interface Props {
  exercise: {
    title: string
    instructions: string
    groupData: GroupData
  }
  onComplete: (score: number, total: number) => void
  onBack: () => void
}

// ------- Normalization -------

const normalizeGroup = (g: RawGroup): NormGroup => ({
  name: g.name,
  image_url: g.image_url,
  items: (g.items || []).map((it) =>
    typeof it === 'string' ? { text: it } : { text: it.text || '', image_url: it.image_url }
  ),
})

// ------- Component -------

export default function GroupSortRunner({ exercise, onComplete, onBack }: Props) {
  // Normalize once per groupData change (handles both legacy string items and new object items)
  const groups = useMemo<NormGroup[]>(
    () => (exercise.groupData?.groups || []).map(normalizeGroup),
    [exercise.groupData]
  )

  // Lookup: item text -> image URL (for rendering placed items anywhere)
  const itemImageMap = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    groups.forEach((g) => g.items.forEach((it) => { map[it.text] = it.image_url }))
    return map
  }, [groups])

  // Answer key: item text -> correct group name
  const answerKey = useMemo(() => {
    const map: Record<string, string> = {}
    groups.forEach((g) => g.items.forEach((it) => { map[it.text] = g.name }))
    return map
  }, [groups])

  // Shuffle all items (stable for this exercise session)
  const allItems = useMemo(() => {
    const flat = groups.flatMap((g) => g.items.map((it) => it.text))
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[flat[i], flat[j]] = [flat[j], flat[i]]
    }
    return flat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalItems = allItems.length

  // Track where each item has been placed: item text -> group name
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  const unplacedItems = allItems.filter((item) => !placements[item])
  const allPlaced = unplacedItems.length === 0

  const placeItem = (item: string, groupName: string) => {
    setPlacements((prev) => ({ ...prev, [item]: groupName }))
    setSelectedItem(null)
    setDraggedItem(null)
  }

  const removeItem = (item: string) => {
    if (submitted) return
    setPlacements((prev) => {
      const next = { ...prev }
      delete next[item]
      return next
    })
  }

  const handleItemTap = (item: string) => {
    if (submitted) return
    setSelectedItem(selectedItem === item ? null : item)
  }

  const handleGroupTap = (groupName: string) => {
    if (submitted) return
    if (selectedItem) placeItem(selectedItem, groupName)
  }

  const handleDrop = (groupName: string) => {
    if (!draggedItem || submitted) return
    placeItem(draggedItem, groupName)
  }

  const handleCheck = () => {
    setSubmitted(true)
    const s = Object.entries(placements).filter(([item, group]) => answerKey[item] === group).length
    onComplete(s, totalItems)
  }

  const score = Object.entries(placements).filter(([item, group]) => answerKey[item] === group).length
  const pct = totalItems > 0 ? Math.round((score / totalItems) * 100) : 0

  // ------- Sub-renderers -------

  // Small image for an item inside a button/pill
  const ItemImage = ({ url, size = 'sm' }: { url?: string; size?: 'sm' | 'md' }) => {
    if (!url) return null
    const cls = size === 'md' ? 'h-10 w-10' : 'h-6 w-6'
    return (
      <img
        src={url}
        alt=""
        className={`${cls} object-cover rounded-md flex-shrink-0`}
      />
    )
  }

  // Small image next to a group name in the group header
  const GroupHeaderImage = ({ url }: { url?: string }) => {
    if (!url) return null
    return (
      <img
        src={url}
        alt=""
        className="h-8 w-8 object-cover rounded-lg flex-shrink-0"
      />
    )
  }

  // ------- Summary view -------

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-3">
            {pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}
          </div>
          <h2 className="text-xl font-bold text-[#416ebe]">
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good effort!' : 'Keep practising!'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            You sorted {score}/{totalItems} items correctly ({pct}%)
          </p>
        </div>

        {/* Show correct groupings */}
        <div className="space-y-4">
          {groups.map((group) => {
            const placedHere = Object.entries(placements)
              .filter(([, g]) => g === group.name)
              .map(([item]) => item)

            return (
              <div key={group.name} className="bg-white rounded-2xl border-2 border-[#cddcf0] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GroupHeaderImage url={group.image_url} />
                  <h3 className="text-sm font-bold text-[#416ebe]">{group.name}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((it) => {
                    const wasPlacedHere = placedHere.includes(it.text)
                    const wasPlacedElsewhere = placements[it.text] && placements[it.text] !== group.name
                    return (
                      <span
                        key={it.text}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${
                          wasPlacedHere
                            ? 'border-green-300 bg-green-50 text-green-700'
                            : wasPlacedElsewhere
                            ? 'border-red-300 bg-red-50 text-red-600'
                            : 'border-gray-200 bg-gray-50 text-gray-400'
                        }`}
                      >
                        {wasPlacedHere && '✓'}
                        {wasPlacedElsewhere && '✗'}
                        <ItemImage url={it.image_url} size="sm" />
                        <span>{it.text}</span>
                        {wasPlacedElsewhere && (
                          <span className="text-gray-400 ml-1">(was in {placements[it.text]})</span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={onBack}
          className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors mt-2"
        >
          ← Back to exercises
        </button>
      </div>
    )
  }

  // ------- Active view -------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-[#416ebe] transition-colors">
          ← Back
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-[#416ebe]">{exercise.title}</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#e6f0fa] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#416ebe] rounded-full transition-all duration-300"
            style={{ width: `${((totalItems - unplacedItems.length) / totalItems) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {totalItems - unplacedItems.length} / {totalItems}
        </span>
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-400 italic">{exercise.instructions}</p>

      {/* Items to sort */}
      {unplacedItems.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 mb-2">Items to sort</p>
          <div className="flex flex-wrap gap-2">
            {unplacedItems.map((item) => {
              const imageUrl = itemImageMap[item]
              const isSelected = selectedItem === item
              return (
                <button
                  key={item}
                  draggable
                  onDragStart={() => setDraggedItem(item)}
                  onClick={() => handleItemTap(item)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isSelected
                      ? 'bg-[#416ebe] text-white border-2 border-[#416ebe] scale-105 shadow-md'
                      : 'bg-white text-[#46464b] border-2 border-[#cddcf0] hover:border-[#416ebe] hover:text-[#416ebe] cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <ItemImage url={imageUrl} size="md" />
                  <span>{item}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Group boxes */}
      <div className={`grid gap-3 ${groups.length <= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {groups.map((group) => {
          const placedItems = Object.entries(placements)
            .filter(([, g]) => g === group.name)
            .map(([item]) => item)

          return (
            <div
              key={group.name}
              onClick={() => handleGroupTap(group.name)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(group.name)}
              className={`rounded-2xl border-2 border-dashed p-4 min-h-[120px] transition-all ${
                selectedItem
                  ? 'border-[#416ebe] bg-[#e6f0fa]/30 cursor-pointer hover:bg-[#e6f0fa]'
                  : 'border-[#cddcf0] bg-white'
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <GroupHeaderImage url={group.image_url} />
                <h3 className="text-sm font-bold text-[#416ebe] text-center">{group.name}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {placedItems.length === 0 && (
                  <p className="text-xs text-gray-300 italic">
                    {selectedItem ? 'Tap to place here' : 'Drop items here'}
                  </p>
                )}
                {placedItems.map((item) => {
                  const imageUrl = itemImageMap[item]
                  return (
                    <button
                      key={item}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeItem(item)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#e6f0fa] text-[#416ebe] border border-[#cddcf0] hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                      title="Click to remove"
                    >
                      <ItemImage url={imageUrl} size="sm" />
                      <span>{item}</span>
                      <span>✕</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Check button */}
      <button
        onClick={handleCheck}
        disabled={!allPlaced}
        className="w-full bg-[#416ebe] hover:bg-[#3560b0] text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Check answers
      </button>
    </div>
  )
}
