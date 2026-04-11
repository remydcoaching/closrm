import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('team_objectives')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[API /workspaces/objectives] GET error:', error.message)
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

const VALID_METRICS = ['calls_per_day', 'rdv_per_week', 'closings_per_month', 'ca_per_month', 'joignabilite'] as const
const VALID_ROLES = ['setter', 'closer'] as const

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, role: userRole } = await getWorkspaceId()

    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Seul un administrateur peut configurer les objectifs' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { user_id, role, metric, target_value } = body as {
      user_id?: string
      role?: string
      metric?: string
      target_value?: number
    }

    // Validation
    if (!metric || !VALID_METRICS.includes(metric as typeof VALID_METRICS[number])) {
      return NextResponse.json(
        { error: `Metrique invalide. Valeurs acceptees: ${VALID_METRICS.join(', ')}` },
        { status: 400 }
      )
    }
    if (target_value === undefined || target_value === null || typeof target_value !== 'number' || target_value < 0) {
      return NextResponse.json({ error: 'target_value doit etre un nombre positif' }, { status: 400 })
    }
    if (role && !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      return NextResponse.json({ error: 'Role invalide (setter ou closer)' }, { status: 400 })
    }

    const supabase = await createClient()

    // Upsert: check if an objective already exists for this workspace/user/role/metric
    const query = supabase
      .from('team_objectives')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('metric', metric)

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

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('team_objectives')
        .update({ target_value, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[API /workspaces/objectives] UPDATE error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ data })
    } else {
      // Insert
      const { data, error } = await supabase
        .from('team_objectives')
        .insert({
          workspace_id: workspaceId,
          user_id: user_id || null,
          role: role || null,
          metric,
          target_value,
        })
        .select()
        .single()

      if (error) {
        console.error('[API /workspaces/objectives] INSERT error:', error.message)
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
