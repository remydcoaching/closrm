import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createPricingTierSchema } from '@/lib/validations/monteur-billing'

// GET — list pricing tiers (filtrable par monteur_id)
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const monteurId = request.nextUrl.searchParams.get('monteur_id')
    const includeArchived = request.nextUrl.searchParams.get('include_archived') === 'true'

    let q = supabase
      .from('monteur_pricing_tiers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })

    if (monteurId) q = q.eq('monteur_id', monteurId)
    if (!includeArchived) q = q.is('archived_at', null)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — create new tier (admin/coach only via RLS)
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createPricingTierSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('monteur_pricing_tiers')
      .insert({
        workspace_id: workspaceId,
        monteur_id: parsed.data.monteur_id,
        name: parsed.data.name,
        price_cents: parsed.data.price_cents,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
