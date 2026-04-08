'use client'

/**
 * T-028c — Matrice de tests visuels des 12 blocs migrés.
 *
 * Page de dev (non listée dans la nav admin) qui rend les 12 blocs Funnels
 * avec un funnel test, et permet de switcher entre les 20 presets pour
 * repérer les ratés visuels (textes illisibles, contrastes pétés, etc.).
 *
 * Utilisée pendant la Phase 7 de T-028c pour valider que la migration de
 * chaque bloc respecte le design system v2 sur tous les presets.
 *
 * Différence avec /dev/funnels-sandbox :
 * - sandbox = test du **design system** (presets + 15 effets en isolation)
 * - matrix  = test de la **migration des blocs** (12 blocs réels avec données de démo)
 *
 * Accessible uniquement en dev via http://localhost:3000/dev/funnels-blocks-matrix
 */

import { useState } from 'react'
import Link from 'next/link'

import {
  FUNNEL_PRESETS,
  DEFAULT_PRESET_ID,
  getPresetByIdOrDefault,
} from '@/lib/funnels/presets'
import { getPresetCssVars } from '@/lib/funnels/apply-preset'
import type {
  HeroBlockConfig,
  VideoBlockConfig,
  TestimonialsBlockConfig,
  FormBlockConfig,
  BookingBlockConfig,
  PricingBlockConfig,
  FaqBlockConfig,
  CountdownBlockConfig,
  CtaBlockConfig,
  FunnelTextBlockConfig,
  FunnelImageBlockConfig,
  SpacerBlockConfig,
} from '@/types'

import HeroBlock from '@/components/funnels/blocks/HeroBlock'
import VideoBlock from '@/components/funnels/blocks/VideoBlock'
import TestimonialsBlock from '@/components/funnels/blocks/TestimonialsBlock'
import FormBlock from '@/components/funnels/blocks/FormBlock'
import BookingBlock from '@/components/funnels/blocks/BookingBlock'
import PricingBlock from '@/components/funnels/blocks/PricingBlock'
import FaqBlock from '@/components/funnels/blocks/FaqBlock'
import CountdownBlock from '@/components/funnels/blocks/CountdownBlock'
import CtaBlock from '@/components/funnels/blocks/CtaBlock'
import TextBlock from '@/components/funnels/blocks/TextBlock'
import ImageBlock from '@/components/funnels/blocks/ImageBlock'
import SpacerBlock from '@/components/funnels/blocks/SpacerBlock'

import '@/styles/funnels/tokens.css'
import '@/styles/funnels/base.css'
import '@/styles/funnels/effects/e1-shimmer.css'
import '@/styles/funnels/effects/e2-hero-glow.css'
import '@/styles/funnels/effects/e3-button-shine.css'
import '@/styles/funnels/effects/e4-colored-shadow.css'
import '@/styles/funnels/effects/e5-badge-pulse.css'
import '@/styles/funnels/effects/e6-lightbox.css'
import '@/styles/funnels/effects/e7-count-up.css'
import '@/styles/funnels/effects/e8-reveal-scroll.css'
import '@/styles/funnels/effects/e9-marquee.css'
import '@/styles/funnels/effects/e10-countdown.css'
import '@/styles/funnels/effects/e11-before-after.css'
import '@/styles/funnels/effects/e12-noise.css'
import '@/styles/funnels/effects/e13-parallax.css'
import '@/styles/funnels/effects/e14-cursor-glow.css'
import '@/styles/funnels/effects/e15-sticky-cta.css'

// Date cible du countdown (3 jours dans le futur, recalculée à chaque mount)
const COUNTDOWN_TARGET = new Date(Date.now() + 3 * 86400 * 1000 + 5 * 3600 * 1000).toISOString()

// ─── Données de démo pour chaque type de bloc ──────────────────────────────

