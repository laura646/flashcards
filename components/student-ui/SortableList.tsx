'use client'

// Wave 0 — reusable accessible drag-to-reorder list.
//
// Replaces the mouse-only HTML5 drag (dead on touchscreens, invisible to
// screen readers — UX-pass finding). Built on dnd-kit so it works with:
//   • mouse  • touch (PointerSensor)  • keyboard (focus the grip → Space to
//     lift → ↑/↓ to move → Space to drop)
// Reused by the builder outline and any reorderable list; the IELTS
// drag-bank / matching types build on the same dnd-kit foundation.
//
// Render-prop API: you render each row and spread `handle` onto the grip,
// so the rest of the row stays clickable.

import { ReactNode } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Item { id: string }

// Props to spread onto the drag handle (no `any` — derived from the hook).
export type DragHandle = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>

function Row({ id, children }: { id: string; children: (handle: DragHandle) => ReactNode }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined, position: 'relative' }}
    >
      {children({ attributes, listeners })}
    </div>
  )
}

export function SortableList<T extends Item>({
  items, onReorder, renderItem, className = '',
}: {
  items: T[]
  onReorder: (items: T[]) => void
  renderItem: (item: T, handle: DragHandle) => ReactNode
  className?: string
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      const from = items.findIndex((i) => i.id === active.id)
      const to = items.findIndex((i) => i.id === over.id)
      if (from !== -1 && to !== -1) onReorder(arrayMove(items, from, to))
    }
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <Row key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </Row>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export default SortableList
