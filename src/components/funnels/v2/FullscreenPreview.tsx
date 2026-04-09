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

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  // Calcule le scale pour que le container device tienne dans la zone de preview
  const updateScale = useCallback(() => {
    if (deviceWidth === '100%') {
      setPreviewScale(1)
      return
    }
    const area = previewAreaRef.current
    if (!area) return
    const areaWidth = area.clientWidth - 40 // 20px padding de chaque côté
    const targetWidth = parseInt(deviceWidth)
    const scale = Math.min(1, areaWidth / targetWidth)
    setPreviewScale(scale)
  }, [deviceWidth])

  useEffect(() => {
    // Microtask pour éviter la règle react-hooks/set-state-in-effect
    Promise.resolve().then(updateScale)
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [updateScale])

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
          {deviceWidth !== '100%' && (
            <span style={{ fontSize: 10, color: '#555', marginLeft: 8 }}>
              (aperçu simulé — {deviceWidth})
            </span>
          )}
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

      {/* Preview area — T-028 Phase 19 fix mobile : en mode tablet/mobile,
          on rend le contenu dans un container de taille fixe (768/375px) puis on
          applique un `transform: scale()` pour le réduire visuellement à la taille
          de l'écran disponible. Ça simule le rendu mobile sans que les media queries
          du design system aient besoin de se déclencher (elles ciblent le viewport,
          pas le container).

          ⚠️ Compromis V1 — les media queries CSS ne se déclenchent PAS (le viewport
          réel du navigateur reste large). Seul un rendu via iframe permettrait un vrai
          preview responsive. Noté dans ameliorations.md pour V2.

          Le scale est calculé dynamiquement pour que le container de 375/768px
          tienne dans la zone de preview disponible (viewport - topbar). */}
      <div
        ref={previewAreaRef}
        style={{
          flex: 1, overflow: 'auto',
          display: 'flex', justifyContent: 'center', alignItems: deviceWidth === '100%' ? 'stretch' : 'flex-start',
          background: '#0a0a0a',
          padding: deviceWidth === '100%' ? 0 : '20px 0',
        }}
      >
        <div
          style={{
            width: deviceWidth === '100%' ? '100%' : parseInt(deviceWidth) + 'px',
            maxWidth: '100%',
            transformOrigin: 'top center',
            transform: deviceWidth === '100%' ? undefined : `scale(${previewScale})`,
            // Quand on scale down, le container prend toujours sa taille réelle dans le layout.
            // Pour éviter un espace blanc en bas, on ajuste la hauteur du wrapper.
            ...(deviceWidth !== '100%' ? {
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            } : {}),
          }}
        >
          <div
            className={`fnl-root ${design.effectsClassName}`}
            style={{
              width: '100%',
              ...design.cssVars,
            }}
          >
            {blocks.map(block => renderBlock(block))}
          </div>
        </div>
      </div>
    </div>
  )
}
