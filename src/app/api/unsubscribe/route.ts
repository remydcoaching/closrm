import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'

export async function POST(request: Request) {
  const body = await request.json()
  const token = body.token

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('leads')
    .update({
      email_unsubscribed: true,
      email_unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', payload.leadId)
    .eq('workspace_id', payload.workspaceId)

  if (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  await supabase
    .from('email_sequence_enrollments')
    .update({ status: 'unsubscribed' })
    .eq('lead_id', payload.leadId)
    .eq('status', 'active')

  return NextResponse.json({ ok: true })
}
