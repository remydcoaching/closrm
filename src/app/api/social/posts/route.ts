import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createSocialPostSchema, socialPostFiltersSchema } from '@/lib/validations/social-posts'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const { searchParams } = new URL(request.url)
    const parsed = socialPostFiltersSchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const {
      status, platform, from, to,
      plan_date_from, plan_date_to,
      content_kind, production_status, pillar_id,
      page, per_page,
    } = parsed.data

    // Mode `slim=true` : ne renvoie que les colonnes nécessaires au Board /
    // Calendar / Montage (pas de script/caption/notes/editor_notes/hashtags
    // qui peuvent peser plusieurs KB par slot). Pas de join publications.
    // Les détails sont récupérés via GET /api/social/posts/[id] à l'ouverture
    // du drawer.
    const slim = searchParams.get('slim') === 'true'
    // Mode slim : on saute la jointure publications + script/caption/notes
    // (gain ~80% sur le payload). Format strict sans espaces pour le parser TS Supabase.
    const slimFields = 'id,workspace_id,title,hook,status,scheduled_at,published_at,pillar_id,content_kind,production_status,plan_date,slot_index,media_urls,monteur_id,rush_url,final_url,final_versions,montage_deadline,monteur_notified_at,coach_notified_at,pricing_tier_id,paid_at,created_at,updated_at'

    const supabase = await createClient()
    // Cast en string générique car la string ternaire fait planter le parser TS de Supabase
    const selectExpr: string = slim ? slimFields : '*, publications:social_post_publications(*)'
    // Pas de `count: 'exact'` : aucun consommateur ne lit `total` et un
    // COUNT(*) full table avec RLS coûte plusieurs centaines de ms.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabase
      .from('social_posts')
      .select(selectExpr as never)
      .eq('workspace_id', workspaceId)
      .order('plan_date', { ascending: true, nullsFirst: false })
      .order('slot_index', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * per_page, page * per_page - 1)

    if (status) query = query.eq('status', status)
    if (from) query = query.gte('scheduled_at', from)
    if (to) query = query.lte('scheduled_at', to)
    if (plan_date_from) query = query.gte('plan_date', plan_date_from)
    if (plan_date_to) query = query.lte('plan_date', plan_date_to)
    if (content_kind) query = query.eq('content_kind', content_kind)
    if (production_status) {
      const statuses = production_status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) query = query.eq('production_status', statuses[0])
      else if (statuses.length > 1) query = query.in('production_status', statuses)
    }
    if (pillar_id) query = query.eq('pillar_id', pillar_id)

    const { data, error } = await query
    if (error) throw error

    type PostRow = { publications?: { platform: string }[] }
    let rows = (data ?? []) as unknown as PostRow[]
    // Le filtre platform nécessite la jointure publications, ignoré en mode slim
    if (platform && !slim) {
      rows = rows.filter((p) =>
        (p.publications ?? []).some((pub) => pub.platform === platform)
      )
    }

    return NextResponse.json({ data: rows, total: rows.length, page, per_page })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = createSocialPostSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { publications, ...post } = parsed.data

    const supabase = await createClient()
    const { data: created, error } = await supabase
      .from('social_posts')
      .insert({ ...post, workspace_id: workspaceId, created_by: userId })
      .select()
      .single()
    if (error) throw error

    let pubs: unknown[] = []
    if (publications.length > 0) {
      const pubRows = publications.map((p) => ({
        social_post_id: created.id,
        workspace_id: workspaceId,
        platform: p.platform,
        config: p.config ?? {},
        scheduled_at: p.scheduled_at ?? post.scheduled_at ?? null,
        status: 'pending' as const,
      }))
      const { data: insertedPubs, error: pubErr } = await supabase
        .from('social_post_publications')
        .insert(pubRows)
        .select()
      if (pubErr) throw pubErr
      pubs = insertedPubs ?? []
    }

    return NextResponse.json({ data: { ...created, publications: pubs } }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
