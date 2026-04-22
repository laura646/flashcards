'use client'

import { useState, useMemo } from 'react'

// ------- Types -------

export interface GroupItem {
  id: string
  text: string
  image_url?: string
}

export interface Group {
  id: string
  name: string
  image_url?: string
  items: GroupItem[]
}

export interface GroupData {
  groups: Group[]
}

// Legacy shape: items were plain strings. Normalize on read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacyGroup = { name: string; image_url?: string; items: (string | GroupItem)[] } & Record<string, any>

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupData: any
  onChange: (data: GroupData) => void
}

// ------- Constants -------

const MIN_GROUPS = 2
const MAX_GROUPS = 8
const MIN_ITEMS = 1
const MAX_ITEMS = 20

// ------- Helpers -------

const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Normalize any incoming shape (including legacy string items) into GroupData.
const normalize = (raw: unknown): GroupData => {
  if (!raw || typeof raw !== 'object') {
    return { groups: [emptyGroup(), emptyGroup()] }
  }
  const rawGroups = (raw as { groups?: LegacyGroup[] }).groups
  if (!Array.isArray(rawGroups) || rawGroups.length === 0) {
    return { groups: [emptyGroup(), emptyGroup()] }
  }
  return {
    groups: rawGroups.map((g) => ({
      id: (g as Group).id || genId(),
      name: g.name || '',
      image_url: g.image_url,
      items: Array.isArray(g.items)
        ? g.items.map((it) =>
            typeof it === 'string'
              ? { id: genId(), text: it }
              : { id: it.id || genId(), text: it.text || '', image_url: it.image_url }
          )
        : [emptyItem()],
    })),
  }
}

const emptyItem = (): GroupItem => ({ id: genId(), text: '' })
const emptyGroup = (): Group => ({ id: genId(), name: '', items: [emptyItem()] })

// ------- Component -------

