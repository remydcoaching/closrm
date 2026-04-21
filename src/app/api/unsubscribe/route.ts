import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'

/**
 * POST /api/unsubscribe
 *
 * Supporte deux formats d'entrée :
 *   1. Body JSON `{ token }` — appel depuis notre propre page /unsubscribe
 *   2. Query param `?token=...` avec body vide — "one-click" RFC 8058
 *      (Gmail/Yahoo envoient POST body `List-Unsubscribe=One-Click` quand
 *      l'utilisateur clique "Se désabonner" directement depuis la UI mail)
 *
 * Marque le lead comme unsubscribed ET insère une entrée global dans
 * email_suppressions pour bloquer tout envoi futur vers cette adresse,
 * même si le lead est recréé ultérieurement dans un autre workspace.
 */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const queryToken = url.searchParams.get('token')

  let token: string | null = queryToken

  if (!token) {
    try {
      const body = await request.json()
      token = body?.token ?? null
    } catch {
      // body vide = one-click → déjà traité via query
    }
  }

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Marque le lead
  const { data: lead } = await supabase
    .from('leads')
    .update({
      email_unsubscribed: true,
      email_unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', payload.leadId)
    .eq('workspace_id', payload.workspaceId)
    .select('email')
    .single()

  // 2. Désactive les enrollments séquence actifs
  await supabase
    .from('email_sequence_enrollments')
    .update({ status: 'unsubscribed' })
    .eq('lead_id', payload.leadId)
    .eq('status', 'active')

  // 3. Ajoute à la suppression list scopée au workspace pour bloquer
  //    les futurs envois SES (broadcasts, workflows, etc.)
  if (lead?.email) {
    await supabase
      .from('email_suppressions')
      .upsert(
        {
          workspace_id: payload.workspaceId,
          email: lead.email.toLowerCase(),
          reason: 'unsubscribe',
        },
        { onConflict: 'workspace_id,email', ignoreDuplicates: true },
      )
  }

  return NextResponse.json({ ok: true })
}
