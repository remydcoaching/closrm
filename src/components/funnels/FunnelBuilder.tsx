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
import { arrayMove } from '@dnd-kit/sortable'
import type { FunnelBlock, FunnelBlockType, FunnelBlockConfig, FunnelPage } from '@/types'
import FunnelBlockPalette from './FunnelBlockPalette'
import FunnelPagePreview from './FunnelPagePreview'
import FunnelBlockConfigPanel from './FunnelBlockConfig'

interface Props {
  pages: FunnelPage[]
  activePageId: string
  onPagesChange: (pages: FunnelPage[]) => void
  mode: 'desktop' | 'mobile'
}

function getDefaultConfig(type: FunnelBlockType): FunnelBlockConfig {
  switch (type) {
    case 'hero':
      return { title: 'Titre principal', subtitle: '', ctaText: '', ctaUrl: '', backgroundImage: null, alignment: 'center' as const }
    case 'video':
      return { url: '', autoplay: false, controls: true, aspectRatio: '16:9' as const }
    case 'testimonials':
      return { items: [{ name: 'Nom', role: 'Role', content: 'Temoignage...', avatarUrl: null, rating: 5 }], layout: 'grid' as const, columns: 3 as const }
    case 'form':
      return { title: 'Formulaire', subtitle: '', fields: [{ key: 'email', label: 'Email', type: 'email' as const, placeholder: 'votre@email.com', required: true }], submitText: 'Envoyer', redirectUrl: null, successMessage: 'Merci !' }
    case 'booking':
      return { calendarId: null, title: 'Reservez votre creneau', subtitle: '' }
    case 'pricing':
      return { title: 'Offre', price: '97', currency: 'EUR', period: '/mois', features: ['Feature 1'], ctaText: 'Souscrire', ctaUrl: '#', highlighted: false }
    case 'faq':
      return { title: 'Questions frequentes', items: [{ question: 'Question ?', answer: 'Reponse.' }] }
    case 'countdown':
      return { targetDate: new Date(Date.now() + 7 * 86400000).toISOString(), title: 'Offre limitee', expiredMessage: 'Offre expiree', style: 'simple' as const }
    case 'cta':
      return { text: 'Cliquez ici', url: '#', style: 'primary' as const, size: 'lg' as const, alignment: 'center' as const }
    case 'text':
      return { content: '<p>Votre texte ici...</p>', alignment: 'center' as const }
    case 'image':
      return { src: '', alt: '', width: null, alignment: 'center' as const, linkUrl: null }
    case 'spacer':
      return { height: 48 }
  }
}

export default function FunnelBuilder({ pages, activePageId, onPagesChange, mode }: Props) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const activePage = pages.find(p => p.id === activePageId)
  const blocks = activePage?.blocks ?? []
  const selectedBlock = blocks.find(b => b.id === selectedBlockId) ?? null

  function updateActivePageBlocks(updater: (currentBlocks: FunnelBlock[]) => FunnelBlock[]) {
    const currentPage = pages.find(p => p.id === activePageId)
    if (!currentPage) return
    const newBlocks = updater(currentPage.blocks ?? [])
    onPagesChange(pages.map(p =>
      p.id === activePageId ? { ...p, blocks: newBlocks } : p
    ))
  }

  function handleAddBlock(type: FunnelBlockType) {
    const newBlock: FunnelBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      config: getDefaultConfig(type),
    }
    updateActivePageBlocks(current => [...current, newBlock])
    setSelectedBlockId(newBlock.id)
  }

  function handleDeleteBlock(blockId: string) {
    updateActivePageBlocks(current => current.filter(b => b.id !== blockId))
    if (selectedBlockId === blockId) setSelectedBlockId(null)
  }

  function handleBlockChange(updatedBlock: FunnelBlock) {
    updateActivePageBlocks(current => current.map(b => b.id === updatedBlock.id ? updatedBlock : b))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    updateActivePageBlocks(() => arrayMove(blocks, oldIndex, newIndex))
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Palette */}
      <div style={{
        width: 240, flexShrink: 0, borderRight: '1px solid #262626',
        background: '#141414', overflowY: 'auto', padding: '12px 8px',
      }}>
        <FunnelBlockPalette onAddBlock={handleAddBlock} />
      </div>

      {/* Center: Preview */}
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <FunnelPagePreview
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onDeleteBlock={handleDeleteBlock}
            mode={mode}
          />
        </DndContext>
      </div>

      {/* Right: Config */}
      {selectedBlock && (
        <div style={{
          width: 320, flexShrink: 0, borderLeft: '1px solid #262626',
          background: '#141414', overflowY: 'auto', padding: 16,
        }}>
          <FunnelBlockConfigPanel
            block={selectedBlock}
            onChange={handleBlockChange}
          />
        </div>
      )}
    </div>
  )
}
