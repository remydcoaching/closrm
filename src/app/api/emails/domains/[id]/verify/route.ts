import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { verifyDomain } from '@/lib/email/domains'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: domain } = await supabase
    .from('email_domains')
    .select('resend_domain_id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (!domain?.resend_domain_id) {
    return NextResponse.json({ error: 'Domaine introuvable' }, { status: 404 })
  }

  const result = await verifyDomain(domain.resend_domain_id)
  if (!result.ok || !result.domain) {
    return NextResponse.json({ error: result.error || 'Erreur de vérification' }, { status: 500 })
  }

  const resendStatus = result.domain.status
  const status = resendStatus === 'verified' ? 'verified'
    : resendStatus === 'failed' ? 'failed'
    : 'pending'

  const dnsRecords = result.domain.records.map(r => ({
    type: r.type,
    name: r.name,
    value: r.value,
    priority: r.priority,
    status: r.status,
  }))

  const { data, error } = await supabase
    .from('email_domains')
    .update({ status, dns_records: dnsRecords })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
