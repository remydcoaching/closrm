import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateLeadSchema } from '@/lib/validations/leads'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    // Récupérer les appels liés
    const { data: calls } = await supabase
      .from('calls')
      .select('*')
      .eq('lead_id', id)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    // Récupérer les follow-ups liés
    const { data: followUps } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('lead_id', id)
      .eq('workspace_id', workspaceId)
      .order('scheduled_at', { ascending: true })

    return NextResponse.json({
      data: {
        ...lead,
        calls: calls ?? [],
        follow_ups: followUps ?? [],
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateLeadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Fetch old lead data for trigger comparison
    const { data: oldLead } = await supabase
      .from('leads')
      .select('status, tags')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    const { data, error } = await supabase
      .from('leads')
      .update(parsed.data)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Lead introuvable ou non autorisé' }, { status: 404 })
    }

    // Fire workflow triggers (non-blocking)
    if (oldLead && parsed.data.status && parsed.data.status !== oldLead.status) {
      fireTriggersForEvent(workspaceId, 'lead_status_changed', {
        lead_id: id,
        old_status: oldLead.status,
        new_status: parsed.data.status,
      }).catch(() => {})

      if (parsed.data.status === 'clos') {
        fireTriggersForEvent(workspaceId, 'deal_won', { lead_id: id }).catch(() => {})
      }
    }

    if (oldLead && parsed.data.tags) {
      const oldTags = oldLead.tags || []
      const newTags = parsed.data.tags || []
      const added = newTags.filter((t: string) => !oldTags.includes(t))
      const removed = oldTags.filter((t: string) => !newTags.includes(t))
      for (const tag of added) {
        fireTriggersForEvent(workspaceId, 'tag_added', { lead_id: id, tag }).catch(() => {})
      }
      for (const tag of removed) {
        fireTriggersForEvent(workspaceId, 'tag_removed', { lead_id: id, tag }).catch(() => {})
      }
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

    // Soft delete : on passe le statut à 'dead'
    const { data, error } = await supabase
      .from('leads')
      .update({ status: 'dead' })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Lead introuvable ou non autorisé' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
