/**
 * Page publique de funnel — Server Component (SSR direct).
 *
 * Avant : Client Component qui fetch via API après hydratation → flash blanc
 * de qql secondes (bg blanc + "Chargement...") avant que le contenu apparaisse.
 *
 * Après : SSR direct via createServiceClient. Pas de flash, le HTML rendu est
 * complet dès la 1re réponse. SEO meta gérée par generateMetadata().
 *
 * Les blocks et FunnelRenderProvider/FunnelTracker restent des Client Components
 * (importés dans un Server Component, Next.js gère la boundary automatiquement).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Script from 'next/script'
import { resolveMetaEvent } from '@/lib/meta/funnel-events'
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
  BookingActionsBlockConfig,
  PricingBlockConfig,
  FaqBlockConfig,
  CountdownBlockConfig,
  CtaBlockConfig,
  FunnelTextBlockConfig,
  FunnelImageBlockConfig,
  SpacerBlockConfig,
  FunnelFooterBlockConfig,
} from '@/types'

import HeroBlock from '@/components/funnels/blocks/HeroBlock'
import VideoBlock from '@/components/funnels/blocks/VideoBlock'
import TestimonialsBlock from '@/components/funnels/blocks/TestimonialsBlock'
import FormBlock from '@/components/funnels/blocks/FormBlock'
import BookingBlock from '@/components/funnels/blocks/BookingBlock'
import BookingActionsBlock from '@/components/funnels/blocks/BookingActionsBlock'
import PricingBlock from '@/components/funnels/blocks/PricingBlock'
import FaqBlock from '@/components/funnels/blocks/FaqBlock'
import CountdownBlock from '@/components/funnels/blocks/CountdownBlock'
import CtaBlock from '@/components/funnels/blocks/CtaBlock'
import TextBlock from '@/components/funnels/blocks/TextBlock'
import ImageBlock from '@/components/funnels/blocks/ImageBlock'
import SpacerBlock from '@/components/funnels/blocks/SpacerBlock'
import FooterBlock from '@/components/funnels/blocks/FooterBlock'
import FunnelTracker from '@/components/funnels/FunnelTracker'
import { FunnelRenderProvider } from '@/components/funnels/FunnelRenderContext'
import { loadFunnelDesign } from '@/lib/funnels/load-funnel-design'
import { createServiceClient } from '@/lib/supabase/service'

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

interface Branding {
  accentColor: string
  logoUrl: string | null
  workspaceName: string
}

interface FunnelDesignFromApi {
  preset_id: string
  preset_override: FunnelPresetOverrideJSON | null
  effects_config: FunnelEffectsConfigJSON
  meta_pixel_id: string | null
}

interface PageData {
  page: FunnelPage
  funnel: FunnelDesignFromApi
  branding: Branding
}

interface PageProps {
  params: Promise<{
    workspaceSlug: string
    funnelSlug: string
    pageSlug: string
  }>
}

async function loadFunnelPageData(
  workspaceSlug: string,
  funnelSlug: string,
  pageSlug: string,
): Promise<PageData | null> {
  const supabase = createServiceClient()

  const { data: ws } = await supabase
    .from('workspace_slugs')
    .select('workspace_id')
    .eq('slug', workspaceSlug)
    .single()

  if (!ws) return null
  const workspaceId = ws.workspace_id

  const { data: funnel } = await supabase
    .from('funnels')
    .select('id, preset_id, preset_override, effects_config, meta_pixel_id')
    .eq('workspace_id', workspaceId)
    .eq('slug', funnelSlug)
    .eq('status', 'published')
    .single()

  if (!funnel) return null

  const { data: page } = await supabase
    .from('funnel_pages')
    .select('*')
    .eq('funnel_id', funnel.id)
    .eq('slug', pageSlug)
    .eq('is_published', true)
    .single()

  if (!page) return null

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('accent_color, logo_url, name')
    .eq('id', workspaceId)
    .single()

  return {
    page: page as FunnelPage,
    funnel: {
      preset_id: funnel.preset_id,
      preset_override: funnel.preset_override,
      effects_config: funnel.effects_config,
      meta_pixel_id: funnel.meta_pixel_id ?? null,
    },
    branding: {
      accentColor: workspace?.accent_color ?? '#E53E3E',
      logoUrl: workspace?.logo_url ?? null,
      workspaceName: workspace?.name ?? '',
    },
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { workspaceSlug, funnelSlug, pageSlug } = await params
  const data = await loadFunnelPageData(workspaceSlug, funnelSlug, pageSlug)
  if (!data) return {}
  return {
    title: data.page.seo_title || undefined,
    description: data.page.seo_description || undefined,
  }
}

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
    case 'booking_actions':
      content = <BookingActionsBlock config={block.config as BookingActionsBlockConfig} />; break
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
    case 'footer':
      content = <FooterBlock config={block.config as FunnelFooterBlockConfig} />; break
    default:
      return null
  }
  const style = block.type === 'footer' ? { marginTop: 'auto' } : undefined
  return <div key={block.id} id={`block-${block.id}`} style={style}>{content}</div>
}

export default async function PublicFunnelPage({ params }: PageProps) {
  const { workspaceSlug, funnelSlug, pageSlug } = await params
  const data = await loadFunnelPageData(workspaceSlug, funnelSlug, pageSlug)

  if (!data) notFound()

  const { page, funnel, branding } = data
  const accentColor = branding.accentColor
  const design = loadFunnelDesign(funnel)
  const metaPixelId = funnel.meta_pixel_id

  // Page-level Meta event (in addition to PageView). NULL when the coach
  // chose "Ne rien envoyer" or left it default.
  const pageMetaEvent = resolveMetaEvent(page.meta_event, 'none')
  // Sanitize defensively: the event name lands inside a JS string template
  // injected verbatim into the page. Strip anything that isn't a-zA-Z0-9_.
  const safePageMetaEvent = pageMetaEvent ? pageMetaEvent.replace(/[^a-zA-Z0-9_]/g, '') : null

  return (
    <>
      {metaPixelId && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
        >{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${metaPixelId}');
          fbq('track', 'PageView');
          ${safePageMetaEvent ? `fbq('track', '${safePageMetaEvent}');` : ''}
        `}</Script>
      )}
      <style>{`
        :root { --color-primary: ${accentColor}; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #ffffff; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      `}</style>

      <FunnelRenderProvider isPreview={false} funnelPageId={page.id}>
        <FunnelTracker funnelPageId={page.id} />

        <main
          className={`fnl-root ${design.effectsClassName}`}
          style={{
            minHeight: '100vh',
            ...design.cssVars,
          }}
        >
          {(page.blocks ?? []).map((block) => renderBlock(block))}
        </main>
      </FunnelRenderProvider>
    </>
  )
}
