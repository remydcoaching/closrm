'use client'

/**
 * T-028 Phase 19 — Overlay plein écran de prévisualisation.
 *
 * Affiche la page active du funnel en rendu complet (avec tous les effets :
 * reveal au scroll, shimmer, hero glow, etc.) sans quitter le builder.
 * Pas besoin que le funnel soit publié, car on rend directement les composants
 * React (pas via la route publique /f/...).
 *
 * Le coach voit exactement ce que verra un visiteur, en plein écran.
 * - Bouton "Fermer" (×) en haut à droite
 * - Touche Échap pour fermer
 * - Toggle device (desktop/tablet/mobile) en haut à gauche
 * - Scroll vertical complet (le contenu peut être plus long que le viewport)
 */

import { useEffect, useState } from 'react'
import type { FunnelBlock, Funnel } from '@/types'
import { loadFunnelDesign } from '@/lib/funnels/load-funnel-design'

// Import tous les blocs
import HeroBlock from '../blocks/HeroBlock'
import VideoBlock from '../blocks/VideoBlock'
import TestimonialsBlock from '../blocks/TestimonialsBlock'
import FormBlock from '../blocks/FormBlock'
import BookingBlock from '../blocks/BookingBlock'
import PricingBlock from '../blocks/PricingBlock'
import FaqBlock from '../blocks/FaqBlock'
import CountdownBlock from '../blocks/CountdownBlock'
import CtaBlock from '../blocks/CtaBlock'
import TextBlock from '../blocks/TextBlock'
import ImageBlock from '../blocks/ImageBlock'
import SpacerBlock from '../blocks/SpacerBlock'
import FooterBlock from '../blocks/FooterBlock'
import { getBlockEffectsClasses } from '@/lib/funnels/apply-preset'

// CSS du design system
import '@/styles/funnels/tokens.css'
import '@/styles/funnels/base.css'
import '@/styles/funnels/effects/e1-shimmer.css'
import '@/styles/funnels/effects/e2-hero-glow.css'
import '@/styles/funnels/effects/e3-button-shine.css'
import '@/styles/funnels/effects/e4-colored-shadow.css'
import '@/styles/funnels/effects/e5-badge-pulse.css'
import '@/styles/funnels/effects/e6-lightbox.css'
import '@/styles/funnels/effects/e8-reveal-scroll.css'
import '@/styles/funnels/effects/e12-noise.css'
import '@/styles/funnels/effects/e15-sticky-cta.css'

interface Props {
  blocks: FunnelBlock[]
  funnel: Pick<Funnel, 'preset_id' | 'preset_override' | 'effects_config'>
  onClose: () => void
}

function renderBlock(block: FunnelBlock): React.ReactNode {
  const fxClasses = getBlockEffectsClasses(block)
  const content = renderBlockContent(block)
  if (fxClasses.length === 0) return content
  return <div key={block.id} className={fxClasses.join(' ')}>{content}</div>
}

function renderBlockContent(block: FunnelBlock): React.ReactNode {
  switch (block.type) {
    case 'hero': return <HeroBlock key={block.id} config={block.config as Parameters<typeof HeroBlock>[0]['config']} />
    case 'video': return <VideoBlock key={block.id} config={block.config as Parameters<typeof VideoBlock>[0]['config']} />
    case 'testimonials': return <TestimonialsBlock key={block.id} config={block.config as Parameters<typeof TestimonialsBlock>[0]['config']} />
    case 'form': return <FormBlock key={block.id} config={block.config as Parameters<typeof FormBlock>[0]['config']} />
    case 'booking': return <BookingBlock key={block.id} config={block.config as Parameters<typeof BookingBlock>[0]['config']} />
    case 'pricing': return <PricingBlock key={block.id} config={block.config as Parameters<typeof PricingBlock>[0]['config']} />
    case 'faq': return <FaqBlock key={block.id} config={block.config as Parameters<typeof FaqBlock>[0]['config']} />
    case 'countdown': return <CountdownBlock key={block.id} config={block.config as Parameters<typeof CountdownBlock>[0]['config']} />
    case 'cta': return <CtaBlock key={block.id} config={block.config as Parameters<typeof CtaBlock>[0]['config']} />
    case 'text': return <TextBlock key={block.id} config={block.config as Parameters<typeof TextBlock>[0]['config']} />
    case 'image': return <ImageBlock key={block.id} config={block.config as Parameters<typeof ImageBlock>[0]['config']} />
    case 'spacer': return <SpacerBlock key={block.id} config={block.config as Parameters<typeof SpacerBlock>[0]['config']} />
    case 'footer': return <FooterBlock key={block.id} config={block.config as Parameters<typeof FooterBlock>[0]['config']} />
    default: return null
  }
}

export default function FullscreenPreview({ blocks, funnel, onClose }: Props) {
  const [deviceWidth, setDeviceWidth] = useState<'100%' | '768px' | '375px'>('100%')

  // Échap pour fermer + lock scroll body
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const design = loadFunnelDesign(funnel)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9997,
      background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'rgba(20,20,20,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
        flexShrink: 0,
      }}>
        {/* Device toggles */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['100%', '768px', '375px'] as const).map((w) => (
            <button
              key={w}
              onClick={() => setDeviceWidth(w)}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 600,
                background: deviceWidth === w ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: deviceWidth === w ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                borderRadius: 6, color: deviceWidth === w ? '#fff' : '#888',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
            >
              {w === '100%' ? 'Desktop' : w === '768px' ? 'Tablet' : 'Mobile'}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>
          Prévisualisation
        </span>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#ccc', cursor: 'pointer', fontSize: 18,
            fontFamily: 'inherit', fontWeight: 300,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#444' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          title="Fermer (Échap)"
          aria-label="Fermer la prévisualisation"
        >
          ×
        </button>
      </div>

      {/* Preview area */}
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'flex', justifyContent: 'center',
        background: '#0a0a0a',
        padding: deviceWidth === '100%' ? 0 : '20px 0',
      }}>
        <div
          className={`fnl-root ${design.effectsClassName}`}
          style={{
            width: deviceWidth,
            maxWidth: '100%',
            ...design.cssVars,
          }}
        >
          {blocks.map(block => renderBlock(block))}
        </div>
      </div>
    </div>
  )
}