const DEMO: {
  hero: HeroBlockConfig
  video: VideoBlockConfig
  text: FunnelTextBlockConfig
  image: FunnelImageBlockConfig
  cta: CtaBlockConfig
  cta_outline: CtaBlockConfig
  spacer: SpacerBlockConfig
  pricing: PricingBlockConfig
  pricing_highlighted: PricingBlockConfig
  faq: FaqBlockConfig
  countdown: CountdownBlockConfig
  testimonials: TestimonialsBlockConfig
  booking: BookingBlockConfig
  form: FormBlockConfig
} = {
  hero: {
    title: 'Découvre comment atteindre tes objectifs en 90 jours',
    subtitle: 'Sans sacrifier ta vie perso. Pour ne plus jamais subir l\'effet yoyo.',
    ctaText: 'Réserve ton bilan offert',
    ctaUrl: '#',
    backgroundImage: null,
    alignment: 'center',
  },
  video: {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    autoplay: false,
    controls: true,
    aspectRatio: '16:9',
  },
  text: {
    content:
      "Voici un paragraphe de texte libre.\nIl peut contenir plusieurs lignes.\nUtile pour expliquer ton offre en détail.",
    alignment: 'center',
  },
  image: {
    src: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="300" fill="%23667eea"/><text x="300" y="160" font-family="sans-serif" font-size="32" font-weight="700" fill="white" text-anchor="middle">Image de démo</text></svg>`
    )}`,
    alt: 'Image de démo',
    width: null,
    alignment: 'center',
    linkUrl: null,
  },
  cta: {
    text: 'Réserver mon appel',
    url: '#',
    style: 'primary',
    size: 'lg',
    alignment: 'center',
  },
  cta_outline: {
    text: 'En savoir plus',
    url: '#',
    style: 'outline',
    size: 'md',
    alignment: 'center',
  },
  spacer: { height: 40 },
  pricing: {
    title: 'Coaching essentiel',
    price: '297',
    currency: '€',
    period: 'mois',
    features: [
      '1 séance par semaine',
      'Plan d\'action personnalisé',
      'Support WhatsApp 7j/7',
      'Communauté privée',
    ],
    ctaText: 'Choisir cette offre',
    ctaUrl: '#',
    highlighted: false,
  },
  pricing_highlighted: {
    title: 'Coaching premium',
    price: '697',
    currency: '€',
    period: 'mois',
    features: [
      '2 séances par semaine',
      'Plan d\'action sur mesure',
      'Support WhatsApp 24/7',
      'Communauté VIP',
      'Audit business mensuel',
    ],
    ctaText: 'Démarrer maintenant',
    ctaUrl: '#',
    highlighted: true,
  },
  faq: {
    title: 'Questions fréquentes',
    items: [
      {
        question: 'Combien de temps prend l\'accompagnement ?',
        answer:
          "Le programme dure 90 jours avec un suivi hebdomadaire. Tu peux ensuite continuer en mode coaching libre.",
      },
      {
        question: "Est-ce que ça marche pour mon métier ?",
        answer:
          "La méthode est universelle. Coachs sportifs, business coaches, consultants : tous mes clients voient des résultats.",
      },
      {
        question: 'Y a-t-il une garantie ?',
        answer:
          "Oui, garantie satisfait ou remboursé sous 14 jours. Si tu n'es pas convaincu, je te rembourse intégralement.",
      },
    ],
  },
  countdown: {
    targetDate: COUNTDOWN_TARGET,
    title: "L'offre se termine bientôt",
    expiredMessage: 'Cette offre est terminée.',
    style: 'simple',
  },
  testimonials: {
    items: [
      {
        name: 'Sarah Martin',
        role: 'Coach business',
        content:
          "J'ai doublé mon CA en 4 mois grâce à la méthode. Les résultats ont dépassé toutes mes attentes.",
        avatarUrl: null,
        rating: 5,
      },
      {
        name: 'Marc Dupont',
        role: 'Coach sportif',
        content: 'Méthode claire, accompagnement au top. Je recommande à 100%.',
        avatarUrl: null,
        rating: 5,
      },
      {
        name: 'Léa Bernard',
        role: 'Coach mindset',
        content: 'Un vrai déclic. Je sais enfin où je vais et comment y aller.',
        avatarUrl: null,
        rating: 4,
      },
    ],
    layout: 'grid',
    columns: 3,
  },
  booking: {
    calendarId: 'demo-calendar',
    title: 'Réserve ton appel découverte',
    subtitle: '30 minutes pour qu\'on fasse le point sur ta situation et tes objectifs.',
  },
  form: {
    title: 'Candidature au programme',
    subtitle: 'Réponds à ces quelques questions pour qu\'on évalue si on peut t\'aider.',
    fields: [
      { key: 'name', label: 'Prénom', type: 'text', placeholder: 'Sarah', required: true },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'sarah@example.com', required: true },
      { key: 'phone', label: 'Téléphone', type: 'tel', placeholder: '+33 6 12 34 56 78', required: false },
      {
        key: 'budget',
        label: 'Quel est ton budget mensuel ?',
        type: 'select',
        placeholder: 'Choisis une fourchette',
        required: true,
        options: ['< 300€', '300-700€', '700-1500€', '> 1500€'],
      },
      {
        key: 'goal',
        label: 'Quel est ton objectif principal ?',
        type: 'textarea',
        placeholder: 'Décris en quelques mots...',
        required: true,
      },
    ],
    submitText: 'Envoyer ma candidature',
    redirectUrl: null,
    successMessage: 'Merci ! Nous reviendrons vers toi sous 24h.',
  },
}

interface BlockSection {
  id: string
  label: string
  render: () => React.ReactNode
}

