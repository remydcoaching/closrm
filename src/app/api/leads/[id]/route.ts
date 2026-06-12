import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateLeadSchema } from '@/lib/validations/leads'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { sendPushToWorkspace } from '@/lib/push/send-to-workspace'
import { getNextCloser } from '@/lib/team/round-robin'
import { resolveMetaPixelForLead } from '@/lib/meta/pixel-resolver'
import { sendCapiEventForLead } from '@/lib/meta/capi'

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
    const { workspaceId, role } = await getWorkspaceId()
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

    // Round-robin: auto-assign closer when status changes to closing_planifie
    // Only if no assigned_to was specified AND the user is not an admin (admins assign manually)
    if (
      parsed.data.status === 'closing_planifie' &&
      !parsed.data.assigned_to &&
      !data.assigned_to &&
      role !== 'admin'
    ) {
      const nextCloser = await getNextCloser(workspaceId)
      if (nextCloser) {
        await supabase
          .from('leads')
          .update({ assigned_to: nextCloser })
          .eq('id', id)
          .eq('workspace_id', workspaceId)
        // Update returned data so the response reflects the assignment
        data.assigned_to = nextCloser
      }
    }

    // Fire workflow triggers (non-blocking)
    if (oldLead && parsed.data.status && parsed.data.status !== oldLead.status) {
      fireTriggersForEvent(workspaceId, 'lead_status_changed', {
        lead_id: id,
        old_status: oldLead.status,
        new_status: parsed.data.status,
      }).catch(() => {})

      // Server-side CAPI: when the coach marks a lead as setting_planifie
      // or closing_planifie, they're saying "this one is a real prospect".
      // Send a Lead event so Meta's algo learns who to target.
      if (parsed.data.status === 'setting_planifie' || parsed.data.status === 'closing_planifie') {
        after(async () => {
          try {
            const pixel = await resolveMetaPixelForLead(supabase, workspaceId, {
              id: data.id,
              tags: data.tags,
              visitor_id: data.visitor_id ?? null,
            })
            if (!pixel) return
            await sendCapiEventForLead(
              supabase,
              workspaceId,
              pixel.pixelId,
              {
                id: data.id,
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                phone: data.phone,
              },
              'Lead',
              {
                lead_event_source: 'crm_manual_qualification',
                status: parsed.data.status,
              },
            )
          } catch (err) {
            console.error('[capi-lead-qualified] non-blocking error', err)
          }
        })
      }

      // Push : closing assigné au closer désigné
      if (parsed.data.status === 'closing_planifie' && data.assigned_to) {
        const fullName = `${data.first_name} ${data.last_name}`.trim() || 'Nouveau lead'
        void sendPushToWorkspace({
          workspaceId,
          type: 'closing_assigned',
          title: 'Nouveau closing',
          body: `${fullName} — closing à planifier`,
          data: { entity_type: 'lead', entity_id: id },
          userIds: [data.assigned_to],
        })
      }

      if (parsed.data.status === 'clos') {
        fireTriggersForEvent(workspaceId, 'deal_won', { lead_id: id }).catch(() => {})

        // Push deal_won : tous les membres du workspace (sauf désactivé)
        const fullName = `${data.first_name} ${data.last_name}`.trim() || 'Lead'
        const amount = data.deal_amount
          ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.deal_amount)
          : null
        void sendPushToWorkspace({
          workspaceId,
          type: 'deal_won',
          title: '🎉 Deal closé',
          body: amount ? `${fullName} · ${amount}` : `${fullName}`,
          data: { entity_type: 'lead', entity_id: id },
        })

        // Server-side CAPI Purchase event. Carries the deal_amount so
        // Meta's algo learns from your actual revenue, not just lead count.
        after(async () => {
          try {
            const pixel = await resolveMetaPixelForLead(supabase, workspaceId, {
              id: data.id,
              tags: data.tags,
              visitor_id: data.visitor_id ?? null,
            })
            if (!pixel) return
            await sendCapiEventForLead(
              supabase,
              workspaceId,
              pixel.pixelId,
              {
                id: data.id,
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                phone: data.phone,
              },
              'Purchase',
              {
                value: data.deal_amount ?? undefined,
                currency: 'EUR',
                content_name: 'Coaching',
              },
            )
          } catch (err) {
            console.error('[capi-purchase] non-blocking error', err)
          }
        })

        // AI self-learning: record winning conversation outcome (non-blocking)
        Promise.resolve(
          supabase
            .from('ig_conversations')
            .select('id')
            .eq('lead_id', id)
            .eq('workspace_id', workspaceId)
            .limit(1)
            .single()
        ).then(({ data: conv }) => {
          if (conv) {
            import('@/lib/ai/brief').then(({ recordOutcome }) => {
              recordOutcome(workspaceId, conv.id, id, 'won').catch(() => {})
            })
          }
        }).catch(() => {})
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

    // Delete related data first (follow-ups, calls, ig_conversations link)
    await supabase.from('follow_ups').delete().eq('lead_id', id).eq('workspace_id', workspaceId)
    await supabase.from('calls').delete().eq('lead_id', id).eq('workspace_id', workspaceId)
    await supabase.from('ig_conversations').update({ lead_id: null }).eq('lead_id', id).eq('workspace_id', workspaceId)

    // Hard delete the lead
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) {
      return NextResponse.json({ error: 'Lead introuvable ou non autorise' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
