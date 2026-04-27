import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('email_broadcasts')
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

  // Accepte soit un template_id, soit body_html/body_text direct (email libre)
  if (!body.template_id && !body.body_html && !body.body_text) {
    return NextResponse.json(
      { error: 'Un template OU un contenu (body) est requis' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('email_broadcasts')
    .insert({
      workspace_id: workspaceId,
      name: body.name || 'Nouvelle campagne',
      template_id: body.template_id || null,
      body_html: body.body_html || null,
      body_text: body.body_text || null,
      subject: body.subject || null,
      filters: body.filters || {},
      status: 'draft',
      scheduled_at: body.scheduled_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
