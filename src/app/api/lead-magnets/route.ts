import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createLeadMagnetSchema } from '@/lib/validations/lead-magnets'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lead_magnets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ lead_magnets: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const input = createLeadMagnetSchema.parse(body)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lead_magnets')
      .insert({ ...input, workspace_id: workspaceId })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ lead_magnet: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
