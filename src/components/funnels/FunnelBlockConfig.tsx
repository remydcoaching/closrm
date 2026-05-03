'use client'

import type { FunnelBlock, FunnelBlockConfig as FunnelBlockConfigType, FunnelPage } from '@/types'
import HeroConfig from './config/HeroConfig'
import VideoConfig from './config/VideoConfig'
import TestimonialsConfig from './config/TestimonialsConfig'
import FormConfig from './config/FormConfig'
import BookingConfig from './config/BookingConfig'
import PricingConfig from './config/PricingConfig'
import FaqConfig from './config/FaqConfig'
import CountdownConfig from './config/CountdownConfig'
import CtaConfig from './config/CtaConfig'
import TextConfig from './config/TextConfig'
import ImageConfig from './config/ImageConfig'
import SpacerConfig from './config/SpacerConfig'
import FooterConfig from './config/FooterConfig'

interface Props {
  block: FunnelBlock
  onChange: (block: FunnelBlock) => void
  /** Pages du funnel — pour le sélecteur de redirection. */
  pages?: FunnelPage[]
  /** Blocs de la page active — pour le sélecteur d'ancre vers un bloc. */
  blocks?: FunnelBlock[]
}

export default function FunnelBlockConfig({ block, onChange, pages, blocks }: Props) {
  function handleConfigChange(config: FunnelBlockConfigType) {
    onChange({ ...block, config })
  }

  const LABELS: Record<string, string> = {
    hero: 'Hero',
    video: 'Video',
    testimonials: 'Temoignages',
    form: 'Formulaire',
    booking: 'Reservation',
    pricing: 'Tarification',
    faq: 'FAQ',
    countdown: 'Compte a rebours',
    cta: 'Bouton CTA',
    text: 'Texte',
    image: 'Image',
    spacer: 'Espacement',
    footer: 'Footer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: '#aaa',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        padding: '0 0 8px', borderBottom: '1px solid #262626',
      }}>
        {LABELS[block.type] || block.type}
      </div>

      {block.type === 'hero' && (
        <HeroConfig config={block.config as Parameters<typeof HeroConfig>[0]['config']} onChange={c => handleConfigChange(c)} pages={pages} blocks={blocks} />
      )}
      {block.type === 'video' && (
        <VideoConfig config={block.config as Parameters<typeof VideoConfig>[0]['config']} onChange={c => handleConfigChange(c)} />
      )}
      {block.type === 'testimonials' && (
        <TestimonialsConfig config={block.config as Parameters<typeof TestimonialsConfig>[0]['config']} onChange={c => handleConfigChange(c)} />
      )}
      {block.type === 'form' && (
        <FormConfig config={block.config as Parameters<typeof FormConfig>[0]['config']} onChange={c => handleConfigChange(c)} pages={pages} blocks={blocks} />
      )}
      {block.type === 'booking' && (
        <BookingConfig config={block.config as Parameters<typeof BookingConfig>[0]['config']} onChange={c => handleConfigChange(c)} pages={pages} blocks={blocks} />
      )}
      {block.type === 'pricing' && (
        <PricingConfig config={block.config as Parameters<typeof PricingConfig>[0]['config']} onChange={c => handleConfigChange(c)} pages={pages} blocks={blocks} />
      )}
      {block.type === 'faq' && (
        <FaqConfig config={block.config as Parameters<typeof FaqConfig>[0]['config']} onChange={c => handleConfigChange(c)} />
      )}
      {block.type === 'countdown' && (
        <CountdownConfig config={block.config as Parameters<typeof CountdownConfig>[0]['config']} onChange={c => handleConfigChange(c)} />
      )}
      {block.type === 'cta' && (
        <CtaConfig config={block.config as Parameters<typeof CtaConfig>[0]['config']} onChange={c => handleConfigChange(c)} pages={pages} blocks={blocks} />
      )}
      {block.type === 'text' && (
        <TextConfig config={block.config as Parameters<typeof TextConfig>[0]['config']} onChange={c => handleConfigChange(c)} />
      )}
      {block.type === 'image' && (
        <ImageConfig config={block.config as Parameters<typeof ImageConfig>[0]['config']} onChange={c => handleConfigChange(c)} pages={pages} blocks={blocks} />
      )}
      {block.type === 'spacer' && (
        <SpacerConfig config={block.config as Parameters<typeof SpacerConfig>[0]['config']} onChange={c => handleConfigChange(c)} />
      )}
      {block.type === 'footer' && (
        <FooterConfig config={block.config as Parameters<typeof FooterConfig>[0]['config']} onChange={c => handleConfigChange(c)} />
      )}
    </div>
  )
}