export default function GroupSortEditor({ groupData, onChange }: Props) {
  const data = useMemo<GroupData>(() => normalize(groupData), [groupData])

  // Upload state is keyed by a string like "group:<gid>" or "item:<gid>:<iid>"
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')

  const pushChange = (next: GroupData) => onChange(next)

  // ------- Group mutations -------

  const updateGroup = (gIdx: number, patch: Partial<Group>) => {
    const next = { groups: data.groups.map((g, i) => (i === gIdx ? { ...g, ...patch } : g)) }
    pushChange(next)
  }

  const addGroup = () => {
    if (data.groups.length >= MAX_GROUPS) return
    pushChange({ groups: [...data.groups, emptyGroup()] })
  }

  const deleteGroup = (gIdx: number) => {
    if (data.groups.length <= MIN_GROUPS) return
    pushChange({ groups: data.groups.filter((_, i) => i !== gIdx) })
  }

  // ------- Item mutations -------

  const updateItem = (gIdx: number, iIdx: number, patch: Partial<GroupItem>) => {
    const items = data.groups[gIdx].items.map((it, i) => (i === iIdx ? { ...it, ...patch } : it))
    updateGroup(gIdx, { items })
  }

  const addItem = (gIdx: number) => {
    const group = data.groups[gIdx]
    if (group.items.length >= MAX_ITEMS) return
    updateGroup(gIdx, { items: [...group.items, emptyItem()] })
  }

  const deleteItem = (gIdx: number, iIdx: number) => {
    const group = data.groups[gIdx]
    if (group.items.length <= MIN_ITEMS) return
    updateGroup(gIdx, { items: group.items.filter((_, i) => i !== iIdx) })
  }

  const duplicateItem = (gIdx: number, iIdx: number) => {
    const group = data.groups[gIdx]
    if (group.items.length >= MAX_ITEMS) return
    const toCopy = group.items[iIdx]
    const copy: GroupItem = { id: genId(), text: toCopy.text, image_url: toCopy.image_url }
    const items = [...group.items.slice(0, iIdx + 1), copy, ...group.items.slice(iIdx + 1)]
    updateGroup(gIdx, { items })
  }

  const moveItem = (gIdx: number, iIdx: number, direction: -1 | 1) => {
    const group = data.groups[gIdx]
    const target = iIdx + direction
    if (target < 0 || target >= group.items.length) return
    const items = [...group.items]
    ;[items[iIdx], items[target]] = [items[target], items[iIdx]]
    updateGroup(gIdx, { items })
  }

  // ------- Image upload -------

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, fileType: file.type, fileName: file.name }),
      })
      const body = await res.json()
      if (res.ok && body.url) return body.url as string
      setUploadError(body.error || 'Upload failed')
      return null
    } catch {
      setUploadError('Failed to upload image')
      return null
    }
  }

  const uploadGroupImage = async (gIdx: number, file: File) => {
    const key = `group:${data.groups[gIdx].id}`
    setUploadingKey(key)
    setUploadError('')
    const url = await uploadImage(file)
    if (url) updateGroup(gIdx, { image_url: url })
    setUploadingKey(null)
  }

  const uploadItemImage = async (gIdx: number, iIdx: number, file: File) => {
    const key = `item:${data.groups[gIdx].id}:${data.groups[gIdx].items[iIdx].id}`
    setUploadingKey(key)
    setUploadError('')
    const url = await uploadImage(file)
    if (url) updateItem(gIdx, iIdx, { image_url: url })
    setUploadingKey(null)
  }

  // ------- Render -------

  return (
    <div className="space-y-3">
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-500">
          {uploadError}
        </div>
      )}

      {/* Groups grid — two columns on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.groups.map((group, gIdx) => {
          const canDeleteGroup = data.groups.length > MIN_GROUPS
          const groupUploadKey = `group:${group.id}`
          const isGroupUploading = uploadingKey === groupUploadKey

          return (
            <div
              key={group.id}
              className="bg-[#f7fafd] rounded-xl p-4 border border-[#e6f0fa]"
            >
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-[#416ebe] uppercase whitespace-nowrap">
                  Group {gIdx + 1}
                </span>
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) => updateGroup(gIdx, { name: e.target.value })}
                  placeholder="Group name"
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm text-[#46464b] bg-white border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
                />
                {/* Group image upload */}
                <label
                  title={group.image_url ? 'Change group image' : 'Add group image'}
                  className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-dashed border-[#cddcf0] cursor-pointer hover:border-[#416ebe] transition-colors ${isGroupUploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <span className="text-[11px] text-gray-400">
                    {isGroupUploading ? '…' : '\uD83D\uDCF7'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    className="hidden"
                    disabled={isGroupUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadGroupImage(gIdx, f)
                      if (e.target) e.target.value = ''
                    }}
                  />
                </label>
                {/* Delete group */}
                <button
                  onClick={() => deleteGroup(gIdx)}
                  disabled={!canDeleteGroup}
                  title={canDeleteGroup ? 'Delete group' : `At least ${MIN_GROUPS} groups required`}
                  className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${canDeleteGroup ? 'text-gray-300 hover:text-red-400 hover:bg-red-50' : 'text-gray-200 cursor-not-allowed'}`}
                >
                  <span className="text-sm">{'\uD83D\uDDD1'}</span>
                </button>
              </div>

              {/* Group image preview */}
              {group.image_url && (
                <div className="mb-3 flex items-center gap-2">
                  <img
                    src={group.image_url}
                    alt=""
                    className="h-16 max-w-[120px] object-contain rounded-lg border border-[#cddcf0] bg-white"
                  />
                  <button
                    onClick={() => updateGroup(gIdx, { image_url: undefined })}
                    className="text-[10px] text-gray-300 hover:text-red-400"
                  >
                    {'\u2715'} Remove image
                  </button>
                </div>
              )}

              {/* Items */}
              <div className="space-y-2">
                {group.items.map((item, iIdx) => {
                  const itemUploadKey = `item:${group.id}:${item.id}`
                  const isItemUploading = uploadingKey === itemUploadKey
                  const canDeleteItem = group.items.length > MIN_ITEMS
                  const canMoveUp = iIdx > 0
                  const canMoveDown = iIdx < group.items.length - 1

                  return (
                    <div key={item.id} className="flex items-start gap-1.5">
                      <span className="text-[11px] font-bold text-gray-400 pt-1.5 w-4 text-right flex-shrink-0">
                        {iIdx + 1}.
                      </span>
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => updateItem(gIdx, iIdx, { text: e.target.value })}
                            placeholder="Item text"
                            className="flex-1 min-w-0 px-2 py-1.5 text-sm text-[#46464b] bg-white border border-[#cddcf0] rounded-lg focus:outline-none focus:border-[#416ebe] transition-colors"
                          />
                          {/* Item image upload */}
                          <label
                            title={item.image_url ? 'Change image' : 'Add image'}
                            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#416ebe] cursor-pointer ${isItemUploading ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <span className="text-[11px]">
                              {isItemUploading ? '…' : '\uD83D\uDCF7'}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                              className="hidden"
                              disabled={isItemUploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) uploadItemImage(gIdx, iIdx, f)
                                if (e.target) e.target.value = ''
                              }}
                            />
                          </label>
                          {/* Move up */}
                          <button
                            onClick={() => moveItem(gIdx, iIdx, -1)}
                            disabled={!canMoveUp}
                            title="Move up"
                            className={`flex-shrink-0 w-6 h-7 flex items-center justify-center rounded transition-colors ${canMoveUp ? 'text-gray-300 hover:text-[#416ebe]' : 'text-gray-200 cursor-not-allowed'}`}
                          >
                            <span className="text-xs">{'\u2191'}</span>
                          </button>
                          {/* Move down */}
                          <button
                            onClick={() => moveItem(gIdx, iIdx, 1)}
                            disabled={!canMoveDown}
                            title="Move down"
                            className={`flex-shrink-0 w-6 h-7 flex items-center justify-center rounded transition-colors ${canMoveDown ? 'text-gray-300 hover:text-[#416ebe]' : 'text-gray-200 cursor-not-allowed'}`}
                          >
                            <span className="text-xs">{'\u2193'}</span>
                          </button>
                          {/* Duplicate */}
                          <button
                            onClick={() => duplicateItem(gIdx, iIdx)}
                            disabled={group.items.length >= MAX_ITEMS}
                            title="Duplicate"
                            className={`flex-shrink-0 w-6 h-7 flex items-center justify-center rounded transition-colors ${group.items.length < MAX_ITEMS ? 'text-gray-300 hover:text-[#416ebe]' : 'text-gray-200 cursor-not-allowed'}`}
                          >
                            <span className="text-xs">{'\u29C9'}</span>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => deleteItem(gIdx, iIdx)}
                            disabled={!canDeleteItem}
                            title={canDeleteItem ? 'Delete item' : `At least ${MIN_ITEMS} item required`}
                            className={`flex-shrink-0 w-6 h-7 flex items-center justify-center rounded transition-colors ${canDeleteItem ? 'text-gray-300 hover:text-red-400' : 'text-gray-200 cursor-not-allowed'}`}
                          >
                            <span className="text-sm">{'\u2715'}</span>
                          </button>
                        </div>
                        {/* Item image preview */}
                        {item.image_url && (
                          <div className="flex items-center gap-2">
                            <img
                              src={item.image_url}
                              alt=""
                              className="h-12 max-w-[100px] object-contain rounded-md border border-[#cddcf0] bg-white"
                            />
                            <button
                              onClick={() => updateItem(gIdx, iIdx, { image_url: undefined })}
                              className="text-[10px] text-gray-300 hover:text-red-400"
                            >
                              {'\u2715'} Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add item */}
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => addItem(gIdx)}
                  disabled={group.items.length >= MAX_ITEMS}
                  className={`text-xs font-bold transition-colors ${group.items.length < MAX_ITEMS ? 'text-[#416ebe] hover:underline' : 'text-gray-300 cursor-not-allowed'}`}
                >
                  + Add an item
                </button>
                <p className="text-[10px] text-gray-300">
                  min {MIN_ITEMS}  max {MAX_ITEMS}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add group */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={addGroup}
          disabled={data.groups.length >= MAX_GROUPS}
          className={`text-sm font-bold transition-colors ${data.groups.length < MAX_GROUPS ? 'text-[#416ebe] hover:underline' : 'text-gray-300 cursor-not-allowed'}`}
        >
          + Add a group
        </button>
        <p className="text-[10px] text-gray-300">
          min {MIN_GROUPS}  max {MAX_GROUPS}
        </p>
      </div>
    </div>
  )
}
