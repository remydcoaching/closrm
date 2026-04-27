'use client'

import { GripVertical, RotateCcw } from 'lucide-react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { hexToRgba } from '@/lib/workspace/config-helpers'

interface BaseEntry {
  key: string
  label: string
  color: string
  bg: string
  visible: boolean
}

interface Props<E extends BaseEntry> {
  title: string
  entries: E[]
  defaults: E[]
  onChange: (next: E[]) => void
  onReset: () => void
}

function Row<E extends BaseEntry>({
  entry, defaultEntry, onUpdate,
}: {
  entry: E
  defaultEntry: E | undefined
  onUpdate: (partial: Partial<E>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.key })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'grid', gridTemplateColumns: 'auto auto auto 1fr auto auto', gap: 10,
    alignItems: 'center', padding: '10px 12px', borderRadius: 8,
    background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
    marginBottom: 6,
  }

  const handleResetRow = () => {
    if (defaultEntry) {
      onUpdate({
        label: defaultEntry.label,
        color: defaultEntry.color,
        bg: defaultEntry.bg,
        visible: defaultEntry.visible,
      } as Partial<E>)
    }
  }

  // Native color picker returns hex '#rrggbb'. If the current color is a CSS var,
  // show a fallback hex in the picker (the actual saved color stays the var until
  // user picks a new hex).
  const isVarColor = entry.color.startsWith('var(')
  const pickerValue = isVarColor ? '#00c853' : (entry.color || '#999999')

  return (
    <div ref={setNodeRef} style={style}>
      <button type="button" {...attributes} {...listeners} style={{
        background: 'none', border: 'none', cursor: 'grab', color: 'var(--text-label)', padding: 0,
      }}>
        <GripVertical size={14} />
      </button>

      <input
        type="checkbox"
        checked={entry.visible}
        onChange={(e) => onUpdate({ visible: e.target.checked } as Partial<E>)}
        aria-label={`Visible: ${entry.label}`}
      />

      <input
        type="color"
        value={pickerValue}
        onChange={(e) => {
          const hex = e.target.value
          onUpdate({ color: hex, bg: hexToRgba(hex, 0.12) } as Partial<E>)
        }}
        aria-label={`Couleur: ${entry.label}`}
        style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
      />

      <input
        type="text"
        value={entry.label}
        onChange={(e) => onUpdate({ label: e.target.value } as Partial<E>)}
        onBlur={(e) => {
          if (!e.target.value.trim()) {
            onUpdate({ label: defaultEntry?.label ?? entry.key } as Partial<E>)
          }
        }}
        style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 13,
          background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      />

      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '3px 10px', borderRadius: 99,
        fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
        color: entry.color, background: entry.bg,
      }}>
        {entry.label || '—'}
      </span>

      <button
        type="button"
        onClick={handleResetRow}
        disabled={!defaultEntry}
        title="Réinitialiser cette entrée"
        aria-label={`Réinitialiser: ${entry.label}`}
        style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: defaultEntry ? 'pointer' : 'not-allowed', padding: 4,
        }}
      >
        <RotateCcw size={14} />
      </button>
    </div>
  )
}

export default function LabelsEditor<E extends BaseEntry>({
  title, entries, defaults, onChange, onReset,
}: Props<E>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = entries.findIndex((x) => x.key === active.id)
    const newIndex = entries.findIndex((x) => x.key === over.id)
    onChange(arrayMove(entries, oldIndex, newIndex))
  }

  const handleRowUpdate = (key: string, partial: Partial<E>) => {
    onChange(entries.map((e) => (e.key === key ? ({ ...e, ...partial }) : e)))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        <button
          type="button"
          onClick={onReset}
          style={{
            fontSize: 12, color: 'var(--text-secondary)', background: 'none',
            border: '1px solid var(--border-primary)', padding: '4px 10px',
            borderRadius: 6, cursor: 'pointer',
          }}
        >
          Réinitialiser tout
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entries.map((e) => e.key)} strategy={verticalListSortingStrategy}>
          {entries.map((entry) => (
            <Row
              key={entry.key}
              entry={entry}
              defaultEntry={defaults.find((d) => d.key === entry.key)}
              onUpdate={(partial) => handleRowUpdate(entry.key, partial)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
