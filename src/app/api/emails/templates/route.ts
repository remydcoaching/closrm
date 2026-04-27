import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      workspace_id: workspaceId,
      name: body.name || 'Sans titre',
      subject: body.subject || '',
      blocks: body.blocks || [],
      preview_text: body.preview_text || null,
      preset_id: body.preset_id || 'classique',
      preset_override: body.preset_override || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
