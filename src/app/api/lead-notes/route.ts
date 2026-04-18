import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const leadId = request.nextUrl.searchParams.get('lead_id')
    if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lead_notes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const leadId = body?.lead_id as string | undefined
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!leadId || !content) {
      return NextResponse.json({ error: 'lead_id and content required' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('lead_notes')
      .insert({
        workspace_id: workspaceId,
        lead_id: leadId,
        content,
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
