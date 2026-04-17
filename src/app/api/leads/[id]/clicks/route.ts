import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('tracked_links')
      .select('short_code, clicks_count, first_clicked_at, last_clicked_at, lead_magnet_id, lead_magnets(title, url, platform)')
      .eq('lead_id', leadId)
      .eq('workspace_id', workspaceId)
      .order('last_clicked_at', { ascending: false, nullsFirst: false })

    if (error) throw error
    return NextResponse.json({ tracked_links: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
