import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateDraftSchema } from '@/lib/validations/instagram'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()
    const parsed = updateDraftSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { data, error } = await supabase
      .from('ig_drafts')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id).eq('workspace_id', workspaceId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params
    const { error } = await supabase
      .from('ig_drafts').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
