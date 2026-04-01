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

  const updates: Record<string, string> = {}
  if (body.default_from_email !== undefined) updates.default_from_email = body.default_from_email
  if (body.default_from_name !== undefined) updates.default_from_name = body.default_from_name

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
