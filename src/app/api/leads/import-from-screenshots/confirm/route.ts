import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { confirmImportSchema } from '@/lib/validations/instagram-import'

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = confirmImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { handles, create_follow_up, follow_up_delay_days, follow_up_reason } = parsed.data

    const leadsToInsert = handles.map((handle) => ({
      workspace_id: workspaceId,
      status: 'nouveau' as const,
      call_attempts: 0,
      reached: false,
      first_name: handle,
      last_name: '',
      phone: '',
      email: null,
      source: 'follow_ads' as const,
      instagram_handle: handle,
      tags: [],
      notes: null,
      assigned_to: userId,
    }))

    const { data: createdLeads, error } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const leadIds = (createdLeads ?? []).map((l) => l.id)
    let followUpsCreated = 0

    if (create_follow_up && leadIds.length > 0) {
      const scheduledAt = new Date()
      scheduledAt.setDate(scheduledAt.getDate() + follow_up_delay_days)
      scheduledAt.setHours(10, 0, 0, 0)

      const followUpsToInsert = leadIds.map((leadId) => ({
        workspace_id: workspaceId,
        lead_id: leadId,
        reason: follow_up_reason,
        scheduled_at: scheduledAt.toISOString(),
        channel: 'instagram_dm' as const,
        status: 'en_attente' as const,
        notes: null,
      }))

      const { error: fuError, count } = await supabase
        .from('follow_ups')
        .insert(followUpsToInsert, { count: 'exact' })

      if (!fuError) followUpsCreated = count ?? followUpsToInsert.length
    }

    return NextResponse.json({
      created: leadIds.length,
      follow_ups_created: followUpsCreated,
      lead_ids: leadIds,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /leads/import-from-screenshots/confirm] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
