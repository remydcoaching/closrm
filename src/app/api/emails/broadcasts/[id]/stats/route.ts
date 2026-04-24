/**
 * GET /api/emails/broadcasts/[id]/stats
 *
 * Renvoie les stats agrégées d'un broadcast : envois, delivered, opened,
 * clicked, bounced, complained. Source = table `email_sends` filtrée par
 * broadcast_id.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  // Vérifie que le broadcast appartient au workspace courant
  const { data: broadcast } = await supabase
    .from('email_broadcasts')
    .select('id, name, subject, sent_at, total_count, sent_count')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!broadcast) {
    return NextResponse.json({ error: 'Broadcast introuvable' }, { status: 404 })
  }

  // Tous les sends de ce broadcast, avec join lead pour affichage
  const { data: sends } = await supabase
    .from('email_sends')
    .select('id, lead_id, status, sent_at, opened_at, clicked_at, bounced_at, leads(first_name, last_name, email)')
    .eq('workspace_id', workspaceId)
    .eq('broadcast_id', id)
    .order('sent_at', { ascending: false })
    .limit(1000)

  const rows = sends || []

  const counts = {
    total: rows.length,
    sent: rows.filter((r) => r.status === 'sent').length,
    delivered: rows.filter((r) => ['delivered', 'opened', 'clicked'].includes(r.status)).length,
    opened: rows.filter((r) => ['opened', 'clicked'].includes(r.status)).length,
    clicked: rows.filter((r) => r.status === 'clicked').length,
    bounced: rows.filter((r) => r.status === 'bounced').length,
    complained: rows.filter((r) => r.status === 'complained').length,
  }

  const rates = {
    open: counts.total > 0 ? Math.round((counts.opened / counts.total) * 100) : 0,
    click: counts.total > 0 ? Math.round((counts.clicked / counts.total) * 100) : 0,
    bounce: counts.total > 0 ? Math.round((counts.bounced / counts.total) * 100) : 0,
  }

  return NextResponse.json({
    broadcast,
    counts,
    rates,
    recipients: rows.map((r) => ({
      send_id: r.id,
      lead_id: r.lead_id,
      status: r.status,
      sent_at: r.sent_at,
      opened_at: r.opened_at,
      clicked_at: r.clicked_at,
      bounced_at: r.bounced_at,
      lead: r.leads,
    })),
  })
}
