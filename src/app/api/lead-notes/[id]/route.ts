import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lead_notes')
      .update({ content })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { error } = await supabase
      .from('lead_notes')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
