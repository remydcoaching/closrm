import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Fetch current funnel
    const { data: funnel, error: fetchError } = await supabase
      .from('funnels')
      .select('id, status')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !funnel) {
      return NextResponse.json({ error: 'Funnel introuvable' }, { status: 404 })
    }

    const newStatus = funnel.status === 'published' ? 'draft' : 'published'
    const pagesPublished = newStatus === 'published'

    // Update funnel status
    const { data: updatedFunnel, error: updateError } = await supabase
      .from('funnels')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update all pages is_published
    const { error: pagesError } = await supabase
      .from('funnel_pages')
      .update({ is_published: pagesPublished, updated_at: new Date().toISOString() })
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)

    if (pagesError) {
      return NextResponse.json({ error: pagesError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updatedFunnel })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
