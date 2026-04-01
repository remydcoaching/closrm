'use client'

import { useState } from 'react'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { FunnelBlock } from '@/types'

import HeroBlock from './blocks/HeroBlock'
import VideoBlock from './blocks/VideoBlock'
import TestimonialsBlock from './blocks/TestimonialsBlock'
import FormBlock from './blocks/FormBlock'
import BookingBlock from './blocks/BookingBlock'
import PricingBlock from './blocks/PricingBlock'
import FaqBlock from './blocks/FaqBlock'
import CountdownBlock from './blocks/CountdownBlock'
import CtaBlock from './blocks/CtaBlock'
import TextBlock from './blocks/TextBlock'
import ImageBlock from './blocks/ImageBlock'
import SpacerBlock from './blocks/SpacerBlock'

interface Props {
  blocks: FunnelBlock[]
  selectedBlockId: string | null
  onSelectBlock: (id: string | null) => void
  onDeleteBlock: (id: string) => void
  mode: 'desktop' | 'mobile'
}

function BlockRenderer({ block }: { block: FunnelBlock }) {
  switch (block.type) {
    case 'hero': return <HeroBlock config={block.config as Parameters<typeof HeroBlock>[0]['config']} />
    case 'video': return <VideoBlock config={block.config as Parameters<typeof VideoBlock>[0]['config']} />
    case 'testimonials': return <TestimonialsBlock config={block.config as Parameters<typeof TestimonialsBlock>[0]['config']} />
    case 'form': return <FormBlock config={block.config as Parameters<typeof FormBlock>[0]['config']} />
    case 'booking': return <BookingBlock config={block.config as Parameters<typeof BookingBlock>[0]['config']} />
    case 'pricing': return <PricingBlock config={block.config as Parameters<typeof PricingBlock>[0]['config']} />
    case 'faq': return <FaqBlock config={block.config as Parameters<typeof FaqBlock>[0]['config']} />
    case 'countdown': return <CountdownBlock config={block.config as Parameters<typeof CountdownBlock>[0]['config']} />
    case 'cta': return <CtaBlock config={block.config as Parameters<typeof CtaBlock>[0]['config']} />
    case 'text': return <TextBlock config={block.config as Parameters<typeof TextBlock>[0]['config']} />
    case 'image': return <ImageBlock config={block.config as Parameters<typeof ImageBlock>[0]['config']} />
    case 'spacer': return <SpacerBlock config={block.config as Parameters<typeof SpacerBlock>[0]['config']} />
    default: return <div style={{ padding: 20, color: '#999' }}>Bloc inconnu</div>
  }
}

function SortableBlock({
  block,
  isSelected,
  onSelect,
  onDelete,
}: {
  block: FunnelBlock
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: block.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    outline: isSelected
      ? '2px solid #3b82f6'
      : hovered
        ? '2px solid rgba(59,130,246,0.4)'
        : '2px solid transparent',
    borderRadius: 4,
    cursor: 'pointer',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={e => {
        e.stopPropagation()
        onSelect()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle */}
      {(hovered || isSelected) && (
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          style={{
            position: 'absolute', top: 8, left: 8, zIndex: 10,
            width: 24, height: 24, borderRadius: 4,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab',
          }}
        >
          <GripVertical size={14} />
        </div>
      )}

      {/* Delete button */}
      {(hovered || isSelected) && (
        <button
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 10,
            width: 24, height: 24, borderRadius: 4,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none', padding: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E53E3E' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)' }}
        >
          <X size={14} />
        </button>
      )}

      <BlockRenderer block={block} />
    </div>
  )
}

export default function FunnelPagePreview({ blocks, selectedBlockId, onSelectBlock, onDeleteBlock, mode }: Props) {
  return (
    <div
      style={{
        flex: 1, overflow: 'auto', background: '#e5e5e5',
        display: 'flex', justifyContent: 'center', padding: 24,
      }}
      onClick={() => onSelectBlock(null)}
    >
      <div style={{
        width: '100%',
        maxWidth: mode === 'mobile' ? 375 : undefined,
        background: '#fff',
        minHeight: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {blocks.length === 0 ? (
          <div style={{
            padding: 60, textAlign: 'center', color: '#999', fontSize: 14,
          }}>
            Ajoutez des blocs depuis le panneau de gauche
          </div>
        ) : (
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map(block => (
              <SortableBlock
                key={block.id}
                block={block}
                isSelected={block.id === selectedBlockId}
                onSelect={() => onSelectBlock(block.id)}
                onDelete={() => onDeleteBlock(block.id)}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
