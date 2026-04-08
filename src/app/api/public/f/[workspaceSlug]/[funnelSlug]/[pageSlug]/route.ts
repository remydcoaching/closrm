import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

interface RouteParams {
  params: Promise<{
    workspaceSlug: string
    funnelSlug: string
    pageSlug: string
  }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { workspaceSlug, funnelSlug, pageSlug } = await params
  const supabase = createServiceClient()

  // 1. Resolve workspace from slug
  const { data: ws, error: wsErr } = await supabase
    .from('workspace_slugs')
    .select('workspace_id')
    .eq('slug', workspaceSlug)
    .single()

  if (wsErr || !ws) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const workspaceId = ws.workspace_id

  // 2. Look up published funnel — inclut les champs design v2 (T-028a/c)
  const { data: funnel, error: funnelErr } = await supabase
    .from('funnels')
    .select('id, preset_id, preset_override, effects_config')
    .eq('workspace_id', workspaceId)
    .eq('slug', funnelSlug)
    .eq('status', 'published')
    .single()

  if (funnelErr || !funnel) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })
  }

  // 3. Look up published page
  const { data: page, error: pageErr } = await supabase
    .from('funnel_pages')
    .select('*')
    .eq('funnel_id', funnel.id)
    .eq('slug', pageSlug)
    .eq('is_published', true)
    .single()

  if (pageErr || !page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  // 4. Load workspace branding
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('accent_color, logo_url, name')
    .eq('id', workspaceId)
    .single()

  return NextResponse.json({
    page,
    // Design system T-028a (cf. migration 015_funnels_design_v2.sql)
    funnel: {
      preset_id: funnel.preset_id,
      preset_override: funnel.preset_override,
      effects_config: funnel.effects_config,
    },
    branding: {
      accentColor: workspace?.accent_color ?? '#E53E3E',
      logoUrl: workspace?.logo_url ?? null,
      workspaceName: workspace?.name ?? '',
    },
  })
}
