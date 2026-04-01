import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify funnel belongs to workspace
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (funnelError || !funnel) {
      return NextResponse.json({ error: 'Funnel introuvable' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('funnel_pages')
      .select('*')
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)
      .order('page_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify funnel belongs to workspace
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (funnelError || !funnel) {
      return NextResponse.json({ error: 'Funnel introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { name, slug, blocks } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json({ error: 'Le slug est requis' }, { status: 400 })
    }

    // Calculate next page_order
    const { data: existingPages } = await supabase
      .from('funnel_pages')
      .select('page_order')
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)
      .order('page_order', { ascending: false })
      .limit(1)

    const nextOrder = existingPages && existingPages.length > 0
      ? existingPages[0].page_order + 1
      : 0

    const { data, error } = await supabase
      .from('funnel_pages')
      .insert({
        funnel_id: id,
        workspace_id: workspaceId,
        name: name.trim(),
        slug: slug.trim(),
        page_order: nextOrder,
        blocks: blocks ?? [],
        is_published: false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
