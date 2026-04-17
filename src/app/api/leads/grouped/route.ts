import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { leadFiltersSchema } from '@/lib/validations/leads'
import { z } from 'zod'

const groupedQuerySchema = leadFiltersSchema.extend({
  limit_per_status: z.coerce.number().int().min(1).max(100).default(25),
})

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, userId, role } = await getWorkspaceId()
    const supabase = await createClient()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = groupedQuerySchema.parse(searchParams)

    const sourcesArr = filters.source
      ? filters.source.split(',').filter(Boolean)
      : null

    const { data, error } = await supabase.rpc('leads_grouped_by_status', {
      p_workspace_id: workspaceId,
      p_limit:        filters.limit_per_status,
      p_date_from:    filters.date_from ?? null,
      p_date_to:      filters.date_to ?? null,
      p_date_field:   filters.date_field,
      p_sources:      sourcesArr,
      p_assigned_to:  filters.assigned_to ?? null,
      p_search:       filters.search?.trim() || null,
      p_role:         role,
      p_user_id:      userId,
    })

    if (error) {
      console.error('[API /leads/grouped] RPC error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ columns: data ?? {} })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
