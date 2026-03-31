import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { sendBatch, type BatchRecipient } from '@/lib/email/batch-sender'
import { compileBlocks } from '@/lib/email/compiler'
import { resolveTemplate } from '@/lib/workflows/variables'
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

  // Get domain config
  const { data: domains } = await supabase
    .from('email_domains')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'verified')
    .limit(1)

  const domain = domains?.[0]
  const fromEmail = domain?.default_from_email || 'noreply@closrm.com'
  const fromName = domain?.default_from_name || 'ClosRM'

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

  // Send batch
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    await supabase.from('email_broadcasts').update({ status: 'failed' }).eq('id', id)
    return NextResponse.json({ error: 'RESEND_API_KEY non configuré' }, { status: 500 })
  }

  const result = await sendBatch(
    { apiKey, fromEmail, fromName },
    recipients,
  )

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
