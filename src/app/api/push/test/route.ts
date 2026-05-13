import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { sendPushToWorkspace } from '@/lib/push/send-to-workspace'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()

    await sendPushToWorkspace({
      workspaceId,
      type: 'new_lead',
      title: 'Nouveau lead',
      body: 'Jean Dupont vient d\'arriver via Facebook Ads.',
      data: { entity_type: 'lead', entity_id: '00000000-0000-0000-0000-000000000000' },
    })

    return NextResponse.json({ ok: true, message: 'Push envoyé' })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 },
    )
  }
}
