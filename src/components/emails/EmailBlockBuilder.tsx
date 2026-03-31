'use client'

import { useState, useCallback } from 'react'
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
import type { EmailBlock, EmailBlockType } from '@/types'
import BlockRenderer from './BlockRenderer'

interface Props {
  blocks: EmailBlock[]
  onChange: (blocks: EmailBlock[]) => void
}

const BLOCK_OPTIONS: { type: EmailBlockType; label: string }[] = [
  { type: 'header', label: 'En-tête' },
  { type: 'text', label: 'Texte' },
  { type: 'image', label: 'Image' },
  { type: 'button', label: 'Bouton' },
  { type: 'divider', label: 'Séparateur' },
]

function getDefaultConfig(type: EmailBlockType): EmailBlock['config'] {
  switch (type) {
    case 'header': return { title: '', alignment: 'center' as const }
    case 'text': return { content: '' }
    case 'image': return { src: '', alt: '', alignment: 'center' as const }
    case 'button': return { text: 'Cliquer ici', url: '', color: '#E53E3E', alignment: 'center' as const }
    case 'divider': return { color: '#e4e4e7', spacing: 16 }
    case 'footer': return { text: '' }
  }
}

function SortableBlock({
  block,
  onChange,
  onDelete,
  isFooter,
}: {
  block: EmailBlock
  onChange: (block: EmailBlock) => void
  onDelete: () => void
  isFooter?: boolean
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: block.id, disabled: isFooter })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <BlockRenderer block={block} onChange={onChange} onDelete={onDelete} isFooter={isFooter} dragHandleProps={{ ref: setActivatorNodeRef, ...listeners }} />
    </div>
  )
}

export default function EmailBlockBuilder({ blocks, onChange }: Props) {
  const [, setDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Ensure footer always exists at the end
  const footerBlock = blocks.find(b => b.type === 'footer')
  const contentBlocks = blocks.filter(b => b.type !== 'footer')

  const addBlock = useCallback((type: EmailBlockType) => {
    const newBlock: EmailBlock = {
      id: `block-${Date.now()}`,
      type,
      config: getDefaultConfig(type),
    }
    // Insert before footer
    const updated = [...contentBlocks, newBlock]
    if (footerBlock) updated.push(footerBlock)
    else updated.push({ id: 'footer', type: 'footer', config: { text: '' } })
    onChange(updated)
  }, [contentBlocks, footerBlock, onChange])

  function handleDragEnd(event: DragEndEvent) {
    setDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = contentBlocks.findIndex(b => b.id === active.id)
    const newIndex = contentBlocks.findIndex(b => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(contentBlocks, oldIndex, newIndex)
    if (footerBlock) reordered.push(footerBlock)
    onChange(reordered)
  }

  function handleBlockChange(blockId: string, updated: EmailBlock) {
    onChange(blocks.map(b => b.id === blockId ? updated : b))
  }

  function handleBlockDelete(blockId: string) {
    onChange(blocks.filter(b => b.id !== blockId))
  }

  return (
    <div>
      {/* Block palette */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {BLOCK_OPTIONS.map(opt => (
          <button
            key={opt.type}
            onClick={() => addBlock(opt.type)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: '#1a1a1a', color: '#aaa', border: '1px solid #333',
              borderRadius: 8, cursor: 'pointer',
            }}
          >
            + {opt.label}
          </button>
        ))}
      </div>

      {/* Sortable blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setDragId(e.active.id as string)} onDragEnd={handleDragEnd}>
          <SortableContext items={contentBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            {contentBlocks.map(block => (
              <SortableBlock
                key={block.id}
                block={block}
                onChange={updated => handleBlockChange(block.id, updated)}
                onDelete={() => handleBlockDelete(block.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Footer (always last, not draggable) */}
        {footerBlock && (
          <BlockRenderer
            block={footerBlock}
            onChange={updated => handleBlockChange(footerBlock.id, updated)}
            onDelete={() => {}}
            isFooter
          />
        )}
      </div>
    </div>
  )
}
