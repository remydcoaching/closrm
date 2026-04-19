import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { sendBatch, type BatchRecipient } from '@/lib/email/batch-sender'
import { getWorkspaceSenderConfig } from '@/lib/email/sender-config'
import { compileBlocks } from '@/lib/email/compiler'
import { resolveTemplate } from '@/lib/workflows/variables'
import { consumeResource } from '@/lib/billing/service'
import { getQuotaInfo } from '@/lib/billing/quota'
import type { EmailBroadcastFilters, EmailBlock, Lead } from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  // Get broadcast
  const { data: broadcast } = await supabase
    .from('email_broadcasts')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (!broadcast) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
  if (broadcast.status === 'sent') return NextResponse.json({ error: 'Déjà envoyé' }, { status: 400 })

  // Get template
  const { data: template } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', broadcast.template_id)
    .single()

  if (!template) return NextResponse.json({ error: 'Template introuvable' }, { status: 404 })

  // Get sender config (workspace custom domain or fallback)
  const { fromEmail, fromName } = await getWorkspaceSenderConfig(workspaceId)

  // Get coach name
  const { data: user } = await supabase
    .from('users')
    .select('full_name')
    .eq('workspace_id', workspaceId)
    .limit(1)
    .single()

  // Get target leads
  const filters: EmailBroadcastFilters = broadcast.filters || {}
  let query = supabase
    .from('leads')
    .select('id, first_name, last_name, email, phone')
    .eq('workspace_id', workspaceId)
    .eq('email_unsubscribed', false)
    .not('email', 'is', null)

  if (filters.statuses?.length) query = query.in('status', filters.statuses)
  if (filters.sources?.length) query = query.in('source', filters.sources)
  if (filters.tags?.length) query = query.overlaps('tags', filters.tags)
  if (filters.date_from) query = query.gte('created_at', filters.date_from)
  if (filters.date_to) query = query.lte('created_at', filters.date_to)
  if (filters.reached === 'true') query = query.eq('reached', true)
  if (filters.reached === 'false') query = query.eq('reached', false)

  const { data: leads } = await query
  if (!leads?.length) {
    return NextResponse.json({ error: 'Aucun destinataire trouvé' }, { status: 400 })
  }

  // Pre-check quota broadcast (avant d'envoyer, on vérifie qu'on a la
  // disponibilité). Si quota + wallet insuffisant pour N emails, on refuse.
  const quotaInfo = await getQuotaInfo(workspaceId, 'email')
  if (quotaInfo && quotaInfo.plan_id !== 'internal') {
    const emailsNeeded = leads.length
    const freeFromQuota = Math.min(quotaInfo.quota_remaining, emailsNeeded)
    const overage = emailsNeeded - freeFromQuota
    if (overage > 0) {
      // Fair-use cap check
      if (quotaInfo.fair_use_cap && quotaInfo.quota_used + emailsNeeded > quotaInfo.fair_use_cap) {
        return NextResponse.json({
          error: `Fair-use dépassé (${quotaInfo.fair_use_cap} emails/mois sur votre plan). Passez en Scale pour envoyer ce broadcast.`,
        }, { status: 402 })
      }
      // Estimation coût wallet
      const costCents = Math.ceil(overage * quotaInfo.overage_price_cents_per_1k / 1000)
      const { data: ws } = await supabase
        .from('workspaces')
        .select('wallet_balance_cents')
        .eq('id', workspaceId)
        .single()
      if (!ws || ws.wallet_balance_cents < costCents) {
        return NextResponse.json({
          error: `Solde wallet insuffisant pour l'overage. Besoin de ${(costCents / 100).toFixed(2)}€, vous avez ${((ws?.wallet_balance_cents || 0) / 100).toFixed(2)}€. Rechargez votre wallet.`,
        }, { status: 402 })
      }
    }
  }

  // Update broadcast status
  await supabase
    .from('email_broadcasts')
    .update({ status: 'sending', total_count: leads.length })
    .eq('id', id)

  // Compile template for each lead
  const baseHtml = compileBlocks(template.blocks as EmailBlock[], template.preview_text)
  const subject = broadcast.subject || template.subject || 'Sans sujet'

  const recipients: BatchRecipient[] = leads.map((lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'>) => {
    const resolvedHtml = resolveTemplate(baseHtml, {
      lead: { first_name: lead.first_name, last_name: lead.last_name, email: lead.email, phone: lead.phone },
      coach: { full_name: user?.full_name || '' },
    })
    const resolvedSubject = resolveTemplate(subject, {
      lead: { first_name: lead.first_name, last_name: lead.last_name, email: lead.email, phone: lead.phone },
    })
    return {
      leadId: lead.id,
      workspaceId,
      email: lead.email!,
      htmlBody: resolvedHtml,
      subject: resolvedSubject,
    }
  })

  // Send batch via AWS SES
  if (!process.env.AWS_ACCESS_KEY_ID) {
    await supabase.from('email_broadcasts').update({ status: 'failed' }).eq('id', id)
    return NextResponse.json({ error: 'AWS SES non configuré' }, { status: 500 })
  }

  const result = await sendBatch(
    { fromEmail, fromName },
    recipients,
  )

  // Débit wallet + log usage event pour les emails effectivement envoyés
  if (result.sent > 0) {
    await consumeResource({
      workspaceId,
      resourceType: 'email',
      quantity: result.sent,
      source: 'broadcast',
      metadata: { broadcast_id: id, template_id: broadcast.template_id },
    })
  }

  // Log sends
  const sendLogs = result.results
    .filter(r => r.resendEmailId)
    .map(r => ({
      workspace_id: workspaceId,
      lead_id: r.leadId,
      broadcast_id: id,
      template_id: broadcast.template_id,
      resend_email_id: r.resendEmailId,
      status: 'sent',
      subject,
      from_email: fromEmail,
    }))

  if (sendLogs.length) {
    await supabase.from('email_sends').insert(sendLogs)
  }

  // Update broadcast
  await supabase
    .from('email_broadcasts')
    .update({
      status: 'sent',
      sent_count: result.sent,
      sent_at: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({
    sent: result.sent,
    failed: result.failed,
    total: leads.length,
  })
}
