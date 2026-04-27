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
import { isAllowedSnsTopic } from '@/lib/email/sns-verify'

interface SnsEnvelope {
  Type?: string
  Message?: string
  SubscribeURL?: string
  Token?: string
  TopicArn?: string
}

interface SesBouncedRecipient {
  emailAddress?: string
  status?: string
  action?: string
  diagnosticCode?: string
}

interface SesNotification {
  eventType?: string // Bounce | Complaint | Delivery | Open | Click | Reject
  notificationType?: string // legacy SES notif format
  mail?: {
    messageId?: string
  }
  bounce?: {
    bounceType?: string // Permanent | Transient | Undetermined
    bounceSubType?: string
    bouncedRecipients?: SesBouncedRecipient[]
  }
  complaint?: {
    complainedRecipients?: { emailAddress?: string }[]
    complaintFeedbackType?: string
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

  // Filtrage TopicArn en defense-en-profondeur (voir sns-verify.ts)
  if (!isAllowedSnsTopic(envelope)) {
    console.warn('[ses webhook] rejected unknown TopicArn', envelope.TopicArn)
    return NextResponse.json({ ok: false, error: 'unknown topic' }, { status: 403 })
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
    .select('id, workspace_id')
    .eq('resend_email_id', messageId)
    .single()

  const now = new Date().toISOString()

  // Ajoute à la suppression list si bounce permanent ou complaint.
  // Si on ne retrouve pas le send (ex: email envoyé avant instrumentation),
  // on stocke quand même en suppression globale pour protéger la réputation.
  async function addSuppressions(
    recipients: { emailAddress?: string; diagnosticCode?: string }[],
    reason: 'bounce' | 'complaint',
    bounceType?: string,
    bounceSubType?: string,
  ) {
    const rows = recipients
      .map((r) => r.emailAddress?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e))
      .map((email, idx) => ({
        workspace_id: send?.workspace_id ?? null,
        email,
        reason,
        bounce_type: bounceType ?? null,
        bounce_subtype: bounceSubType ?? null,
        diagnostic: recipients[idx]?.diagnosticCode ?? null,
        ses_message_id: messageId,
      }))
    if (rows.length === 0) return
    // Insert simple : la contrainte unique est sur une expression
    // (COALESCE(workspace_id::text,'global'), lower(email)) donc onConflict
    // ne peut pas la cibler via PostgREST. On insert et on ignore les doublons.
    const { error } = await supabase.from('email_suppressions').insert(rows)
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.error('[ses webhook] suppression insert failed', error)
    }
  }

  if (send) {
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
        await supabase
          .from('email_sends')
          .update({ status: 'bounced', bounced_at: now })
          .eq('id', send.id)
        break
    }
  }

  // Suppressions : dans tous les cas, même si on ne retrouve pas le send local.
  if (eventType === 'Bounce' && notif.bounce?.bounceType === 'Permanent') {
    await addSuppressions(
      notif.bounce.bouncedRecipients || [],
      'bounce',
      notif.bounce.bounceType,
      notif.bounce.bounceSubType,
    )
  } else if (eventType === 'Complaint') {
    await addSuppressions(notif.complaint?.complainedRecipients || [], 'complaint')
  }

  return NextResponse.json({ ok: true })
}
