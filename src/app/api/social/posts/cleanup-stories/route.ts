import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { z } from 'zod'

const schema = z.object({
  // Supprime les stories en 'idea' avec plan_date > today + days_ahead
  days_ahead: z.number().int().min(0).max(365).default(7),
})

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { days_ahead } = parsed.data

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days_ahead)
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('social_posts')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('content_kind', 'story')
      .eq('production_status', 'idea')
      .eq('status', 'draft')
      .gt('plan_date', cutoffStr)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ deleted: data?.length ?? 0, cutoff: cutoffStr })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
