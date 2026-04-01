import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id, pageId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: page, error } = await supabase
      .from('funnel_pages')
      .select('*')
      .eq('id', pageId)
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !page) {
      return NextResponse.json({ error: 'Page introuvable' }, { status: 404 })
    }

    return NextResponse.json({ data: page })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id, pageId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const { name, slug, blocks, seo_title, seo_description, redirect_url } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slug
    if (blocks !== undefined) updates.blocks = blocks
    if (seo_title !== undefined) updates.seo_title = seo_title
    if (seo_description !== undefined) updates.seo_description = seo_description
    if (redirect_url !== undefined) updates.redirect_url = redirect_url

    const { data, error } = await supabase
      .from('funnel_pages')
      .update(updates)
      .eq('id', pageId)
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Page introuvable ou non autorisée' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { id, pageId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Get the page to know its order
    const { data: page, error: fetchError } = await supabase
      .from('funnel_pages')
      .select('id, page_order')
      .eq('id', pageId)
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !page) {
      return NextResponse.json({ error: 'Page introuvable ou non autorisée' }, { status: 404 })
    }

    // Delete associated events
    await supabase
      .from('funnel_events')
      .delete()
      .eq('funnel_page_id', pageId)

    // Delete the page
    const { error: deleteError } = await supabase
      .from('funnel_pages')
      .delete()
      .eq('id', pageId)
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Reorder remaining pages to fill the gap
    const { data: remainingPages } = await supabase
      .from('funnel_pages')
      .select('id, page_order')
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)
      .gt('page_order', page.page_order)
      .order('page_order', { ascending: true })

    if (remainingPages && remainingPages.length > 0) {
      for (const p of remainingPages) {
        await supabase
          .from('funnel_pages')
          .update({ page_order: p.page_order - 1 })
          .eq('id', p.id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
