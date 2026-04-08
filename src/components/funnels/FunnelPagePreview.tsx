'use client'

/**
 * T-028c — FunnelPagePreview enrichi pour consommer le design system v2.
 *
 * Ce composant est utilisé dans 2 contextes :
 * 1. Le builder admin (FunnelBuilder.tsx — bugué, à refondre en T-028b)
 * 2. La page publique /f/[workspaceSlug]/[funnelSlug]/[pageSlug] (rendu final)
 *
 * Ajout T-028c : prop optionnelle `funnel` qui contient `preset_id`,
 * `preset_override` et `effects_config`. Quand elle est fournie, on enrobe
 * les blocs dans un container `.fnl-root ...fxClasses` avec les CSS vars
 * `--fnl-*` injectées en `style`. Tous les blocs migrés (HeroBlock, etc.)
 * consomment ces CSS vars automatiquement.
 *
 * Quand `funnel` n'est pas fourni (cas du vieux builder), le rendu reste
 * exactement comme avant : pas de wrapper `.fnl-root`, les blocs utilisent
 * leur fallback hardcodé. → backward-compat 100%.
 */

import { useState } from 'react'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { FunnelBlock, Funnel } from '@/types'
import { loadFunnelDesign } from '@/lib/funnels/load-funnel-design'

// CSS du design system T-028a — importé ici pour que tous les rendus
// (builder admin + page publique) bénéficient des classes .fnl-* dès qu'un
// container `.fnl-root` est présent dans le DOM.
import '@/styles/funnels/tokens.css'
import '@/styles/funnels/base.css'
// Effets forcés (toujours actifs)
import '@/styles/funnels/effects/e4-colored-shadow.css'
import '@/styles/funnels/effects/e5-badge-pulse.css'
import '@/styles/funnels/effects/e6-lightbox.css'
// Effets toggleables (l'activation se fait via les classes fx-* sur .fnl-root)
import '@/styles/funnels/effects/e1-shimmer.css'
import '@/styles/funnels/effects/e2-hero-glow.css'
import '@/styles/funnels/effects/e3-button-shine.css'
import '@/styles/funnels/effects/e7-count-up.css'
import '@/styles/funnels/effects/e8-reveal-scroll.css'
import '@/styles/funnels/effects/e9-marquee.css'
import '@/styles/funnels/effects/e10-countdown.css'
import '@/styles/funnels/effects/e11-before-after.css'
import '@/styles/funnels/effects/e12-noise.css'
import '@/styles/funnels/effects/e13-parallax.css'
import '@/styles/funnels/effects/e14-cursor-glow.css'
import '@/styles/funnels/effects/e15-sticky-cta.css'

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
  /**
   * Funnel parent (optionnel). Si fourni, ses champs `preset_id`,
   * `preset_override` et `effects_config` sont utilisés pour stylé les
   * blocs via les CSS vars `--fnl-*` du design system T-028a.
   * Si absent (cas legacy), les blocs utilisent leurs valeurs par défaut.
   */
  funnel?: Pick<Funnel, 'preset_id' | 'preset_override' | 'effects_config'> | null
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

export default function FunnelPagePreview({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  mode,
  funnel,
}: Props) {
  // Si un funnel est fourni, on calcule le design (CSS vars + classes fx-*)
  // pour wrapper les blocs dans un .fnl-root correctement stylé.
  const design = funnel ? loadFunnelDesign(funnel) : null

  // Contenu commun (vide ou liste de blocs sortable)
  const blocksContent =
    blocks.length === 0 ? (
      <div
        style={{
          padding: '80px 40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#bbb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.map((block) => (
          <SortableBlock
            key={block.id}
            block={block}
            isSelected={block.id === selectedBlockId}
            onSelect={() => onSelectBlock(block.id)}
            onDelete={() => onDeleteBlock(block.id)}
          />
        ))}
      </SortableContext>
    )

  // Inner card du preview — c'est ce conteneur qui devient `.fnl-root` quand
  // un funnel est fourni, pour que les CSS vars du preset s'appliquent à
  // tous les blocs enfants.
  const innerCard = (
    <div
      className={design ? `fnl-root ${design.effectsClassName}` : ''}
      style={{
        width: '100%',
        maxWidth: mode === 'mobile' ? 375 : 1200,
        // Si on a un design, le background vient de --fnl-section-bg via .fnl-root.
        // Sinon (legacy), on garde le fond blanc historique pour ne rien casser.
        background: design ? undefined : '#fff',
        minHeight: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)',
        borderRadius: mode === 'mobile' ? 20 : 8,
        overflow: 'hidden',
        transition: 'max-width 0.3s ease, border-radius 0.3s ease',
        ...(design?.cssVars ?? {}),
      }}
    >
      {blocksContent}
    </div>
  )

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
        display: 'flex',
        justifyContent: 'center',
        padding: mode === 'mobile' ? '24px 16px' : 32,
        transition: 'padding 0.3s ease',
      }}
      onClick={() => onSelectBlock(null)}
    >
      {innerCard}
    </div>
  )
}
