import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { isEmptySlot, recordSkips } from '@/lib/social/slot-skips'

/**
 * Deletes several editorial-calendar slots at once.
 *  { ids: [...] }                       — these slots (≤ 500)
 *  { from, to, only_empty: true, kinds } — the untouched slots of a period
 *                                          ("Vider les créneaux vides")
 * Only draft slots nobody worked on are deleted in period mode; trame slots
 * are remembered so the next generation doesn't recreate them.
 */
const schema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    only_empty: z.literal(true),
    kinds: z.array(z.enum(['post', 'story', 'reel'])).optional(),
  }),
])

const FIELDS = 'id, status, production_status, title, hook, caption, script, notes, media_urls, references_urls, plan_date, content_kind, slot_index, pillar_id'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    const body = parsed.data

    let query = supabase.from('social_posts').select(FIELDS).eq('workspace_id', workspaceId)
    if ('ids' in body) {
      query = query.in('id', body.ids)
    } else {
      if (body.to < body.from) return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
      query = query.gte('plan_date', body.from).lte('plan_date', body.to).eq('status', 'draft')
      if (body.kinds?.length) query = query.in('content_kind', body.kinds)
    }
    const { data: found, error: findErr } = await query.limit(2000)
    if (findErr) throw findErr
    const targets = 'ids' in body ? (found ?? []) : (found ?? []).filter(isEmptySlot)
    // Published / scheduled slots are never deleted in bulk.
    const deletable = targets.filter((s) => !['scheduled', 'publishing', 'published'].includes(s.status ?? ''))

    let deleted = 0
    for (let i = 0; i < deletable.length; i += 200) {
      const chunk = deletable.slice(i, i + 200)
      const { data, error } = await supabase
        .from('social_posts')
        .delete()
        .eq('workspace_id', workspaceId)
        .in('id', chunk.map((s) => s.id))
        .select('plan_date, content_kind, slot_index, pillar_id')
      if (error) throw error
      deleted += data?.length ?? 0
      await recordSkips(supabase, workspaceId, data ?? [])
    }
    return NextResponse.json({ data: { deleted, skipped: (found?.length ?? 0) - deleted } })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
