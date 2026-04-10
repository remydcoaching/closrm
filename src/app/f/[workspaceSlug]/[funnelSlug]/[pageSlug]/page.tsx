'use client'

/**
 * T-028c — Page publique de funnel migrée vers le design system v2.
 *
 * Modifications par rapport à la version d'avant T-028c :
 * 1. Consomme le champ `funnel` (preset_id, preset_override, effects_config)
 *    retourné par l'API publique en plus de `page` et `branding`
 * 2. Wrappe le rendu dans un container `.fnl-root` avec les CSS vars du
 *    preset injectées via `loadFunnelDesign()`
 * 3. Importe les CSS du design system pour que les classes `.fnl-*` soient
 *    disponibles partout
 *
 * Les anciennes CSS vars `--color-primary` (palette branding workspace) sont
 * préservées au cas où des composants legacy y feraient encore référence,
 * mais les blocs migrés utilisent désormais `--fnl-primary` du preset.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type {
  FunnelPage,
  FunnelBlock,
  FunnelPresetOverrideJSON,
  FunnelEffectsConfigJSON,
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
import FunnelTracker from '@/components/funnels/FunnelTracker'
import { FunnelRenderProvider } from '@/components/funnels/FunnelRenderContext'
import { loadFunnelDesign } from '@/lib/funnels/load-funnel-design'

// CSS du design system T-028a — chargés ici pour que toutes les classes
// .fnl-* (et les pseudo-éléments des effets) soient disponibles dans le DOM
// dès que la page publique est servie.
// T-028 Phase 9 — Seuls les 9 effets encore au catalogue sont importés.
import '@/styles/funnels/tokens.css'
import '@/styles/funnels/base.css'
import '@/styles/funnels/effects/e4-colored-shadow.css'
import '@/styles/funnels/effects/e5-badge-pulse.css'
import '@/styles/funnels/effects/e6-lightbox.css'
import '@/styles/funnels/effects/e1-shimmer.css'
import '@/styles/funnels/effects/e3-button-shine.css'
import '@/styles/funnels/effects/e2-hero-glow.css'
import '@/styles/funnels/effects/e8-reveal-scroll.css'
import '@/styles/funnels/effects/e12-noise.css'
import '@/styles/funnels/effects/e15-sticky-cta.css'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Branding {
  accentColor: string
  logoUrl: string | null
  workspaceName: string
}

interface FunnelDesignFromApi {
  preset_id: string
  preset_override: FunnelPresetOverrideJSON | null
  effects_config: FunnelEffectsConfigJSON
}

interface ApiResponse {
  page: FunnelPage
  funnel: FunnelDesignFromApi
  branding: Branding
  error?: string
}

// ─── Block Renderer ─────────────────────────────────────────────────────────

function renderBlock(block: FunnelBlock) {
  let content: React.ReactNode
  switch (block.type) {
    case 'hero':
      content = <HeroBlock config={block.config as HeroBlockConfig} />; break
    case 'video':
      content = <VideoBlock config={block.config as VideoBlockConfig} />; break
    case 'testimonials':
      content = <TestimonialsBlock config={block.config as TestimonialsBlockConfig} />; break
    case 'form':
      content = <FormBlock config={block.config as FormBlockConfig} />; break
    case 'booking':
      content = <BookingBlock config={block.config as BookingBlockConfig} />; break
    case 'pricing':
      content = <PricingBlock config={block.config as PricingBlockConfig} />; break
    case 'faq':
      content = <FaqBlock config={block.config as FaqBlockConfig} />; break
    case 'countdown':
      content = <CountdownBlock config={block.config as CountdownBlockConfig} />; break
    case 'cta':
      content = <CtaBlock config={block.config as CtaBlockConfig} />; break
    case 'text':
      content = <TextBlock config={block.config as FunnelTextBlockConfig} />; break
    case 'image':
      content = <ImageBlock config={block.config as FunnelImageBlockConfig} />; break
    case 'spacer':
      content = <SpacerBlock config={block.config as SpacerBlockConfig} />; break
    default:
      return null
  }
  // Chaque bloc a un id HTML pour supporter les ancres internes (#block-{id})
  return <div key={block.id} id={`block-${block.id}`}>{content}</div>
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function PublicFunnelPage() {
  const params = useParams<{
    workspaceSlug: string
    funnelSlug: string
    pageSlug: string
  }>()

  const [page, setPage] = useState<FunnelPage | null>(null)
  const [funnelDesign, setFunnelDesign] = useState<FunnelDesignFromApi | null>(null)
  const [branding, setBranding] = useState<Branding | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/public/f/${params.workspaceSlug}/${params.funnelSlug}/${params.pageSlug}`,
        )
        if (!res.ok) {
          setError('Page introuvable.')
          return
        }
        const data: ApiResponse = await res.json()
        if (data.error) {
          setError(data.error)
          return
        }
        setPage(data.page)
        setFunnelDesign(data.funnel)
        setBranding(data.branding)

        // Set page title & description
        if (data.page.seo_title) {
          document.title = data.page.seo_title
        }
        if (data.page.seo_description) {
          let meta = document.querySelector('meta[name="description"]')
          if (!meta) {
            meta = document.createElement('meta')
            meta.setAttribute('name', 'description')
            document.head.appendChild(meta)
          }
          meta.setAttribute('content', data.page.seo_description)
        }
      } catch {
        setError('Erreur de chargement.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.workspaceSlug, params.funnelSlug, params.pageSlug])

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#666',
          fontSize: 15,
        }}
      >
        Chargement...
      </div>
    )
  }

  // ─── Error / 404 ────────────────────────────────────────────────────────
  if (error || !page) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#999',
          fontSize: 16,
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 48 }}>404</div>
        <div>{error ?? 'Page introuvable.'}</div>
      </div>
    )
  }

  const accentColor = branding?.accentColor ?? '#E53E3E'

  // Calcul du design system T-028a (CSS vars + classes fx-* d'effets activés).
  // funnelDesign est garanti non-null à ce stade (set en même temps que page),
  // mais on garde un fallback défensif au cas où l'API publique servirait une
  // ancienne version sans les champs du funnel.
  const design = funnelDesign ? loadFunnelDesign(funnelDesign) : null

  return (
    <>
      {/* Inject l'ancien --color-primary (legacy branding workspace) pour les
          composants qui ne sont pas encore migrés vers --fnl-primary du preset.
          Background body neutre — les couleurs viennent maintenant du preset. */}
      <style>{`
        :root { --color-primary: ${accentColor}; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #ffffff; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      `}</style>

      <FunnelRenderProvider isPreview={false} funnelPageId={page.id}>
        <FunnelTracker funnelPageId={page.id} />

        {/* Container racine .fnl-root qui apporte les CSS vars du preset
            et les classes fx-* pour activer les effets toggleables. */}
        <main
          className={design ? `fnl-root ${design.effectsClassName}` : ''}
          style={{
            minHeight: '100vh',
            ...(design?.cssVars ?? {}),
          }}
        >
          {(page.blocks ?? []).map((block) => renderBlock(block))}
        </main>
      </FunnelRenderProvider>
    </>
  )
}
