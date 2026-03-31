import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateIntegrationSchema } from '@/lib/validations/integrations'
import { encrypt } from '@/lib/crypto'

const VALID_TYPES = ['google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Type d\'intégration invalide' }, { status: 400 })
    }

    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('id, type, credentials_encrypted, is_active, connected_at')
      .eq('workspace_id', workspaceId)
      .eq('type', type)
      .single()

    if (error || !integration) {
      return NextResponse.json({
        data: {
          id: null,
          type,
          is_active: false,
          connected_at: null,
          has_credentials: false,
        },
      })
    }

    return NextResponse.json({
      data: {
        id: integration.id,
        type: integration.type,
        is_active: integration.is_active,
        connected_at: integration.connected_at,
        has_credentials: !!integration.credentials_encrypted,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Type d\'intégration invalide' }, { status: 400 })
    }

    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateIntegrationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (parsed.data.is_active !== undefined) {
      updatePayload.is_active = parsed.data.is_active
    }
    if (parsed.data.credentials) {
      updatePayload.credentials_encrypted = encrypt(JSON.stringify(parsed.data.credentials))
    }

    const { data, error } = await supabase
      .from('integrations')
      .update(updatePayload)
      .eq('workspace_id', workspaceId)
      .eq('type', type)
      .select('id, type, is_active, connected_at')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Intégration non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Type d\'intégration invalide' }, { status: 400 })
    }

    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('integrations')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('type', type)
      .select('id, type')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Intégration non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
