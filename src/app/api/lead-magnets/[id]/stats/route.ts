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

    const { data: links, error } = await supabase
      .from('tracked_links')
      .select('lead_id, clicks_count, last_clicked_at, leads(first_name, last_name)')
      .eq('lead_magnet_id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw error
    const rows = links ?? []

    const total_clicks = rows.reduce((s, r) => s + (r.clicks_count ?? 0), 0)
    const unique_leads = rows.filter(r => (r.clicks_count ?? 0) > 0).length

    const top_leads = rows
      .filter(r => (r.clicks_count ?? 0) > 0)
      .sort((a, b) => (b.clicks_count ?? 0) - (a.clicks_count ?? 0))
      .slice(0, 10)
      .map(r => {
        const lead = r.leads as unknown as { first_name: string; last_name: string } | null
        return {
          lead_id: r.lead_id,
          name: lead ? `${lead.first_name} ${lead.last_name}` : 'Inconnu',
          clicks: r.clicks_count,
          last_clicked_at: r.last_clicked_at,
        }
      })

    return NextResponse.json({ total_clicks, unique_leads, top_leads })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
