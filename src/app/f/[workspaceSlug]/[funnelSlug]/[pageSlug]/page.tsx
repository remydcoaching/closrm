'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type {
  FunnelPage,
  FunnelBlock,
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface Branding {
  accentColor: string
  logoUrl: string | null
  workspaceName: string
}

interface ApiResponse {
  page: FunnelPage
  branding: Branding
  error?: string
}

// ─── Block Renderer ─────────────────────────────────────────────────────────

function renderBlock(block: FunnelBlock) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock key={block.id} config={block.config as HeroBlockConfig} />
    case 'video':
      return <VideoBlock key={block.id} config={block.config as VideoBlockConfig} />
    case 'testimonials':
      return <TestimonialsBlock key={block.id} config={block.config as TestimonialsBlockConfig} />
    case 'form':
      return <FormBlock key={block.id} config={block.config as FormBlockConfig} />
    case 'booking':
      return <BookingBlock key={block.id} config={block.config as BookingBlockConfig} />
    case 'pricing':
      return <PricingBlock key={block.id} config={block.config as PricingBlockConfig} />
    case 'faq':
      return <FaqBlock key={block.id} config={block.config as FaqBlockConfig} />
    case 'countdown':
      return <CountdownBlock key={block.id} config={block.config as CountdownBlockConfig} />
    case 'cta':
      return <CtaBlock key={block.id} config={block.config as CtaBlockConfig} />
    case 'text':
      return <TextBlock key={block.id} config={block.config as FunnelTextBlockConfig} />
    case 'image':
      return <ImageBlock key={block.id} config={block.config as FunnelImageBlockConfig} />
    case 'spacer':
      return <SpacerBlock key={block.id} config={block.config as SpacerBlockConfig} />
    default:
      return null
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function PublicFunnelPage() {
  const params = useParams<{
    workspaceSlug: string
    funnelSlug: string
    pageSlug: string
  }>()

  const [page, setPage] = useState<FunnelPage | null>(null)
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

  return (
    <>
      {/* Inject branding CSS variable */}
      <style>{`
        :root { --color-primary: ${accentColor}; }
        body { margin: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      `}</style>

      <FunnelTracker funnelPageId={page.id} />

      <main
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '0 16px',
        }}
      >
        {(page.blocks ?? []).map((block) => renderBlock(block))}
      </main>
    </>
  )
}
