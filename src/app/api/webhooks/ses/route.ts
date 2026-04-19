/**
 * AWS SES events webhook (via SNS).
 *
 * Setup côté AWS :
 *   1. Créer un Configuration Set SES (ex: "closrm-default")
 *   2. Créer un topic SNS et l'attacher au config set pour ces évents :
 *      - Bounce, Complaint, Delivery, Open, Click, Reject, RenderingFailure
 *   3. Créer une subscription HTTPS du topic vers cette URL.
 *      AWS enverra d'abord un SubscriptionConfirmation que ce handler valide
 *      automatiquement en faisant GET sur SubscribeURL.
 *
 * SNS payload format :
 *   { Type: 'Notification', Message: '<json string>', ... }
 *   Le Message contient un payload SES avec eventType + mail.messageId.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

interface SnsEnvelope {
  Type?: string
  Message?: string
  SubscribeURL?: string
  Token?: string
  TopicArn?: string
}

interface SesNotification {
  eventType?: string // Bounce | Complaint | Delivery | Open | Click | Reject
  notificationType?: string // legacy SES notif format
  mail?: {
    messageId?: string
  }
}

export async function POST(request: Request) {
  // Le content-type peut être text/plain (par défaut SNS)
  const text = await request.text()
  let envelope: SnsEnvelope
  try {
    envelope = JSON.parse(text) as SnsEnvelope
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Handshake d'abonnement SNS : on doit GET la SubscribeURL pour confirmer
  if (envelope.Type === 'SubscriptionConfirmation' && envelope.SubscribeURL) {
    try {
      await fetch(envelope.SubscribeURL, { method: 'GET' })
    } catch (err) {
      console.error('[ses webhook] SNS subscription confirmation failed', err)
    }
    return NextResponse.json({ ok: true })
  }

  if (envelope.Type !== 'Notification' || !envelope.Message) {
    return NextResponse.json({ ok: true })
  }

  let notif: SesNotification
  try {
    notif = JSON.parse(envelope.Message) as SesNotification
  } catch {
    return NextResponse.json({ ok: true })
  }

  const eventType = notif.eventType || notif.notificationType
  const messageId = notif.mail?.messageId
  if (!eventType || !messageId) {
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceClient()

  // On stocke le SES MessageId dans la même colonne resend_email_id (legacy)
  const { data: send } = await supabase
    .from('email_sends')
    .select('id')
    .eq('resend_email_id', messageId)
    .single()

  if (!send) {
    return NextResponse.json({ ok: true })
  }

  const now = new Date().toISOString()

  switch (eventType) {
    case 'Delivery':
      await supabase.from('email_sends').update({ status: 'delivered' }).eq('id', send.id)
      break
    case 'Open':
      await supabase
        .from('email_sends')
        .update({ status: 'opened', opened_at: now })
        .eq('id', send.id)
      break
    case 'Click':
      await supabase
        .from('email_sends')
        .update({ status: 'clicked', clicked_at: now })
        .eq('id', send.id)
      break
    case 'Bounce':
      await supabase
        .from('email_sends')
        .update({ status: 'bounced', bounced_at: now })
        .eq('id', send.id)
      break
    case 'Complaint':
      await supabase.from('email_sends').update({ status: 'complained' }).eq('id', send.id)
      break
    case 'Reject':
      await supabase.from('email_sends').update({ status: 'bounced', bounced_at: now }).eq('id', send.id)
      break
  }

  return NextResponse.json({ ok: true })
}
