import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { deleteComment, hideComment } from '@/lib/instagram/api'

// DELETE — delete a comment via Meta API + remove from DB
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Get the comment
    const { data: comment } = await supabase
      .from('ig_comments')
      .select('ig_comment_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!comment) {
      return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })
    }

    // Get account token
    const { data: account } = await supabase
      .from('ig_accounts')
      .select('access_token, page_access_token')
      .eq('workspace_id', workspaceId)
      .eq('is_connected', true)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Compte Instagram non connecté' }, { status: 400 })
    }

    const token = account.page_access_token || account.access_token

    // Delete on Meta
    await deleteComment(token, comment.ig_comment_id)

    // Delete from DB
    await supabase.from('ig_comments').delete().eq('id', id).eq('workspace_id', workspaceId)

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — hide/unhide a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const { hide } = body

    if (typeof hide !== 'boolean') {
      return NextResponse.json({ error: 'hide (boolean) requis' }, { status: 400 })
    }

    // Get the comment
    const { data: comment } = await supabase
      .from('ig_comments')
      .select('ig_comment_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!comment) {
      return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })
    }

    // Get account token
    const { data: account } = await supabase
      .from('ig_accounts')
      .select('access_token, page_access_token')
      .eq('workspace_id', workspaceId)
      .eq('is_connected', true)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Compte Instagram non connecté' }, { status: 400 })
    }

    const token = account.page_access_token || account.access_token

    // Hide/unhide on Meta
    await hideComment(token, comment.ig_comment_id, hide)

    // Update in DB
    const { data: updated, error } = await supabase
      .from('ig_comments')
      .update({ is_hidden: hide })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
