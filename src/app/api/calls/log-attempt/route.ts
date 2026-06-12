import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { logCallAttemptSchema } from '@/lib/validations/calls'

/**
 * Logue une tentative d'appel rétroactive (ex: "je viens d'appeler, il a
 * pas décroché"). Distinct de POST /api/calls qui programme un appel futur
 * et change le statut du lead — ici on n'altère pas le statut.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = logCallAttemptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data: lead } = await supabase
      .from('leads')
      .select('id, call_attempts')
      .eq('id', parsed.data.lead_id)
      .eq('workspace_id', workspaceId)
      .single() as { data: { id: string; call_attempts: number } | null }

    if (!lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    const { count } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('lead_id', parsed.data.lead_id)
      .eq('type', 'setting')

    const now = new Date().toISOString()

    const { data: call, error } = await supabase
      .from('calls')
      .insert({
        workspace_id: workspaceId,
        lead_id: parsed.data.lead_id,
        type: 'setting',
        scheduled_at: now,
        outcome: 'done',
        attempt_number: (count ?? 0) + 1,
        reached: parsed.data.reached,
        notes: parsed.data.notes || null,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase
      .from('leads')
      .update({
        call_attempts: (lead.call_attempts ?? 0) + 1,
        last_activity_at: now,
        ...(parsed.data.reached ? { reached: true } : {}),
      })
      .eq('id', parsed.data.lead_id)
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ data: call }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
