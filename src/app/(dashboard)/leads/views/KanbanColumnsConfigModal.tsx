'use client'

import { useState } from 'react'
import { X, GripVertical } from 'lucide-react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { LeadStatus } from '@/types'
import { useStatusEntry } from '@/lib/workspace/config-context'
import type { KanbanColumnsPref } from '@/lib/ui-prefs/leads-prefs'

interface Props {
  value: KanbanColumnsPref
  onClose: () => void
  onSave: (pref: KanbanColumnsPref) => void
}

function Row({ status, checked, onToggle }: { status: LeadStatus; checked: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 8,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-primary)',
  }
  const cfg = useStatusEntry(status)
  return (
    <div ref={setNodeRef} style={style}>
      <button type="button" {...attributes} {...listeners} style={{
        background: 'none', border: 'none', cursor: 'grab',
        color: 'var(--text-label)', padding: 0,
      }}>
        <GripVertical size={14} />
      </button>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color as string }} />
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{cfg.label}</span>
    </div>
  )
}

export default function KanbanColumnsConfigModal({ value, onClose, onSave }: Props) {
  const [order, setOrder] = useState<LeadStatus[]>(value.order)
  const [visible, setVisible] = useState<LeadStatus[]>(value.visible)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function toggle(s: LeadStatus) {
    setVisible(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as LeadStatus)
    const newIndex = order.indexOf(over.id as LeadStatus)
    setOrder(arrayMove(order, oldIndex, newIndex))
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 20, minWidth: 360, maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Colonnes du kanban
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-label)', cursor: 'pointer',
          }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 12 }}>
          Cocher = afficher. Glisser pour réordonner.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {order.map(s => (
                <Row key={s} status={s} checked={visible.includes(s)} onToggle={() => toggle(s)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'transparent', border: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>Annuler</button>
          <button
            onClick={() => { onSave({ visible, order }); onClose() }}
            disabled={visible.length === 0}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--color-primary)', border: 'none',
              color: '#000', cursor: visible.length === 0 ? 'not-allowed' : 'pointer',
              opacity: visible.length === 0 ? 0.5 : 1,
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
