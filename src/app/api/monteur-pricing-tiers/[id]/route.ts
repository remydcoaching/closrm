import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updatePricingTierSchema } from '@/lib/validations/monteur-billing'

// PATCH — update tier (rename, change price, archive)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = updatePricingTierSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('monteur_pricing_tiers')
      .update(parsed.data)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — hard delete (only if no slots reference it)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Check if any slot uses this tier
    const { data: usage } = await supabase
      .from('social_posts')
      .select('id')
      .eq('pricing_tier_id', id)
      .limit(1)

    if (usage && usage.length > 0) {
      // Soft archive instead of hard delete
      const { error } = await supabase
        .from('monteur_pricing_tiers')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: { archived: true } })
    }

    const { error } = await supabase
      .from('monteur_pricing_tiers')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
