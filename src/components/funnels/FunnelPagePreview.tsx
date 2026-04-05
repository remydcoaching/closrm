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
    transition: transition || 'outline 0.15s ease, box-shadow 0.15s ease',
    position: 'relative',
    outline: isSelected
      ? '2px solid #3b82f6'
      : hovered
        ? '2px solid rgba(59,130,246,0.35)'
        : '2px solid transparent',
    boxShadow: isSelected
      ? '0 0 0 4px rgba(59,130,246,0.1)'
      : 'none',
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
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', transition: 'background 0.15s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.8)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)' }}
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
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none', padding: 0,
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E53E3E'; e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.7)'; e.currentTarget.style.transform = 'scale(1)' }}
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
        minHeight: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
        display: 'flex', justifyContent: 'center',
        padding: mode === 'mobile' ? '24px 16px' : 32,
        transition: 'padding 0.3s ease',
      }}
      onClick={() => onSelectBlock(null)}
    >
      <div style={{
        width: '100%',
        maxWidth: mode === 'mobile' ? 375 : 1200,
        background: '#fff',
        minHeight: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)',
        borderRadius: mode === 'mobile' ? 20 : 8,
        overflow: 'hidden',
        transition: 'max-width 0.3s ease, border-radius 0.3s ease',
      }}>
        {blocks.length === 0 ? (
          <div style={{
            padding: '80px 40px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 4,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
              Aucun bloc ajouté
            </div>
            <div style={{ fontSize: 13, color: '#999', maxWidth: 260, lineHeight: 1.5 }}>
              Glissez des blocs depuis le panneau de gauche pour construire votre page
            </div>
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
