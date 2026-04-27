'use client'

/**
 * Panneau sections de la sidebar. Liste des blocs avec drag handle,
 * click-pour-sélectionner, delete. Bouton "Ajouter une section" avec menu
 * des 13 types ajoutables (footer exclu, auto-appendé).
 */

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import type { EmailBlock, EmailBlockType } from '@/types'
import {
  ADDABLE_EMAIL_BLOCK_TYPES,
  EMAIL_BLOCK_LABELS,
  createDefaultEmailBlock,
} from '@/lib/email/defaults'

interface Props {
  blocks: EmailBlock[]
  selectedBlockId: string | null
  onBlocksChange: (blocks: EmailBlock[]) => void
  onSelectBlock: (id: string | null) => void
}

export default function EmailSectionsListPanel({
  blocks,
  selectedBlockId,
  onBlocksChange,
  onSelectBlock,
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Footer est séparé et non draggable
  const footerBlock = blocks.find((b) => b.type === 'footer')
  const contentBlocks = blocks.filter((b) => b.type !== 'footer')

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = contentBlocks.findIndex((b) => b.id === active.id)
    const newIndex = contentBlocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(contentBlocks, oldIndex, newIndex)
    onBlocksChange(footerBlock ? [...reordered, footerBlock] : reordered)
  }

  function handleAddBlock(type: EmailBlockType) {
    const newBlock = createDefaultEmailBlock(type)
    const newBlocks = footerBlock
      ? [...contentBlocks, newBlock, footerBlock]
      : [...contentBlocks, newBlock]
    onBlocksChange(newBlocks)
    onSelectBlock(newBlock.id)
    setShowAddMenu(false)
  }

  function handleDelete(id: string) {
    onBlocksChange(blocks.filter((b) => b.id !== id))
    if (selectedBlockId === id) onSelectBlock(null)
  }

  return (
    <div style={{ padding: '16px 14px', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          paddingLeft: 2,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Sections ({contentBlocks.length})
        </span>
        <button
          onClick={() => setShowAddMenu((s) => !s)}
          title="Ajouter une section"
          style={{
            padding: '4px 10px 4px 6px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
          <Plus size={11} /> Ajouter
        </button>
      </div>

      {showAddMenu && (
        <div
          style={{
            background: '#141414',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: 4,
            marginBottom: 10,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {ADDABLE_EMAIL_BLOCK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleAddBlock(type)}
              style={{
                display: 'block',
                width: '100%',
                padding: '7px 10px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: '#ddd',
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: 4,
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {EMAIL_BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={contentBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {contentBlocks.map((block) => (
              <SortableBlockRow
                key={block.id}
                block={block}
                selected={selectedBlockId === block.id}
                onSelect={() => onSelectBlock(block.id)}
                onDelete={() => handleDelete(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {footerBlock && (
        <div
          onClick={() => onSelectBlock(footerBlock.id)}
          style={{
            marginTop: 10,
            padding: '9px 12px',
            background:
              selectedBlockId === footerBlock.id
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(255,255,255,0.02)',
            border:
              selectedBlockId === footerBlock.id
                ? '1px solid #fff'
                : '1px dashed rgba(255,255,255,0.1)',
            borderRadius: 8,
            fontSize: 12,
            color: '#aaa',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <span>{EMAIL_BLOCK_LABELS.footer}</span>
          <span
            style={{
              fontSize: 8,
              padding: '1px 5px',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)',
              borderRadius: 3,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
              fontWeight: 700,
            }}
          >
            verrouillé
          </span>
        </div>
      )}
    </div>
  )
}

function SortableBlockRow({
  block,
  selected,
  onSelect,
  onDelete,
}: {
  block: EmailBlock
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id: block.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        padding: '9px 10px',
        background: selected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
        border: selected ? '1px solid #fff' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        gap: 8,
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
      {...attributes}
      onClick={onSelect}
    >
      <span
        ref={setActivatorNodeRef}
        {...listeners}
        style={{ cursor: 'grab', color: '#555', display: 'flex', touchAction: 'none' }}
      >
        <GripVertical size={13} />
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: selected ? '#fff' : '#ccc',
          fontWeight: selected ? 600 : 500,
        }}
      >
        {EMAIL_BLOCK_LABELS[block.type] || block.type}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        title="Supprimer"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#555',
          display: 'flex',
          padding: 2,
          borderRadius: 4,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#E53E3E'
          e.currentTarget.style.background = 'rgba(229,62,62,0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#555'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
