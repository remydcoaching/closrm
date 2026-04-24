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
    <div style={{ padding: '14px', flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Sections
        </span>
        <button
          onClick={() => setShowAddMenu((s) => !s)}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: 'none',
            background: '#E53E3E',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={12} />
        </button>
      </div>

      {showAddMenu && (
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
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
                padding: '8px 10px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: '#ddd',
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: 4,
              }}
            >
              + {EMAIL_BLOCK_LABELS[type]}
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
            marginTop: 8,
            padding: '8px 10px',
            background: selectedBlockId === footerBlock.id ? 'rgba(229,62,62,0.1)' : '#141414',
            border:
              selectedBlockId === footerBlock.id
                ? '1px solid #E53E3E'
                : '1px solid #262626',
            borderRadius: 6,
            fontSize: 12,
            color: '#888',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 9, color: '#555' }}>🔒</span>
          {EMAIL_BLOCK_LABELS.footer}
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
        padding: '8px 10px',
        background: selected ? 'rgba(229,62,62,0.1)' : '#141414',
        border: selected ? '1px solid #E53E3E' : '1px solid #262626',
        borderRadius: 6,
        gap: 6,
      }}
      {...attributes}
      onClick={onSelect}
    >
      <span
        ref={setActivatorNodeRef}
        {...listeners}
        style={{ cursor: 'grab', color: '#555', display: 'flex', touchAction: 'none' }}
      >
        <GripVertical size={12} />
      </span>
      <span style={{ flex: 1, fontSize: 12, color: '#ddd' }}>
        {EMAIL_BLOCK_LABELS[block.type] || block.type}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#555',
          display: 'flex',
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
