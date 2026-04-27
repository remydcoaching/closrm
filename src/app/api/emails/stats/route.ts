import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(request: Request) {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const url = new URL(request.url)
  const days = parseInt(url.searchParams.get('days') || '30')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  // Get all sends in period (inclut toutes les sources : broadcast, workflow,
  // sequence, booking_reminder, booking_confirmation, direct_message, manual)
  const { data: sends } = await supabase
    .from('email_sends')
    .select('status, sent_at, source')
    .eq('workspace_id', workspaceId)
    .gte('sent_at', since)

  if (!sends) {
    return NextResponse.json({
      total: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      by_source: {},
    })
  }

  const total = sends.length
  const delivered = sends.filter((s) => ['delivered', 'opened', 'clicked'].includes(s.status)).length
  const opened = sends.filter((s) => ['opened', 'clicked'].includes(s.status)).length
  const clicked = sends.filter((s) => s.status === 'clicked').length
  const bounced = sends.filter((s) => s.status === 'bounced').length
  const complained = sends.filter((s) => s.status === 'complained').length

  // Breakdown par source pour voir d'où viennent les envois
  const bySource: Record<string, { count: number; bounced: number }> = {}
  for (const s of sends) {
    const key = s.source || 'unknown'
    if (!bySource[key]) bySource[key] = { count: 0, bounced: 0 }
    bySource[key].count++
    if (s.status === 'bounced') bySource[key].bounced++
  }

  // Unsubscribed count
  const { count: unsubscribed } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('email_unsubscribed', true)
    .gte('email_unsubscribed_at', since)

  return NextResponse.json({
    total,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    unsubscribed: unsubscribed || 0,
    rates: {
      open: total > 0 ? Math.round((opened / total) * 100) : 0,
      click: total > 0 ? Math.round((clicked / total) * 100) : 0,
      bounce: total > 0 ? Math.round((bounced / total) * 100) : 0,
    },
    by_source: bySource,
  })
}
