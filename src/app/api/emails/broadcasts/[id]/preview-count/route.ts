import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import type { EmailBroadcastFilters } from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, _context: RouteContext) {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()
  const filters: EmailBroadcastFilters = await request.json()

  let query = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('email_unsubscribed', false)
    .not('email', 'is', null)

  if (filters.statuses?.length) query = query.in('status', filters.statuses)
  if (filters.sources?.length) query = query.in('source', filters.sources)
  if (filters.tags?.length) query = query.overlaps('tags', filters.tags)
  if (filters.date_from) query = query.gte('created_at', filters.date_from)
  if (filters.date_to) query = query.lte('created_at', filters.date_to)
  if (filters.reached === 'true') query = query.eq('reached', true)
  if (filters.reached === 'false') query = query.eq('reached', false)

  const { count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count || 0 })
}
