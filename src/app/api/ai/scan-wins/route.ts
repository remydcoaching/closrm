import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { recordOutcome } from '@/lib/ai/brief'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Find all leads with status 'clos' that have a linked IG conversation
    // and DON'T already have an outcome recorded
    const { data: closedLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'clos')

    if (!closedLeads || closedLeads.length === 0) {
      return NextResponse.json({ data: { scanned: 0, recorded: 0 } })
    }

    const leadIds = closedLeads.map(l => l.id)

    // Find conversations linked to these leads
    const { data: conversations } = await supabase
      .from('ig_conversations')
      .select('id, lead_id')
      .eq('workspace_id', workspaceId)
      .in('lead_id', leadIds)

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ data: { scanned: leadIds.length, recorded: 0 } })
    }

    // Check which ones already have an outcome
    const convIds = conversations.map(c => c.id)
    const { data: existing } = await supabase
      .from('ai_conversation_outcomes')
      .select('conversation_id')
      .eq('workspace_id', workspaceId)
      .in('conversation_id', convIds)

    const existingSet = new Set((existing || []).map(e => e.conversation_id))

    // Record outcomes for new ones
    let recorded = 0
    for (const conv of conversations) {
      if (!existingSet.has(conv.id) && conv.lead_id) {
        await recordOutcome(workspaceId, conv.id, conv.lead_id, 'won')
        recorded++
      }
    }

    return NextResponse.json({ data: { scanned: leadIds.length, recorded } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
