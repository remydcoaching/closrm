import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateCallSchema } from '@/lib/validations/calls'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { fireStatusChangeCapi } from '@/lib/meta/capi'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('calls')
      .select('*, lead:leads(*)')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Appel non trouvé' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
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
    const parsed = updateCallSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data: existingCall } = await supabase
      .from('calls').select('*').eq('id', id).eq('workspace_id', workspaceId).single()
    if (!existingCall) return NextResponse.json({ error: 'Appel non trouvé' }, { status: 404 })

    const { data, error } = await supabase
      .from('calls').update(parsed.data).eq('id', id).eq('workspace_id', workspaceId)
      .select('*, lead:leads(id, first_name, last_name, phone, email, status)').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auto-change lead status based on outcome
    if (parsed.data.outcome && parsed.data.outcome !== existingCall.outcome) {
      let newLeadStatus: string | null = null
      if (parsed.data.outcome === 'done' && existingCall.type === 'closing') newLeadStatus = 'clos'
      else if (parsed.data.outcome === 'no_show' && existingCall.type === 'setting') newLeadStatus = 'no_show_setting'
      else if (parsed.data.outcome === 'no_show' && existingCall.type === 'closing') newLeadStatus = 'no_show_closing'
      else if (parsed.data.outcome === 'cancelled') newLeadStatus = 'nouveau'

      if (newLeadStatus) {
        await supabase.from('leads').update({ status: newLeadStatus })
          .eq('id', existingCall.lead_id).eq('workspace_id', workspaceId)

        // Fire CAPI for the resulting lead status change. This path doesn't
        // go through PATCH /api/leads/[id], so the leads route's CAPI handler
        // would miss it. Covers no_show_setting, no_show_closing, clos, and
        // 'nouveau' (no-op since mapStatusToCapiEvent returns null for it).
        const { data: leadForCapi } = await supabase
          .from('leads')
          .select('id, first_name, last_name, email, phone, tags, visitor_id, deal_amount')
          .eq('id', existingCall.lead_id)
          .eq('workspace_id', workspaceId)
          .single() as { data: {
            id: string
            first_name: string | null
            last_name: string | null
            email: string | null
            phone: string | null
            tags: string[] | null
            visitor_id: string | null
            deal_amount: number | null
          } | null }

        if (leadForCapi) {
          const statusForCapi = newLeadStatus
          after(async () => {
            await fireStatusChangeCapi(supabase, workspaceId, leadForCapi, statusForCapi)
          })
        }
      }
    }

    // Fire workflow triggers (non-blocking)
    if (parsed.data.outcome && parsed.data.outcome !== existingCall.outcome) {
      fireTriggersForEvent(workspaceId, 'call_outcome_logged', {
        lead_id: existingCall.lead_id,
        call_id: id,
        outcome: parsed.data.outcome,
      }).catch(() => {})

      if (parsed.data.outcome === 'no_show') {
        fireTriggersForEvent(workspaceId, 'call_no_show', {
          lead_id: existingCall.lead_id,
          call_id: id,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
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

    const { data, error } = await supabase
      .from('calls').delete().eq('id', id).eq('workspace_id', workspaceId).select().single()
    if (error || !data) return NextResponse.json({ error: 'Appel non trouvé' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
