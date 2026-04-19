import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createDomain } from '@/lib/email/domains'

export async function GET() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('email_domains')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()
  const body = await request.json()
  const domain = body.domain?.trim()?.toLowerCase()

  if (!domain) {
    return NextResponse.json({ error: 'Le domaine est requis' }, { status: 400 })
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('email_domains')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('domain', domain)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Ce domaine est déjà configuré' }, { status: 409 })
  }

  // Register with AWS SES
  const result = await createDomain(domain)
  if (!result.ok || !result.domain) {
    return NextResponse.json({ error: result.error || 'Erreur AWS SES' }, { status: 500 })
  }

  const sesDomain = result.domain
  const dnsRecords = sesDomain.records.map(r => ({
    type: r.type,
    name: r.name,
    value: r.value,
    priority: r.priority,
    status: r.status,
  }))

  const { data, error } = await supabase
    .from('email_domains')
    .insert({
      workspace_id: workspaceId,
      domain,
      // resend_domain_id réutilisé pour stocker l'identité SES (= le domaine)
      resend_domain_id: sesDomain.id,
      status: sesDomain.status === 'verified' ? 'verified' : 'pending',
      dns_records: dnsRecords,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
