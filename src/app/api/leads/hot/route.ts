import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

const DEFAULT_SCORING = { like: 1, comment: 3, dm: 5, mention: 2 } as const

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const days = Number(searchParams.get('days') ?? '7')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: rules } = await supabase
      .from('engagement_scoring_rules')
      .select('interaction_type, points')
      .eq('workspace_id', workspaceId)

    const scoring: Record<string, number> = { ...DEFAULT_SCORING }
    for (const rule of rules ?? []) {
      scoring[rule.interaction_type] = rule.points
    }

    const { data: interactions, error } = await supabase
      .from('instagram_interactions')
      .select('lead_id, interaction_type, last_seen_at, leads(id, first_name, last_name, instagram_handle)')
      .eq('workspace_id', workspaceId)
      .gte('last_seen_at', since)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const byLead = new Map<
      string,
      {
        lead_id: string
        first_name: string
        last_name: string
        instagram_handle: string | null
        score: number
        likes_count: number
        comments_count: number
        dm_count: number
        last_interaction_at: string
      }
    >()

    for (const row of interactions ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lead = row.leads as any
      if (!lead) continue

      const existing = byLead.get(row.lead_id) ?? {
        lead_id: row.lead_id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        instagram_handle: lead.instagram_handle,
        score: 0,
        likes_count: 0,
        comments_count: 0,
        dm_count: 0,
        last_interaction_at: row.last_seen_at,
      }

      existing.score += scoring[row.interaction_type] ?? 1
      if (row.interaction_type === 'like') existing.likes_count += 1
      if (row.interaction_type === 'comment') existing.comments_count += 1
      if (row.interaction_type === 'dm') existing.dm_count += 1
      if (row.last_seen_at > existing.last_interaction_at) existing.last_interaction_at = row.last_seen_at

      byLead.set(row.lead_id, existing)
    }

    const leads = Array.from(byLead.values()).sort((a, b) => b.score - a.score)

    return NextResponse.json({ leads })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /leads/hot GET] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