const BLOCK_SECTIONS: BlockSection[] = [
  { id: 'hero', label: '1 · Hero', render: () => <HeroBlock config={DEMO.hero} /> },
  { id: 'video', label: '2 · Video', render: () => <VideoBlock config={DEMO.video} /> },
  { id: 'text', label: '3 · Text', render: () => <TextBlock config={DEMO.text} /> },
  { id: 'image', label: '4 · Image', render: () => <ImageBlock config={DEMO.image} /> },
  {
    id: 'cta',
    label: '5 · CTA (primary + outline)',
    render: () => (
      <>
        <CtaBlock config={DEMO.cta} />
        <CtaBlock config={DEMO.cta_outline} />
      </>
    ),
  },
  { id: 'spacer', label: '6 · Spacer (40px)', render: () => <SpacerBlock config={DEMO.spacer} /> },
  {
    id: 'pricing',
    label: '7 · Pricing (standard + highlighted)',
    render: () => (
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        <PricingBlock config={DEMO.pricing} />
        <PricingBlock config={DEMO.pricing_highlighted} />
      </div>
    ),
  },
  { id: 'faq', label: '8 · FAQ', render: () => <FaqBlock config={DEMO.faq} /> },
  { id: 'countdown', label: '9 · Countdown', render: () => <CountdownBlock config={DEMO.countdown} /> },
  {
    id: 'testimonials',
    label: '10 · Testimonials',
    render: () => <TestimonialsBlock config={DEMO.testimonials} />,
  },
  {
    id: 'booking',
    label: '11 · Booking (À venir)',
    render: () => <BookingBlock config={DEMO.booking} />,
  },
  { id: 'form', label: '12 · Form (À venir)', render: () => <FormBlock config={DEMO.form} /> },
]

export default function FunnelsBlocksMatrixPage() {
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PRESET_ID)
  const preset = getPresetByIdOrDefault(selectedId)
  const cssVars = getPresetCssVars(preset) as React.CSSProperties

  return (
    <div style={pageStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div>
          <h1 style={headerTitleStyle}>T-028c — Matrice de tests visuels des 12 blocs</h1>
          <p style={headerSubtitleStyle}>
            Chaque bloc est rendu avec des données de démo. Switche le preset
            ci-dessous pour vérifier que la migration tient sur les 20 thèmes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/dev/funnels-sandbox" style={navLinkStyle}>
            → sandbox effets
          </Link>
          <Link href="/" style={navLinkStyle}>
            ← retour
          </Link>
        </div>
      </header>

      {/* Sticky preset bar */}
      <section style={presetBarStyle}>
        <h2 style={presetBarTitleStyle}>20 presets — preset actif : {preset.name}</h2>
        <div style={presetGridStyle}>
          {FUNNEL_PRESETS.map((p) => {
            const active = p.id === selectedId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                style={presetCardStyle(active)}
              >
                <div style={swatchesStyle}>
                  <span style={{ ...swatchStyle, background: p.primary }} />
                  <span style={{ ...swatchStyle, background: p.heroBg }} />
                  <span style={{ ...swatchStyle, background: p.footerBg }} />
                </div>
                <span style={presetNameStyle}>{p.name}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Matrice : tous les blocs empilés dans un .fnl-root commun */}
      <main className="fnl-root" style={cssVars}>
        {BLOCK_SECTIONS.map((section) => (
          <section key={section.id} style={blockSectionStyle}>
            <div style={blockLabelStyle}>{section.label}</div>
            <div style={blockBodyStyle}>{section.render()}</div>
          </section>
        ))}
      </main>
    </div>
  )
}

/* ─── Styles inline du chrome admin ─── */

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a0a',
  color: '#fff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 24,
  padding: '20px 24px',
  background: '#141414',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const headerTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  margin: 0,
  marginBottom: 4,
}

const headerSubtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#a0a0a0',
  margin: 0,
  maxWidth: 700,
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#a0a0a0',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  padding: '6px 12px',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
}

const presetBarStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: 'rgba(10,10,10,0.95)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: '16px 24px',
}

const presetBarTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  opacity: 0.7,
  margin: '0 0 14px',
}

const presetGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  gap: 8,
}

const presetCardStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
  border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 6px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  textAlign: 'center',
  color: 'inherit',
  fontFamily: 'inherit',
  boxShadow: active ? '0 4px 20px rgba(255,255,255,0.1)' : 'none',
})

const swatchesStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 3,
  marginBottom: 6,
}

const swatchStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.2)',
  display: 'inline-block',
}

const presetNameStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 600,
  color: '#fff',
}

/* ─── Styles des sections de blocs ─── */

const blockSectionStyle: React.CSSProperties = {
  borderBottom: '1px dashed rgba(var(--fnl-primary-rgb), 0.15)',
  position: 'relative',
}

const blockLabelStyle: React.CSSProperties = {
  position: 'sticky',
  top: 110,
  zIndex: 10,
  display: 'inline-block',
  margin: '12px 0 0 12px',
  padding: '4px 10px',
  background: 'rgba(0, 0, 0, 0.7)',
  color: '#fff',
  fontSize: 10,
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.15)',
}

const blockBodyStyle: React.CSSProperties = {
  paddingBottom: 20,
}
