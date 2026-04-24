'use client'

import Link from 'next/link'
import { useState } from 'react'
import { X, GripVertical, Palette } from 'lucide-react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { StatusConfig } from '@/types'

interface Props {
  config: StatusConfig
  onClose: () => void
  onSave: (next: StatusConfig) => void
}

function Row({ entry, onToggle }: { entry: StatusConfig[number]; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.key })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 8,
    background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
  }
  return (
    <div ref={setNodeRef} style={style}>
      <button type="button" {...attributes} {...listeners} style={{
        background: 'none', border: 'none', cursor: 'grab', color: 'var(--text-label)', padding: 0,
      }}>
        <GripVertical size={14} />
      </button>
      <input type="checkbox" checked={entry.visible} onChange={onToggle} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{entry.label}</span>
    </div>
  )
}

export default function KanbanColumnsConfigModal({ config, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<StatusConfig>(config)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function toggle(key: string) {
    setDraft((prev) => prev.map((e) => (e.key === key ? { ...e, visible: !e.visible } : e)))
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = draft.findIndex((x) => x.key === active.id)
    const newIndex = draft.findIndex((x) => x.key === over.id)
    setDraft(arrayMove(draft, oldIndex, newIndex))
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 20, minWidth: 360, maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Configurer les colonnes
          </h2>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4,
          }}>
            <X size={16} />
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={draft.map((e) => e.key)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {draft.map((entry) => (
                <Row key={entry.key} entry={entry} onToggle={() => toggle(entry.key)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Link
          href="/parametres/reglages#statuts"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none',
            marginBottom: 14,
          }}
        >
          <Palette size={12} /> Personnaliser les libellés et couleurs
        </Link>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            background: 'transparent', border: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            Annuler
          </button>
          <button type="button" onClick={() => { onSave(draft); onClose() }} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
          }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
