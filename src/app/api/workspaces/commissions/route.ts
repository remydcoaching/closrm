import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('team_commissions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[API /workspaces/commissions] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

const VALID_TYPES = ['percentage', 'fixed'] as const
const VALID_ROLES = ['setter', 'closer'] as const

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, role: userRole } = await getWorkspaceId()

    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Seul un administrateur peut configurer les commissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { user_id, role, type, value, bonus_threshold, bonus_amount } = body as {
      user_id?: string
      role?: string
      type?: string
      value?: number
      bonus_threshold?: number | null
      bonus_amount?: number | null
    }

    // Validation
    if (!type || !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json(
        { error: 'Type invalide. Valeurs acceptees: percentage, fixed' },
        { status: 400 }
      )
    }
    if (value === undefined || value === null || typeof value !== 'number' || value < 0) {
      return NextResponse.json({ error: 'value doit etre un nombre positif' }, { status: 400 })
    }
    if (role && !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      return NextResponse.json({ error: 'Role invalide (setter ou closer)' }, { status: 400 })
    }
    if (bonus_threshold !== undefined && bonus_threshold !== null && (typeof bonus_threshold !== 'number' || bonus_threshold < 0)) {
      return NextResponse.json({ error: 'bonus_threshold doit etre un nombre positif' }, { status: 400 })
    }
    if (bonus_amount !== undefined && bonus_amount !== null && (typeof bonus_amount !== 'number' || bonus_amount < 0)) {
      return NextResponse.json({ error: 'bonus_amount doit etre un nombre positif' }, { status: 400 })
    }

    const supabase = await createClient()

    // Upsert: check if a commission config already exists for this workspace/user/role
    const query = supabase
      .from('team_commissions')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (user_id) {
      query.eq('user_id', user_id)
    } else {
      query.is('user_id', null)
    }
    if (role) {
      query.eq('role', role)
    } else {
      query.is('role', null)
    }

    const { data: existing } = await query.maybeSingle()

    const payload = {
      type,
      value,
      bonus_threshold: bonus_threshold ?? null,
      bonus_amount: bonus_amount ?? null,
    }

    if (existing) {
      const { data, error } = await supabase
        .from('team_commissions')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[API /workspaces/commissions] UPDATE error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ data })
    } else {
      const { data, error } = await supabase
        .from('team_commissions')
        .insert({
          workspace_id: workspaceId,
          user_id: user_id || null,
          role: role || 'closer',
          ...payload,
        })
        .select()
        .single()

      if (error) {
        console.error('[API /workspaces/commissions] INSERT error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ data }, { status: 201 })
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
