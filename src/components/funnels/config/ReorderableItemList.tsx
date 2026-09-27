'use client'

// T-048 — Wrapper générique drag & drop pour les listes d'items dans les
// panneaux de config (cartes Problèmes/Programme, points Qualifier, stats
// Coach). Même lib (dnd-kit) que le réordonnancement des blocs dans
// SectionsListPanel, mais scopée localement à une seule liste — chaque
// instance a son propre DndContext, pas de conflit entre elles ni avec
// celui des blocs.

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface Props<T extends { id: string }> {
  items: T[]
  onChange: (items: T[]) => void
  onAdd: () => void
  addLabel: string
  /** Doit inclure son propre contrôle de suppression (bouton "Supprimer"). */
  renderItem: (item: T, index: number) => React.ReactNode
}

export default function ReorderableItemList<T extends { id: string }>({
  items, onChange, onAdd, addLabel, renderItem,
}: Props<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item, i) => (
            <SortableItemRow key={item.id} id={item.id}>
              {renderItem(item, i)}
            </SortableItemRow>
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={onAdd}
        style={{
          padding: '6px 12px', fontSize: 12, background: '#1a1a1a', border: '1px dashed #444',
          borderRadius: 8, color: '#aaa', cursor: 'pointer',
        }}
      >
        + {addLabel}
      </button>
    </div>
  )
}

function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        type="button"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 28, flexShrink: 0, marginTop: 8,
          background: 'none', border: 'none', color: '#555', cursor: 'grab',
        }}
        title="Glisser pour réorganiser"
        aria-label="Glisser pour réorganiser"
      >
        <GripVertical size={14} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
