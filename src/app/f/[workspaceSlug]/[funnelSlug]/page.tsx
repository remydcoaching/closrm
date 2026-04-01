import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'

interface PageProps {
  params: Promise<{
    workspaceSlug: string
    funnelSlug: string
  }>
}

export default async function FunnelIndexPage({ params }: PageProps) {
  const { workspaceSlug, funnelSlug } = await params
  const supabase = createServiceClient()

  // Resolve workspace
  const { data: ws } = await supabase
    .from('workspace_slugs')
    .select('workspace_id')
    .eq('slug', workspaceSlug)
    .single()

  if (!ws) notFound()

  // Resolve funnel
  const { data: funnel } = await supabase
    .from('funnels')
    .select('id')
    .eq('workspace_id', ws.workspace_id)
    .eq('slug', funnelSlug)
    .eq('status', 'published')
    .single()

  if (!funnel) notFound()

  // Get first page by order
  const { data: firstPage } = await supabase
    .from('funnel_pages')
    .select('slug')
    .eq('funnel_id', funnel.id)
    .eq('is_published', true)
    .order('page_order', { ascending: true })
    .limit(1)
    .single()

  if (!firstPage) notFound()

  redirect(`/f/${workspaceSlug}/${funnelSlug}/${firstPage.slug}`)
}
