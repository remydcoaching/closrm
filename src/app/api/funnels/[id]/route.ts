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

    const { data: funnel, error } = await supabase
      .from('funnels')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !funnel) {
      return NextResponse.json({ error: 'Funnel introuvable' }, { status: 404 })
    }

    const { data: pages } = await supabase
      .from('funnel_pages')
      .select('*')
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)
      .order('page_order', { ascending: true })

    return NextResponse.json({
      data: {
        ...funnel,
        pages: pages ?? [],
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const {
      name,
      slug,
      description,
      domain_id,
      // Design system T-028a (cf. migration 015_funnels_design_v2.sql)
      preset_id,
      preset_override,
      effects_config,
    } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slug
    if (description !== undefined) updates.description = description
    if (domain_id !== undefined) updates.domain_id = domain_id
    // Validation minimale : preset_id doit être une string non-vide si fourni.
    // La validité de l'ID (présence dans le catalogue) est gérée côté front via
    // getPresetByIdOrDefault qui retombe sur 'ocean' si l'ID est inconnu.
    if (preset_id !== undefined && typeof preset_id === 'string' && preset_id.trim()) {
      updates.preset_id = preset_id.trim()
    }
    // preset_override : on accepte null (reset) ou un objet { primary?, heroBg?, sectionBg?, footerBg? }
    if (preset_override !== undefined) {
      updates.preset_override = preset_override === null ? null : preset_override
    }
    // effects_config : map { effect-id: boolean }. Une map vide {} est valide.
    if (effects_config !== undefined && typeof effects_config === 'object' && effects_config !== null) {
      updates.effects_config = effects_config
    }

    const { data, error } = await supabase
      .from('funnels')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Funnel introuvable ou non autorisé' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify funnel belongs to workspace
    const { data: funnel, error: fetchError } = await supabase
      .from('funnels')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !funnel) {
      return NextResponse.json({ error: 'Funnel introuvable ou non autorisé' }, { status: 404 })
    }

    // Delete pages first (cascade), then funnel
    await supabase
      .from('funnel_events')
      .delete()
      .in(
        'funnel_page_id',
        (await supabase
          .from('funnel_pages')
          .select('id')
          .eq('funnel_id', id)
        ).data?.map((p) => p.id) ?? []
      )

    await supabase
      .from('funnel_pages')
      .delete()
      .eq('funnel_id', id)

    const { error: deleteError } = await supabase
      .from('funnels')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
