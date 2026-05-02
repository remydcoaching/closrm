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
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, Plus,
  FileText, Crosshair, Type, ImageIcon, MousePointerClick,
  Megaphone, Minus, ArrowUpDown, Quote, MessageSquareQuote,
  LayoutGrid, Video, Share2, PanelBottom,
} from 'lucide-react'
import type { EmailBlock, EmailBlockType } from '@/types'
import {
  ADDABLE_EMAIL_BLOCK_TYPES,
  EMAIL_BLOCK_LABELS,
  createDefaultEmailBlock,
} from '@/lib/email/defaults'

const BLOCK_TYPE_ICONS: Record<EmailBlockType, React.ReactNode> = {
  header: <FileText size={13} />,
  hero: <Crosshair size={13} />,
  text: <Type size={13} />,
  image: <ImageIcon size={13} />,
  button: <MousePointerClick size={13} />,
  cta_banner: <Megaphone size={13} />,
  divider: <Minus size={13} />,
  spacer: <ArrowUpDown size={13} />,
  quote: <Quote size={13} />,
  testimonials: <MessageSquareQuote size={13} />,
  features_grid: <LayoutGrid size={13} />,
  video: <Video size={13} />,
  social_links: <Share2 size={13} />,
  footer: <PanelBottom size={13} />,
}

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
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const footerBlock = blocks.find((b) => b.type === 'footer')
  const contentBlocks = blocks.filter((b) => b.type !== 'footer')
  const draggedBlock = draggedId ? contentBlocks.find((b) => b.id === draggedId) : null

  function handleDragStart(event: DragStartEvent) {
    setDraggedId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedId(null)
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
                display: 'flex',
                alignItems: 'center',
                gap: 8,
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
              <span style={{ display: 'flex', color: '#888', flexShrink: 0 }}>
                {BLOCK_TYPE_ICONS[type]}
              </span>
              {EMAIL_BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={contentBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {contentBlocks.map((block) => (
              <SortableBlockRow
                key={block.id}
                block={block}
                selected={selectedBlockId === block.id}
                isDragging={draggedId === block.id}
                onSelect={() => onSelectBlock(block.id)}
                onDelete={() => handleDelete(block.id)}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {draggedBlock ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '9px 10px',
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.4)',
                borderRadius: 8,
                gap: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <span style={{ color: '#3b82f6', display: 'flex' }}>
                <GripVertical size={13} />
              </span>
              <span style={{ color: '#888', display: 'flex' }}>
                {BLOCK_TYPE_ICONS[draggedBlock.type]}
              </span>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                {EMAIL_BLOCK_LABELS[draggedBlock.type]}
              </span>
            </div>
          ) : null}
        </DragOverlay>
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
  isDragging,
  onSelect,
  onDelete,
}: {
  block: EmailBlock
  selected: boolean
  isDragging: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id: block.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || 'background 0.15s ease, border-color 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 8px',
        background: isDragging
          ? 'rgba(59,130,246,0.06)'
          : selected
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(255,255,255,0.02)',
        border: isDragging
          ? '1px dashed rgba(59,130,246,0.3)'
          : selected
            ? '1px solid #fff'
            : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        gap: 6,
        cursor: 'pointer',
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      onClick={onSelect}
    >
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        type="button"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'grab',
          color: 'rgba(255,255,255,0.35)',
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          flexShrink: 0,
          touchAction: 'none',
        }}
        title="Glisser pour réorganiser"
      >
        <GripVertical size={12} />
      </button>
      <span style={{ display: 'flex', color: '#888', flexShrink: 0 }}>
        {BLOCK_TYPE_ICONS[block.type]}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 11,
          color: selected ? '#fff' : '#ccc',
          fontWeight: selected ? 600 : 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
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
          color: 'rgba(255,255,255,0.3)',
          display: 'flex',
          padding: 2,
          borderRadius: 4,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#E53E3E'
          e.currentTarget.style.background = 'rgba(229,62,62,0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
