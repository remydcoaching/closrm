import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { sendPushToWorkspace, type PushType } from '@/lib/push/send-to-workspace'

/**
 * Endpoint de test pour vérifier la fiabilité des push notifications.
 * Déclenche une notif réelle vers le workspace de l'utilisateur authentifié.
 *
 * Usage : POST /api/test/push?type=new_lead
 *   - type (default 'new_lead'): n'importe quel PushType
 *
 * Réponse : { ok, type, workspaceId, t } — la notif arrive sur les tokens
 * encore valides. Les tokens morts sont auto-purgés par le helper.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const type = (request.nextUrl.searchParams.get('type') ?? 'new_lead') as PushType
    const now = new Date().toLocaleTimeString('fr-FR')

    await sendPushToWorkspace({
      workspaceId,
      type,
      title: type === 'new_lead' ? '🟢 Test — Nouveau prospect' : `🔔 Test — ${type}`,
      body: `Notification test envoyée à ${now}. Si tu lis ça, le push fonctionne.`,
      data: { entity_type: 'lead', entity_id: 'test-id', test: true },
    })

    return NextResponse.json({
      ok: true,
      type,
      workspaceId,
      sent_at: new Date().toISOString(),
      hint: 'Vérifie les logs Vercel pour les tickets Expo (errors, purged tokens).',
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur', details: String(err) }, { status: 500 })
  }
}
