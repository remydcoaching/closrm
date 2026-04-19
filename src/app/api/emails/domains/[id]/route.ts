import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { deleteDomain as deleteResendDomain } from '@/lib/email/domains'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('email_domains')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Domaine introuvable' }, { status: 404 })
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()
  const body = await request.json()

  const { data: existing } = await supabase
    .from('email_domains')
    .select('domain, status')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Domaine introuvable' }, { status: 404 })
  }

  if (existing.status !== 'verified') {
    return NextResponse.json(
      { error: 'Le domaine doit être vérifié avant de définir un expéditeur par défaut.' },
      { status: 400 },
    )
  }

  const updates: Record<string, string> = {}
  if (body.default_from_email !== undefined) {
    const email = String(body.default_from_email).trim().toLowerCase()
    if (email && !email.endsWith(`@${existing.domain}`)) {
      return NextResponse.json(
        { error: `L'email expéditeur doit utiliser le domaine @${existing.domain}.` },
        { status: 400 },
      )
    }
    updates.default_from_email = email
  }
  if (body.default_from_name !== undefined) {
    updates.default_from_name = String(body.default_from_name).trim()
  }

  const { data, error } = await supabase
    .from('email_domains')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: domain } = await supabase
    .from('email_domains')
    .select('resend_domain_id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (!domain) {
    return NextResponse.json({ error: 'Domaine introuvable' }, { status: 404 })
  }

  if (domain.resend_domain_id) {
    await deleteResendDomain(domain.resend_domain_id)
  }

  const { error } = await supabase
    .from('email_domains')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
