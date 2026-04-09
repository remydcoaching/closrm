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
import { getBlockEffectsClasses } from '@/lib/funnels/apply-preset'

// CSS du design system T-028a — importé ici pour que tous les rendus
// (builder admin + page publique) bénéficient des classes .fnl-* dès qu'un
// container `.fnl-root` est présent dans le DOM.
// T-028 Phase 9 — Seuls les effets encore au catalogue sont importés
// (E7, E9, E10, E11, E13, E14 retirés — cf. design-types.ts).
import '@/styles/funnels/tokens.css'
import '@/styles/funnels/base.css'
// Effets forcés (toujours actifs)
import '@/styles/funnels/effects/e4-colored-shadow.css'
import '@/styles/funnels/effects/e5-badge-pulse.css'
import '@/styles/funnels/effects/e6-lightbox.css'
// Effets par-bloc (classes appliquées sur un wrapper du bloc via getBlockEffectsClasses)
import '@/styles/funnels/effects/e1-shimmer.css'
import '@/styles/funnels/effects/e3-button-shine.css'
// Effets globaux (classes appliquées sur .fnl-root via getEffectsClassNames)
import '@/styles/funnels/effects/e2-hero-glow.css'
import '@/styles/funnels/effects/e8-reveal-scroll.css'
import '@/styles/funnels/effects/e12-noise.css'
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
import FooterBlock from './blocks/FooterBlock'

/**
 * Modes de prévisualisation du builder. T-028b Phase 4 ajoute `tablet`
 * (largeur 768px) entre desktop et mobile pour permettre au coach de
 * vérifier le rendu sur les 3 breakpoints standards.
 */
export type FunnelPreviewMode = 'desktop' | 'tablet' | 'mobile'

const PREVIEW_MAX_WIDTHS: Record<FunnelPreviewMode, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 375,
}

interface Props {
  blocks: FunnelBlock[]
  selectedBlockId: string | null
  onSelectBlock: (id: string | null) => void
  onDeleteBlock: (id: string) => void
  mode: FunnelPreviewMode
  /**
   * Funnel parent (optionnel). Si fourni, ses champs `preset_id`,
   * `preset_override` et `effects_config` sont utilisés pour stylé les
   * blocs via les CSS vars `--fnl-*` du design system T-028a.
   * Si absent (cas legacy), les blocs utilisent leurs valeurs par défaut.
   */
  funnel?: Pick<Funnel, 'preset_id' | 'preset_override' | 'effects_config'> | null
}

/**
 * Dispatche un FunnelBlock vers son composant React dédié selon son `type`.
 * T-028 Phase 9 — Wrap le rendu dans un `<div className="fx-e1-shimmer fx-e3-button-shine">`
 * quand le bloc a des effets par-bloc activés (cf. getBlockEffectsClasses).
 * Ça permet au CSS des effets `.fx-eX-name .selecteur` de ne s'appliquer qu'à
 * CE bloc et pas au reste du funnel.
 */
function BlockRenderer({ block }: { block: FunnelBlock }) {
  const content = renderBlockContent(block)
  const fxClasses = getBlockEffectsClasses(block)
  // Footer: margin-top auto pour coller au bas de la page (flex parent)
  const style = block.type === 'footer' ? { marginTop: 'auto' } : undefined
  if (fxClasses.length === 0) return <div id={`block-${block.id}`} style={style}>{content}</div>
  return <div id={`block-${block.id}`} className={fxClasses.join(' ')} style={style}>{content}</div>
}

function renderBlockContent(block: FunnelBlock): React.ReactNode {
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
    case 'footer': return <FooterBlock config={block.config as Parameters<typeof FooterBlock>[0]['config']} />
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
  // tous les blocs enfants. La maxWidth dépend du mode (desktop/tablet/mobile).
  const maxWidth = PREVIEW_MAX_WIDTHS[mode]
  const isMobileLike = mode === 'mobile' || mode === 'tablet'
  // Neutralise la navigation des liens dans le builder preview.
  // Les <a> sont rendus normalement (pour le style) mais le clic ne navigue nulle part.
  function handlePreviewClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const anchor = target.closest('a')
    if (anchor) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const innerCard = (
    <div
      className={design ? `fnl-root ${design.effectsClassName}` : ''}
      onClickCapture={handlePreviewClick}
      style={{
        width: '100%',
        maxWidth,
        // Si on a un design, le background vient de --fnl-section-bg via .fnl-root.
        // Sinon (legacy), on garde le fond blanc historique pour ne rien casser.
        background: design ? undefined : '#fff',
        minHeight: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)',
        borderRadius: mode === 'mobile' ? 20 : mode === 'tablet' ? 16 : 8,
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
        padding: isMobileLike ? '24px 16px' : 32,
        transition: 'padding 0.3s ease',
      }}
      onClick={() => onSelectBlock(null)}
    >
      {innerCard}
    </div>
  )
}
